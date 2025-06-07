// network.js
import { io } from 'socket.io-client';
import * as THREE from 'three';
import { highlightSubgraph, resetGraph } from './main.js';
const ROTATION_COMPRESSION_FACTOR = 1000;


export const socket = io('https://webxr4-server.fly.dev')

export const userAvatars = {}; // socket.id -> { head, left, right }
// network.js (top level)
export const avatarInterpolation = {
  factors: {
    position: 0.25,
    rotation: 0.2 
  },
  
  update(avatars, deltaTime) {
    const frameFactor = Math.min(deltaTime * 60, 2.0);
    Object.values(avatars).forEach(avatar => {
      // Apply interpolation
      const posFactor = this.factors.position * frameFactor;
      const rotFactor = this.factors.rotation * frameFactor;
      
      avatar.head.position.lerp(avatar.targetPosition.head, posFactor);
      avatar.left.position.lerp(avatar.targetPosition.left, posFactor);
      avatar.right.position.lerp(avatar.targetPosition.right, posFactor);
      avatar.head.quaternion.slerp(avatar.targetQuaternion.head, rotFactor);
      avatar.left.quaternion.slerp(avatar.targetQuaternion.left, rotFactor);
      avatar.right.quaternion.slerp(avatar.targetQuaternion.right, rotFactor);

    });
  }
};

let scene = null;
let currentHighlightId = null;
export function setScene(s) {
  scene = s;
}

socket.on('connect', () => {
  console.log('Connected as', socket.id);
});

socket.on('user-update', ({ id, head, left, right, headRot, leftRot, rightRot }) => {
  if (!userAvatars[id]) {
    const ghostMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, opacity: 0.5, transparent: true });
    userAvatars[id] = {
      head: new THREE.Mesh(new THREE.SphereGeometry(0.1), ghostMat),
      left: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), ghostMat),
      right: new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.1), ghostMat),
      targetPosition: {
        head: new THREE.Vector3(),
        left: new THREE.Vector3(),
        right: new THREE.Vector3()
      },
      targetQuaternion: {
        head: new THREE.Quaternion(),
        left: new THREE.Quaternion(),
        right: new THREE.Quaternion()
      }
    };
    scene.add(userAvatars[id].head, userAvatars[id].left, userAvatars[id].right);
  }

  const avatar = userAvatars[id];
  avatar.targetPosition.head.fromArray(head);
  avatar.targetPosition.left.fromArray(left);
  avatar.targetPosition.right.fromArray(right);
  const decompressRot = arr => new THREE.Quaternion(
    arr[0] / ROTATION_COMPRESSION_FACTOR,
    arr[1] / ROTATION_COMPRESSION_FACTOR,
    arr[2] / ROTATION_COMPRESSION_FACTOR,
    arr[3] / ROTATION_COMPRESSION_FACTOR
  );

  avatar.targetQuaternion.head.copy(decompressRot(headRot));
  avatar.targetQuaternion.left.copy(decompressRot(leftRot));
  avatar.targetQuaternion.right.copy(decompressRot(rightRot));

  });


socket.on('user-disconnect', id => {
  const avatar = userAvatars[id];
  if (avatar) {
    scene.remove(avatar.head, avatar.left, avatar.right);
    delete userAvatars[id];
  }
});



// Utility function to send transform updates
// in network.js
const AVATAR_UPDATE_INTERVAL = 16; // ms
const AVATAR_UPDATE_THRESHOLD = 0.0004; // ~0.02m squared
let lastAvatarUpdate = 0;
let lastPositions = {
  head: new THREE.Vector3(),
  left: new THREE.Vector3(),
  right: new THREE.Vector3()
};

export function broadcastAvatar(camera, controller1, controller2) {
  const now = Date.now();
  if (now - lastAvatarUpdate < AVATAR_UPDATE_INTERVAL) return;

  // Check if positions have changed significantly
  const headMoved = camera.position.distanceToSquared(lastPositions.head) > AVATAR_UPDATE_THRESHOLD;
  const leftMoved = controller1.position.distanceToSquared(lastPositions.left) > AVATAR_UPDATE_THRESHOLD;
  const rightMoved = controller2.position.distanceToSquared(lastPositions.right) > AVATAR_UPDATE_THRESHOLD;
  
  // Only broadcast if something moved
  if (!(headMoved || leftMoved || rightMoved)) return;

  // Compress rotations to integers for smaller payload
  const compressRot = q => [
    Math.round(q.x * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.y * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.z * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.w * ROTATION_COMPRESSION_FACTOR)
  ];

  socket.volatile.emit('user-update', {
    id: socket.id,
    head: camera.position.toArray(),
    left: controller1.position.toArray(),
    right: controller2.position.toArray(),
    headRot: compressRot(camera.quaternion),
    leftRot: compressRot(controller1.quaternion),
    rightRot: compressRot(controller2.quaternion)
  });

  // Update last positions
  lastPositions.head.copy(camera.position);
  lastPositions.left.copy(controller1.position);
  lastPositions.right.copy(controller2.position);
  lastAvatarUpdate = now;
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