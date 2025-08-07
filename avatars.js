// avatars.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';

const gltfLoader = new GLTFLoader();

export async function createAvatar(material, name = '') {
  const head = new THREE.Group(); // Placeholder, we'll add the GLB to this group
  const left = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ffff }));
  const right = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), new THREE.MeshBasicMaterial({ color: 0x00ffff }));

  // Load the Ready Player Me avatar
  gltfLoader.load(
    'https://models.readyplayer.me/688b45a04c405a37adca7af9.glb',
    gltf => {
      const avatarModel = gltf.scene;
      avatarModel.scale.set(1.5, 1.5, 1.5);
      avatarModel.position.set(0, -1.6, 0); // Adjust if needed
      head.add(avatarModel);
    },
    undefined,
    error => {
      console.error('Failed to load avatar:', error);
    }
  );

  const nameLabel = new Text();
  nameLabel.text = name;
  nameLabel.fontSize = 0.04;
  nameLabel.anchorX = 'center';
  nameLabel.anchorY = 'bottom';
  nameLabel.color = 0xffffaa;
  nameLabel.position.set(0, 1.6, 0); // was 0.25, now raised above avatar
  nameLabel.sync();
  head.add(nameLabel);

  return { head, left, right, nameLabel };
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

// 'https://models.readyplayer.me/688b45a04c405a37adca7af9.glb',