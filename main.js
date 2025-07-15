// main.js
export const myUsername = prompt("Enter your name:") || "Anonymous";


// ========================
// Imports and Setup
// ========================
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import ForceGraph3D from '3d-force-graph';
import graphData from './graph-data-periods.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  setupController,
  handleJoystickInput,
  setupVRNodeSelection,
  handleXButtonInput,
  setupGraphSwitchButtons,
  handleAButtonInput
} from './vrSetup.js';
import { detectHover, initLabels,markHoverCacheDirty, hoverLabel } from './hover.js';
import { createFilterPanel, updatePeroidLabel, updatePanelPosition } from './filterUIPanel.js';
import { PathFinder } from './pathFinder.js';
import { broadcastAvatar, broadcastNodeSelection, setScene, broadcastGraphReset, userAvatars,avatarInterpolation, setUIPanel } from './network.js';
import { updateRemoteAvatar } from './avatars.js';

// ========================
//  Static Panel variables
// ========================

let panelState = 'showing'; // 'hidden', 'showing', 'shown', 'hiding'
const PANEL_HIDDEN_POS = new THREE.Vector3(0, -0.3, -0.8);
const PANEL_SHOWN_POS = new THREE.Vector3(0, 0, -1.2);
const PANEL_LERP_FACTOR = 0.2;



//
// ========================
// Scene, Camera, Renderer
// ========================
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);
setScene(scene);
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
const BROADCAST_INTERVAL = 100;
// Add at the top with other variables
let lastTime = performance.now();
let lastBroadcast = 0;
// ========================
// Controls and VR Setup
// ========================
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

const cameraGroup = new THREE.Group();
cameraGroup.add(camera);
scene.add(cameraGroup);

const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

setupController(controller1, 0, renderer, cameraGroup);
setupController(controller2, 1, renderer, cameraGroup);






// ========================
// Graph Data and Maps
// ========================
const adjacency = new Map();
const directLinksMap = new Map();


// Init adjacency maps
for (const node of graphData.nodes) {
  const id = String(node.id);
  adjacency.set(id, new Set());
  directLinksMap.set(id, []);
}

for (const link of graphData.links) {
  const srcId = String(link.source?.id ?? link.source);
  const tgtId = String(link.target?.id ?? link.target);
  adjacency.get(srcId).add(tgtId);
  adjacency.get(tgtId).add(srcId);
  const storedLink = { source: srcId, target: tgtId };
  directLinksMap.get(srcId).push(storedLink);
  if (srcId !== tgtId) directLinksMap.get(tgtId).push(storedLink);
}

// ========================
// Graph Initialization
// ========================
const colorScale = scaleOrdinal(schemeCategory10)
  .domain([...new Set(graphData.nodes.map(n => n.group))]);

const Graph = ForceGraph3D()(document.body)
  .graphData(graphData)
  .nodeAutoColorBy('group')
  .nodeColor(d => colorScale(d.group))
  .nodeLabel(node => node.label || node.id)
  .onNodeClick((node, event) => {
    if (inVR || event?.shiftKey) {
      highlightSubgraph(node.id, 'DIRECT');
      console.log("I was highlighted in if")
      broadcastNodeSelection(node.id, 'DIRECT');

    } else {
      highlightSubgraph(node.id, 'DIRECT');
      broadcastNodeSelection(node.id, 'DIRECT');
      console.log("I was highlighted in else")


    }
  });

const GraphRef = { current: Graph };
scene.add(Graph.scene());
const pathFinder = new PathFinder(Graph, adjacency, directLinksMap, colorScale);

// ========================
// UI Setup (VR Button + Panel)
// ========================
const vrButton = VRButton.createButton(renderer);
vrButton.id = 'VRButton';
vrButton.textContent = 'Enter VR';
Object.assign(vrButton.style, {
  position: 'absolute', top: '20px', right: '20px',
  padding: '10px 16px', background: 'rgba(0,0,0,0.6)',
  color: 'white', border: '1px solid white',
  zIndex: '999', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '14px'
});
document.body.appendChild(vrButton);

const groups = [...new Set(graphData.nodes.map(n => n.group))].map(group => ({
  name: String(group),
  color: colorScale(group)
}));
export const uiPanel = createFilterPanel({ groupColors: groups, camera });
cameraGroup.add(uiPanel); // ui panel buttom center
uiPanel.position.copy(PANEL_HIDDEN_POS);
// initLabels(cameraGroup, camera); // info label for hover

// ========================
// Graph Interaction + Reset
// ========================
function requestGraphUpdate(mode, nodeId) {
  graphUpdateMode = mode;
  graphUpdateNodeId = nodeId;
  graphUpdateNeeded = true;
}


setUIPanel(uiPanel);

