// avatars.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const loader = new GLTFLoader();

// Paths to your models
const HEADSET_MODEL = '/webxr4/models/meta_quest_3.glb';
const CONTROLLER_MODEL = '/webxr4/models/vr_controller.glb';
export async function createAvatar(name = '') {
  const avatarRoot = new THREE.Group();
  // REMOVE: avatarRoot.scale.set(20, 20, 20); 
  // Keep root at scale 1 so world positions map 1:1

  const head = new THREE.Group();
  const left = new THREE.Group();
  const right = new THREE.Group();
  head.rotation.z = Math.PI;
  avatarRoot.add(head, left, right);

  loader.load(HEADSET_MODEL, gltf => {
    const model = gltf.scene;
    // Scale the model, not the group
    model.scale.set(1, 1, 1); 
    head.add(model);
  });

  loader.load(CONTROLLER_MODEL, gltf => {
    const ctrl = gltf.scene;
    ctrl.scale.set(1, 1, 1);
    left.add(ctrl.clone());
    right.add(ctrl.clone());
  });

  // Label
  const nameLabel = new Text();
  nameLabel.text = name;
  nameLabel.fontSize = 0.06;
  nameLabel.anchorX = 'center';
  nameLabel.anchorY = 'bottom';
  nameLabel.position.set(0, 0.25, 0);
  nameLabel.sync();
  head.add(nameLabel);

  return { root: avatarRoot, head, left, right, nameLabel };
}



// ==========================
// Local Avatar Update (camera + controllers)
// ==========================
const HEAD_ROTATION_FIX = new THREE.Quaternion().setFromEuler(
  new THREE.Euler(0, Math.PI, 0)
);

export function updateLocalAvatar(avatar, camera, controller1, controller2) {
  // Head
  avatar.head.position.copy(camera.position);
  avatar.head.quaternion.copy(camera.quaternion).multiply(HEAD_ROTATION_FIX);

  // Controllers
  avatar.left.position.copy(controller1.position);
  avatar.left.quaternion.copy(controller1.quaternion);

  avatar.right.position.copy(controller2.position);
  avatar.right.quaternion.copy(controller2.quaternion);
}



// ==========================
// Remote Avatar Interpolation
// ==========================
export function updateRemoteAvatar(avatar, targetPos, targetQuat, factor = 0.2) {
  avatar.head.position.lerp(targetPos.head, factor);
  avatar.head.quaternion.slerp(targetQuat.head, factor);

  avatar.left.position.lerp(targetPos.left, factor);
  avatar.left.quaternion.slerp(targetQuat.left, factor);

  avatar.right.position.lerp(targetPos.right, factor);
  avatar.right.quaternion.slerp(targetQuat.right, factor);
}
