// network.js
import { io } from 'socket.io-client';
import * as THREE from 'three';
import { highlightSubgraph, resetGraph, highlightPeriod, periodActiveNodes, AVATAR_UPDATE_INTERVAL } from './main.js';
import { schoolPeriods } from './periodDefs';
import { createAvatar } from './avatars.js';

const ROTATION_COMPRESSION_FACTOR = 1000;

// Test
let lastEmitLogTime = 0;
let lastReceiveLogTimes = {};  // { socketId: timestamp }
//

export const socket = io('https://webxr4-server.fly.dev', {
  transports: ['websocket']  // Force WebSocket, skip long-polling (prevents 400 errors)
});
export const userAvatars = {};
export const avatarInterpolation = {
  factors: {
    position: 0.25,
    rotation: 0.2 
  },
  
  update(avatars, deltaTime) {
    const frameFactor = Math.min(deltaTime * 60, 2.5);
    Object.values(avatars).forEach(avatar => {
      const posFactor = this.factors.position * frameFactor;
      const rotFactor = this.factors.rotation * frameFactor;
      
      avatar.head.position.lerp(avatar.targetPosition.head, posFactor);
      avatar.left.position.lerp(avatar.targetPosition.left, posFactor);
      avatar.right.position.lerp(avatar.targetPosition.right, posFactor);
      
      // CRITICAL: Add rotation interpolation
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
  console.log('[RECEIVE] user-update', id, head, left, right);
  
  // Skip self
  if (id === socket.id) return;

  if (!userAvatars[id]) {
    const avatar = createAvatar();
    userAvatars[id] = {
      ...avatar,
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
    scene.add(avatar.head, avatar.left, avatar.right);
  }

  const avatar = userAvatars[id];
  avatar.targetPosition.head.fromArray(head);
  avatar.targetPosition.left.fromArray(left);
  avatar.targetPosition.right.fromArray(right);

  // Add decompression HERE
  const decompressRot = arr => arr.map(v => v / ROTATION_COMPRESSION_FACTOR);
  
  avatar.targetQuaternion.head.fromArray(decompressRot(headRot));
  avatar.targetQuaternion.left.fromArray(decompressRot(leftRot));
  avatar.targetQuaternion.right.fromArray(decompressRot(rightRot));
});

socket.on('user-disconnect', id => {
  const avatar = userAvatars[id];
  if (avatar) {
    scene.remove(avatar.head, avatar.left, avatar.right);
    delete userAvatars[id];
  }
});

const AVATAR_UPDATE_THRESHOLD = 0.0004;
let lastAvatarUpdate = 0;
let lastPositions = {
  head: new THREE.Vector3(),
  left: new THREE.Vector3(),
  right: new THREE.Vector3()
};

export function broadcastAvatar(camera, controller1, controller2) {
  const now = Date.now();
  if (now - lastAvatarUpdate < AVATAR_UPDATE_INTERVAL) return;

  const compressRot = q => [
    Math.round(q.x * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.y * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.z * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.w * ROTATION_COMPRESSION_FACTOR)
  ];

  // ✅ Correct order: declare first
  const headPos = new THREE.Vector3();
  const leftPos = new THREE.Vector3();
  const rightPos = new THREE.Vector3();

  // ✅ Then populate
  camera.getWorldPosition(headPos);
  controller1.getWorldPosition(leftPos);
  controller2.getWorldPosition(rightPos);

  socket.emit('user-update', {
    id: socket.id,
    head: headPos.toArray(),
    left: leftPos.toArray(),
    right: rightPos.toArray(),
    headRot: compressRot(camera.quaternion),
    leftRot: compressRot(controller1.quaternion),
    rightRot: compressRot(controller2.quaternion)
  });

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

let currentPeriodIndex = 0;
export function getCurrentPeriodIndex() {
  return currentPeriodIndex;
}

export function setCurrentPeriodIndex(index, broadcast = true) {
  currentPeriodIndex = Math.max(0, Math.min(index, schoolPeriods.length - 1));
  const period = schoolPeriods[currentPeriodIndex];
  highlightPeriod(period);
  
  if (broadcast) {
    socket.emit('period-change', period);
  }
}

export let squeezeRightNextPeriod = () => setCurrentPeriodIndex(getCurrentPeriodIndex() + 1, true);
export let squeezeLefttPrevPeriod = () => setCurrentPeriodIndex(getCurrentPeriodIndex() - 1, true);

socket.on('period-change', (period) => {
  const index = schoolPeriods.indexOf(period);
  if (index !== -1) {
    setCurrentPeriodIndex(index, false);
  }
});