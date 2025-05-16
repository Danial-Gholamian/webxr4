// network.js
import { io } from 'socket.io-client';
import * as THREE from 'three';
import { highlightSubgraph, resetGraph } from './main.js';

export const socket = io('https://webxr4-server.fly.dev')

const userAvatars = {}; // socket.id -> { head, left, right }

let scene = null;
let currentHighlightId = null;
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



// Utility function to send transform updates
export function broadcastAvatar(camera, controller1, controller2) {
  console.log("Avatar was broadcasted!")
  socket.emit('user-update', {
    id: socket.id,
    head: camera.position.toArray(),
    left: controller1.position.toArray(),
    right: controller2.position.toArray()
  });
}

export function broadcastNodeSelection(nodeId, mode = 'DIRECT') {
  console.log("This node was broadcasted: ", nodeId)
  socket.emit('node-select', { 
    nodeId: String(nodeId), 
    mode: mode.slice(0, 20)
  }, (ack) => { /* ... */ });
}

socket.on('node-select', ({ nodeId, mode }) => {
  console.log('Received selection', nodeId, mode);
  if (String(nodeId) !== String(currentHighlightId)) {
    highlightSubgraph(nodeId, mode);
    currentHighlightId = nodeId;
  }
});

export function broadcastGraphReset() {
  console.log("Broadcasting graph reset");
  socket.emit('graph-reset', {}, (ack) => {
    if (!ack) setTimeout(() => broadcastGraphReset(), 100);
  });
}

socket.on('graph-reset', () => {
  console.log('Remote reset received');
  resetGraph(); // Reuse central function
});