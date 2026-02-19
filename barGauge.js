import * as THREE from 'three';
import { Text } from 'troika-three-text';

function createRoundedRectShape(width, height, radius) {
  const maxRadius = Math.min(width, height) / 2;
  radius = Math.min(radius, maxRadius);

  const shape = new THREE.Shape();
  const x = -width / 2;
  const y = -height / 2;

  shape.moveTo(x, y + radius);
  shape.lineTo(x, y + height - radius);
  shape.quadraticCurveTo(x, y + height, x + radius, y + height);
  shape.lineTo(x + width - radius, y + height);
  shape.quadraticCurveTo(x + width, y + height, x + width, y + height - radius);
  shape.lineTo(x + width, y + radius);
  shape.quadraticCurveTo(x + width, y, x + width - radius, y);
  shape.lineTo(x + radius, y);
  shape.quadraticCurveTo(x, y, x, y + radius);

  return shape;
}

export function createBarGauge(position = new THREE.Vector3(0, 1.8, -1.5), width = 1, height = 0.05, radius = 0.02) {
  const gaugeGroup = new THREE.Group();

  // Background with rounded corners
  const bgShape = createRoundedRectShape(width, height, radius);
  const bgGeom = new THREE.ShapeGeometry(bgShape);
  const bgMat = new THREE.MeshBasicMaterial({ color: 0x333333, transparent: true, opacity: 0.5 });
  const bgBar = new THREE.Mesh(bgGeom, bgMat);
  gaugeGroup.add(bgBar);

  // Foreground = just a rectangle (smooth filling)
  const fgGeom = new THREE.PlaneGeometry(width, height);
  const fgMat = new THREE.MeshBasicMaterial({ color: 0x00ff00 });
  const fgBar = new THREE.Mesh(fgGeom, fgMat);
  fgBar.position.x = -width / 2; // left align
  fgBar.scale.x = 0;             // start empty
  fgBar.position.z = 0.001;      // avoid z-fighting
  gaugeGroup.add(fgBar);

  // Text label in the center
  const label = new Text();
  label.text = '0%';              // default
  label.fontSize = height * 0.6;  // scale relative to bar height
  label.color = 0xffffff;
  label.anchorX = 'center';
  label.anchorY = 'middle';
  label.position.set(0, 0, 0.01); // a bit above the bar
  label.sync();
  gaugeGroup.add(label);

  // Store references
  gaugeGroup.position.copy(position);
  gaugeGroup.userData.fgBar = fgBar;
  gaugeGroup.userData.width = width;
  gaugeGroup.userData.label = label;

  return gaugeGroup;
}

export function updateBarGauge(gauge, value, text = null) {
  const fgBar = gauge.userData.fgBar;
  const width = gauge.userData.width;
  const label = gauge.userData.label;
  if (!fgBar) return;

  const clamped = Math.min(Math.max(value, 0), 1);

  // Smooth lerp fill
  fgBar.scale.x = clamped;

  // Keep left aligned
  const currentFillWidth = width * fgBar.scale.x;
  fgBar.position.x = -width / 2 + currentFillWidth / 2;

  // Update text (percent or custom)
  if (text !== null) {
    label.text = text;
  } else {
    label.text = `${Math.round(clamped * 100)}%`;
  }
  label.sync();
}

export function updateBarGaugeFromTime(gauge, currentTime, totalDuration, labelText = null) {
  const fraction = currentTime / totalDuration;
  updateBarGauge(gauge, fraction, labelText);
}

export function updateBarGaugeHUD(gauge, camera, offset = new THREE.Vector3(0, 0.9, -1.5)) {
  const worldPos = camera.localToWorld(offset.clone());
  gauge.position.copy(worldPos);
  gauge.quaternion.copy(camera.quaternion);
}

export function updateBarGaugeForBucket(gauge, bucket, globalStart, globalDuration) {
  const fgBar = gauge.userData.fgBar;
  const width = gauge.userData.width;
  const label = gauge.userData.label;
  if (!fgBar || !bucket) return;

  const startRatio = (bucket.start - globalStart) / globalDuration;
  const widthRatio = (bucket.end - bucket.start) / globalDuration;

  const clampedStart = Math.max(0, Math.min(startRatio, 1));
  const clampedWidth = Math.max(0, Math.min(widthRatio, 1));

  fgBar.scale.x = clampedWidth;

  const actualWidth = width * clampedWidth;
  fgBar.position.x = (-width / 2) + (width * clampedStart) + (actualWidth / 2);

  label.text = `${Math.floor(bucket.start)} - ${Math.floor(bucket.end)}`;
  label.sync();
}
