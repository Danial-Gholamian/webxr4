// avatars.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

const HEADSET_MODEL = `${import.meta.env.BASE_URL}/models/meta_quest_3.glb`;
const CONTROLLER_MODEL = `${import.meta.env.BASE_URL}/models/vr_controller.glb`;

export async function createAvatar(name = '') {
  const avatarRoot = new THREE.Group();
  
  // Containers: These receive the raw Network data
  const head = new THREE.Group(); 
  const left = new THREE.Group();
  const right = new THREE.Group();

  avatarRoot.add(head, left, right);

  // --- HEADSET LOAD ---
  loader.load(HEADSET_MODEL, gltf => {
    const model = gltf.scene;
    // Rotate the model INSIDE the container to fix the file orientation
    model.rotation.y = Math.PI; 
    head.add(model);
  });

  // --- CONTROLLER LOAD ---
  loader.load(CONTROLLER_MODEL, gltf => {
    const ctrl = gltf.scene;
    
    const leftModel = ctrl.clone();
    const rightModel = ctrl.clone();

    // Fix Controller Orientation:
    // 1. Flip 180 (Y) so it faces away from the user
    // 2. Tilt -45 degrees (X) so the sensor ring points forward like a laser
    const fixX = -Math.PI / 4; 
    const fixY = Math.PI;

    leftModel.rotation.set(fixX, fixY, 0);
    rightModel.rotation.set(fixX, fixY, 0);

    // Minor position adjustment to put the "handle" in the virtual hand
    leftModel.position.set(0, -0.03, 0.02);
    rightModel.position.set(0, -0.03, 0.02);
    window.debugLeft = leftModel;
    window.debugLeft = rightModel;
    left.add(leftModel);
    right.add(rightModel);
  });

  // Label - Attached to root so it doesn't flip/mirror with the head
  const nameLabel = new Text();
  nameLabel.text = name;
  nameLabel.fontSize = 0.06;
  nameLabel.anchorX = 'center';
  nameLabel.anchorY = 'bottom';
  avatarRoot.add(nameLabel); 

  return { root: avatarRoot, head, left, right, nameLabel };
}

// --- Local Sync Fix ---
const HEAD_ROTATION_FIX = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, Math.PI, 0)
);

export function updateLocalAvatar(avatar, camera, controller1, controller2) {
  avatar.head.position.copy(camera.position);
  avatar.head.quaternion.copy(camera.quaternion).multiply(HEAD_ROTATION_FIX);

  avatar.left.position.copy(controller1.position);
  avatar.left.quaternion.copy(controller1.quaternion);

  avatar.right.position.copy(controller2.position);
  avatar.right.quaternion.copy(controller2.quaternion);

  // Keep label above the moving head
  if (avatar.nameLabel) {
    avatar.nameLabel.position.copy(camera.position);
    avatar.nameLabel.position.y += 0.3;
  }
}

export function updateRemoteAvatar(avatar, targetPos, targetQuat, factor = 0.2) {
  avatar.head.position.lerp(targetPos.head, factor);
  avatar.head.quaternion.slerp(targetQuat.head, factor);

  avatar.left.position.lerp(targetPos.left, factor);
  avatar.left.quaternion.slerp(targetQuat.left, factor);

  avatar.right.position.lerp(targetPos.right, factor);
  avatar.right.quaternion.slerp(targetQuat.right, factor);

  if (avatar.nameLabel) {
    avatar.nameLabel.position.copy(avatar.head.position);
    avatar.nameLabel.position.y += 0.3;
  }
}