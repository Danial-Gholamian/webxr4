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
import { detectHover, markHoverCacheDirty, initLabels, updateLabels } from './hover.js';
import { createFilterPanel } from './filterUIPanel.js';
import { PathFinder } from './pathFinder.js';
import { broadcastAvatar, broadcastNodeSelection, setScene } from './network.js';

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
      broadcastNodeSelection(node.id, 'DIRECT');

    } else {
      highlightSubgraph(node.id, 'DIREKT');
      broadcastNodeSelection(node.id, 'DIRECT');

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
cameraGroup.add(uiPanel);
initLabels(scene);

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
  const neighbourIds = new Set(adjacency.get(clickedId) || []);
  const selectedIds = new Set([clickedId, ...neighbourIds]);

  Graph.scene().traverse(obj => {
    if (obj.__data?.id !== undefined) {
      const objId = String(obj.__data.id);
      const isSelected = selectedIds.has(objId);
      // optional: obj.material.opacity = isSelected ? 1 : 0.1
    }
    if (obj.__data?.source && obj.__data?.target) {
      const s = String(obj.__data.source?.id ?? obj.__data.source);
      const t = String(obj.__data.target?.id ?? obj.__data.target);
      obj.visible = (s === clickedId || t === clickedId);
    }
  });
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
  Graph.graphData(graphData);
  pathFinder.reset();
  Graph.scene().traverse(obj => {
    if (obj.__data?.source !== undefined && obj.__data?.target !== undefined) {
      obj.visible = true;
    }
  });
});

// ========================
// XR Session Event Handling
// ========================
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  inVR = true;
  const session = renderer.xr.getSession();
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
  inVR = false;
});

// ========================
// Animation Loop
// ========================
let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;

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
        break;
    }
    graphUpdateNeeded = false;
    graphUpdateMode = null;
    graphUpdateNodeId = null;
  }

  Graph.scene().traverse(obj => {
    if (obj.userData?.labelSprite) {
      obj.userData.labelSprite.lookAt(camera.position);
    }
  });
  updateLabels(camera);

  if (uiPanel) {
    const panelOffset = new THREE.Vector3(0, -0.3, -0.8);
    const worldPosition = new THREE.Vector3().copy(camera.position).add(panelOffset.applyQuaternion(camera.quaternion));
    uiPanel.position.copy(worldPosition);
    if (inVR) uiPanel.userData.update?.();
  }

  if (inVR && xrFrame) {
    handleJoystickInput(xrFrame, camera, cameraGroup);

    if (timestamp - lastBroadcast > 33) {
      broadcastAvatar(camera, controller1, controller2);
      lastBroadcast = timestamp;
    }

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
    detectHover(controller1, GraphRef.current.scene(), camera);
    detectHover(controller2, GraphRef.current.scene(), camera);
    pollGraphSwitchButtons();
  } else {
    controls.update();
  }

  renderer.render(scene, camera);
});
