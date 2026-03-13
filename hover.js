//hover.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';


const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
// this is tesyt


export let hoverLabel = null;

let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

export let labelContainer = null;
const justGIT = 1;
const PULSE_COOLDOWN = 500; // ms – one pulse every half-second max
const PANEL_SCALE = 0.3;       // 30% of view width
const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.12;      // 12cm between rows

export function initLabels(nodeId, groupNum, camera, cameraGroup) {
  // Remove existing panel if any
  const oldPanel = cameraGroup.getObjectByName('NodeIDBillboard');
  if (oldPanel) cameraGroup.remove(oldPanel);

  const panel = new THREE.Group();
  panel.name = 'NodeIDBillboard';

  // Create text label
  const idLabel = new Text();
  idLabel.text = `Node ${nodeId}\nGroup: ${groupNum}`;
  idLabel.fontSize = FONT_SIZE;
  idLabel.color = 0xffffff;
  idLabel.anchorX = 'center';
  idLabel.anchorY = 'middle';
  idLabel.position.set(0, 0, 0.01);

  // Critical rendering settings (same as working uiPanel)
  idLabel.sync(() => {
    if (idLabel.mesh) {
      idLabel.mesh.renderOrder = 999;
      idLabel.mesh.material.depthTest = false;
      idLabel.mesh.material.depthWrite = false;
    }
  });

  panel.add(idLabel);
  cameraGroup.add(panel);

  // Add update function matching uiPanel's pattern
  panel.userData.update = () => {
    const panelOffset = new THREE.Vector3(0, -0.3, -0.8); // Same position as uiPanel
    const worldPosition = new THREE.Vector3()
      .copy(camera.position)
      .add(panelOffset.applyQuaternion(camera.quaternion));
    panel.position.copy(worldPosition);
    panel.quaternion.copy(camera.quaternion); // Always face camera
  };
}


export function markHoverCacheDirty() {
  cacheNeedsUpdate = true;
}


