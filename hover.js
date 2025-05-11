import * as THREE from 'three';
import { Text } from 'troika-three-text';

const intersected = [];
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster();
const tempVector = new THREE.Vector3();

let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

export let labelContainer = null;

export function initLabels(cameraParent) {
  labelContainer = new THREE.Group();
  labelContainer.name = "NodeLabelContainer";
  cameraParent.add(labelContainer);
}

export function markHoverCacheDirty() {
  cacheNeedsUpdate = true;
}

function createLabelFromNodeData(nodeData) {
  const label = new Text();
  label.text = nodeData.label || nodeData.id;
  label.fontSize = 0.15;
  label.color = 0xffffff;
  label.anchorX = 'center';
  label.anchorY = 'middle';
  label.outlineColor = 0x000000;
  label.outlineWidth = 0.005;
  label.depthTest = false;
  label.renderOrder = 999;
  label.sync();

  const bg = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 0.4),
    new THREE.MeshBasicMaterial({
      color: 0x222222,
      transparent: true,
      opacity: 0.95,
      depthTest: false
    })
  );
  bg.renderOrder = 998;
  label.add(bg);

  return label;
}
let lastHoveredNodeId = null;
let currentHoveredNodeId = null;

export function detectHover(controller, graphScene, camera) {
  while (intersected.length) {
    const obj = intersected.pop();

    if (obj.userData.originalMaterial) {
      obj.material = obj.userData.originalMaterial;
      delete obj.userData.originalMaterial;
    }

    if (obj.userData.label) {
      labelContainer.remove(obj.userData.label);
      obj.userData.label.children.forEach(child => {
        if (child.material?.map) child.material.map.dispose();
        if (child.material) child.material.dispose();
      });
      obj.userData.label = null;
    }

    delete obj.userData.isHovered;
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
    const intersection = intersections[0];
    const hitObject = intersection.object;

    if (line) line.scale.z = intersection.distance;

    if (hitObject instanceof THREE.Mesh) {
      const currentNodeId = String(hitObject.__data?.id || '');

      if (currentNodeId !== lastHoveredNodeId) {
        console.log("🔍 Hovered node:", hitObject.__data);
        try {
          const inputSource = controller.userData.inputSource;
          const actuator = inputSource?.gamepad?.hapticActuators?.[0];
          actuator?.pulse?.(0.8, 50);
          console.log(`✅ Haptics triggered for new node: ${currentNodeId}`);
        } catch (err) {
          console.warn("Haptic feedback error:", err);
        }
        lastHoveredNodeId = currentNodeId;
      }

      hitObject.userData.isHovered = true;
      controller.userData.hoveredObject = hitObject;
      intersected.push(hitObject);

      if (!hitObject.userData.originalMaterial) {
        hitObject.userData.originalMaterial = hitObject.material;
        hitObject.material = hitObject.material.clone();
      }

      if (hitObject.material?.emissive) {
        hitObject.material.emissive.setHex(0xff0000);
      }

      if (!hitObject.userData.label && hitObject.__data) {
        const label = createLabelFromNodeData(hitObject.__data);
        label.userData.sourceNode = hitObject;
        hitObject.userData.label = label;
        labelContainer.add(label);

        hitObject.getWorldPosition(tempVector);
        label.position.copy(tempVector);
        label.position.y += 0.5;
        label.lookAt(camera.position);
      }
    }
  } else {
    lastHoveredNodeId = null;
    if (line) line.scale.z = raycaster.far;
    controller.userData.hoveredObject = null;
  }
}


export function updateLabels(camera) {
  if (!labelContainer) return;
  labelContainer.children.forEach(label => {
    const sourceNode = label.userData?.sourceNode;
    if (sourceNode) {
      sourceNode.getWorldPosition(tempVector);
      label.position.copy(tempVector);
      label.position.y += 0.5;
      label.lookAt(camera.position);
    }
  });
}

// setupController,
// handleJoystickInput,
// setupVRNodeSelection,
// handleXButtonInput,
// setupGraphSwitchButtons,