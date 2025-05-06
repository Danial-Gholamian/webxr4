// hover.js
import * as THREE from 'three';

const intersected = []; // Keep track of currently hovered
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster(); // Reuse raycaster

// Store node meshes temporarily to avoid traversing every frame if scene doesn't change structurally
// This is a simple cache; more robust caching might be needed if nodes are added/removed.
let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

export function markHoverCacheDirty() {
  cacheNeedsUpdate = true;
  
}
function createLabelFromNodeData(nodeData) {
  const canvas = document.createElement('canvas');
  const context = canvas.getContext('2d');
  const fontSize = 28;
  const padding = 10;

  const lines = Object.entries(nodeData)
    .filter(([key, _]) => key !== '__link')
    .map(([key, value]) => `${key}: ${value}`);

  context.font = `${fontSize}px Arial`;
  const textWidth = Math.max(...lines.map(line => context.measureText(line).width));
  const width = textWidth + padding * 2;
  const height = fontSize * lines.length + padding * 2;

  canvas.width = width;
  canvas.height = height;

  // Background (rounded rectangle)
  context.fillStyle = 'rgba(0, 0, 0, 0.7)';
  const radius = 12;
  context.beginPath();
  context.moveTo(radius, 0);
  context.lineTo(width - radius, 0);
  context.quadraticCurveTo(width, 0, width, radius);
  context.lineTo(width, height - radius);
  context.quadraticCurveTo(width, height, width - radius, height);
  context.lineTo(radius, height);
  context.quadraticCurveTo(0, height, 0, height - radius);
  context.lineTo(0, radius);
  context.quadraticCurveTo(0, 0, radius, 0);
  context.closePath();
  context.fill();

  // Text
  context.fillStyle = 'white';
  lines.forEach((line, i) => {
    context.fillText(line, padding, padding + fontSize * (i + 0.8));
  });

  const texture = new THREE.CanvasTexture(canvas);
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true });
  const sprite = new THREE.Sprite(material);

  // Wider and shorter label
  const aspectRatio = width / height;
  sprite.scale.set(2.5 * aspectRatio, 2.5, 1);

  return sprite;
}


// Modified detectHover
export function detectHover(controller, graphScene) {
  // --- 1. Clear previous hover state ---
  while (intersected.length) {
    const obj = intersected.pop();

    if (obj.material?.emissive) {
      obj.material.emissive.setRGB(0, 0, 0); // Reset emissive color
    }

    if (obj.userData?.labelSprite) {
      obj.remove(obj.userData.labelSprite);
      obj.userData.labelSprite.material.map.dispose();
      obj.userData.labelSprite.material.dispose();
      delete obj.userData.labelSprite;
    }

    if (obj.userData) {
      delete obj.userData.isHovered;
    }
  }

  controller.userData.hoveredObject = null;

  // --- 2. Raycasting Setup ---
  if (!controller || !graphScene) return;

  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 100;

  // --- 3. Update node mesh cache if needed ---
  if (cacheNeedsUpdate) {
    nodeMeshesCache = [];
    graphScene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.__data && obj.__data.id !== undefined) {
        nodeMeshesCache.push(obj);
      }
    });
    cacheNeedsUpdate = false;
    console.log(`Updated node mesh cache: ${nodeMeshesCache.length} nodes found.`);
  }

  if (nodeMeshesCache.length === 0) return;

  // --- 4. Intersect with nodes ---
  const intersections = raycaster.intersectObjects(nodeMeshesCache, false);
  const line = controller.userData.laser;

  if (intersections.length > 0) {
    const intersection = intersections[0];
    const hitObject = intersection.object;

    if (line) line.scale.z = intersection.distance;

    if (hitObject instanceof THREE.Mesh) {
      hitObject.userData.isHovered = true;
      controller.userData.hoveredObject = hitObject;
      intersected.push(hitObject);

      if (hitObject.material?.emissive) {
        hitObject.material.emissive.setHex(0xff0000);
      }

      if (!hitObject.userData.labelSprite && hitObject.__data) {
        const label = createLabelFromNodeData(hitObject.__data);
        label.position.set(0, 1.5, 0); // Adjust height above node
        hitObject.add(label);
        hitObject.userData.labelSprite = label;
      }

      // Haptic feedback
      try {
        const inputSource = controller.userData.inputSource;
        const actuator = inputSource?.gamepad?.hapticActuators?.[0];
        if (actuator?.pulse) {
          actuator.pulse(0.8, 50);
        }
      } catch (err) {
        console.warn("Haptic feedback error:", err);
      }
    }

  } else {
    if (line) line.scale.z = raycaster.far;
    controller.userData.hoveredObject = null;
  }
}