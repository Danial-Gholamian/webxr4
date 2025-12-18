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
  handleAButtonInput,
  handleBButtonInput,
  handleYButtonInput,
  handleLeftStickButton,
  handleRightStickButton
} from './vrSetup.js';
import { createUserGuidePanel, createHelpIcon } from './userGuidePanel.js';
import { detectHover, initLabels, markHoverCacheDirty, hoverLabel } from './hover.js';
import { createFilterPanel, updatePeroidLabel, updatePanelPosition } from './filterUIPanel.js';
import { PathFinder } from './pathFinder.js';
import { broadcastAvatar, broadcastNodeSelection, setScene, broadcastGraphReset, userAvatars, avatarInterpolation, setUIPanel, broadcastPeriodStackToggle } from './network.js';
import { createBarGauge, updateBarGauge, updateBarGaugeHUD } from './barGauge.js';
import { schoolPeriods } from './periodDefs.js';
import { createPeriodStack } from './periodStack.js';
import { initVoice } from './voice.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';


// ========================
//  Static Panel variables
// ========================

let panelState = 'hiding'; // 'shown', 'hiding', 'hidden', 'showing'
const PANEL_HIDDEN_POS = new THREE.Vector3(0, -0.3, -0.8);

let activePeriod = null;
let currentPeriodIndex = 0;

let selectionState = {
  isActive: false,
  selectedNodeId: null,
  neighborIds: new Set()
};

let periodStackInstance = null;

const groupFilterState = {
  isActive: false,
  activeGroup: null,
  nodeIds: new Set(),
  edgeIds: new Set()
};

const minScale = 0.01;
const maxScale = 1.0;
let targetScale = 0.1;      // starting size
const scaleLerpSpeed = 0.05; // how smooth it feels

let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;


const roomCenter = new THREE.Vector3();


// now
// ========================
// Scene, Camera, Renderer
// ========================
const scene = new THREE.Scene();
const loader0 = new THREE.TextureLoader();

loader0.load('public/models/background.jpeg', (texture) => {
  texture.mapping = THREE.EquirectangularReflectionMapping;
  texture.colorSpace = THREE.SRGBColorSpace;

  scene.environment = texture;
  scene.background = texture;
});
// ======== LOAD VR ROOM / LAB ROOM ========
const loader = new GLTFLoader();
let labRoom;
let roomHalfSize = new THREE.Vector2(); // XZ half size we allow the user to move in

loader.load('/webxr4/models/neoclassical_vr_room.glb', (gltf) => {
  labRoom = gltf.scene;

  labRoom.scale.set(35, 35, 35);
  labRoom.position.set(0, -40, 0);

  labRoom.traverse((child) => {
    if (child.isMesh) {
      child.castShadow = true;
      child.receiveShadow = true;
      if (child.material) {
        child.material.roughness = 0.8;
        child.material.metalness = 0.1;
      }
    }
  });

  scene.add(labRoom);
  console.log("Lab room loaded.");

  // Compute world-space bounding box
  const box = new THREE.Box3().setFromObject(labRoom);
  box.getCenter(roomCenter);

  const size = new THREE.Vector3();
  box.getSize(size);

  // Define how close to the walls the player is allowed to get (in meters)
  const margin = 2.0;

  // "Half size" of the allowed walk area in XZ
  const shrinkFactor = 0.80;   // 80% of original size = tighter room

  roomHalfSize.set(
    (size.x * 0.5) * shrinkFactor,
    (size.z * 0.5) * shrinkFactor
  );



});


function clampCameraToRoom() {
  if (!roomHalfSize) return;

  const pos = cameraGroup.position;

  // Position relative to the center of the room
  const relX = pos.x - roomCenter.x;
  const relZ = pos.z - roomCenter.z;

  const clampedRelX = THREE.MathUtils.clamp(relX, -roomHalfSize.x, roomHalfSize.x);
  const clampedRelZ = THREE.MathUtils.clamp(relZ, -roomHalfSize.y, roomHalfSize.y);

  // Convert back to world space
  pos.x = roomCenter.x + clampedRelX;
  pos.z = roomCenter.z + clampedRelZ;

  // If you want to prevent "flying" up/down, clamp Y too:
  // pos.y = Math.max(pos.y, someFloorHeight);
}




const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);
setScene(scene);
const renderer = new THREE.WebGLRenderer({
  antialias: false,                 // was true
  powerPreference: 'high-performance',
  precision: 'mediump'
});
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
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

