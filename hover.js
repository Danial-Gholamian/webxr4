// hover.js
import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel';

const raycaster = new THREE.Raycaster();

export let hoverLabel = null;
let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

const FONT_SIZE = 0.05;        // 5cm in VR units
const LASER_DEFAULT_LENGTH = 50; // Default length when hitting nothing (adjust as needed)

// ============================================================
// HELPER: Reset Node and UI visual states
// ============================================================
function resetAllHoverStates(controller, cameraGroup) {
  // 1. Reset UI Button colors
  if (controller.userData.lastHoveredButton) {
    const btn = controller.userData.lastHoveredButton;
    const targetColor = btn.userData.isSelected
      ? btn.userData.selectedColor
      : btn.userData.defaultColor;

    if (targetColor && btn.userData.redraw) {
      btn.userData.redraw(targetColor);
    }
    controller.userData.lastHoveredButton = null;
  }

  // 2. Reset Graph Node emissive highlights
  const prev = controller.userData.lastHoveredObject;
  if (prev) {
    if (prev.material && prev.material.__originalEmissive !== undefined) {
      prev.material.emissive.copy(prev.material.__originalEmissive);
      prev.material.emissiveIntensity = prev.material.__originalEmissiveIntensity;
      delete prev.material.__originalEmissive;
      delete prev.material.__originalEmissiveIntensity;
    }
    if (prev.userData.wasClonedForHover && prev.userData.originalMaterial) {
      prev.material.dispose?.();
      prev.material = prev.userData.originalMaterial;
      delete prev.userData.originalMaterial;
      delete prev.userData.wasClonedForHover;
    }
  }

  // 3. Clear Node Labels - ONLY if this controller was the one holding the ID
  const oldPanel = cameraGroup.getObjectByName('NodeIDBillboard');
  if (oldPanel && controller.userData.lastHoveredNodeId !== null) {
    cameraGroup.remove(oldPanel);
  }

  controller.userData.lastHoveredObject = null;
  controller.userData.lastHoveredNodeId = null;
}

export function initLabels(nodeId, groupNum, nodeColorHex, camera, cameraGroup) {
  const oldPanel = cameraGroup.getObjectByName('NodeIDBillboard');
  if (oldPanel) cameraGroup.remove(oldPanel);

  const panel = new THREE.Group();
  panel.name = 'NodeIDBillboard';

  // --- Create the Canvas ---
  const canvasWidth = 512;
  const canvasHeight = 256;
  const canvas = document.createElement("canvas");
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
  const ctx = canvas.getContext("2d");

  // --- Draw the Background Plate ---
  const radius = 30;
  ctx.fillStyle = 'rgba(20, 25, 35, 0.9)';
  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(canvasWidth - radius, 0);
  ctx.quadraticCurveTo(canvasWidth, 0, canvasWidth, radius);
  ctx.lineTo(canvasWidth, canvasHeight - radius);
  ctx.quadraticCurveTo(canvasWidth, canvasHeight, canvasWidth - radius, canvasHeight);
  ctx.lineTo(radius, canvasHeight);
  ctx.quadraticCurveTo(0, canvasHeight, 0, canvasHeight - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();
  ctx.fill();

  // --- Draw the Text ---
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = 'bold 65px Arial';
  ctx.fillText(`Node ${nodeId}`, canvasWidth / 2, canvasHeight / 2 - 25);

  ctx.font = '50px Arial';
  // Use the dynamically passed color, or fallback to green if it fails
  ctx.fillStyle = nodeColorHex || '#00ffaa';
  ctx.fillText(`Group: ${groupNum}`, canvasWidth / 2, canvasHeight / 2 + 45);

  // --- Create the Material (Matching your filter UI exactly!) ---
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.minFilter = THREE.LinearFilter;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    depthWrite: false,
    toneMapped: false // <-- Stops the fog/lighting from washing it out!
  });

  const aspect = canvasWidth / canvasHeight;
  const geometry = new THREE.PlaneGeometry(0.15 * aspect, 0.15);
  const idLabelMesh = new THREE.Mesh(geometry, material);

  idLabelMesh.renderOrder = 9999;

  panel.add(idLabelMesh);
  cameraGroup.add(panel);

  // --- Position it comfortably above the Filter Panel ---
  panel.userData.update = () => {
    // Moved to Y: -0.1 and Z: -0.6 (Closer and higher than the Filter UI)
    const panelOffset = new THREE.Vector3(0, -0.1, -0.6);
    const worldPosition = new THREE.Vector3()
      .copy(camera.position)
      .add(panelOffset.applyQuaternion(camera.quaternion));

    panel.position.copy(worldPosition);
    panel.quaternion.copy(camera.quaternion);
  };
}

export function markHoverCacheDirty() {
  cacheNeedsUpdate = true;
}

