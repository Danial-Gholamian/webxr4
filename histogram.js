import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { createCapsuleLabel } from './filterUIPanel';

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

    this._buildHistogram(bins);
    this._buildHighlightWindow();
    this._buildLabel();
    this.currentWindowSize = globalDuration; // default

    // Plane for user interaction 

    this._buildInteractionPlane();

    // === Preserve your spatial configuration ===

    // Increase the scale of the histogram
    this.group.scale.set(1.3, 1.3, 1.3);

    // Position relative to cameraGroup (shoulder-docked)
    this.group.position.set(2.8, 1, -3.3);

    // Tilt the histogram toward the user
    this.group.rotation.y = -Math.PI / 2.95;
  }

  /**
   * Return root object for scene insertion.
   */
  getObject3D() {
    return this.group;
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
        opacity: 0.8
      });

      const barGeom = new THREE.BoxGeometry(
        binWidth * 0.8,
        h,
        binDepth
      );

      const barMesh = new THREE.Mesh(barGeom, barMat);

      // Store bin index for interaction mapping
      barMesh.userData.binIndex = i;

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

      barsGroup.add(barMesh);
      this.binMeshes.push(barMesh);
    });

    this.group.add(barsGroup);
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
  reset() {
    // Cover full histogram width
    this.highlightWindow.scale.x = 1;
    this.highlightWindow.position.x = 0;

    // Reset label
    this.group.remove(this.label);

    this.label = createCapsuleLabel('All Time', {
      fontSize: 48,
      color: 0x00ff00,
      textColor: "#00ff00",
      opacity: 0.0
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

  // Can be used later if we want to implement selection

  _handleBarClick(binIndex, numBins) {
    console.log("CLICKING BAR HISTOGRAM...")
    if (!this.onBucketSelected) return;

    const ratio = binIndex / numBins;

    const time =
      this.globalStart +
      ratio * this.globalDuration;

    // Center the window around clicked point
    const halfWindow = this.currentWindowSize / 2;

    const start = time - halfWindow;
    const end = time + halfWindow;

    this.onBucketSelected({
      start,
      end
    });
  }

  _buildInteractionPlane() {
    const geom = new THREE.PlaneGeometry(
      this.width,
      this.maxHeight * 1.5
    );

    const mat = new THREE.MeshBasicMaterial({
      transparent: true,
      opacity: 0.0, // invisible
      depthWrite: false
    });

    this.interactionPlane = new THREE.Mesh(geom, mat);

    // Put it slightly behind bars
    this.interactionPlane.position.z = 0.05;
    this.interactionPlane.renderOrder = 999;

    this.interactionPlane.userData = {
      isInteractable: true,
      isHistogram: true,
      onClick: (intersection) => {
        this._handlePlaneClick(intersection);
      }
    };

    this.group.add(this.interactionPlane);
  }

  _handlePlaneClick(intersection) {
    if (!intersection || !intersection.point) return;

    const localPoint = this.interactionPlane.worldToLocal(
      intersection.point.clone()
    );

    const normalized =
      (localPoint.x + this.width / 2) / this.width;

    const clamped = Math.max(0, Math.min(normalized, 1));

    // Convert to bin
    const binIndex = Math.floor(clamped * this.numBins);


    const safeIndex = Math.max(0, Math.min(binIndex, this.numBins - 1));

    this._handleBarClick(safeIndex, this.numBins);
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
    console.log("00000000000000 GLOBAL DURATION: ", this.globalDuration)
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

