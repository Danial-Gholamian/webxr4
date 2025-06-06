import * as THREE from 'three';
import { Text } from 'troika-three-text';


const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();


export let hoverLabel = null;  

let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

export let labelContainer = null;

const PULSE_COOLDOWN = 500; // ms – one pulse every half-second max
const PANEL_SCALE = 0.3;       // 30% of view width
const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.12;      // 12cm between rows

export function initLabels(nodeId, camera) {
  const panel = new THREE.Group();
  panel.name = 'NodeIDBillboard';

  const aspect = window.innerWidth / window.innerHeight;
  panel.position.set(0, -0.3, -0.8); // In front of and below camera
  panel.scale.set(PANEL_SCALE * aspect, PANEL_SCALE, 1);

  const idLabel = new Text();
  idLabel.text = `Node ${nodeId}`;
  idLabel.fontSize = FONT_SIZE;
  idLabel.color = 0xffffff;
  idLabel.anchorX = 'top';
  idLabel.anchorY = 'middle';
  idLabel.position.set(0, 0, 0.01);
  idLabel.sync(() => {
    if (idLabel.mesh) {
      idLabel.mesh.renderOrder = 999;
      idLabel.mesh.material.depthTest = false;
    }
  });


  panel.add(idLabel);

  camera.add(panel);  // ✅ Attach directly to camera
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
  if (hit !== prev && prev && prev.userData.originalMaterial) {
    prev.material = prev.userData.originalMaterial;
    delete prev.userData.originalMaterial;
  }

  /* highlight current mesh */
  if (!hit.userData.originalMaterial) {
    hit.userData.originalMaterial = hit.material;
    hit.material = hit.material.clone();
  }
  if (hit.material.emissive === undefined)
    hit.material.emissive = new THREE.Color();
    hit.material.emissive.copy(hit.material.color);
    hit.material.emissiveIntensity = 0.8;

  /* haptic pulse once per entry, with cooldown */
  const nodeId = String(hit.__data.id);
  console.log('hit.__data $', nodeId)

  const now    = performance.now();
  if (nodeId !== controller.userData.lastHoveredNodeId &&
      now - controller.userData.lastPulseTime > PULSE_COOLDOWN) {
    controller.userData.inputSource?.gamepad
             ?.hapticActuators?.[0]?.pulse?.(0.8, 40);
    controller.userData.lastPulseTime = now;
  }

  if (nodeId !== controller.userData.lastHoveredNodeId) {
  // remove previous label
  const oldPanel = camera.getObjectByName('NodeIDBillboard');
  if (oldPanel) camera.remove(oldPanel);

  initLabels(nodeId, camera);  // ← only pass camera now

  }





  controller.userData.lastHoveredObject = hit;
  controller.userData.lastHoveredNodeId = nodeId;

} else {
  /* no hit → restore and hide */
  const prev = controller.userData.lastHoveredObject;
  if (prev && prev.userData.originalMaterial) {
    prev.material = prev.userData.originalMaterial;
    delete prev.userData.originalMaterial;
  }
  controller.userData.lastHoveredObject = null;
  controller.userData.lastHoveredNodeId = null;
  const oldPanel = camera.getObjectByName('NodeIDBillboard');
  if (oldPanel) camera.remove(oldPanel);

}


}



// setupController,
// handleJoystickInput,
// setupVRNodeSelection,
// handleXButtonInput,
// setupGraphSwitchButtons,