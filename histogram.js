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
    const numBins = bins.length;
    const binWidth = this.width / numBins;
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
      `${Math.floor(bucket.start)} - ${Math.floor(bucket.end)}`,
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

    this.group.add(this.label);
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