// ========================
// User Guide Panel Setup 
// in Camera Group
// ========================
// User Guide Panel
const userGuidePanel = createUserGuidePanel();
cameraGroup.add(userGuidePanel);

userGuidePanel.traverse(obj => {
  if (obj.isMesh && obj.material) {
    obj.material.depthTest = false;
    obj.renderOrder = 999;
  }
});

function toggleGuidePanel() {
  console.log("Toggle Guide Panel")
  userGuidePanel.visible = !userGuidePanel.visible
}


// MIGHT BE USED TO REPLACE BUTTON FUNCTIONALITY
// // Help icon
// const helpIcon = createHelpIcon();
// helpIcon.userData.onHelpClick = () => {
//   userGuidePanel.visible = !userGuidePanel.visible;
// };

// cameraGroup.add(helpIcon);

// helpIcon.traverse(obj => {
//   if (obj.isMesh && obj.material) {
//     obj.material.depthTest = false;
//     obj.renderOrder = 999;
//   }
// });


// // Create a wireframe cube around the cameraGroup
// const geometry = new THREE.BoxGeometry(0.5, 0.5, 0.5); // 0.5m cube
// const wireframe = new THREE.WireframeGeometry(geometry);
// const line = new THREE.LineSegments(
//   wireframe,
//   new THREE.LineBasicMaterial({ color: 0x00ff00 })
// );

// // Position it at the cameraGroup origin (or adjust as needed)
// line.position.set(0, 0, 0); 

// // Make sure it’s rendered on top
// line.renderOrder = 999;
// line.material.depthTest = false;

// // Add to cameraGroup
// cameraGroup.add(line);

// // Optional: log world position
// console.log("Wireframe world pos:", line.getWorldPosition(new THREE.Vector3()));



// TEST 
// --- Reference Plane for Orientation ---
// const refPlaneGeo = new THREE.CircleGeometry(8, 64);
// const refPlaneMat = new THREE.MeshBasicMaterial({
//   color: 0x111111,
//   opacity: 0.35,
//   transparent: true,
//   side: THREE.DoubleSide
// });
// const refPlane = new THREE.Mesh(refPlaneGeo, refPlaneMat);
// refPlane.rotation.x = -Math.PI / 2;
// refPlane.position.set(0, -1.6, 0); // just below user eye level
// refPlane.name = "ReferencePlane";
// cameraGroup.add(refPlane);


// TEST
const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

setupController(controller1, 0, renderer, cameraGroup);
setupController(controller2, 1, renderer, cameraGroup);







// ========================
// Graph Rotation State
// ========================
let isRotatingGraph = false;
let grabbedController = null;

const startControllerQuat = new THREE.Quaternion();
const startGraphQuat = new THREE.Quaternion();
const tmpQuat = new THREE.Quaternion();
const invQuat = new THREE.Quaternion();



// Allow Controller to be used for rotating the graph
function enableGraphRotation(controller) {
  controller.addEventListener('squeezestart', () => {
    // Start rotation only if pointing at the graph root (or always rotate on grab)
    isRotatingGraph = true;
    grabbedController = controller;

    startControllerQuat.copy(controller.quaternion);
    startGraphQuat.copy(graphRoot.quaternion);
  });

  controller.addEventListener('squeezeend', () => {
    if (grabbedController === controller) {
      isRotatingGraph = false;
      grabbedController = null;
    }
  });
}

enableGraphRotation(controller1)
enableGraphRotation(controller2)







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
  .linkVisibility(false)   // disable built-in lines
  .nodeAutoColorBy('group')
  .nodeColor(d => colorScale(d.group))
  .nodeLabel(node => node.label || node.id)
  .onNodeClick((node, event) => {
    highlightSubgraph(node.id, 'DIRECT');
    broadcastNodeSelection(node.id, 'DIRECT');
  });

// --- make edges "longer" by increasing spring length ---
const linkForce = Graph.d3Force('link');
if (linkForce?.distance) {

  linkForce.distance(220);


  if (Graph.numDimensions) Graph.numDimensions(3);
  else if (Graph.d3ReheatSimulation) Graph.d3ReheatSimulation();
}

const charge = Graph.d3Force('charge');
if (charge?.strength) charge.strength(-150); // more negative = more repulsion

initVoice();


// Edge index map: edgeKey -> { start: idx0, end: idx1 }
const edgeVertexMap = new Map();
// Instead of creating thousands of individual line meshes (one per edge),
// we build a single line made of many vertices. Each pair of vertices
// represents one edge, and we store an "alpha" value per vertex. That way
// we can fade out some edges by lowering their alpha while keeping others
// fully visible, all in one draw call.

