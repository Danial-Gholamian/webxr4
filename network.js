// network.js
import { io } from 'socket.io-client';
import * as THREE from 'three';
import { highlightSubgraph } from './main.js';

export const socket = io('https://webxr4-server.fly.dev')

const userAvatars = {}; // socket.id -> { head, left, right }

let scene = null;
export function setScene(s) {
  scene = s;
}

socket.on('connect', () => {
  console.log('Connected as', socket.id);
});

socket.on('user-update', ({ id, head, left, right }) => {
  if (!userAvatars[id]) {
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.5, transparent: true });

    userAvatars[id] = {
      head: new THREE.Mesh(new THREE.SphereGeometry(0.1), ghostMat),
      left: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), ghostMat),
      right: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), ghostMat)
    };

    scene.add(userAvatars[id].head, userAvatars[id].left, userAvatars[id].right);
  }

  userAvatars[id].head.position.fromArray(head);
  userAvatars[id].left.position.fromArray(left);
  userAvatars[id].right.position.fromArray(right);
});

socket.on('user-disconnect', id => {
  const avatar = userAvatars[id];
  if (avatar) {
    scene.remove(avatar.head, avatar.left, avatar.right);
    delete userAvatars[id];
  }
});

// Shared node selection
socket.on('node-select', ({ nodeId, mode }) => {
  highlightSubgraph(nodeId, mode);
});

// Utility function to send transform updates
export function broadcastAvatar(camera, controller1, controller2) {
  socket.emit('user-update', {
    id: socket.id,
    head: camera.position.toArray(),
    left: controller1.position.toArray(),
    right: controller2.position.toArray()
  });
}

// Utility function to broadcast node clicks
export function broadcastNodeSelection(nodeId, mode = 'DIREKT') {
  socket.emit('node-select', { nodeId, mode });
}