export function detectHover(controller, graphScene, camera, cameraGroup) {
  if (!controller || !graphScene) return;

  const interactables = [];
  const line = controller.userData.laser;

  // --- 1. INITIALIZE USER DATA ---
  if (controller.userData.lastHoveredObject === undefined) {
    controller.userData.lastHoveredObject = null;
    controller.userData.lastHoveredNodeId = null;
    controller.userData.lastPulseTime = 0;
    controller.userData.lastHoveredButton = null;
  }

  // --- 2. RAYCASTER SETUP ---
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 200;

  // --- 3. COLLECT OBJECTS ---
  if (cacheNeedsUpdate) {
    nodeMeshesCache = [];
    graphScene.traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.__data?.id !== undefined) {
        obj.__data.id = String(obj.__data.id);
        nodeMeshesCache.push(obj);
      }
    });
    cacheNeedsUpdate = false;
  }
  interactables.push(...nodeMeshesCache);

  const panelsToCheck = [
    graphScene.getObjectByName('FilterUIPanel'),
    cameraGroup.getObjectByName('FilterUIPanel'),
    cameraGroup.getObjectByName('TemporalDrillPanel')
  ];

  panelsToCheck.forEach(panel => {
    if (panel && panel.visible) {
      const bg = panel.getObjectByName('uiPanelBackground');
      if (bg) interactables.push(bg);
      panel.traverse(child => {
        if (child.name === 'capsuleHitbox' && child.userData.interactive) {
          interactables.push(child);
        }
      });
    }
  });

  const intersections = raycaster.intersectObjects(interactables, false);

  const triggerHaptic = () => {
    const gp = controller.userData.inputSource?.gamepad;
    if (gp?.hapticActuators?.[0]?.pulse) gp.hapticActuators[0].pulse(0.8, 40);
  };

  // --- 4. INTERSECTION LOGIC ---
  if (intersections.length > 0) {
    const hit = intersections[0].object;
    const dist = intersections[0].distance;

    // Correctly shorten laser to the hit point
    if (line) line.scale.z = dist;

    // CASE A: UI BUTTON HIT
    if (hit.name === 'capsuleHitbox') {
      if (hit.userData.target) {
        const btnMesh = hit.userData.target;
        if (controller.userData.lastHoveredButton && controller.userData.lastHoveredButton !== btnMesh) {
          // Reset previous button color before highlighting new one
          const prevBtn = controller.userData.lastHoveredButton;
          const prevColor = prevBtn.userData.isSelected ? prevBtn.userData.selectedColor : prevBtn.userData.defaultColor;
          if (prevBtn.userData.redraw) prevBtn.userData.redraw(prevColor);
        }

        if (controller.userData.lastHoveredButton !== btnMesh) {
          if (btnMesh.userData.hoverColor && btnMesh.userData.redraw) {
            btnMesh.userData.redraw(btnMesh.userData.hoverColor);
          }
          triggerHaptic();
          controller.userData.lastHoveredButton = btnMesh;
        }
      }
      return;
    }

    // CASE B: UI BACKGROUND (Swallow ray but don't highlight)
    if (hit.name === "uiPanelBackground" || hit.userData.absorbsOnly) {
      // Clear any previously hovered button/node but keep laser shortened
      if (controller.userData.lastHoveredButton) {
        const btn = controller.userData.lastHoveredButton;
        const col = btn.userData.isSelected ? btn.userData.selectedColor : btn.userData.defaultColor;
        if (btn.userData.redraw) btn.userData.redraw(col);
        controller.userData.lastHoveredButton = null;
      }
      return;
    }

    // CASE C: GRAPH NODE HIT
    if (hit.__data?.id) {
      const nodeId = String(hit.__data.id);
      const groupNum = String(hit.__data.group);
      const now = performance.now();

      // Reset UI if looking at graph
      if (controller.userData.lastHoveredButton) {
        const btn = controller.userData.lastHoveredButton;
        const col = btn.userData.isSelected ? btn.userData.selectedColor : btn.userData.defaultColor;
        if (btn.userData.redraw) btn.userData.redraw(col);
        controller.userData.lastHoveredButton = null;
      }

      // Restore previous node material if moving between nodes
      const prev = controller.userData.lastHoveredObject;
      if (prev && prev !== hit && prev.material?.__originalEmissive !== undefined) {
        prev.material.emissive.copy(prev.material.__originalEmissive);
        prev.material.emissiveIntensity = prev.material.__originalEmissiveIntensity;
        delete prev.material.__originalEmissive;
        delete prev.material.__originalEmissiveIntensity;
      }

      // Setup Highlight
      if (!hit.userData.wasClonedForHover) {
        hit.userData.originalMaterial = hit.material;
        hit.material = hit.material.clone();
        hit.userData.wasClonedForHover = true;
      }
      if (!hit.material.__originalEmissive) {
        hit.material.__originalEmissive = hit.material.emissive.clone();
        hit.material.__originalEmissiveIntensity = hit.material.emissiveIntensity;
        hit.material.emissive = hit.material.color.clone();
        hit.material.emissiveIntensity = 0.8;
      }

      // Feedback
      if (nodeId !== controller.userData.lastHoveredNodeId) {
        if (now - controller.userData.lastPulseTime > 500) {
          triggerHaptic();
          controller.userData.lastPulseTime = now;
        }

        // Extract the exact hex color of the 3D node you are pointing at
        const colorHex = '#' + hit.material.color.getHexString();

        // Pass the colorHex into our updated function!
        initLabels(nodeId, groupNum, colorHex, camera, cameraGroup);
      }

      controller.userData.lastHoveredObject = hit;
      controller.userData.lastHoveredNodeId = nodeId;
    }
  } else {
    // --- CASE D: NO HIT (Reset Everything) ---
    if (line) line.scale.z = LASER_DEFAULT_LENGTH;
    resetAllHoverStates(controller, cameraGroup);
  }
}