function buildBatchedEdges(graphData, nodesById) {
  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  let vIndex = 0;
  const alphas = [];

  graphData.links.forEach(link => {
    const src = nodesById[link.source.id ?? link.source];
    const tgt = nodesById[link.target.id ?? link.target];
    if (!src || !tgt) return;

    alphas.push(0.2);
    alphas.push(0.2);
    // positions
    positions.push(src.x, src.y, src.z);
    positions.push(tgt.x, tgt.y, tgt.z);

    // default colors
    color.setRGB(1, 1, 1);
    colors.push(color.r, color.g, color.b);
    colors.push(color.r, color.g, color.b);

    // record indices (two vertices per link)
    const key = getEdgeKey(link.source.id ?? link.source, link.target.id ?? link.target);
    edgeVertexMap.set(key, { start: vIndex, end: vIndex + 1 });
    vIndex += 2;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

  // ============================================================
  // Custom ShaderMaterial for batched edges
  //
  // We use a custom shader so each edge can have its own opacity.
  // - Each vertex stores an `alpha` attribute (0.0 → invisible, 1.0 → fully visible).
  // - Vertex shader: passes per-vertex color and alpha down to the fragment shader.
  // - Fragment shader: blends edges using the alpha value. If alpha <= 0.0, we
  //   call `discard` so the fragment is not drawn at all (prevents black lines).
  //
  // This is GLSL (OpenGL Shading Language), which looks like C but runs on the GPU.
  // ============================================================

  const material = new THREE.ShaderMaterial({
    transparent: true,
    vertexColors: true,
    depthWrite: false,            // <--- important so transparent lines don’t occlude
    blending: THREE.NormalBlending, // <--- standard alpha blending
    uniforms: {},
    vertexShader: `
      attribute float alpha;
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        vColor = color;
        vAlpha = alpha;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.0) discard;   // <--- don't draw invisible edges at all
        gl_FragColor = vec4(vColor, vAlpha);
      }
    `
  });



  return new THREE.LineSegments(geometry, material);
}

const nodesById = {};
Graph.graphData().nodes.forEach(n => nodesById[n.id] = n);

// Build line batch
const lineSegments = buildBatchedEdges(Graph.graphData(), nodesById);
// scene.add(lineSegments);

Graph.onEngineTick(() => {
  const pos = lineSegments.geometry.attributes.position.array;
  let i = 0;
  Graph.graphData().links.forEach(link => {
    const src = nodesById[link.source.id ?? link.source];
    const tgt = nodesById[link.target.id ?? link.target];

    pos[i++] = src.x; pos[i++] = src.y; pos[i++] = src.z;
    pos[i++] = tgt.x; pos[i++] = tgt.y; pos[i++] = tgt.z;
  });
  lineSegments.geometry.attributes.position.needsUpdate = true;
});


const GraphRef = { current: Graph };
const graphRoot = Graph.scene();
// console.log("graphRoot: ",typeof(graphRoot));
// console.log("graph: ",typeof(Graph));

scene.add(graphRoot);
graphRoot.position.y += 20;   // or any value you like


// shrink the graph by 50%
graphRoot.scale.set(0.99, 0.99, 0.99);
// const pathFinder = new PathFinder(Graph, adjacency, directLinksMap, colorScale);
graphRoot.add(lineSegments);


// --- Period stack (lazy) ---
export let periodStack = null;

const baseGraphData = structuredClone(graphData);



function rebuildPeriodStack() {
  if (periodStack) {
    scene.remove(periodStack.group);
    periodStack = null;
  }

  const freshData = JSON.parse(JSON.stringify(graphData)); // deep clone
  periodStack = createPeriodStack({
    Graph,
    graphData: freshData,
    periods: schoolPeriods,
    colorScale,
    spacing: 50,
    nodeSize: 1.2,
    selectionState,
    groupFilterState
  });

  scene.add(periodStack.group);
}




Graph.onEngineStop(() => {
  // optional: build once the force layout stabilizes
  // buildPeriodStackOnce();
});


// function updateGraphScaling(xrFrame) {
//   // Shrink (left stick button)
//   handleLeftStickButton(xrFrame, () => {
//     targetScale = Math.max(minScale, targetScale - 0.01);
//   });

//   // Grow (right stick button)
//   handleRightStickButton(xrFrame, () => {
//     targetScale = Math.min(maxScale, targetScale + 0.01);
//   });

//   // Smoothly interpolate current scale → target scale
//   const current = graphRoot.scale.x;
//   const newScale = THREE.MathUtils.lerp(current, targetScale, scaleSpeed);

//   graphRoot.scale.set(newScale, newScale, newScale);
// }

// ========================
// UI Setup (VR Button + Panel)
// ========================
const vrButton = VRButton.createButton(renderer);

// Force remove default VRButton classes and styles
vrButton.removeAttribute('style');
vrButton.className = ''; // Remove any built-in styles

// Then apply your clean style
Object.assign(vrButton.style, {
  position: 'absolute',
  top: '10px',
  right: '10px',
  padding: '8px 12px',
  background: 'rgba(0, 0, 0, 0.6)',
  color: 'white',
  border: '1px solid white',
  borderRadius: '4px',
  fontSize: '14px',
  fontFamily: 'sans-serif',
  zIndex: '10',
  cursor: 'pointer',
  width: 'auto',
  height: 'auto',
  lineHeight: 'normal',
  boxSizing: 'border-box',
  display: 'inline-block'
});
vrButton.textContent = 'Enter VR';

document.body.appendChild(vrButton);


const groups = [...new Set(graphData.nodes.map(n => n.group))].map(group => ({
  name: String(group),
  color: colorScale(group)
}));
export const uiPanel = createFilterPanel({ groupColors: groups, camera });
cameraGroup.add(uiPanel); // ui panel buttom center
uiPanel.position.copy(PANEL_HIDDEN_POS);
// initLabels(cameraGroup, camera); // info label for hover
export const timeGauge = createBarGauge(new THREE.Vector3(0, 1.4, -1.2));
cameraGroup.add(timeGauge);
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
  const clickedId = String(nodeId);
  uiPanel.userData.updateSelectedNodeLabel?.(clickedId);
  selectionState.isActive = true;
  selectionState.selectedNodeId = clickedId;
  const validNeighbors = new Set();
  const edges = Graph.graphData().links;
  for (const edge of edges) {
    if (activePeriod && !edge.periods?.includes(activePeriod)) continue;

    const source = String(edge.source?.id ?? edge.source);
    const target = String(edge.target?.id ?? edge.target);

    if (source === clickedId) validNeighbors.add(target);
    else if (target === clickedId) validNeighbors.add(source);
  }
  selectionState.neighborIds = validNeighbors;

  updateAllVisuals();
}
function getEdgeKey(a, b) {
  return [a, b].sort().join('--');
}

export function highlightGroup(groupName) {
  // Normalize and reset states
  const normalizedGroup = String(groupName).trim().toLowerCase();

  groupFilterState.isActive = true;
  groupFilterState.activeGroup = normalizedGroup;
  groupFilterState.nodeIds.clear();
  groupFilterState.edgeIds.clear();

  // Reset selection to avoid conflicts
  selectionState.isActive = false;
  selectionState.selectedNodeId = null;
  selectionState.neighborIds.clear();

  // Filter nodes
  for (const node of Graph.graphData().nodes) {
    const nodeGroup = String(node.group).trim().toLowerCase();
    const nodeId = String(node.id);
    if (nodeGroup === normalizedGroup) {
      groupFilterState.nodeIds.add(nodeId);
    }
  }

  // Filter edges where both ends are in the group AND match current period (if any)
  for (const edge of Graph.graphData().links) {
    const src = String(edge.source?.id ?? edge.source);
    const tgt = String(edge.target?.id ?? edge.target);

    const edgeInPeriod = !activePeriod || edge.periods?.includes(activePeriod);
    if (
      groupFilterState.nodeIds.has(src) &&
      groupFilterState.nodeIds.has(tgt) &&
      edgeInPeriod
    ) {
      groupFilterState.edgeIds.add(getEdgeKey(src, tgt));
    }
  }

  updateAllVisuals();
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
  activePeriod = null;
  selectionState.isActive = false;
  selectionState.selectedNodeId = null;
  selectionState.neighborIds = new Set();

  clearGroupFilter();
  updatePeroidLabel('Default');
  uiPanel.userData.updateSelectedNodeLabel?.(null);

  // reset nodes as before (Graph.scene().traverse)

  // reset edges (all white again)

  const alphas = lineSegments.geometry.attributes.alpha.array;
  for (let i = 0; i < alphas.length; i++) alphas[i] = 0.2;
  lineSegments.geometry.attributes.alpha.needsUpdate = true;


  Graph.graphData(Graph.graphData());
  Graph.d3ReheatSimulation();
  updateBarGauge(timeGauge, 0, "Default");
}

// ------------ Checking node state  -------------
function nodeVisibleInPeriod(nodeId, periodNodes) {
  return !periodNodes || periodNodes.has(nodeId);
}

function nodeVisibleInGroup(nodeId, groupFilterState) {
  return !groupFilterState.isActive || groupFilterState.nodeIds.has(nodeId);
}

function nodeVisibleInSelection(nodeId, selectionState) {
  if (!selectionState.isActive) return false; // Changed to return false when inactive
  return (
    selectionState.selectedNodeId === nodeId ||
    selectionState.neighborIds.has(nodeId)
  );
}

//  ---------------- Checking Edge State -------------------
// Edges inherit visibility constraints from both temporal membership and node-based selection context.
function edgeVisibleInPeriod(link, activePeriod) {
  return !activePeriod || link.periods?.includes(activePeriod);
}

function edgeVisibleInGroup(edgeKey, groupFilterState) {
  return !groupFilterState.isActive || groupFilterState.edgeIds.has(edgeKey);
}

function edgeVisibleInSelection(link, selectionState) {
  if (!selectionState.isActive) return false;

  const src = String(link.source.id ?? link.source);
  const tgt = String(link.target.id ?? link.target);

  return (
    src === selectionState.selectedNodeId ||
    tgt === selectionState.selectedNodeId
  );
}



function updateAllVisuals() {
  const periodNodes = activePeriod ? (periodActiveNodes.get(activePeriod) || new Set()) : null;

  // ---------- Nodes ----------
  GraphRef.current.scene().traverse(obj => {
    if (obj.__data?.id !== undefined) {
      const nodeId = String(obj.__data.id);

      const inPeriod = nodeVisibleInPeriod(nodeId, periodNodes);
      const inGroup = nodeVisibleInGroup(nodeId, groupFilterState);
      const inSelection = nodeVisibleInSelection(nodeId, selectionState);

      const visible = inPeriod && inGroup && (!selectionState.isActive || inSelection);

      applyOpacityLayer(obj, "combined", visible);
    }
  });

  // ---------- Edges (batched) ----------

  const alphas = lineSegments.geometry.attributes.alpha.array;

  Graph.graphData().links.forEach(link => {
    const src = String(link.source.id ?? link.source);
    const tgt = String(link.target.id ?? link.target);
    const edgeKey = getEdgeKey(src, tgt);
    const entry = edgeVertexMap.get(edgeKey);

    if (!entry) return; // Exit early if entry doesn't exist

    const isVisible =
      edgeVisibleInPeriod(link, activePeriod) &&
      edgeVisibleInGroup(edgeKey, groupFilterState) &&
      edgeVisibleInSelection(link, selectionState);

    const alphaValue = isVisible ? 1.0 : 0.0; // Fully visible or fully invisible
    alphas[entry.start] = alphaValue;
    alphas[entry.end] = alphaValue;
  });

  lineSegments.geometry.attributes.alpha.needsUpdate = true;


  Graph.d3ReheatSimulation();
  markHoverCacheDirty?.();
}



export function clearGroupFilter() {
  groupFilterState.isActive = false;
  groupFilterState.activeGroup = null;
  groupFilterState.nodeIds.clear();
  groupFilterState.edgeIds.clear();
  updateAllVisuals();
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
  activePeriod = period;
  selectionState.isActive = false; // clear selection on period change
  updatePeroidLabel(period);
  updateAllVisuals();

  currentPeriodIndex = schoolPeriods.indexOf(period);

  const value = currentPeriodIndex / (schoolPeriods.length - 1);

  updateBarGauge(timeGauge, value, period);
}


// ========================
// XR Session Event Handling
// ========================
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  Graph.enablePointerInteraction(false);
  inVR = true;

  cameraGroup.position.set(0, 3.6, 230);  // Initial spawn position
  cameraGroup.position.y += 22.2;

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
  stopAutoHighlightCycle?.(); // Test
  inVR = false;
  Graph.enablePointerInteraction(true);
});



