// ========================
// Imports and Setup
// ========================
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';
import ForceGraph3D from '3d-force-graph';
import graphData from './graph-data.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  setupController,
  handleJoystickInput,
  setupVRNodeSelection,
  handleXButtonInput,
  setupGraphSwitchButtons,
  
} from './vrSetup.js';
import { detectHover, initLabels,markHoverCacheDirty, hoverLabel } from './hover.js';
import { createFilterPanel } from './filterUIPanel.js';
import { PathFinder } from './pathFinder.js';
import { broadcastAvatar, broadcastNodeSelection, setScene, broadcastGraphReset, userAvatars,avatarInterpolation } from './network.js';

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

let lastAvatarBroadcastTime = 0;
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

let lastCameraPosition = new THREE.Vector3();
let lastLeft = new THREE.Vector3();
let lastRight = new THREE.Vector3();
const POSITION_EPSILON = 0.001; // ~1mm threshold


// ========================
// Graph Data and Maps
// ========================
const adjacency = new Map();
const directLinksMap = new Map();
const nodeMap = new Map(graphData.nodes.map(node => [String(node.id), node]));

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
const uiPanel = createFilterPanel({ groupColors: groups, camera });
cameraGroup.add(uiPanel); // ui panel buttom center
// initLabels(cameraGroup, camera); // info label for hover

// ========================
// Graph Interaction + Reset
// ========================
function requestGraphUpdate(mode, nodeId) {
  graphUpdateMode = mode;
  graphUpdateNodeId = nodeId;
  graphUpdateNeeded = true;
}



export function highlightSubgraph(nodeId) {
  const clickedId = String(nodeId);
  const neighbourIds = new Set(
    Array.from(adjacency.get(clickedId) || []).map(String)
  );
  const selectedIds = new Set([clickedId, ...neighbourIds]);

  Graph.scene().traverse(obj => {
    // Node handling only (edges remain unchanged)
    if (obj.__data?.id !== undefined) {
      const objId = String(obj.__data.id); // Ensure string conversion
      const isSelected = selectedIds.has(objId);

      if (obj.material) {
        // Clone material to prevent shared instances
        if (!obj.userData.originalMaterial) {
          obj.userData.originalMaterial = obj.material;
          obj.material = obj.material.clone();
        }

        obj.material.transparent = true;
        obj.material.opacity = isSelected ? 1.0 : 0.1;
        obj.material.needsUpdate = true;
      }
    }

    // Existing edge handling remains unchanged
    if (obj.__data?.source && obj.__data?.target) {
      const s = String(obj.__data.source?.id ?? obj.__data.source);
      const t = String(obj.__data.target?.id ?? obj.__data.target);
      obj.visible = (s === clickedId || t === clickedId);
      obj.material.color.setRGB(1,1,1);
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
  Graph.scene().traverse(obj => {
    // Reset nodes
    if (obj.__data?.id !== undefined) {
      if (obj.userData.originalMaterial) {
        obj.material = obj.userData.originalMaterial;
        obj.material.needsUpdate = true;
        delete obj.userData.originalMaterial;
      } else {
        obj.material.opacity = 1.0;
        obj.material.transparent = false;
        obj.material.needsUpdate = true;
      }
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

  Graph.graphData(Graph.graphData());

  Graph.d3ReheatSimulation();
}


// ========================
// Auto Highlight Cycle
// ========================
// let autoHighlightInterval;
// let autoHighlightEnabled = false;

// function startAutoHighlightCycle() {
//   if (autoHighlightEnabled) return;
//   autoHighlightEnabled = true;
  
//   // Get valid node IDs within the specified range
//   const validNodeIds = graphData.nodes
//     .map(node => node.id)
//     .filter(id => id >= 1426 && id <= 1922);
  
//   if (validNodeIds.length === 0) {
//     console.warn('No nodes found in the range [1426, 1922]');
//     return;
//   }

//   let currentHighlightedNode = null;
  
//   autoHighlightInterval = setInterval(() => {
//     // Reset previous highlight
//     if (currentHighlightedNode !== null) {
//       resetGraph(); // <--- Reset at the start of the interval
//     }
    
//     // Select new random node
//     const randomIndex = Math.floor(Math.random() * validNodeIds.length);
//     currentHighlightedNode = validNodeIds[randomIndex];
    
//     // Highlight new node after 10s
//     setTimeout(() => {
//       highlightSubgraph(currentHighlightedNode);
//       console.log(`Auto-highlighting node: ${currentHighlightedNode}`);
//     }, 10000);
//   }, 20000); // Full cycle (reset + highlight) every 20s

//   // Start first highlight after initial 10s
//   setTimeout(() => {
//     const randomIndex = Math.floor(Math.random() * validNodeIds.length);
//     currentHighlightedNode = validNodeIds[randomIndex];
//     highlightSubgraph(currentHighlightedNode);
//     console.log(`Auto-highlighting started. First node: ${currentHighlightedNode}`);
//   }, 10000);
// }

// function stopAutoHighlightCycle() {
//   if (!autoHighlightEnabled) return;
//   autoHighlightEnabled = false;
//   clearInterval(autoHighlightInterval);
//   resetGraph();
//   console.log('Auto-highlighting stopped');
// }
// ========================
// Auto Highlight Cycle (Animation Loop Version)
// ========================


// ========================
// XR Session Event Handling
// ========================
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  inVR = true;
  const session = renderer.xr.getSession();
  startAutoHighlightCycle(); // Test 
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
// Animation Loop
// ========================
let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;
let lastTime;
lastCameraPosition.copy(camera.position);
lastLeft.copy(controller1.position);
lastRight.copy(controller2.position);

const pollGraphSwitchButtons = setupGraphSwitchButtons(controller1, controller2, GraphRef, requestGraphUpdate);
setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate);

renderer.setAnimationLoop((timestamp, xrFrame) => {
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

  // Graph.scene().traverse(obj => {
  //   if (obj.userData?.labelSprite) {
  //     obj.userData.labelSprite.lookAt(camera.position);
  //   }
  // });
  // updateLabels(camera);

  if (uiPanel) {
    const panelOffset = new THREE.Vector3(0, -0.3, -0.8);
    const worldPosition = new THREE.Vector3().copy(camera.position).add(panelOffset.applyQuaternion(camera.quaternion));
    uiPanel.position.copy(worldPosition);
    if (inVR) uiPanel.userData.update?.();
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

    // Inside animation loop
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    if (timestamp - lastAvatarBroadcastTime > 1000) { // 1000ms = 1s
      broadcastAvatar(camera, controller1, controller2);
      lastAvatarBroadcastTime = timestamp;
    }

    avatarInterpolation.update(userAvatars, deltaTime);


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
    detectHover(controller1, GraphRef.current.scene(), camera, cameraGroup);
    detectHover(controller2, GraphRef.current.scene(), camera, cameraGroup);
    pollGraphSwitchButtons();
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
