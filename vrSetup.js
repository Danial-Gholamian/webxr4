//vrSetup.js
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';

// --- Constants ---
const movementSpeed = 0.5;
const rotationSpeed = 0.03;
const deadZone = 0.1;
const laserDistance = 10;

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
  laser.userData.isLaser = true;

  controller.add(laser);
  controller.userData.laser = laser;
  cameraGroup.add(controller);

  controller.addEventListener('squeezestart', () => teleportFromController(controller, cameraGroup));

  console.log(`Controller ${index} setup complete.`);
}

// --- 2. Teleport Movement ---
function teleportFromController(controller, cameraGroup, teleportDistance = 5) {
  const direction = new THREE.Vector3();
  const position = new THREE.Vector3();

  controller.getWorldDirection(direction);
  direction.y = 0;
  direction.normalize();

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

// --- 4. Trigger Selection ---
let vrNodeSelectionInitialized = false;

function setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate) {
  function onVRSelect(event) {
    const controller = event.target;
    console.log(` VR selectstart from ${controller === controller1 ? 'Left' : 'Right'} Controller`);

    if (!GraphRef.current?.scene) return;

    const raycaster = new THREE.Raycaster();
    const matrix = new THREE.Matrix4();

    matrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
    raycaster.far = 10;

    const nodes = [];
    GraphRef.current.scene().traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.__data) nodes.push(obj);
    });

    const intersections = raycaster.intersectObjects(nodes, false);
    if (intersections.length > 0) {
      const node = intersections[0].object.__data;
      console.log(" VR Selected node:", node);
      requestGraphUpdate('SUBGRAPH', node.id); // Always use SUBGRAPH
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
    console.log(`[${handedness}] HERE inputSource:`, inputSource);

    const gamepad = inputSource?.gamepad;
    if (!gamepad) {
      console.warn(` HERE [${handedness}] No gamepad available`);
      return;
    }

    if (!gamepad.buttons || gamepad.buttons.length === 0) {
      console.warn(` HERE [${handedness}] No buttons on gamepad`);
      return;
    }

    console.log(`HERE [${handedness}] Gamepad buttons state:`, gamepad.buttons);

    const buttonIndex = 0; // A (right) or X (left)
    const button = gamepad.buttons[buttonIndex];

    if (button?.pressed) {
      console.log(`HERE [${handedness}] Button ${buttonIndex} is PRESSED`);

      const raycaster = new THREE.Raycaster();
      const matrix = new THREE.Matrix4();

      matrix.identity().extractRotation(controller.matrixWorld);
      raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
      raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
      raycaster.far = 10;

      const nodes = [];
      GraphRef.current.scene().traverse(obj => {
        if (obj instanceof THREE.Mesh && obj.__data) nodes.push(obj);
      });

      const intersections = raycaster.intersectObjects(nodes, false);
      console.log(`HERE [${handedness}] Raycast found ${intersections.length} intersections`);

      if (intersections.length > 0) {
        const nodeId = intersections[0].object.__data.id;
        console.log(`HERE  [${handedness}] Button ${buttonIndex} selected node: ${nodeId}`);
        requestGraphUpdate('DIRECT', nodeId);
      } else {
        console.warn(`HERE  [${handedness}] Button ${buttonIndex} pressed but hit nothing`);
      }
    }
  }

  function pollGamepadButtons() {
    console.log('HERE pollGamepadButtons is running');

    if (controller1.userData.inputSource) {
      console.log('HERE Left controller inputSource exists');
      checkButtonPress(controller1, 'left');
    } else {
      console.warn('HERE Left controller inputSource missing');
    }

    if (controller2.userData.inputSource) {
      console.log('🔍HERE Right controller inputSource exists');
      checkButtonPress(controller2, 'right');
    } else {
      console.warn('HERE Right controller inputSource missing');
    }
  }

  return pollGamepadButtons;
}



// --- Laser Reset (Optional) ---
function updateLaserPointer(controller) {
  if (controller.userData.laser && controller.userData.laser.scale.z < laserDistance) {
    controller.userData.laser.scale.z = laserDistance;
  }
}

// --- Exports ---
export {
  setupController,
  teleportFromController,
  handleJoystickInput,
  setupVRNodeSelection,
  setupGraphSwitchButtons,
  updateLaserPointer
};
