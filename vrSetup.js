//vrSetup.js
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { schoolPeriods } from './periodDefs';
import { highlightPeriod } from './main.js';
import { squeezeLefttPrevPeriod, squeezeRightNextPeriod } from './network.js';

// --- Constants ---
const movementSpeed = 0.5;
const rotationSpeed = 0.03;
const deadZone = 0.1;
const laserDistance = 2000;
const xButtonIndex = 4; // xr-standard index for X (left) / A (right)
const yButtonIndex = 5; // xr-standard index for y (left) / b (right)
const aButtonIndex = 4; // index 4 is A (right controller)

let currentPeriodIndex = 0;
// --- 1. Controller Setup (with laser + teleport) ---
function setupController(controller, index, renderer, cameraGroup) {
  const controllerGrip = renderer.xr.getControllerGrip(index);
  const modelFactory = new XRControllerModelFactory();
  const controllerModel = modelFactory.createControllerModel(controllerGrip);
  controllerGrip.add(controllerModel);
  cameraGroup.add(controllerGrip);

  const laserGeometry = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0, 0, -1)
  ]);
  const laserMaterial = new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 });
  const laser = new THREE.Line(laserGeometry, laserMaterial);
  laser.name = 'laser';
  laser.scale.z = laserDistance;
  console.log(`Laser lenght ${laserDistance}`)
  laser.userData.isLaser = true;

  controller.add(laser);
  controller.userData.laser = laser;
  cameraGroup.add(controller);

  controller.addEventListener('squeezestart', () => {
    if (index === 0) {
      // Left controller → go back
      cyclePeriod(-1);
      squeezeLefttPrevPeriod();
    } else if (index === 1) {
      // Right controller → go forward
      cyclePeriod(1);
      squeezeRightNextPeriod();
    }
  });
}

// --- 1.2 Changing time slices ---
function cyclePeriod(delta) {
  currentPeriodIndex = (currentPeriodIndex + delta + schoolPeriods.length) % schoolPeriods.length;
  const period = schoolPeriods[currentPeriodIndex];
  highlightPeriod(period);
  console.log(`Period changed to: ${period}`);
}

// --- 2. Teleport Movement ---
function teleportFromController(controller, cameraGroup, teleportDistance = 5) {
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();

  controller.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();
  
  // Add this line to reverse direction
  direction.multiplyScalar(-1); 
  controller.getWorldPosition(position);
  const target = position.clone().add(direction.multiplyScalar(teleportDistance));

  cameraGroup.position.set(target.x, cameraGroup.position.y, target.z);
  console.log(" Teleported cameraGroup to:", cameraGroup.position);
}

// --- 3. Thumbstick Joystick Movement + Rotation ---
function handleJoystickInput(xrFrame, camera, cameraGroup) {
  const session = xrFrame.session;
  if (!session) return;

  for (const source of session.inputSources) {
    const gamepad = source.gamepad;
    if (!gamepad || !source.handedness) continue;

    const [ , , x, y ] = gamepad.axes;

    if (source.handedness === "left" && Math.abs(x) > deadZone) {
      cameraGroup.rotation.y -= x * rotationSpeed;
    }

    if (source.handedness === "right") {
      moveThumbstick(x, y, camera, cameraGroup);
    }
  }
}

function moveThumbstick(inputX, inputY, camera, cameraGroup, speed = movementSpeed) {
  if (Math.abs(inputX) < deadZone && Math.abs(inputY) < deadZone) return;

  const direction = new THREE.Vector3();
  camera.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

  const right = new THREE.Vector3();
  right.crossVectors(camera.up, direction).normalize();

  const moveVector = new THREE.Vector3();
  moveVector.add(right.multiplyScalar(inputX * speed));
  moveVector.add(direction.multiplyScalar(-inputY * speed));

  cameraGroup.position.add(moveVector);
}

// --- 4. Trigger Selection ---, today
let vrNodeSelectionInitialized = false;
let lastSelectedCapsule = null;

function setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate, scene, cameraGroup) {
  function onVRSelect(event) {
    const controller = event.target;
    const controllerSide = controller === controller1 ? 'left' : 'right';
    console.log(` VR selectstart from ${controllerSide} Controller`);

    const raycaster = new THREE.Raycaster();
    const matrix = new THREE.Matrix4();

    matrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
    raycaster.far = laserDistance;

    const uiPanel = scene.getObjectByName('FilterUIPanel') || cameraGroup.getObjectByName('FilterUIPanel');

    if (uiPanel && uiPanel.userData.panelState === 'hidden') {
      const interactiveObjects = [];
      uiPanel.traverse(obj => {
        if (obj.isMesh && obj.userData?.interactive) {
          interactiveObjects.push(obj);
        }
      });

      const hits = raycaster.intersectObjects(interactiveObjects, false);
// now debugg
      if (hits.length > 0) {
        const hit = hits[0].object;
        const { onClick, label, target } = hit.userData;

        console.log('VR ray hit object:', hit.name);
        console.log('hit.userData:', hit.userData);
        console.log('hit target material:', target?.material?.color.getHexString());

        // Reset previous selection
        if (lastSelectedCapsule && lastSelectedCapsule !== target) {
          console.log(' Deselecting previous capsule');
          lastSelectedCapsule.material.color.copy(lastSelectedCapsule.userData.defaultColor);
          lastSelectedCapsule.userData.isSelected = false;
        }

        // Set new selection
        if (target?.material) {
          const selectedColor = target.userData.selectedColor || new THREE.Color(0x3366ff);
          console.log(' Selecting capsule:', label, 'Color:', selectedColor.getHexString());
          target.material.color.copy(selectedColor);
          target.userData.isSelected = true;
          lastSelectedCapsule = target;
        } else {
          console.warn(' No target material found');
        }

        if (typeof onClick === 'function') onClick(label);
        console.log(` Capsule clicked: ${label}`);
        return;
      }

    }

    // --- Fallback to graph node selection ---
    if (!GraphRef.current?.scene) return;

    const graphNodes = [];
    GraphRef.current.scene().traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.__data) graphNodes.push(obj);
    });

    const hits = raycaster.intersectObjects(graphNodes, false);
    if (hits.length > 0) {
      const node = hits[0].object.__data;
      console.log(" VR Selected node:", node);
      requestGraphUpdate('SUBGRAPH', node.id);
    } else {
      console.log(`HERE  [${controllerSide}] Button 0 pressed but hit nothing`);
    }
  }

  if (!vrNodeSelectionInitialized) {
    controller1.addEventListener('selectstart', onVRSelect);
    controller2.addEventListener('selectstart', onVRSelect);
    vrNodeSelectionInitialized = true;
    console.log("setupVRNodeSelection: Listeners initialized.");
  }
}





function setupGraphSwitchButtons(controller1, controller2, GraphRef, requestGraphUpdate) {
  function checkButtonPress(controller, handedness) {
    const inputSource = controller.userData.inputSource;

    const gamepad = inputSource?.gamepad;
    if (!gamepad) {
      return;
    }

    if (!gamepad.buttons || gamepad.buttons.length === 0) {
      return;
    }

    const buttonIndex = 0; // A (right) or X (left)
    const button = gamepad.buttons[buttonIndex];

    if (button?.pressed) {

      const raycaster = new THREE.Raycaster();
      const matrix = new THREE.Matrix4();

      matrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
      raycaster.far = laserDistance;

      const nodes = [];
      GraphRef.current.scene().traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.__data) nodes.push(obj);
      });

      const intersections = raycaster.intersectObjects(nodes, false);

      if (intersections.length > 0) {
        const nodeId = intersections[0].object.__data.id;
        requestGraphUpdate('DIRECT', nodeId);
      } else {
        console.warn(`HERE  [${handedness}] Button ${buttonIndex} pressed but hit nothing`);
      }
    }
  }

  
  function pollGamepadButtons() {

    if (controller1.userData.inputSource) {
      checkButtonPress(controller1, 'left');
    } 

    if (controller2.userData.inputSource) {
      checkButtonPress(controller2, 'right');
    } 
  }

  return pollGamepadButtons;
}


/**
 * Polls the left controller’s gamepad each frame and calls onXPress()
 * exactly once per button-down event.
 */
function handleXButtonInput(xrFrame, onXPress) {
  if (!xrFrame || typeof onXPress !== 'function') return;

  // 1) find the left-hand gamepad
  let isPressed = false;
  for (const source of xrFrame.session.inputSources) {
    if (source.handedness === 'left' && source.gamepad) {
      const btns = source.gamepad.buttons;
      if (btns.length > xButtonIndex && btns[xButtonIndex].pressed) {
        isPressed = true;
        break;
      }
    }
  }

  // 2) edge-detect: fire only when going from up → down
  if (isPressed && !handleXButtonInput._wasPressed) {
    onXPress();
  }
  handleXButtonInput._wasPressed = isPressed;
}
handleXButtonInput._wasPressed = false;




// --- Laser Reset (Optional) ---
function updateLaserPointer(controller) {
  if (controller.userData.laser && controller.userData.laser.scale.z < laserDistance) {
    controller.userData.laser.scale.z = laserDistance;
  }
}

export function handleAButtonInput(xrFrame, onAPress) {
  if (!xrFrame || typeof onAPress !== 'function') return;

  let isPressed = false;
  for (const source of xrFrame.session.inputSources) {
    if (source.handedness === 'right' && source.gamepad) {
      const btns = source.gamepad.buttons;
      if (btns.length > aButtonIndex && btns[aButtonIndex].pressed) {
        isPressed = true;
        break;
      }
    }
  }

  if (isPressed && !handleAButtonInput._wasPressed) {
    onAPress();
  }

  handleAButtonInput._wasPressed = isPressed;
}
handleAButtonInput._wasPressed = false;


// --- Exports ---
export {
  setupController,
  teleportFromController,
  handleJoystickInput,
  handleXButtonInput,
  setupVRNodeSelection,
  setupGraphSwitchButtons,
  updateLaserPointer
};
