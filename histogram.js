import * as THREE from 'three';
import { Text } from 'troika-three-text';

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
    this.highlightWindow.scale.x = 0;

    // Vertically center it
    this.highlightWindow.position.y = this.maxHeight / 2;

    this.group.add(this.highlightWindow);
  }

  /**
   * Build the text label displayed below the histogram.
   */
  _buildLabel() {
    this.label = new Text();
    this.label.text = 'All Time';
    this.label.fontSize = 0.04;
    this.label.color = 0x00ff00;
    this.label.anchorX = 'center';
    this.label.anchorY = 'top';
    this.label.position.set(0, -0.05, 0);
    this.label.sync();

    this.group.add(this.label);
  }

  /**
   * Called by GraphVisualController when active bucket changes.
   * Updates highlight window and label.
   */
  onTimeChange(bucket) {
    if (!bucket) return;

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
    this.label.text =
      `${Math.floor(bucket.start)} - ${Math.floor(bucket.end)}`;
    this.label.sync();
  }

  /**
   * Handle raycast click intersection.
   * Determines which bin was clicked and emits bucket.
   */
  handleClick(intersection) {
    const mesh = intersection.object;

    // Ensure clicked object is a bar
    if (mesh.userData.binIndex === undefined) return;

    const binIndex = mesh.userData.binIndex;

    const binCount = this.binMeshes.length;
    const bucketSize = this.globalDuration / binCount;

    const start = this.globalStart + (binIndex * bucketSize);
    const end = start + bucketSize;

    if (this.onBucketSelected) {
      this.onBucketSelected({ start, end });
    }
  }

  /**
   * Return all interactive meshes for raycasting.
   */
  getInteractiveMeshes() {
    return this.binMeshes;
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




// import * as THREE from 'three';
// import { Text } from 'troika-three-text';


// export function createHistogramGauge(bins, position = new THREE.Vector3(0, 1.8, -1.5), width = 1.5, maxHeight = 0.2) {
//   const gaugeGroup = new THREE.Group();
  
//   // 1. Math for the bins
//   const maxBinCount = Math.max(...bins) || 1; 
//   const numBins = bins.length;
//   const binWidth = width / numBins;
//   const binDepth = 0.05;

//   // 2. Build the Histogram Bars
//   const barsGroup = new THREE.Group();
  
//   bins.forEach((count, i) => {
//     if (count === 0) return; // Skip empty bins
    
//     // Calculate height relative to the max count
//     const h = (count / maxBinCount) * maxHeight; 
    
//     // Optional: Color gradient based on height (Low = Green, High = Red)
//     const color = new THREE.Color().setHSL(0.3 - (0.3 * (count / maxBinCount)), 1.0, 0.5);
//     const barMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
    
//     const barGeom = new THREE.BoxGeometry(binWidth * 0.8, h, binDepth); // 0.8 leaves a small gap between bars
//     const barMesh = new THREE.Mesh(barGeom, barMat);
    
//     // Position: Align left edge, shift right by bin index. Center Y so base is at 0.
//     barMesh.position.x = (-width / 2) + (i * binWidth) + (binWidth / 2);
//     barMesh.position.y = h / 2; 
    
//     barsGroup.add(barMesh);
//   });
//   gaugeGroup.add(barsGroup);

//   // 3. The Highlight Window (Replaces fgBar)
//   // CHANGED: Made the color 0x00ff00 (bright green) instead of orange
//   const windowGeom = new THREE.BoxGeometry(width, maxHeight * 1.1, binDepth * 1.5);
//   const windowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, depthWrite: false });
//   const highlightWindow = new THREE.Mesh(windowGeom, windowMat);
  
//   // Start it as 0 width
//   highlightWindow.scale.x = 0; 
//   highlightWindow.position.y = maxHeight / 2;
//   gaugeGroup.add(highlightWindow);

//   // 4. Text Label
//   const label = new Text();
//   label.text = 'All Time';
//   label.fontSize = 0.04;
//   // CHANGED: Made the text color match the green window
//   label.color = 0x00ff00; 
//   label.anchorX = 'center';
//   label.anchorY = 'top';
//   label.position.set(0, -0.05, 0); // Below the histogram
//   label.sync();
//   gaugeGroup.add(label);


//   gaugeGroup.position.copy(position);
//   gaugeGroup.userData.fgBar = highlightWindow; // keep the same property name so update works
//   gaugeGroup.userData.width = width;
//   gaugeGroup.userData.label = label;

//   // increase the scale of the histogram
//   gaugeGroup.scale.set(1.3, 1.3, 1.3)
//   gaugeGroup.position.set(2.8, 1, -3.3);
//   // tilt the bar toward the user
//   gaugeGroup.rotation.y = -Math.PI / 2.95; 

//   return gaugeGroup;
// }

// export function updateBarGaugeForBucket(gauge, bucket, globalStart, globalDuration) {
//   const highlightWindow = gauge.userData.fgBar;
//   const width = gauge.userData.width;
//   const label = gauge.userData.label;
//   if (!highlightWindow || !bucket) return;

//   // Calculate relative start and width
//   const startRatio = (bucket.start - globalStart) / globalDuration;
//   const widthRatio = (bucket.end - bucket.start) / globalDuration;

//   const clampedStart = Math.max(0, Math.min(startRatio, 1));
//   const clampedWidth = Math.max(0, Math.min(widthRatio, 1));

//   // Scale the highlight box
//   highlightWindow.scale.x = clampedWidth;

//   // Position it correctly over the histogram
//   const actualWidth = width * clampedWidth;
//   highlightWindow.position.x = (-width / 2) + (width * clampedStart) + (actualWidth / 2);

//   // Update text
//   label.text = `${Math.floor(bucket.start)} - ${Math.floor(bucket.end)}`;
//   label.sync();
// }


