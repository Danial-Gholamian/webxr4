import * as THREE from 'three';
import { Text } from 'troika-three-text';


const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();


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

  if (controller.userData.lastHoveredObject === undefined) {
  controller.userData.lastHoveredObject = null;
  controller.userData.lastHoveredNodeId = null;
  controller.userData.lastPulseTime     = 0;   // timestamp for haptic cooldown
  }


  controller.userData.hoveredObject = null;
  if (!controller || !graphScene) return;

  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 100;

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

  if (nodeMeshesCache.length === 0) return;

  const intersections = raycaster.intersectObjects(nodeMeshesCache, false);
  const line = controller.userData.laser;
if (intersections.length > 0) {
  const hit = intersections[0].object;
  if (line) line.scale.z = intersections[0].distance;


  /* restore previous mesh if cursor moved */
const prev = controller.userData.lastHoveredObject;
if (prev && prev !== hit && prev.material.__originalEmissive !== undefined) {
  prev.material.emissive.copy(prev.material.__originalEmissive);
  prev.material.emissiveIntensity = prev.material.__originalEmissiveIntensity;
  delete prev.material.__originalEmissive;
  delete prev.material.__originalEmissiveIntensity;
}
  /* highlight current mesh */
// Clone material if it's shared
if (!hit.userData.wasClonedForHover) {
  hit.userData.originalMaterial = hit.material;
  hit.material = hit.material.clone();
  hit.userData.wasClonedForHover = true;
}

// Preserve current emissive state
if (!hit.material.__originalEmissive) {
  hit.material.__originalEmissive = hit.material.emissive.clone();
  hit.material.__originalEmissiveIntensity = hit.material.emissiveIntensity;

  hit.material.emissive = hit.material.color.clone();
  hit.material.emissiveIntensity = 0.8;
}


  /* haptic pulse once per entry, with cooldown */
  const nodeId = String(hit.__data.id);
  const groupNum = String(hit.__data.group);
  // console.log('hit.__data $', nodeId)
  // console.log('hit.__data $', groupNum)
  const now = performance.now();
  if (nodeId !== controller.userData.lastHoveredNodeId &&
      now - controller.userData.lastPulseTime > PULSE_COOLDOWN) {
      
    const inputSource = controller.userData.inputSource;
    if (inputSource && inputSource.gamepad) {
      const gamepad = inputSource.gamepad;
      
      // Try different haptic actuator patterns
      const actuators = gamepad.hapticActuators || (gamepad.vibrationActuator ? [gamepad.vibrationActuator] : []);
      
      if (actuators.length > 0) {
        const actuator = actuators[0];
        
        if (actuator.pulse) {
          actuator.pulse(0.8, 40);
        } 
        else if (actuator.playEffect) {
          actuator.playEffect('dual-rumble', {
            startDelay: 0,
            duration: 40,
            weakMagnitude: 0.8,
            strongMagnitude: 0.8
          });
        }
      }
    }
    
    controller.userData.lastPulseTime = now;
  }

  if (nodeId !== controller.userData.lastHoveredNodeId) {
  // remove previous label
    const oldPanel = cameraGroup.getObjectByName('NodeIDBillboard');
    if (oldPanel) cameraGroup.remove(oldPanel);

    initLabels(nodeId, groupNum, camera, cameraGroup);

  }


  controller.userData.lastHoveredObject = hit;
  controller.userData.lastHoveredNodeId = nodeId;

} else {
  /* no hit → restore and hide */
  const prev = controller.userData.lastHoveredObject;
  if (prev && prev.material.__originalEmissive !== undefined) {
    prev.material.emissive.copy(prev.material.__originalEmissive);
    prev.material.emissiveIntensity = prev.material.__originalEmissiveIntensity;
    delete prev.material.__originalEmissive;
    delete prev.material.__originalEmissiveIntensity;

    // Restore original material if we cloned it
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

}


}



// setupController,
// handleJoystickInput,
// setupVRNodeSelection,
// handleXButtonInput,
// setupGraphSwitchButtons,