export function highlightSubgraph(nodeId) {
  updatePeroidLabel('Default');
  const clickedId = String(nodeId);
  const neighbourIds = new Set(
    Array.from(adjacency.get(clickedId) || []).map(String)
  );
  const selectedIds = new Set([clickedId, ...neighbourIds]);

  Graph.scene().traverse(obj => {
    if (obj.__data?.id !== undefined) {
      const objId = String(obj.__data.id);
      const isSelected = selectedIds.has(objId);
      applyOpacityLayer(obj, "selection", isSelected);
    }

    if (obj.__data?.source && obj.__data?.target) {
      const s = String(obj.__data.source?.id ?? obj.__data.source);
      const t = String(obj.__data.target?.id ?? obj.__data.target);
      obj.visible = (s === clickedId || t === clickedId);
      obj.material.color.setRGB(1, 1, 1);
      obj.material.transparent = true;
      obj.material.opacity = 1.0;
      obj.material.emissive?.setRGB(0.5, 0.5, 0.5);
    }
  });

  markHoverCacheDirty();
}


const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset View';
Object.assign(resetBtn.style, {
  position: 'absolute', top: '10px', left: '10px', padding: '8px 12px',
  background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid white',
  zIndex: 1, cursor: 'pointer'
});
document.body.appendChild(resetBtn);

resetBtn.addEventListener('click', () => {
  resetGraph();
  broadcastGraphReset();
});

export function resetGraph() {
  updatePeroidLabel('Default');
  Graph.scene().traverse(obj => {
    // Reset nodes
    if (obj.__data?.id !== undefined) {
      const userData = obj.userData;

      if (userData.originalMaterial) {
        obj.material = userData.originalMaterial;
        obj.material.opacity = 1.0;
        obj.material.transparent = false;
        obj.material.needsUpdate = true;
      }

      // Clean up all custom materials
      delete userData.originalMaterial;
      delete userData.periodMaterial;
      delete userData.selectionMaterial;
      // Add more if needed (e.g., hoverMaterial, filterMaterial)
    }

    // Reset edges
    if (obj.__data?.source && obj.__data?.target) {
      obj.visible = true;
      obj.material.color.setRGB(1, 1, 1);
      obj.material.opacity = 1.0;
      obj.material.transparent = false;

      if (obj.material.emissive) {
        obj.material.emissive.setRGB(0, 0, 0);
      }

      obj.material.needsUpdate = true;
    }
  });

  // Force render refresh and physics update
  Graph.graphData(Graph.graphData());
  Graph.d3ReheatSimulation();
}



// ========================
// Auto Highlight Cycle
// ========================

function applyOpacityLayer(obj, context, visible) {
  const base = obj.userData.originalMaterial ||= obj.material;

  // Clone per context (e.g., periodMaterial, selectionMaterial)
  const key = context + "Material";
  if (!obj.userData[key]) {
    obj.userData[key] = base.clone();
  }

  const mat = obj.userData[key];
  mat.transparent = true;
  mat.opacity = visible ? 1.0 : 0.1;
  mat.needsUpdate = true;

  obj.material = mat;
}
export const periodActiveNodes = new Map();

export function precomputePeriodData() {
  periodActiveNodes.clear();

  Graph.graphData().links.forEach(link => {
    const periods = link.periods || [];

    periods.forEach(period => {
      if (!periodActiveNodes.has(period)) {
        periodActiveNodes.set(period, new Set());
      }
      periodActiveNodes.get(period).add(link.source);
      periodActiveNodes.get(period).add(link.target);
    });
  });
}



export function highlightPeriod(period) {
  updatePeroidLabel(period);
  const activeNodes = periodActiveNodes.get(period) || new Set();

  Graph.scene().traverse(obj => {
    if (obj.__data?.id !== undefined) {
      const nodeId = obj.__data.id;
      const isActive = activeNodes.has(nodeId);
      applyOpacityLayer(obj, "period", isActive);
    }

    if (obj.__data?.source && obj.__data?.target) {
      const isCurrentPeriod = obj.__data.periods?.includes?.(period);
      obj.visible = isCurrentPeriod;

      if (isCurrentPeriod) {
        obj.material.color.setRGB(1, 1, 1);
        obj.material.transparent = true;
        obj.material.opacity = 1.0;
        obj.material.emissive?.setRGB(0.5, 0.5, 0.5);
        obj.material.needsUpdate = true;
      }
    }
  });
}

// ========================
// XR Session Event Handling
// ========================
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  inVR = true;
  const session = renderer.xr.getSession();
  // startAutoHighlightCycle(); // Test 
  session.inputSources.forEach(source => {
    if (source.handedness === 'left') controller1.userData.inputSource = source;
    if (source.handedness === 'right') controller2.userData.inputSource = source;
  });
  session.addEventListener('inputsourceschange', () => {
    session.inputSources.forEach(source => {
      if (source.handedness === 'left') controller1.userData.inputSource = source;
      if (source.handedness === 'right') controller2.userData.inputSource = source;
    });
  });
});

renderer.xr.addEventListener('sessionend', () => {
  stopAutoHighlightCycle(); // Test
  inVR = false;
});

// ========================
// Period Cycling
// ========================
const schoolPeriods = [
  "arrival",
  "class1",
  "break1",
  "class2",
  "lunch",
  "class3",
  "break2",
  "afterclass"
];