setInterval(() => {
  if (inVR) {

    broadcastAvatar(camera, controller1, controller2);

    // console.log('Hellow');
  }
}, 100);

function togglePanel() {
  console.log("console.log from togglePanel");
  if (panelState === 'shown' || panelState === 'showing') {
    panelState = 'hiding';
  } else if (panelState === 'hidden' || panelState === 'hiding') {
    panelState = 'showing';
  }
}

export function applyRemotePeriodStackToggle(visible, context = {}) {
  if (!periodStack) rebuildPeriodStack();

  // Apply context BEFORE showing
  if (context.groupName) {
    highlightGroup(context.groupName);
  }
  if (context.period) {
    highlightPeriod(context.period);
  }
  if (context.selectedNodeId) {
    highlightSubgraph(context.selectedNodeId);
  }

  if (visible) {
    periodStack.show();
  } else {
    periodStack.hide();
  }
}





// ========================
// Animation Loop
// ========================




const pollGraphSwitchButtons = setupGraphSwitchButtons(controller1, controller2, GraphRef, requestGraphUpdate);
setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate, scene, cameraGroup);
precomputePeriodData();
export const AVATAR_UPDATE_INTERVAL = 16;
// startPeriodPreviewCycle();

let fpsAccum = 0;
let frameCount = 0;
renderer.setAnimationLoop((timestamp, xrFrame) => {
  scene.updateMatrixWorld(true);
  if (periodStack?.group?.visible) {
    periodStack.syncFromGraph?.(Graph);
  }


  // TEST
  // const plane = cameraGroup.getObjectByName("ReferencePlane");
  // if (plane) {
  //   plane.rotation.set(-Math.PI / 2, 0, 0); // keep it flat
  // }


  // TEST

  // if (timestamp > 10000) graphRoot.scale.set(0.1, 0.1, 0.1);
  const deltaTime = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;
  if (periodStack) periodStack.update(deltaTime);

  avatarInterpolation.update(userAvatars, deltaTime);



  const fps = 1 / Math.max(deltaTime, 1e-6);
  fpsAccum += fps;
  frameCount++;
  if (frameCount % 60 === 0) { // log once every ~60 frames 
    console.log("FPS:", Math.round(fpsAccum / frameCount));
    frameCount = 0;
    fpsAccum = 0;
  }
  // Make avatar name labels always face the camera
  Object.values(userAvatars).forEach(({ head, nameLabel }) => {
    if (nameLabel) {

      nameLabel.lookAt(camera.position);
    }
  });

  if (inVR && timestamp - lastBroadcast > AVATAR_UPDATE_INTERVAL) {
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
    clampCameraToRoom();
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // --- Graph scaling with stick buttons ---
    handleLeftStickButton(xrFrame, () => {
      console.log("Left stick clicked")
    });

    handleRightStickButton(xrFrame, () => {
      console.log("Right stick clicked")
    });

    // Smoothly interpolate scale
    const currentScale = graphRoot.scale.x;
    const newScale = THREE.MathUtils.lerp(currentScale, targetScale, scaleLerpSpeed);
    graphRoot.scale.set(newScale, newScale, newScale);

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

    handleBButtonInput(xrFrame, () => {
      const context = {
        groupName: groupFilterState.activeGroup,
        period: activePeriod,
        selectedNodeId: selectionState.selectedNodeId
      };

      if (!periodStack || periodStack.group.visible === false) {
        rebuildPeriodStack();
        periodStack.show();
        broadcastPeriodStackToggle(true, context);
      } else {
        periodStack.hide();
        broadcastPeriodStackToggle(false, context);
      }
    });

    handleYButtonInput(xrFrame, () => {
      toggleGuidePanel();
      [controller1, controller2].forEach(c => {
        const gp = c.userData.inputSource?.gamepad;
        const h = gp?.hapticActuators?.[0] || gp?.hapticActuator;
        if (h?.pulse) {
          h.pulse(0.8, 100);
        } else if (navigator.vibrate) {
          navigator.vibrate(100);
        }
      });
    })







    if (!periodStack?.group?.visible) {
      detectHover(controller1, GraphRef.current.scene(), camera, cameraGroup);
      detectHover(controller2, GraphRef.current.scene(), camera, cameraGroup);
    }

    pollGraphSwitchButtons();
  } else {
    controls.update();
  }

  // ========================
  // Graph Rotation Update
  // ========================
  if (isRotatingGraph && grabbedController) {

    // qDelta = currentControllerRot * inverse(startControllerRot)
    invQuat.copy(startControllerQuat).invert();
    tmpQuat.copy(grabbedController.quaternion).multiply(invQuat);

    // New graph rotation = delta * originalGraphRotation
    graphRoot.quaternion.copy(tmpQuat).multiply(startGraphQuat);
  }

  renderer.render(scene, camera);
});

// Today