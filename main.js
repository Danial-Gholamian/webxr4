// main.js
export const myUsername = prompt("Enter your name:") || "Anonymous";
// --- NEW: Ask the user for the minimum time granularity ---
const deltaInput = prompt(
  "Welcome to the Temporal Explorer!\n\n" +
  "Please enter the minimum time step (delta_min) for your lowest drill-down level.\n" +
  "(For example: 10, 50, or 100). If you leave this blank, it will default to 50:"
);

// Parse the input into a number. If they hit cancel, type letters, or enter 0, default to 50.
const parsedDelta = parseFloat(deltaInput);
export const userDeltaMin = (!isNaN(parsedDelta) && parsedDelta > 0) ? parsedDelta : 50;


// ========================
// Imports and Setup
// ========================
import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import { scaleOrdinal } from 'd3-scale';
import { schemeCategory10 } from 'd3-scale-chromatic';

// Controller and Data Adapter
import { GraphVisualController } from "./graphVisualController.js";
import { graphAdapter } from './graphAdapter.js';

import ForceGraph3D from '3d-force-graph';
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
  handleRightStickButton,
  setupNinjaHands,
  animatePuppetHands
} from './vrSetup.js';
import { createUserGuidePanel, nextGuidePage, prevGuidePage } from './userGuidePanel.js';
import { detectHover } from './hover.js';
import { createFilterPanel, updatePeroidLabel, updatePanelPosition, updateGroupList } from './filterUIPanel.js';
import { registerNetworkHandlers, broadcastAvatar, broadcastNodeSelection, setScene, broadcastGraphReset, userAvatars, avatarInterpolation, setUIPanel, broadcastPeriodStackToggle } from './network.js';
import { calculateHistogram, HistogramGauge } from './histogram.js';
import { createPeriodStack } from './periodStack.js';
import { initVoice } from './voice.js';

import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js';
import { DATASETS, getDatasetList } from './dataset.js';
import {
  buildTemporalHierarchy,
  buildTemporalTree,
  createTemporalNavigator
} from './temporalHierarchy.js';
import { createTemporalDrillPanel } from './temporalDrillPanel.js';
import { gridGeo, gridMaterial } from './skybox.js';

let levelIndex = 0;
let bucketIndex = null;
let autoplayInterval = null;


// Graph data variables
let dataset = null
let periods = null


// A getter for the periods
export function getActivePeriods() {
  return periods
}

export function getDatasets() {
  return dataset
}
// ========================
//  Static Panel variables
// ========================

let panelState = 'hiding'; // 'shown', 'hiding', 'hidden', 'showing'
const PANEL_HIDDEN_POS = new THREE.Vector3(0, -0.3, -0.8);

let currentPeriodIndex = 0;
let targetScale = 0.1;      // starting size
const scaleLerpSpeed = 0.05; // how smooth it feels

let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;


const roomCenter = new THREE.Vector3();


// ========================
// Scene, Camera, Renderer
// ========================
const scene = new THREE.Scene();
// const loader0 = new THREE.TextureLoader();

// loader0.load('public/models/background.jpeg', (texture) => {
//   texture.mapping = THREE.EquirectangularReflectionMapping;
//   texture.colorSpace = THREE.SRGBColorSpace;

//   scene.environment = texture;
//   scene.background = texture;
// });

// scene.background = new THREE.Color(0x111827);
scene.background = new THREE.Color(0x1a2638);
scene.fog = new THREE.FogExp2(0x1a2638, 0.004);

const grid = new THREE.Mesh(gridGeo, gridMaterial)
scene.add(grid)
grid.renderOrder = -1;



// ======== LOAD VR ROOM / LAB ROOM ========
const loader = new GLTFLoader();
let labRoom;
let roomHalfSize = new THREE.Vector2(); // XZ half size we allow the user to move in

// loader.load('/webxr4/models/neoclassical_vr_room.glb', (gltf) => {
//   labRoom = gltf.scene;

//   labRoom.scale.set(35, 35, 35);
//   labRoom.position.set(0, -40, 0);

//   labRoom.traverse((child) => {
//     if (child.isMesh) {
//       child.castShadow = true;
//       child.receiveShadow = true;
//       if (child.material) {
//         child.material.roughness = 0.8;
//         child.material.metalness = 0.1;
//       }
//     }
//   });

//   scene.add(labRoom);
//   console.log("Lab room loaded.");