let currentPeriodIndex = 0;
let cycleInterval = null;

export function startPeriodPreviewCycle() {
  if (cycleInterval) clearInterval(cycleInterval);

  cycleInterval = setInterval(() => {
    const period = schoolPeriods[currentPeriodIndex];
    highlightPeriod(period);
    console.log(`Highlighting period: ${period}`);

    currentPeriodIndex = (currentPeriodIndex + 1) % schoolPeriods.length;
  }, 5000); // Every 5 seconds
}

export function stopPeriodPreviewCycle() {
  if (cycleInterval) {
    clearInterval(cycleInterval);
    cycleInterval = null;
  }
}

setInterval(() => {
  if (inVR) {
    
    broadcastAvatar(camera, controller1, controller2);
    // console.log('Hellow');
  }
}, 100);

function togglePanel() {
  console.log("console.log from togglePanel");
  if (panelState === 'hidden' || panelState === 'hiding') {
    panelState = 'showing';
  } else if (panelState === 'shown' || panelState === 'showing') {
    panelState = 'hiding';
  }
}


// ========================
// Animation Loop
// ========================
let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;



const pollGraphSwitchButtons = setupGraphSwitchButtons(controller1, controller2, GraphRef, requestGraphUpdate);
setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate, scene, cameraGroup);
precomputePeriodData();
export const AVATAR_UPDATE_INTERVAL = 16;
// startPeriodPreviewCycle();


renderer.setAnimationLoop((timestamp, xrFrame) => {
  scene.updateMatrixWorld(true);

  const deltaTime = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;
  avatarInterpolation.update(userAvatars, deltaTime);
  // Make avatar name labels always face the camera
  Object.values(userAvatars).forEach(({ head, nameLabel }) => {
    if (nameLabel) {
  
      nameLabel.lookAt(camera.position);
    }
  });

  if (inVR && timestamp - lastBroadcast > AVATAR_UPDATE_INTERVAL)  {
  broadcastAvatar(camera, controller1, controller2);
  lastBroadcast = timestamp;
  }
  if (graphUpdateNeeded) {
    switch (graphUpdateMode) {
      case 'FULL':
        Graph.scene().traverse(obj => {
          if (obj.material?.opacity !== undefined) {
            obj.material.transparent = false;
            obj.material.opacity = 1.0;
          }
        });
        break;
      case 'SUBGRAPH':
      case 'DIRECT':
        highlightSubgraph(graphUpdateNodeId);
        broadcastNodeSelection(graphUpdateNodeId);
        break;
    }
    graphUpdateNeeded = false;
    graphUpdateMode = null;
    graphUpdateNodeId = null;
  }

  //Panel
  // const uiPanel = scene.getObjectByName('FilterUIPanel') || 
  //                 cameraGroup.getObjectByName('FilterUIPanel');
  
  panelState = updatePanelPosition({
  uiPanel,
  panelState,
  camera,
  cameraGroup,
  controller: controller1,
  scene,
  inVR
  });
  uiPanel?.userData?.update?.();


  if (uiPanel?.userData?.bgPlane) {
  const bg = uiPanel.userData.bgPlane;
  
  // Only update color if panel is interactive
    if (bg.userData.isUIPanel) { 
      const targetColor = bg.userData.isHovered ? 0x4444aa : 0x000000;
      bg.material.color.lerp(new THREE.Color(targetColor), 0.1);
    }
  }



  const hoverPanel = cameraGroup.getObjectByName('NodeIDBillboard');
  if (hoverPanel) {
    const panelOffset = new THREE.Vector3(0, -0.3, -0.8);
    const worldPosition = new THREE.Vector3()
      .copy(camera.position)
      .add(panelOffset.applyQuaternion(camera.quaternion));
    hoverPanel.position.copy(worldPosition);
    if (inVR) hoverPanel.userData.update?.();
  }

  if (inVR && xrFrame) {
    handleJoystickInput(xrFrame, camera, cameraGroup);

    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;



    handleXButtonInput(xrFrame, () => {
      resetBtn.click();
      [controller1, controller2].forEach(c => {
        const gp = c.userData.inputSource?.gamepad;
        const h = gp?.hapticActuators?.[0] || gp?.hapticActuator;
        if (h?.pulse) {
          h.pulse(0.8, 100);
        } else if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      });
    });

    handleAButtonInput(xrFrame, () => {
    togglePanel();
    [controller1, controller2].forEach(c => {
      const gp = c.userData.inputSource?.gamepad;
      const h = gp?.hapticActuators?.[0] || gp?.hapticActuator;
      if (h?.pulse) {
        h.pulse(0.8, 100);
      } else if (navigator.vibrate) {
        navigator.vibrate(100);
        }
      });
    });


    detectHover(controller1, GraphRef.current.scene(), camera, cameraGroup);
    detectHover(controller2, GraphRef.current.scene(), camera, cameraGroup);
    pollGraphSwitchButtons();
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
