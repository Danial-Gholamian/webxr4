//vrSetup.js
import * as THREE from 'three';
import { XRControllerModelFactory } from 'three/examples/jsm/webxr/XRControllerModelFactory.js';
import { highlightPeriod, getActivePeriods } from './main.js';
import { squeezeLefttPrevPeriod, squeezeRightNextPeriod } from './network.js';

// --- Constants ---
const movementSpeed = 0.9;
const rotationSpeed = 0.03;
const deadZone = 0.1;
const laserDistance = 2000;
const xButtonIndex = 4; // xr-standard index for X (left) / A (right)
const yButtonIndex = 5; // xr-standard index for y (left) / b (right)
const aButtonIndex = 4; // index 4 is A (right controller)
const bBuutonIndex = 5;
const leftStickButtonIndex = 3;   // L3
const rightStickButtonIndex = 3;  // R3

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
      // cyclePeriod(-1);
      // squeezeLefttPrevPeriod();
    } else if (index === 1) {
      // Right controller → go forward
      // cyclePeriod(1);
      // squeezeRightNextPeriod();
    }
  });
}

// --- 1.2 Changing time slices ---
function cyclePeriod(delta) {
  currentPeriodIndex = (currentPeriodIndex + delta + getActivePeriods().length) % getActivePeriods().length;
  const period = getActivePeriods()[currentPeriodIndex];
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

    const [, , x, y] = gamepad.axes;

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

// --- 4. Trigger Selection (Updated for Generic UI) ---
let vrNodeSelectionInitialized = false;
let lastSelectedCapsule = null;

function setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate, scene, cameraGroup, histogram) {
  // Hierarchy of selection
  // Check UI buttons
  // Check histogram bars
  // Check graph nodes
  function onVRSelect(event) {
    const controller = event.target;
    const controllerSide = controller === controller1 ? 'left' : 'right';
    // console.log(`[VR] Select from ${controllerSide}`);

    const raycaster = new THREE.Raycaster();
    const matrix = new THREE.Matrix4();

    // 1. Setup Ray
    matrix.identity().extractRotation(controller.matrixWorld);
    raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
    raycaster.ray.direction.set(0, 0, -1).applyMatrix4(matrix);
    raycaster.far = laserDistance; // 2000

    // ============================================================
    // 2. UI INTERACTION (Panel Buttons)
    // ============================================================
    // We check everything in cameraGroup (includes FilterPanel, TemporalPanel AND histogram as well)
    const intersects = raycaster.intersectObject(cameraGroup, true);

    // Filter hits to find the first actual "Button" (Object with onClick)
    // We use a loop to "bubble up" from the hit point (e.g. text) to the button container
    let uiHit = null;

    for (const hit of intersects) {
      // Check if visible
      if (!hit.object.visible) continue;

      let target = hit.object;

      // Traverse up to find the clickable element
      while (target) {
        if (target.userData && target.userData.onClick) {
          uiHit = target;
          break;
        }
        // Stop if we hit the cameraGroup root
        if (target === cameraGroup) break;
        target = target.parent;
      }

      if (uiHit) break; // Found a button, stop looking
    }

    if (uiHit) {
      console.log(`[VR] Clicked Button: ${uiHit.userData.label || 'Unnamed'}`);

      // A. Fire the Click Handler
      uiHit.userData.onClick();

      // B. Haptic Feedback (Pulse)
      const gamepad = controller.userData.inputSource?.gamepad;
      if (gamepad && gamepad.hapticActuators && gamepad.hapticActuators[0]) {
        gamepad.hapticActuators[0].pulse(0.8, 20); // Strength 0.8, 20ms
      }

      // C. Legacy Highlighting (Only for FilterUIPanel capsules that need manual color change)
      // If the button handles its own re-render (like TemporalPanel), this part is ignored.
      if (uiHit.material && uiHit.userData.selectedColor) {
        if (lastSelectedCapsule && lastSelectedCapsule !== uiHit) {
          // Reset previous
          if (lastSelectedCapsule.userData.defaultColor) {
            lastSelectedCapsule.material.color.copy(lastSelectedCapsule.userData.defaultColor);
          }
        }
        uiHit.material.color.copy(uiHit.userData.selectedColor);
        lastSelectedCapsule = uiHit;
      }

      return; // STOP HERE. Don't click through the UI to the graph behind it.
    }
    // ============================================================
    // 3. GRAPH SELECTION (Fallback)
    // ============================================================
    if (!GraphRef.current?.scene) return;

    const graphNodes = [];
    GraphRef.current.scene().traverse(obj => {
      if (obj instanceof THREE.Mesh && obj.__data) graphNodes.push(obj);
    });

    const hits = raycaster.intersectObjects(graphNodes, false);
    if (hits.length > 0) {
      const node = hits[0].object.__data;
      console.log("[VR] Selected Graph Node:", node.id);

      // Haptics
      const gamepad = controller.userData.inputSource?.gamepad;
      if (gamepad?.hapticActuators?.[0]) gamepad.hapticActuators[0].pulse(0.5, 10);

      requestGraphUpdate('SUBGRAPH', node.id);
    }
  }

  if (!vrNodeSelectionInitialized) {
    controller1.addEventListener('selectstart', onVRSelect);
    controller2.addEventListener('selectstart', onVRSelect);
    vrNodeSelectionInitialized = true;
    console.log("setupVRNodeSelection: Generic Interaction Initialized.");
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

// Managing AButtonInput
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

// Managing BButtonInput
export function handleBButtonInput(xrFrame, onBPress) {
  if (!xrFrame || typeof onBPress !== 'function') return;

  let isPressed = false;
  for (const source of xrFrame.session.inputSources) {
    if (source.handedness === 'right' && source.gamepad) {
      const btns = source.gamepad.buttons;
      if (btns.length > bBuutonIndex && btns[bBuutonIndex].pressed) {
        isPressed = true;
        break;
      }
    }
  }

  if (isPressed && !handleBButtonInput._wasPressed) {
    onBPress();
  }
  handleBButtonInput._wasPressed = isPressed;
}
handleBButtonInput._wasPressed = false;


export function handleYButtonInput(xrFrame, onYPress) {
  if (!xrFrame || typeof onYPress !== 'function') return;

  let isPressed = false;
  for (const source of xrFrame.session.inputSources) {
    if (source.handedness === 'left' && source.gamepad) {
      const btns = source.gamepad.buttons;
      if (btns.length > yButtonIndex && btns[yButtonIndex].pressed) {
        isPressed = true;
        break;
      }
    }
  }


  if (isPressed && !handleYButtonInput._wasPressed) {
    onYPress();
  }

  handleYButtonInput._wasPressed = isPressed;
}

// Generic stick-button handler
function handleStickButton(xrFrame, handedness, buttonIndex, callback) {
  if (!xrFrame) return;

  for (const source of xrFrame.session.inputSources) {
    if (source.handedness === handedness && source.gamepad) {
      const btns = source.gamepad.buttons;

      if (btns.length > buttonIndex) {
        const isPressed = btns[buttonIndex].pressed;

        // Always return state ONCE per frame
        callback(isPressed);
        return;
      }
    }
  }

  // If no button or no input source, report not pressed
  callback(false);
}


let leftStickWasPressed = false;
let rightStickWasPressed = false;

export function handleLeftStickButton(xrFrame, onPress) {
  handleStickButton(xrFrame, "left", leftStickButtonIndex, (isPressed) => {
    if (isPressed && !leftStickWasPressed) {
      console.log("Left stick clicked");
      // REMOVED: cyclePeriod(-1);
      // REMOVED: squeezeLefttPrevPeriod();
      if (onPress) onPress();
    }
    leftStickWasPressed = isPressed;
  });
}

export function handleRightStickButton(xrFrame, onPress) {
  handleStickButton(xrFrame, "right", rightStickButtonIndex, (isPressed) => {
    if (isPressed && !rightStickWasPressed) {
      console.log("Right stick clicked");
      // REMOVED: cyclePeriod(1);
      // REMOVED: squeezeRightNextPeriod();
      if (onPress) onPress();
    }
    rightStickWasPressed = isPressed;
  });
}



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