export function detectHover(controller, graphScene, camera, cameraGroup) {
  const interactables = [];

  // --- 1. RESET STATE ---
  if (controller.userData.lastHoveredObject === undefined) {
    controller.userData.lastHoveredObject = null;
    controller.userData.lastHoveredNodeId = null;
    controller.userData.lastPulseTime = 0;
    controller.userData.lastHoveredButton = null;
  }
  controller.userData.hoveredObject = null;

  if (!controller || !graphScene) return;

  // --- 2. RAYCASTER SETUP ---
  const tempMatrix = new THREE.Matrix4();
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 2000;

  // --- 3. COLLECT OBJECTS ---
  // A. Graph Nodes
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

  // B. UI Panels (Both Filter & Temporal)
  const panelsToCheck = [
    scene.getObjectByName('FilterUIPanel'),
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

  if (interactables.length === 0) return;

  const intersections = raycaster.intersectObjects(interactables, false);
  const line = controller.userData.laser;

  // --- HELPER: Restore Color (Respects Selection) ---
  const restoreButtonColor = (btn) => {
    const targetColor = btn.userData.isSelected
      ? btn.userData.selectedColor
      : btn.userData.defaultColor;

    if (targetColor && btn.userData.redraw) {
      btn.userData.redraw(targetColor);
    }
    // REMOVED SINCE THE BUTTONS ARE DRAWN IN CANVAS TEXTURE NOW
    // const targetColor = btn.userData.isSelected ? btn.userData.selectedColor : btn.userData.defaultColor;
    // if (targetColor) btn.material.color.copy(targetColor);
  };

  // --- HELPER: Trigger Haptic Pulse ---
  const triggerHaptic = () => {
    const gp = controller.userData.inputSource?.gamepad;
    if (gp?.hapticActuators?.[0]?.pulse) gp.hapticActuators[0].pulse(0.8, 40);
  };

  if (intersections.length > 0) {
    const hit = intersections[0].object;
    const dist = intersections[0].distance;

    // ------------------------------------------------
    // CASE A: UI BUTTON HIT
    // ------------------------------------------------
    if (hit.name === 'capsuleHitbox') {
      if (line) line.scale.z = dist; // Shorten laser to touch button

      if (hit.userData.target) {
        const btnMesh = hit.userData.target;

        // 1. Un-hover previous button
        if (controller.userData.lastHoveredButton &&
          controller.userData.lastHoveredButton !== btnMesh) {
          restoreButtonColor(controller.userData.lastHoveredButton);
        }

        // 2. Hover current button
        if (controller.userData.lastHoveredButton !== btnMesh) {
          // Change Color
          if (btnMesh.userData.hoverColor) {
            //  btnMesh.material.color.copy(btnMesh.userData.hoverColor);
            btnMesh.userData.redraw(btnMesh.userData.hoverColor);
          }
          // Trigger Vibration (New!)
          triggerHaptic();
        }

        controller.userData.lastHoveredButton = btnMesh;
      }

      controller.userData.lastHoveredObject = hit;
      controller.userData.lastHoveredNodeId = null;
      return; // Stop here
    }

    // ------------------------------------------------
    // CASE B: BACKGROUND HIT (Swallow)
    // ------------------------------------------------
    if (hit.name === "uiPanelBackground" || hit.userData.absorbsOnly) {
      if (line) line.scale.z = dist;
      if (controller.userData.lastHoveredButton) {
        restoreButtonColor(controller.userData.lastHoveredButton);
        controller.userData.lastHoveredButton = null;
      }
      return;
    }

    // ------------------------------------------------
    // CASE C: GRAPH NODE HIT
    // ------------------------------------------------
    if (line) line.scale.z = dist;

    // Reset UI if looking at graph
    if (controller.userData.lastHoveredButton) {
      restoreButtonColor(controller.userData.lastHoveredButton);
      controller.userData.lastHoveredButton = null;
    }

    if (!hit.__data?.id) return;

    // Restore previous node material
    const prev = controller.userData.lastHoveredObject;
    if (prev && prev !== hit && prev.material.__originalEmissive !== undefined) {
      prev.material.emissive.copy(prev.material.__originalEmissive);
      prev.material.emissiveIntensity = prev.material.__originalEmissiveIntensity;
      delete prev.material.__originalEmissive;
      delete prev.material.__originalEmissiveIntensity;
    }

    // Highlight current node
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

    // Node Haptics (with cooldown)
    const nodeId = String(hit.__data.id);
    const groupNum = String(hit.__data.group);
    const now = performance.now();
    if (nodeId !== controller.userData.lastHoveredNodeId &&
      now - controller.userData.lastPulseTime > 500) {
      triggerHaptic();
      controller.userData.lastPulseTime = now;
    }

    if (nodeId !== controller.userData.lastHoveredNodeId) {
      initLabels(nodeId, groupNum, camera, cameraGroup);
    }
    controller.userData.lastHoveredObject = hit;
    controller.userData.lastHoveredNodeId = nodeId;

  } else {
    // ------------------------------------------------
    // CASE D: NO HIT (Reset All)
    // ------------------------------------------------

    // 1. Reset UI Button
    if (controller.userData.lastHoveredButton) {
      restoreButtonColor(controller.userData.lastHoveredButton);
      controller.userData.lastHoveredButton = null;
    }

    // 2. Reset Filter Row (Legacy)
    if (controller.userData.lastHoveredFilter) {
      controller.userData.lastHoveredFilter.material.opacity = 0;
      controller.userData.lastHoveredFilter = null;
    }

    // 3. Reset Graph Node
    const prev = controller.userData.lastHoveredObject;
    if (prev) {
      if (prev.material.__originalEmissive !== undefined) {
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

    controller.userData.lastHoveredObject = null;
    controller.userData.lastHoveredNodeId = null;

    const oldPanel = cameraGroup.getObjectByName('NodeIDBillboard');
    if (oldPanel) cameraGroup.remove(oldPanel);

    // 4. RESET LASER LENGTH 
    // if (line) line.scale.z = 5; 
  }
}
