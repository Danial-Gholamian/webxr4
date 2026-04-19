import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel';
import { completeResetGraph } from './main';

/**
 * HistogramGauge
 *
 * Interactive temporal histogram component.
 *
 * Based directly on the updated functional version.
 * Preserves:
 *  - Scale
 *  - Position
 *  - Rotation
 *  - Highlight window logic
 *
 * Responsibilities:
 *  - Render histogram bars
 *  - Render highlight window
 *  - Render time label
 *  - React to controller time updates
 *  - Emit bucket selection when clicked
 */
export class HistogramGauge {
  constructor({
    bins,
    globalStart,
    globalDuration,
    width = 1.5,
    maxHeight = 0.2,
    onBucketSelected = null
  }) {
    this.globalStart = globalStart;
    this.globalDuration = globalDuration;
    this.width = width;
    this.maxHeight = maxHeight;
    this.onBucketSelected = onBucketSelected;

    this.group = new THREE.Group();
    this.binMeshes = [];

    this.tooltip = null;

    this._buildHistogram(bins);
    this._buildBackground()
    this._buildHighlightWindow();
    this._buildLabel();
    this._resetWindow()
    this.currentWindowSize = globalDuration; // default

    // Increase the scale of the histogram
    this.group.scale.set(1.3, 1.3, 1.3);

    // Position relative to cameraGroup (shoulder-docked)
    this.group.position.set(0, -0.15, -1.5);

    // Tilt the histogram toward the user
    // this.group.rotation.y = -Math.PI / 2.95;
  }

  /**
   * Return root object for scene insertion.
   */
  getObject3D() {
    return this.group;
  }

  _buildBackground() {
    const bg = new THREE.Mesh(
      new THREE.PlaneGeometry(this.width + 0.1, this.maxHeight + 0.25),
      new THREE.MeshBasicMaterial({
        color: 0x000000,
        transparent: true,
        opacity: 0.6,
        depthWrite: false
      })
    );

    bg.position.set(0, this.maxHeight / 2, -0.02);
    bg.renderOrder = -1;

    this.group.add(bg);
  }