//   // Compute world-space bounding box
//   const box = new THREE.Box3().setFromObject(labRoom);
//   box.getCenter(roomCenter);

//   const size = new THREE.Vector3();
//   box.getSize(size);

//   // Define how close to the walls the player is allowed to get (in meters)
//   const margin = 2.0;

//   // "Half size" of the allowed walk area in XZ
//   const shrinkFactor = 0.80;   // 80% of original size = tighter room

//   roomHalfSize.set(
//     (size.x * 0.5) * shrinkFactor,
//     (size.z * 0.5) * shrinkFactor
//   );
// });


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


const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);

setupController(controller1, 0, renderer, cameraGroup);
setupController(controller2, 1, renderer, cameraGroup);

setupNinjaHands(scene, renderer);
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
const nodesById = {};
// Edge index map: edgeKey -> { start: idx0, end: idx1 }
const edgeVertexMap = new Map();
let lineSegments = null
export let periodStack = null;
const colorScale = scaleOrdinal(schemeCategory10)

function buildBatchedEdges(graphData, nodesById) {
  console.log("buildBatchedEdges called")
  // edgeVertexMap.clear()
  const positions = [];
  const colors = [];
  const color = new THREE.Color();

  let vIndex = 0;
  const alphas = [];

  graphData.links.forEach(link => {
    const src = nodesById[link.source.id ?? link.source];
    const tgt = nodesById[link.target.id ?? link.target];
    if (!src || !tgt) return;

    // each edge has 2 vertices, so you MUST push 2 alpha values
    alphas.push(0.2);
    alphas.push(0.2);
    const x1 = Number.isFinite(src.x) ? src.x : 0;
    const y1 = Number.isFinite(src.y) ? src.y : 0;
    const z1 = Number.isFinite(src.z) ? src.z : 0;

    const x2 = Number.isFinite(tgt.x) ? tgt.x : 0;
    const y2 = Number.isFinite(tgt.y) ? tgt.y : 0;
    const z2 = Number.isFinite(tgt.z) ? tgt.z : 0;

    // // positions
    positions.push(x1, y1, z1);
    positions.push(x2, y2, z2);

    // default colors
    color.setRGB(0.65, 0.75, 0.9);
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


// ========================
// Graph Initialization
// ========================

function applyDataset(dataset, periods) {
  // 1️ Color scale
  colorScale.domain([...new Set(dataset.nodes.map(n => n.group))]);

  // 2️ Adjacency
  adjacency.clear();
  directLinksMap.clear();

  dataset.nodes.forEach(n => {
    const id = String(n.id);
    adjacency.set(id, new Set());
    directLinksMap.set(id, []);
  });

  dataset.links.forEach(l => {
    const s = String(l.source.id ?? l.source);
    const t = String(l.target.id ?? l.target);

    adjacency.get(s)?.add(t);
    adjacency.get(t)?.add(s);

    directLinksMap.get(s)?.push({ source: s, target: t });
    if (s !== t) directLinksMap.get(t)?.push({ source: s, target: t });
  });

  // 3️ ForceGraph data
  Graph.graphData(dataset);
  Graph.linkVisibility(false)   // disable built-in lines
  Graph.nodeAutoColorBy('group');

  // 4️ nodesById
  Object.keys(nodesById).forEach(k => delete nodesById[k]);
  dataset.nodes.forEach(n => nodesById[n.id] = n);

  // 5️ Edges
  if (lineSegments) {
    graphRoot.remove(lineSegments);
    lineSegments.geometry.dispose();
    lineSegments.material.dispose();
  }

  edgeVertexMap.clear();
  lineSegments = buildBatchedEdges(Graph.graphData(), nodesById);
  graphRoot.add(lineSegments);

  graphController.setEdgeLayer?.(lineSegments, edgeVertexMap);

  // 6️ Controller
  graphController.setDataset(dataset);
  graphController.resetAll();


  // 7️ Period stack
  if (periodStack) {
    scene.remove(periodStack.group);
    periodStack = null;
  }

  // // 8 Update Filter Panel using the created uiPanel at initialization
  // updateGroupList(uiPanel, buildGroupColorList())


  console.log('Dataset applied');
}


// colorScale.domain([...new Set(graphData.nodes.map(n => n.group))]);

const Graph = ForceGraph3D()(document.body)
Graph.nodeColor(d => colorScale(d.group))
Graph.nodeLabel(node => node.label || node.id)
Graph.onNodeClick((node, event) => {
  graphController.highlightNode(node.id);
  broadcastNodeSelection(node.id, 'DIRECT');
})

async function loadDataset(datasetKey) {
  const entry = DATASETS[datasetKey];
  if (!entry) {
    throw new Error(`Unknown dataset: ${datasetKey}`);
  }

  // 1️ Load modules
  const dataModule = await entry.data();
  const periodModule = await entry.periods();

  // 2️ Extract actual values
  dataset = dataModule.default ?? dataModule;
  // Cache original timestamps BEFORE ForceGraph mutates links
  dataset.__allTimes = dataset.links.flatMap(l =>
    Array.isArray(l.times) ? l.times : []
  );

  periods = dataset.meta?.periods ?? [];


  // 3️ Validate
  if (!dataset?.nodes || !dataset?.links) {
    throw new Error("Invalid dataset shape");
  }

  // console.log(
  //   `Loaded dataset "${entry.label}"`,
  //   dataset.nodes.length,
  //   dataset.links.length
  // );
  // console.log(
  //   `-----Loaded periods----- "${periods}"`
  // )

  return { datasetValues: dataset, periodLabelsValues: periods, key: datasetKey };

  // // 4️ Apply to graph
  // applyDataset(dataset, periods);
}


export async function switchDataset(datasetKey) {
  // 1️ Load data and Store current state in dataset and periods
  const { datasetValues, periodLabelsValues, key } = await loadDataset(datasetKey);


  // 2️ Store current state
  dataset = datasetValues;
  periods = periodLabelsValues;
  const currentDatasetKey = key;
  console.log("LOADED DATA AND PERIODS AS WELL AS KEY", dataset, periods, currentDatasetKey)
  // 3️ Apply to graph
  applyDataset(dataset, periods);

  // Update the rest of the visuals as well
  // Update Filter Panel using the created uiPanel at initialization
  updateGroupList(uiPanel, buildGroupColorList(Graph.graphData()))

  console.log(`Dataset switched to: ${currentDatasetKey}`);
}


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



Graph.graphData().nodes.forEach(n => nodesById[n.id] = n);

const GraphRef = { current: Graph };
const graphRoot = Graph.scene();


// Create controller after graph inititialization
// Include the histogram as visual module updated by the controller
const graphController = new GraphVisualController({
  graph: Graph,
  scene: Graph.scene(),
  lineSegments: null,
  edgeVertexMap,
  adapter: graphAdapter
});


await loadDataset('school')
applyDataset(dataset, periods)

// ========================
// EXPERIMENTAL: Temporal Hierarchy Autoplay
// ========================



const b = 4;
// const deltaMin = 50; // arbitrary test value
// Use the ORIGINAL dataset, not ForceGraph-mutated data
const allTimes = dataset.__allTimes ?? [];

// ==========
const T = allTimes.reduce((max, t) => (t > max ? t : max), -Infinity) + 1;



const levels = buildTemporalHierarchy({ T, deltaMin: userDeltaMin, b: 4 });
const root = buildTemporalTree(levels, 4);
const navigator = createTemporalNavigator(root);

const temporalPanel = createTemporalDrillPanel({
  cameraGroup: cameraGroup, // Pass the group (scene graph location)
  camera: camera,           // Pass camera (for positioning calculation)
  navigator,
  graphController
});

// --- UNIFIED TEMPORAL DISPATCHER ---

export function dispatchTemporalUpdate() {
  const activeBucket = navigator.getCurrentNode();
  if (!activeBucket) return;

  // 1. Update Graph and dependent UI modules
  // including the histogram - update 3D Histogram Highlight Window
  graphController.highlightBucket(activeBucket);

  // 2. Update the VR UI Panel
  if (temporalPanel.group.visible) {
    temporalPanel.show();
  }
}

function handleTemporalShift(direction) {
  // -1 to the left
  //  1 to the right
  const newNode = navigator.shiftSibling(direction);
  if (newNode) {
    dispatchTemporalUpdate();
  }
}

const globalStart = 0; // Or math.min(...dataset.__allTimes) if it doesn't start at 0
const globalDuration = T - globalStart;
// // Create 60 bars across the timeline
const histogramData = calculateHistogram(dataset.__allTimes, globalStart, globalDuration, 60);


// create the histogram UI Module class
const histogram = new HistogramGauge({
  bins: histogramData,
  globalStart,
  globalDuration,
  onBucketSelected: (bucket) => {
    graphController.highlightBucket(bucket);
  }
});

// Add it to the VR camera space
cameraGroup.add(histogram.getObject3D());


// Subscribe to controller temporal updates
graphController.subscribeToTimeChanges(
  histogram.onTimeChange.bind(histogram)
);

// Initialize the highlight of the histogram
graphController.highlightBucket(null);

// // Create 60 bars across the timeline
// const histogramData = calculateHistogram(dataset.__allTimes, globalStart, globalDuration, 60);

// export const timeGauge = createHistogramGauge(
//   histogramData,
//   new THREE.Vector3(0, 1.4, -1.2),
//   1.5, // Width of the whole gauge
//   0.2  // Max height of the tallest bar
// );


// // Subscribe the histogram to the graphController
// graphController.subscribeToTimeChanges((bucket) => {
//   const globalStart = 0;
//   const globalDuration = T - globalStart;
//   updateBarGaugeForBucket(timeGauge, bucket, globalStart, globalDuration);
// })


// // Add the histogram to the VR space 
// cameraGroup.add(timeGauge);



// await switchDataset('school')


// shrink the graph by 50%
graphRoot.scale.set(0.99, 0.99, 0.99);
graphRoot.add(lineSegments);

scene.add(graphRoot);
graphRoot.position.y += 40;   // or any value you like



Graph.onEngineTick(() => {

  if (!lineSegments) return;

  const pos = lineSegments.geometry.attributes.position.array;
  let i = 0;

  Graph.graphData().links.forEach(link => {
    const src = nodesById[link.source.id ?? link.source];
    const tgt = nodesById[link.target.id ?? link.target];
    if (!src || !tgt) return;

    if (!Number.isFinite(src.x) || !Number.isFinite(tgt.x)) return;

    pos[i++] = src.x;
    pos[i++] = src.y;
    pos[i++] = src.z;
    pos[i++] = tgt.x;
    pos[i++] = tgt.y;
    pos[i++] = tgt.z;
  });

  lineSegments.geometry.attributes.position.needsUpdate = true;
});

// This lets other modules import the controller without circular dependency
export function getGraphController() {
  return graphController;
}


registerNetworkHandlers({
  onNodeSelect: (nodeId) => {
    graphController.highlightNode(nodeId);

    // keep legacy UI side-effects
    // uiPanel.userData.updateSelectedNodeLabel?.(String(nodeId));
  },

  onGroupSelect: (groupName) => {
    graphController.highlightGroup(groupName);
  },

  onPeriodChange: (period) => {
    graphController.highlightPeriod(period);
    updatePeroidLabel(period);
  },

  onGraphReset: () => {
    resetGraph()
  },

  onPeriodStackToggle: (visible, context) => {
    applyRemotePeriodStackToggle(visible, context);
  },
  onDatasetChange: async (datasetKey) => {
    console.log('[main] loading dataset from network:', datasetKey);
    await switchDataset(datasetKey)
  },
});



function rebuildPeriodStack() {
  if (periodStack) {
    scene.remove(periodStack.group);
    periodStack = null;
  }

  const freshData = JSON.parse(JSON.stringify(dataset)); // deep clone
  periodStack = createPeriodStack({
    Graph,
    graphData: freshData,
    periods: periods,
    colorScale,
    spacing: 50,
    nodeSize: 1.2,
    controller: graphController
  });

  scene.add(periodStack.group);
}

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


const groups = [...new Set(Graph.graphData().nodes.map(n => n.group))].map(group => ({
  name: String(group),
  color: colorScale(group)
}));

export function buildGroupColorList(dataset) {
  console.log("HELLOSOSOFSDFDSIFISDF", dataset)
  const map = new Map();
  dataset.nodes.forEach(n => {
    if (!map.has(n.group)) {
      map.set(n.group, colorScale(n.group));
    }
  });
  return [...map.entries()].map(([name, color]) => ({ name, color }));
}

export const uiPanel = await createFilterPanel({ groupColors: groups, camera, datasets: Object.values(DATASETS) });
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

graphController.setSelectionListener((nodeId) => {
  uiPanel.userData.updateSelectedNodeLabel?.(nodeId);
});


setUIPanel(uiPanel);

export function highlightSubgraph(nodeId) {
  graphController.highlightNode(nodeId)
}


function getEdgeKey(a, b) {
  return [a, b].sort().join('--');
}

export function highlightGroup(groupName) {
  graphController.highlightGroup(groupName)
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

  graphController.clearGroupFilter()
  updatePeroidLabel('Default');
  uiPanel.userData.updateSelectedNodeLabel?.(null);

  graphController.resetAll()
  histogram.reset()
  // updateBarGauge(timeGauge, 0, "Default");
}



export function highlightPeriod(periodValue) {
  graphController.highlightPeriod(periodValue)

  console.log("GET RID OF ME LATER WHEN YOU GET RID OF THE DEPENDENCIES :)");
  updatePeroidLabel(periodValue);

  currentPeriodIndex = periods.indexOf(periodValue);

  const value = currentPeriodIndex / (periods.length - 1);

  updateBarGauge(timeGauge, value, periodValue);
}


// ========================
// XR Session Event Handling
// ========================
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  Graph.enablePointerInteraction(false);
  inVR = true;

  // Show guide panel when starting the tool
  userGuidePanel.visible = true

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
    graphController.highlightGroup(context.groupName)
    // highlightGroup(context.groupName);
  }
  if (context.period) {
    graphController.highlightPeriod(context.period)
    // highlightPeriod(context.period);
  }
  if (context.selectedNodeId) {
    graphController.highlightNode(context.selectedNodeId)
    // highlightSubgraph(context.selectedNodeId);
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
setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate, scene, cameraGroup, histogram);
// precomputePeriodData();
export const AVATAR_UPDATE_INTERVAL = 16;
// startPeriodPreviewCycle();

let fpsAccum = 0;
let frameCount = 0;

// --- Reusable vectors for the "Behind" check ---
const _panelDir = new THREE.Vector3();
const _camForward = new THREE.Vector3();
const _snapPos = new THREE.Vector3();


renderer.setAnimationLoop((timestamp, xrFrame) => {

  // SKYBOX RENDERING 
  grid.position.x = Math.floor(camera.position.x / 10) * 10;
  grid.position.z = Math.floor(camera.position.z / 10) * 10;

  scene.updateMatrixWorld(true);
  if (periodStack?.group?.visible) {
    periodStack.syncFromGraph?.(Graph);
  }
  //setupNinjaHands(scene, renderer)


  const deltaTime = (timestamp - lastTime) / 1000; // seconds
  lastTime = timestamp;
  if (periodStack) periodStack.update(deltaTime);

  avatarInterpolation.update(userAvatars, deltaTime);



  const fps = 1 / Math.max(deltaTime, 1e-6);
  fpsAccum += fps;
  frameCount++;
  if (frameCount % 60 === 0) { // log once every ~60 frames 
    // console.log("FPS:", Math.round(fpsAccum / frameCount));
    frameCount = 0;
    fpsAccum = 0;
  }
  // Make avatar name labels always face the camera
  Object.values(userAvatars).forEach(({ head, nameLabel }) => {
    if (nameLabel) {

      nameLabel.lookAt(camera.position);
    }
  });
  //livesheer 





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
        // highlightSubgraph(graphUpdateNodeId);
        graphController.highlightNode(graphUpdateNodeId)
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

  // <--- NEW: FIX FOR "GOING BEHIND" (Snap Logic)
  // ============================================================
  temporalPanel.update();
  // ============================================================


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
    // clampCameraToRoom();
    const deltaTime = (timestamp - lastTime) / 1000;
    lastTime = timestamp;

    // --- Graph scaling with stick buttons ---
    handleLeftStickButton(xrFrame, () => {
      handleTemporalShift(-1);
      if (userGuidePanel.visible) {
        prevGuidePage(userGuidePanel);
      };

      console.log("Left stick clicked")
    });
    animatePuppetHands(xrFrame, renderer);
    handleRightStickButton(xrFrame, () => {
      console.log("Right stick clicked")
      handleTemporalShift(1);
      if (userGuidePanel.visible) {
        nextGuidePage(userGuidePanel);
      };
      // temporalPanel.toggle();
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
      // Show the user guide panel
      toggleGuidePanel();

      // const state = graphController.getState();

      // const context = {
      //   groupName: state.activeGroup,
      //   period: state.activePeriod,
      //   selectedNodeId: state.selectedNodeId
      // };

      // if (!periodStack || periodStack.group.visible === false) {
      //   rebuildPeriodStack();
      //   periodStack.show();
      //   broadcastPeriodStackToggle(true, context);
      // } else {
      //   periodStack.hide();
      //   broadcastPeriodStackToggle(false, context);
      // }
    });

    handleYButtonInput(xrFrame, () => {
      temporalPanel.toggle();
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
  // renderer.clearDepth();
});
