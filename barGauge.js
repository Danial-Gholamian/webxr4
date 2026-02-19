import * as THREE from 'three';
import { Text } from 'troika-three-text';


export function createHistogramGauge(bins, position = new THREE.Vector3(0, 1.8, -1.5), width = 1.5, maxHeight = 0.2) {
  const gaugeGroup = new THREE.Group();
  
  // 1. Math for the bins
  const maxBinCount = Math.max(...bins) || 1; 
  const numBins = bins.length;
  const binWidth = width / numBins;
  const binDepth = 0.05;

  // 2. Build the Histogram Bars
  const barsGroup = new THREE.Group();
  
  bins.forEach((count, i) => {
    if (count === 0) return; // Skip empty bins
    
    // Calculate height relative to the max count
    const h = (count / maxBinCount) * maxHeight; 
    
    // Optional: Color gradient based on height (Low = Green, High = Red)
    const color = new THREE.Color().setHSL(0.3 - (0.3 * (count / maxBinCount)), 1.0, 0.5);
    const barMat = new THREE.MeshBasicMaterial({ color: color, transparent: true, opacity: 0.8 });
    
    const barGeom = new THREE.BoxGeometry(binWidth * 0.8, h, binDepth); // 0.8 leaves a small gap between bars
    const barMesh = new THREE.Mesh(barGeom, barMat);
    
    // Position: Align left edge, shift right by bin index. Center Y so base is at 0.
    barMesh.position.x = (-width / 2) + (i * binWidth) + (binWidth / 2);
    barMesh.position.y = h / 2; 
    
    barsGroup.add(barMesh);
  });
  gaugeGroup.add(barsGroup);

  // 3. The Highlight Window (Replaces fgBar)
  // CHANGED: Made the color 0x00ff00 (bright green) instead of orange
  const windowGeom = new THREE.BoxGeometry(width, maxHeight * 1.1, binDepth * 1.5);
  const windowMat = new THREE.MeshBasicMaterial({ color: 0x00ff00, transparent: true, opacity: 0.3, depthWrite: false });
  const highlightWindow = new THREE.Mesh(windowGeom, windowMat);
  
  // Start it as 0 width
  highlightWindow.scale.x = 0; 
  highlightWindow.position.y = maxHeight / 2;
  gaugeGroup.add(highlightWindow);

  // 4. Text Label
  const label = new Text();
  label.text = 'All Time';
  label.fontSize = 0.04;
  // CHANGED: Made the text color match the green window
  label.color = 0x00ff00; 
  label.anchorX = 'center';
  label.anchorY = 'top';
  label.position.set(0, -0.05, 0); // Below the histogram
  label.sync();
  gaugeGroup.add(label);


  gaugeGroup.position.copy(position);
  gaugeGroup.userData.fgBar = highlightWindow; // keep the same property name so update works
  gaugeGroup.userData.width = width;
  gaugeGroup.userData.label = label;

  return gaugeGroup;
}

export function updateBarGaugeForBucket(gauge, bucket, globalStart, globalDuration) {
  const highlightWindow = gauge.userData.fgBar;
  const width = gauge.userData.width;
  const label = gauge.userData.label;
  if (!highlightWindow || !bucket) return;

  // Calculate relative start and width
  const startRatio = (bucket.start - globalStart) / globalDuration;
  const widthRatio = (bucket.end - bucket.start) / globalDuration;

  const clampedStart = Math.max(0, Math.min(startRatio, 1));
  const clampedWidth = Math.max(0, Math.min(widthRatio, 1));

  // Scale the highlight box
  highlightWindow.scale.x = clampedWidth;

  // Position it correctly over the histogram
  const actualWidth = width * clampedWidth;
  highlightWindow.position.x = (-width / 2) + (width * clampedStart) + (actualWidth / 2);

  // Update text
  label.text = `${Math.floor(bucket.start)} - ${Math.floor(bucket.end)}`;
  label.sync();
}