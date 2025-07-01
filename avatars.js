// avatars.js
import * as THREE from 'three';

export function createAvatar(material) {
  material ??= new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.5, transparent: true});
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.1), material);
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), material);
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), material);
  return {head, left, right};
}

export function updateLocalAvatar(avatar, camera , controller1, controller2) {
  avatar.head.position.copy(camera.position);
  avatar.head.quaternion.copy(camera.quaternion);
  avatar.left.position.copy(controller1.position);
  avatar.left.quaternion.copy(controller1.quaternion);
  avatar.right.position.copy(controller2.position);
  avatar.right.quaternion.copy(controller2.quaternion);
}

export function updateRemoteAvatar(avatar, targetPosition, targetQuaternion, factor = 0.2) {
  avatar.head.position.lerp(targetPosition.head, factor);
  avatar.head.quaternion.slerp(targetQuaternion.head, factor);
  avatar.left.position.lerp(targetPosition.left, factor);
  avatar.left.quaternion.slerp(targetQuaternion.left, factor);
  avatar.right.position.lerp(targetPosition.right, factor);
  avatar.right.quaternion.slerp(targetQuaternion.right, factor);
}