  /**
   * Build histogram bars from bins.
   */
  _buildHistogram(bins) {
    const maxBinCount = Math.max(...bins) || 1;
    this.numBins = bins.length;
    const binWidth = this.width / this.numBins;
    const binDepth = 0.05;

    const barsGroup = new THREE.Group();

    bins.forEach((count, i) => {
      if (count === 0) return;

      // Normalize height relative to max bin
      const h = (count / maxBinCount) * this.maxHeight;

      // Color gradient (green → red)
      const color = new THREE.Color().setHSL(
        0.3 - (0.3 * (count / maxBinCount)),
        1.0,
        0.5
      );

      const barMat = new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity: 0.8,
      });

      const barGeom = new THREE.BoxGeometry(
        binWidth * 1,
        h,
        binDepth
      );

      const barMesh = new THREE.Mesh(barGeom, barMat);

      // Store bin index for interaction mapping including tool tip
      barMesh.userData = {
        type: "histogramBar",
        binIndex: i,
        count: count,
        parent: this
      };

      // Position bars along X
      barMesh.position.x =
        (-this.width / 2) + (i * binWidth) + (binWidth / 2);

      // Center vertically so base rests at y = 0
      barMesh.position.y = h / 2;

      // This makes the bars clickable and interactive
      // barMesh.userData = {
      //   isInteractable: true,
      //   isHistogramBar: true,
      //   onClick: () => {
      //     this._handleBarClick(i, numBins);
      //   }
      // };

      const edges = new THREE.EdgesGeometry(barGeom);

      const outline = new THREE.LineSegments(
        edges,
        new THREE.LineBasicMaterial({
          color: 0x000000,
          transparent: true,
          opacity: 0.35
        })
      );

      barMesh.add(outline);

      barsGroup.add(barMesh);
      this.binMeshes.push(barMesh);
    });

    this.group.add(barsGroup);
  }

  createTooltip(text) {
    const label = createCapsuleLabel(text, {
      fontSize: 40,
      color: 0x000000,
      textColor: "#ffffff",
      opacity: 0.85
    });

    label.renderOrder = 9999;

    return label;
  }


  getBinRange(binIndex) {
    const binSize = this.globalDuration / this.numBins;

    const start = Math.floor(this.globalStart + binIndex * binSize);
    const end = Math.floor(start + binSize);

    return { start, end };
  }


  /**
   * Build translucent highlight window.
   * This visually represents the selected bucket.
   */
  _buildHighlightWindow() {
    const windowGeom = new THREE.BoxGeometry(
      this.width,
      this.maxHeight * 1.1,
      0.075
    );

    const windowMat = new THREE.MeshBasicMaterial({
      color: 0x00ff00,
      transparent: true,
      opacity: 0.3,
      depthWrite: false
    });

    this.highlightWindow = new THREE.Mesh(windowGeom, windowMat);

    // Start with zero width
    this.highlightWindow.scale.x = 1;
    this.highlightWindow.position.x = 0;
    this.highlightWindow.renderOrder = 10;
    // Vertically center it
    this.highlightWindow.position.y = this.maxHeight / 2;

    this.group.add(this.highlightWindow);
  }

  /**
   * Build the text label displayed below the histogram.
   */
  _buildLabel() {
    this.label = createCapsuleLabel('All Time', {
      fontSize: 48,
      color: 0x00ff00,
      textColor: "#00ff00",
      opacity: 0.0 // transparent background, text only
    });

    this.label.position.set(0, -0.12, 0.01);
    this.label.traverse((child) => {
      if (child.isMesh && child.material) {
        child.renderOrder = 999;
        child.material.depthTest = false;
        child.material.depthWrite = false;
      }
    });
    this.group.add(this.label);
  }

  _resetWindow() {
    this.resetButton = createCapsuleLabel('Reset', {
      fontSize: 48,
      color: 0x882222,
      hoverColor: 0xaa4444,
      opacity: 0.75,
      onClick: () => { completeResetGraph() }
    })

    this.resetButton.position.set(0, -0.3, 0.01);
    this.group.add(this.resetButton);
  }

  /**
   * Called by GraphVisualController when active bucket changes.
   * Updates highlight window and label.
   */
  onTimeChange(bucket) {
    if (!bucket) {
      this.reset();
      return;
    }
    this.currentWindowSize = bucket.end - bucket.start;

    const startRatio =
      (bucket.start - this.globalStart) / this.globalDuration;

    const widthRatio =
      (bucket.end - bucket.start) / this.globalDuration;

    const clampedStart = Math.max(0, Math.min(startRatio, 1));
    const clampedWidth = Math.max(0, Math.min(widthRatio, 1));

    // Resize highlight window
    this.highlightWindow.scale.x = clampedWidth;

    const actualWidth = this.width * clampedWidth;

    // Position highlight correctly
    this.highlightWindow.position.x =
      (-this.width / 2) +
      (this.width * clampedStart) +
      (actualWidth / 2);

    // Update label
    this.group.remove(this.label);

    this.label = createCapsuleLabel(
      `${bucket.start} - ${bucket.end}`,
      {
        fontSize: 48,
        color: 0x00ff00,
        textColor: "#00ff00",
        opacity: 0.0
      }
    );

    this.label.position.set(0, -0.12, 0.01);
    this.label.traverse((child) => {
      if (child.isMesh && child.material) {
        child.renderOrder = 999;
        child.material.depthTest = false;
        child.material.depthWrite = false;
      }
    });

    this.group.add(this.label);
  }

  /**
   * Reset histogram to full-range default state.
   * Highlight spans entire histogram.
   */
  reset(windowSize = this.currentWindowSize) {

    const widthRatio = windowSize / this.globalDuration;

    this.highlightWindow.scale.x = widthRatio;

    const startRatio = 0; // reset to beginning

    const actualWidth = this.width * widthRatio;

    this.highlightWindow.position.x =
      (-this.width / 2) +
      (this.width * startRatio) +
      (actualWidth / 2);

    // Reset label
    this.group.remove(this.label);

    this.label = createCapsuleLabel(
      `${this.globalStart} - ${this.globalStart + windowSize}`,
      {
        fontSize: 48,
        color: 0x00ff00,
        textColor: "#00ff00",
        opacity: 0.0
      }
    );

    this.label.position.set(0, -0.12, 0.01);

    this.group.add(this.label);
  }
  resetHistogram() {
    this.reset()
    // re initialize the variables

  }

  _buildRemoteWindow(id) {

    const hash = id.split('').reduce((a, b) => { a = ((a << 5) - a) + b.charCodeAt(0); return a & a; }, 0);
    const hue = (Math.abs(hash) % 30) / 360;

    const geom = new THREE.BoxGeometry(this.width, this.maxHeight * 1.05, 0.08);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color().setHSL(hue, 0.8, 0.5), // Vibrant Red/Orange
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      side: THREE.DoubleSide
    });

    const mesh = new THREE.Mesh(geom, mat);
    mesh.position.y = this.maxHeight / 2;
    mesh.position.z = 0.06;
    mesh.renderOrder = 20;
    this.group.add(mesh);

    return mesh;
  }

  _buildRemoteLabel(color) {
    const remoteLabel = createCapsuleLabel('All Time', {
      fontSize: 48,
      color: 0x00ff00,
      textColor: color,
      opacity: 0.0 // transparent background, text only
    });

    remoteLabel.position.set(0, -0.12, 0.01);
    remoteLabel.traverse((child) => {
      if (child.isMesh && child.material) {
        child.renderOrder = 999;
        child.material.depthTest = false;
        child.material.depthWrite = false;
      }
    });
    return remoteLabel
  }

  updateRemoteWindow(id, start, end) {
    if (!this.remoteWindows) this.remoteWindows = {};

    if (!this.remoteWindows[id]) {
      const mesh = this._buildRemoteWindow(id);
      const label = this._buildRemoteLabel(`#${mesh.material.color.getHexString()}`);
      console.log("------------------", mesh.material.color)

      this.group.add(label);

      this.remoteWindows[id] = {
        mesh,
        label
      };
    }

    const { mesh, label } = this.remoteWindows[id];
    const startRatio = (start - this.globalStart) / this.globalDuration;
    const widthRatio = (end - start) / this.globalDuration;
    const clampedWidth = Math.max(0.001, widthRatio);
    const clampedStart = Math.max(0, Math.min(startRatio, 1));
    mesh.scale.x = clampedWidth;
    const actualWidthInMeters = this.width * clampedWidth;
    mesh.position.x =
      (-this.width / 2) +
      (this.width * clampedStart) +
      (actualWidthInMeters / 2);

    label.position.x = mesh.position.x;
    label.position.y = -0.15;
    label.position.z = 0.08;


    // Update the remote label
    label.userData.setText(`${start} - ${end}`);
  }

  removeRemoteWindow(id) {
    if (this.remoteWindows && this.remoteWindows[id]) {
      const { mesh, label } = this.remoteWindows[id];

      this.group.remove(mesh);
      this.group.remove(label);

      mesh.geometry?.dispose();
      mesh.material?.dispose();

      delete this.remoteWindows[id];

      console.log(`Cleaned up remote window for user: ${id}`);
    }
  }

  // Rotates the histogram to always face the user
  updateFacing(camera) {
    this.group.quaternion.copy(camera.quaternion);
  }
}

// --- Histogram Helper ---
export function calculateHistogram(times, globalStart, globalDuration, numBins = 50) {
  const bins = new Array(numBins).fill(0);
  if (!times || times.length === 0) return bins;

  times.forEach(t => {
    // Prevent out-of-bounds math
    const ratio = Math.max(0, Math.min((t - globalStart) / globalDuration, 0.999));
    const binIndex = Math.floor(ratio * numBins);
    bins[binIndex]++;
  });

  return bins;
}

