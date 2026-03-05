// network.js
import { io } from 'socket.io-client';
import * as THREE from 'three';
import { highlightPeriod, AVATAR_UPDATE_INTERVAL } from './main.js';
import { createAvatar } from './avatars.js';
import { myUsername, getActivePeriods } from './main.js';
import { handleUserList } from './voice.js';


let injectedHandlers = null;

export function registerNetworkHandlers(handlers) {
  injectedHandlers = handlers;
}



const ROTATION_COMPRESSION_FACTOR = 1000;
export const knownUsers = {}; // { socketId: name }
export let myAvatar = null;


let _uiPanel = null;
export function setUIPanel(panel) {
  _uiPanel = panel;
}

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
  socket.emit('user-join', { id: socket.id, name: myUsername });
});

socket.on('user-update', async ({ id, head, left, right, headRot, leftRot, rightRot }) => {
  const username = knownUsers[id] || id;
  // console.log(`[RECEIVE] user-update from ${username}`, head);

  // Skip self
  if (id === socket.id) return;

  if (!userAvatars[id]) {
    const avatar = await createAvatar(knownUsers[id] || '');
    userAvatars[id] = {
      ...avatar,
      name: knownUsers[id],
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


  const headPos = new THREE.Vector3();
  const leftPos = new THREE.Vector3();
  const rightPos = new THREE.Vector3();

  // Then populate
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


export function broadcastGraphReset() {
  console.log("Broadcasting graph reset");
  socket.emit('graph-reset', {}, (ack) => {
    if (!ack) setTimeout(() => broadcastGraphReset(), 100);
  });
}


socket.on('node-select', ({ nodeId, mode }) => {
  console.log('Received selection', nodeId, mode);

  if (String(nodeId) === String(currentHighlightId)) return;
  currentHighlightId = nodeId;

  if (injectedHandlers?.onNodeSelect) {
    console.log('[network] using injected handler');
    injectedHandlers.onNodeSelect(nodeId, mode);
  }
  // else {
  //   highlightSubgraph(nodeId, mode); // fallback
  // }
});

socket.on('graph-reset', () => {
  console.log('Remote reset received');

  if (injectedHandlers?.onGraphReset) {
    console.log('[network] using injected handler');
    injectedHandlers.onGraphReset();
  }
  //  else {
  //   resetGraph();
  // }

});


socket.on('dataset-change', (msg) => {
  console.log('Received dataset-change', msg);
  if (injectedHandlers?.onDatasetChange) {
    console.log('Remote switch dataset received:', msg.datasetKey);
    injectedHandlers.onDatasetChange(msg.datasetKey);
  }
});


socket.on('group-select', ({ groupName }) => {
  console.log("Received group selection:", groupName);

  if (injectedHandlers?.onGroupSelect) {
    console.log('[network] using injected handler');
    injectedHandlers.onGroupSelect(groupName);
  }
  // else {
  //   highlightGroup(groupName);
  // }
});


socket.on('period-stack-toggle', ({ visible, context }) => {
  console.log("Received period stack toggle:", visible, context);

  if (injectedHandlers?.onPeriodStackToggle) {
    console.log('[network] using injected handler');
    injectedHandlers.onPeriodStackToggle(visible, context);
  }
  // else {
  //   applyRemotePeriodStackToggle(visible, context);
  // }
});

let currentPeriodIndex = 0;
export function getCurrentPeriodIndex() {
  return currentPeriodIndex;
}

export function setCurrentPeriodIndex(index, broadcast = true) {
  currentPeriodIndex = Math.max(0, Math.min(index, getActivePeriods().length - 1));
  const period = getActivePeriods()[currentPeriodIndex];
  console.warn("LEGACY HIGHLIGHTPERIOD METHOD STILL BEING USED :(")
  highlightPeriod(period);

  if (broadcast) {
    socket.emit('period-change', period);
  }
}


export let squeezeRightNextPeriod = () => setCurrentPeriodIndex(getCurrentPeriodIndex() + 1, true);
export let squeezeLefttPrevPeriod = () => setCurrentPeriodIndex(getCurrentPeriodIndex() - 1, true);

socket.on('period-change', (period) => {
  console.log("Received period change:", period);

  if (injectedHandlers?.onPeriodChange) {
    console.log('[network] using injected handler');
    injectedHandlers.onPeriodChange(period);
  } else {
    const index = getActivePeriods().indexOf(period);
    if (index !== -1) {
      setCurrentPeriodIndex(index, false);
    }
  }
});

socket.on('user-list', (userArray) => {
  console.log('[RECEIVE] user-list', userArray);


  Object.keys(knownUsers).forEach(k => delete knownUsers[k]);

  userArray.forEach(({ socketId, name }) => {
    knownUsers[socketId] = name;
  });


  Object.values(userAvatars).forEach(avatar => {
    if (avatar.nameLabel) {
      avatar.nameLabel.sync();
    }
  });

  if (_uiPanel?.userData?.refreshUsers) {
    _uiPanel.userData.refreshUsers(socket.id);
  }
  handleUserList(userArray);

});

export function broadcastGroupSelection(groupName) {
  console.log("Broadcasting group selection:", groupName);
  socket.emit('group-select', { groupName });
}

export function broadcastPeriodStackToggle(visible, context = {}) {
  console.log("Broadcasting period stack toggle:", visible, context);
  socket.emit('period-stack-toggle', { visible, context });
}

export function broadcastDatasetChange(datasetKey) {
  console.log('📡 broadcastDatasetChange called with', datasetKey);

  socket.emit('dataset-change', {
    datasetKey
  });
}

