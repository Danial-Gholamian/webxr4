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
    position: 0.15,
    rotation: 0.12
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


let username = null;


let isConnected = false;

socket.on('connect', () => {
  isConnected = true;

  if (username) {
    socket.emit('user-join', { id: socket.id, name: username });
  }
});

export function setUsername(name) {
  username = name;

  if (isConnected) {
    socket.emit('user-join', { id: socket.id, name: username });
  }
}


// 1. Helper function to create the yellow laser mesh
const createRemoteLaser = () => {
  const geo = new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 0, 0), 
    new THREE.Vector3(0, 0, -1)
  ]);
  const mat = new THREE.LineBasicMaterial({ 
    color: 0xffff00, 
    transparent: true, 
    opacity: 0.8,
    depthTest: false 
  });
  const line = new THREE.Line(geo, mat);
  line.name = "remoteLaser";
  return line;
};

socket.on('user-update', async ({ id, head, left, right, headRot, leftRot, rightRot, leftLaserL, rightLaserL
  ,windowStart, windowEnd
 }) => {
  if (id === socket.id || !scene) return;

  // 2. If avatar doesn't exist at all, create it
  if (!userAvatars[id]) {
    const avatar = await createAvatar(knownUsers[id] || '');
    userAvatars[id] = {
      ...avatar,
      targetPosition: { head: new THREE.Vector3(), left: new THREE.Vector3(), right: new THREE.Vector3() },
      targetQuaternion: { head: new THREE.Quaternion(), left: new THREE.Quaternion(), right: new THREE.Quaternion() }
    };
    scene.add(avatar.head, avatar.left, avatar.right);
  }

  const avatar = userAvatars[id];

  // 3. THE CRITICAL FIX: Ensure lasers exist even if avatar was spawned via user-list
  if (!avatar.leftLaser) {
    avatar.leftLaser = createRemoteLaser();
    avatar.left.add(avatar.leftLaser);
  }
  if (!avatar.rightLaser) {
    avatar.rightLaser = createRemoteLaser();
    avatar.right.add(avatar.rightLaser);
  }

  // 4. Standard interpolation and scaling
  avatar.targetPosition.head.fromArray(head);
  avatar.targetPosition.left.fromArray(left);
  avatar.targetPosition.right.fromArray(right);
  
  const decompressRot = arr => arr.map(v => v / ROTATION_COMPRESSION_FACTOR);
  avatar.targetQuaternion.head.fromArray(decompressRot(headRot));
  avatar.targetQuaternion.left.fromArray(decompressRot(leftRot));
  avatar.targetQuaternion.right.fromArray(decompressRot(rightRot));

  // 5. Update Laser Scales
  if (avatar.leftLaser) {
    avatar.leftLaser.scale.z = leftLaserL || 0;
    avatar.leftLaser.visible = (leftLaserL > 0.1);
  }
  if (avatar.rightLaser) {
    avatar.rightLaser.scale.z = rightLaserL || 0;
    avatar.rightLaser.visible = (rightLaserL > 0.1);
  }
  if (window.histogramRef && windowStart !== undefined) {
      window.histogramRef.updateRemoteWindow(id, windowStart, windowEnd);
  }
});

socket.on('user-disconnect', id => {
  const avatar = userAvatars[id];
  if (avatar) {
    scene.remove(avatar.head, avatar.left, avatar.right);
    delete userAvatars[id];
  }
  if (window.histogramRef) {
    window.histogramRef.removeRemoteWindow(id);
  }
});

const AVATAR_UPDATE_THRESHOLD = 0.0004;
let lastAvatarUpdate = 0;
let lastPositions = {
  head: new THREE.Vector3(),
  left: new THREE.Vector3(),
  right: new THREE.Vector3()
};

export function broadcastAvatar(camera, controller1, controller2, timelineManager) {
  const now = Date.now();
  if (now - lastAvatarUpdate < AVATAR_UPDATE_INTERVAL) return;

  // 1. Get the bucket once at the start
  const currentBucket = timelineManager ? timelineManager.getCurrentBucket() : { start: 0, end: 0 };

  const compressRot = q => [
    Math.round(q.x * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.y * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.z * ROTATION_COMPRESSION_FACTOR),
    Math.round(q.w * ROTATION_COMPRESSION_FACTOR)
  ];

  const headPos = new THREE.Vector3();
  const leftPos = new THREE.Vector3();
  const rightPos = new THREE.Vector3();

  camera.getWorldPosition(headPos);
  controller1.getWorldPosition(leftPos);
  controller2.getWorldPosition(rightPos);

  const leftLaser = controller1.userData.laser?.scale.z || 0;
  const rightLaser = controller2.userData.laser?.scale.z || 0;

  // REMOVED the second 'const currentBucket' line that was here

  socket.emit('user-update', {
    id: socket.id,
    head: headPos.toArray(),
    left: leftPos.toArray(),
    right: rightPos.toArray(),
    headRot: compressRot(camera.quaternion),
    leftRot: compressRot(controller1.quaternion),
    rightRot: compressRot(controller2.quaternion),
    leftLaserL: leftLaser,
    rightLaserL: rightLaser,
    windowStart: currentBucket.start, // Now using the one from the top
    windowEnd: currentBucket.end
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

socket.on('user-list', async (userArray) => {
  console.log('[RECEIVE] user-list', userArray);

  // 1. Update the metadata map for names
  Object.keys(knownUsers).forEach(k => delete knownUsers[k]);
  userArray.forEach(({ socketId, name }) => {
    knownUsers[socketId] = name;
  });

  // SAFETY CHECK: If the Three.js scene isn't initialized yet, stop here.
  // The users are recorded in knownUsers, so they will spawn once the first 
  // 'user-update' arrives OR when the next 'user-list' fires after scene is set.
  if (!scene) {
    console.warn('[Network] Received user-list but scene is not ready. Skipping avatar spawn.');
    return; 
  }

  // 2. Sync Avatars
  for (const { socketId, name } of userArray) {
    if (socketId === socket.id) continue;

    if (!userAvatars[socketId]) {
      console.log(`[Network] Spawning avatar for existing user: ${name}`);
      
      const avatar = await createAvatar(name || 'Anonymous');
      
      userAvatars[socketId] = {
        ...avatar,
        name: name,
        targetPosition: {
          head: new THREE.Vector3(0, 1.6, 0), 
          left: new THREE.Vector3(-0.2, 1.5, 0),
          right: new THREE.Vector3(0.2, 1.5, 0)
        },
        targetQuaternion: {
          head: new THREE.Quaternion(),
          left: new THREE.Quaternion(),
          right: new THREE.Quaternion()
        }
      };

      scene.add(avatar.head, avatar.left, avatar.right);
    }
  }

  // 3. Optional: Cleanup "Zombies" 
  // If someone is in userAvatars but NOT in the new userArray, remove them
  const currentSocketIds = userArray.map(u => u.socketId);
  Object.keys(userAvatars).forEach(id => {
    if (!currentSocketIds.includes(id)) {
      const avatar = userAvatars[id];
      scene.remove(avatar.head, avatar.left, avatar.right);
      delete userAvatars[id];
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

