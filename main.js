// main.js
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
import { registerNetworkHandlers, broadcastAvatar, setScene, userAvatars, avatarInterpolation, setUIPanel, setUsername, broadcastNodeSelection } from './network.js';
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
import { createSky, gridGeo, gridMaterial } from './skybox.js';
import { calculateInsights } from './insightSystem.js';
import { InsightPanel } from './insightPanel.js';
import { initStartMenu } from './startMenu.js';
import { SlidingTimelineManager } from './SlidingTimelineManager.js';
import { QuestionPanel } from './questionPanel.js';

// After scene creation


// INTIALIZE THE START MENU AND GLOBAL VARIABLES
const { datasetKey, deltaMin, username } = await initStartMenu();
export let userDeltaMin = deltaMin;
let selectedDatasetKey = datasetKey;
setUsername(username)
export const myUsername = username

let stickHoldTimer = 0;
const HOLD_THRESHOLD = 0.2; // Seconds before a click turns into a slide
const SLIDE_SPEED = 50; // Steps per second while holding

let triggerHoldTime = 0;
const TRIGGER_HOLD_THRESHOLD = 0.25; // seconds
let wasTriggerPressed = false;

// ONLY DECLARE IT HERE. DO NOT INITIALIZE IT YET.
export let timelineManager = null;

let globalStart = 0;
let globalDuration = 1;
let insightPanel = null;


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
const PANEL_HIDDEN_POS = new THREE.Vector3(0, -2, -0.8);

let currentPeriodIndex = 0;
let targetScale = 0.1;      // starting size
const scaleLerpSpeed = 0.05; // how smooth it feels

let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;


const roomCenter = new THREE.Vector3(0, 0, 0);


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
// scene.fog = new THREE.FogExp2(0x1a2638, 0.004);
// scene.fog = new THREE.FogExp2(0x020617, 0.0025);
scene.fog = new THREE.FogExp2(0x0f2238, 0.0015);

const sky = createSky();
scene.add(sky);

const grid = new THREE.Mesh(gridGeo, gridMaterial)
scene.add(grid)
grid.renderOrder = -1;



// ======== LOAD VR ROOM / LAB ROOM ========
const loader = new GLTFLoader();

let roomHalfSize = new THREE.Vector2(500, 500); // XZ half size we allow the user to move in



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

insightPanel = new InsightPanel();
cameraGroup.add(insightPanel.getObject3D());

// ========================
// User Guide Panel Setup 
// in Camera Group
// ========================
export const userGuidePanel = createUserGuidePanel();
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

// THIS CHNAGED
const questPanel = new QuestionPanel(scene);

// If you want to move it specifically:
questPanel.group.position.set(250, 25.8, 8);
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
  console.log("buildBatchedEdges called with GPU filtering (Fixed)");

  const positions = [];
  const colors = [];
  const alphas = [];
  const startTimes = [];
  const endTimes = [];

  let vIndex = 0;

  graphData.links.forEach(link => {
    // 1. Get the actual node objects
    const src = nodesById[link.source.id ?? link.source];
    const tgt = nodesById[link.target.id ?? link.target];

    if (!src || !tgt) return;

    // 2. Extract Temporal Data for this edge
    // FIX: If there are no times, we set values to -1.0. 
    // Since the timeline slider is always >= 0, these will be hidden by the shader.
    const times = link.times || [];
    const edgeStart = times.length > 0 ? Math.min(...times) : -1.0;
    const edgeEnd = times.length > 0 ? Math.max(...times) : -1.0;

    // 3. Logic for Edge Coloring (Intra vs Inter)
    const srcGroup = src.group;
    const tgtGroup = tgt.group;

    if (srcGroup === tgtGroup) {
      // INTRA: Same community -> Use Group Color
      const c = new THREE.Color(colorScale(srcGroup));
      colors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    } else {
      // INTER: Different communities -> Pure White
      colors.push(1, 1, 1, 1, 1, 1);
    }

    // 4. Populate Attributes (2 vertices per line segment)
    // BASE_EDGE_ALPHA (0.45) is used as the default visibility
    alphas.push(0.45, 0.45);

    // Add the time data for BOTH vertices of the edge
    startTimes.push(edgeStart, edgeStart);
    endTimes.push(edgeEnd, edgeEnd);

    // Positions
    const x1 = Number.isFinite(src.x) ? src.x : 0;
    const y1 = Number.isFinite(src.y) ? src.y : 0;
    const z1 = Number.isFinite(src.z) ? src.z : 0;

    const x2 = Number.isFinite(tgt.x) ? tgt.x : 0;
    const y2 = Number.isFinite(tgt.y) ? tgt.y : 0;
    const z2 = Number.isFinite(tgt.z) ? tgt.z : 0;

    positions.push(x1, y1, z1, x2, y2, z2);

    // 5. Record indices for the selection map
    const key = getEdgeKey(link.source.id ?? link.source, link.target.id ?? link.target);
    edgeVertexMap.set(key, { start: vIndex, end: vIndex + 1 });
    vIndex += 2;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('alpha', new THREE.Float32BufferAttribute(alphas, 1));

  // Attributes for GPU-side time filtering
  geometry.setAttribute('startTime', new THREE.Float32BufferAttribute(startTimes, 1));
  geometry.setAttribute('endTime', new THREE.Float32BufferAttribute(endTimes, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    vertexColors: true,
    depthWrite: false,
    blending: THREE.NormalBlending,
    uniforms: {
      uTimeStart: { value: 0.0 },
      uTimeEnd: { value: 1000000.0 }
    },
    vertexShader: `
      attribute float alpha;
      attribute float startTime;
      attribute float endTime;
      
      uniform float uTimeStart;
      uniform float uTimeEnd;

      varying vec3 vColor;
      varying float vAlpha;

      void main() {
        vColor = color;
        
        float isVisible = 1.0;

        // 1. If edge has no data (our -1.0 fallback), hide it.
        if (startTime < 0.0) {
            isVisible = 0.0;
        }
        // 2. Standard Temporal Overlap logic
        else if (startTime > uTimeEnd || endTime < uTimeStart) {
            isVisible = 0.0;
        }

        vAlpha = alpha * isVisible; 
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      varying vec3 vColor;
      varying float vAlpha;
      void main() {
        if (vAlpha <= 0.0) discard;
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
  // FORCE INITIAL INSIGHTS CALCULATION
  // This ensures the panel is populated the moment you enter VR
  setTimeout(() => {
    if (graphController && insightPanel) {
      const { nodes, links } = graphController.getFilteredData();
      const stats = calculateInsights(nodes, links, { type: 'NONE', id: null });
      insightPanel.update(stats, colorScale);
    }
  }, 500); // Small delay to ensure ForceGraph has finished initial layout

  console.log('Dataset applied');
}


// colorScale.domain([...new Set(graphData.nodes.map(n => n.group))]);

const Graph = ForceGraph3D()(document.body)
Graph.nodeColor(d => colorScale(d.group))
Graph.nodeLabel(node => node.label || node.id)
Graph.onNodeClick((node, event) => {
  graphController.highlightNode(node.id);
  // broadcastNodeSelection(node.id, 'DIRECT');
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
if (charge?.strength) charge.strength(-500); // more negative = more repulsion

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




const datasetInfo = await loadDataset(selectedDatasetKey);
// Now 'dataset' and 'periods' are globally assigned within loadDataset, 
// but let's use the returned values for safety:
dataset = datasetInfo.datasetValues;
periods = datasetInfo.periodLabelsValues;

const allTimes = dataset.__allTimes ?? [];
const T = allTimes.reduce((max, t) => (t > max ? t : max), -Infinity) + 1;

// ASSIGN to the global variables we declared at the top
globalStart = 0;
globalDuration = T - globalStart;

graphController.setTimelineContext(globalStart, globalDuration);
timelineManager = new SlidingTimelineManager(globalStart, globalDuration);
window.timelineManager = timelineManager;
// Now this will work because globalStart and globalDuration are defined!
// const histogramData = calculateHistogram(dataset.__allTimes, globalStart, globalDuration, 60);

// THE FIX: Set the initial window to 10% of the dataset so it actually clips things.
const initialWindow = Math.max(10, Math.min(500, globalDuration * 0.1));
timelineManager.setWindowSize(initialWindow);

// Force the GPU to reset to a full view initially
graphController.updateEdgeUniforms(0, globalDuration);

applyDataset(dataset, periods);
// We will update the inside of this panel in the next step!
const temporalPanel = createTemporalDrillPanel({
  cameraGroup: cameraGroup,
  camera: camera,
  timelineManager: timelineManager,
  graphController: graphController
});

// --- NEW: REBUILD TREE FUNCTION ---
export function updateDeltaMin(amount) {
  // 1. Calculate new delta, ensure it doesn't drop below 10
  userDeltaMin = Math.max(10, userDeltaMin + amount);
  console.log(`[Time] Rebuilding tree with new delta_min: ${userDeltaMin}`);

  // 2. Rebuild the mathematical tree
  levels = buildTemporalHierarchy({ T, deltaMin: userDeltaMin, b: 4 });
  root = buildTemporalTree(levels, 4);

  // 3. Re-initialize the navigator
  navigator = createTemporalNavigator(root);

  // 4. Give the updated navigator to the drill panel
  temporalPanel.setNavigator(navigator);

  // 5. Reset the view to the new Root bucket
  dispatchTemporalUpdate();
}



const histogramData = calculateHistogram(dataset.__allTimes, globalStart, globalDuration, 60);


// create the histogram UI Module class
const histogram = new HistogramGauge({
  bins: histogramData,
  globalStart,
  globalDuration,
  onBucketSelected: (bucket) => {
    timelineManager.currentStart = bucket.start;

    const newBucket = timelineManager.getCurrentBucket();

    graphController.bucketActiveNodes.clear();
    graphController.highlightBucket(newBucket);
    histogram.onTimeChange(newBucket);
  }
});

// Add it to the VR camera space
cameraGroup.add(histogram.getObject3D());
cameraGroup.userData.histogram = histogram;
window.histogramRef = histogram


// Subscribe to controller temporal updates
graphController.subscribeToTimeChanges(
  histogram.onTimeChange.bind(histogram)
);

// Subscribe to selection inorder to broadcast later
graphController.setSelectionBroadcaster((nodeId) => {
    broadcastNodeSelection(nodeId);
});

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
    console.log("NODE SELECTED", nodeId)
    graphController.setRemoteSelection(nodeId);
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
//panel for insight 

// const insightPanel = new InsightPanel();
// cameraGroup.add(insightPanel.getObject3D());

// Add the insight panel to the controller subscribers
// This allows them to listen to any selection done in the graph and update
graphController.subscribeToSelection((stats, nodeSelected, edgeMode) => {
  insightPanel.update(stats, colorScale, nodeSelected, edgeMode);
});

// // Hook it into the controller's update loop
// const originalUpdate = graphController.update.bind(graphController);
// graphController.update = () => {
//   // 1. Run original visual updates
//   originalUpdate();

//   // 2. Calculate new insights
//   const { nodes, links } = graphController.getFilteredData();
//   const selection = {
//     type: graphController.state.selection.active ? 'NODE' : 'NONE',
//     id: graphController.state.selection.selectedNodeId
//   };
//   const currentBucket = graphController.state.activeBucket;
//   const globalBucketLinks = dataset.links.filter(l =>
//     graphController._edgeInBucket(l, currentBucket)
//   );
//   const stats = calculateInsights(nodes, links, selection, globalBucketLinks);

//   // 3. Update the Panel
//   insightPanel.update(stats, colorScale);
// };

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


let frameSkip = 0;

function updateTimeWindow() {
  const newBucket = timelineManager.getCurrentBucket();

  // 1. ALWAYS update the GPU Edges (This is instant)
  graphController.updateEdgeUniforms(newBucket.start, newBucket.end);

  // 2. THROTTLE the CPU Node/Selection logic
  // Only run this every 5 frames to keep VR at 90FPS
  frameSkip++;
  if (frameSkip % 5 === 0) {
    graphController.highlightBucket(newBucket);
    if (histogram) histogram.onTimeChange(newBucket);
    frameSkip = 0;
  }
}


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
  // broadcastGraphReset();
});


// main.js

export function resetGraph() {
  // 1. Clear the selection states
  graphController.clearAllSelection();

  // 2. NEW: Force the controller to ignore the performance gate 
  // and reset all edge alphas to BASE_EDGE_ALPHA
  graphController._modeChanged = true;

  // 3. Trigger the update
  graphController.update();
}

export function completeResetGraph() {

  // 1. Set timeline to full range
  timelineManager.reset()
  timelineManager.setWindowSize(globalDuration);

  // 2. Get the FULL bucket
  const bucket = timelineManager.getCurrentBucket();

  // 3. Sync GPU edges (VERY IMPORTANT)
  graphController.updateEdgeUniforms(bucket.start, bucket.end);

  // 4. Sync graph logic
  graphController.bucketActiveNodes.clear();
  graphController.highlightBucket(bucket);

  // 5. Reset selection ONLY (not full reset)
  graphController.clearAllSelection();

  // 6. Sync histogram UI
  histogram.reset()

  console.log("Reset to ALL TIME (stable)");
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



// setInterval(() => {
//   if (inVR && timelineManager) {
//     broadcastAvatar(camera, controller1, controller2, timelineManager);
//   }
// }, 100);

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

  sky.position.copy(camera.position);

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





  if (inVR && (timestamp - lastBroadcast > AVATAR_UPDATE_INTERVAL) && timelineManager) {
    broadcastAvatar(camera, controller1, controller2, timelineManager);
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
        // broadcastNodeSelection(graphUpdateNodeId);
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
  if (hoverPanel && inVR) {
    // Just trigger the update. Let hover.js handle the math and coordinates!
    hoverPanel.userData.update?.();
  }

  if (inVR && xrFrame) {
    handleJoystickInput(xrFrame, camera, cameraGroup);

    // // Calculate deltaTime for smooth sliding and timers
    // const deltaTime = (timestamp - lastTime) / 1000;
    // lastTime = timestamp;
    clampCameraToRoom();
    animatePuppetHands(xrFrame, renderer);

    // ============================================================
    // NEW: "Click-to-Step, Hold-to-Slide" Logic
    // ============================================================
    let isLeftStickPressed = false;
    let isRightStickPressed = false;
    let isLeftTriggerPressed = false;
    let isRightTriggerPressed = false;





    // Reset states at the start of the frame check
    isLeftTriggerPressed = false;
    isRightTriggerPressed = false;
    isLeftStickPressed = false;
    isRightStickPressed = false;

    for (const source of xrFrame.session.inputSources) {
      if (source.gamepad) {
        const gp = source.gamepad;
        const triggerPressed = gp.buttons[0]?.pressed;
        const stickPressed = gp.buttons[3]?.pressed;

        if (source.handedness === 'left') {
          isLeftTriggerPressed = triggerPressed;
          isLeftStickPressed = stickPressed;
        }
        if (source.handedness === 'right') {
          isRightTriggerPressed = triggerPressed;
          isRightStickPressed = stickPressed;
        }
      }
    }

    const isTriggerActive = isLeftTriggerPressed || isRightTriggerPressed;

    if (isTriggerActive) {
      triggerHoldTime += deltaTime; // Timer starts counting up
    } else {
      // Trigger released
      if (wasTriggerPressed && triggerHoldTime < TRIGGER_HOLD_THRESHOLD) {
        // This was a quick tap! 
        // Note: Selection is already handled by 'selectstart' in vrSetup.js
        console.log("Trigger Tap Detected");
      }
      triggerHoldTime = 0; // Reset timer for the next press
    }
    wasTriggerPressed = isTriggerActive;




    // 2. Process the input
    let shifted = false;
    let direction = 0;
    let slideAmount = 0;

    // Determine direction
    if (isLeftStickPressed) direction = -1;
    if (isRightStickPressed) direction = 1;

    if (direction !== 0) {
      stickHoldTimer += deltaTime;

      if (stickHoldTimer < HOLD_THRESHOLD) {
        // --- TAP (single step) ---
        slideAmount = 5; // small step
      } else {
        // --- HOLD (continuous) ---
        slideAmount = SLIDE_SPEED * deltaTime;
      }

      shifted = true;

    } else {
      // Released
      if (stickHoldTimer > 0) {
        Graph.d3ReheatSimulation?.();
      }

      stickHoldTimer = 0;
    }
    // 3. Apply the shift if needed
    if (shifted) {
      timelineManager.shift(direction, slideAmount);
      updateTimeWindow()
    }


    // Handle increase in window size
    const RESIZE_SPEED = 200; // tweak this

    let resized = false;


    if (!cameraGroup.userData.temporalPanel?.visible) {


      if (triggerHoldTime > TRIGGER_HOLD_THRESHOLD) {

        if (isLeftTriggerPressed) {
          timelineManager.setWindowSize(
            timelineManager.windowSize - RESIZE_SPEED * deltaTime
          );
          resized = true; // Set our resized flag
        }

        if (isRightTriggerPressed) {
          timelineManager.setWindowSize(
            timelineManager.windowSize + RESIZE_SPEED * deltaTime
          );
          resized = true; // Set our resized flag
        }
      }
    }

    if (resized) {
      updateTimeWindow();
    }
    // ============================================================


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
      userGuidePanel.visible = !userGuidePanel.visible;

      // This part ensures the video plays/pauses
      if (userGuidePanel.onToggle) {
        userGuidePanel.onToggle(userGuidePanel.visible);
      }
    });

    handleYButtonInput(xrFrame, () => {
      // temporalPanel.toggle();
      const modes = ['ALL', 'INTRA_ONLY', 'INTER_ONLY'];
      const currentIndex = modes.indexOf(graphController.state.edgeMode);
      const nextMode = modes[(currentIndex + 1) % modes.length];

      graphController.setEdgeMode(nextMode);
      [controller1, controller2].forEach(c => {
        const gp = c.userData.inputSource?.gamepad;
        const h = gp?.hapticActuators?.[0] || gp?.hapticActuator;
        if (h?.pulse) {
          h.pulse(0.8, 100);
        } else if (navigator.vibrate) {
          navigator.vibrate(100);
        }
        console.log(`Switched Edge Mode to: ${nextMode}`);
      });
    })

    handleLeftStickButton(xrFrame, () => {
      if (userGuidePanel.visible) {
        console.log("LEFT STICK CLICKED FOR PAGE")
        prevGuidePage(userGuidePanel);
      }
    });

    handleRightStickButton(xrFrame, () => {
      if (userGuidePanel.visible) {
        console.log("RIGHT STICK CLICKED FOR PAGE")
        nextGuidePage(userGuidePanel);
      }
    });

    if (!periodStack?.group?.visible) {
      // 1. Run detection for both controller
      detectHover(controller1, GraphRef.current.scene(), camera, cameraGroup, scene);
      detectHover(controller2, GraphRef.current.scene(), camera, cameraGroup, scene);

      // 2. Update the label position ONLY once per frame
      // This ensures the label follows the camera regardless of which hand triggered it
      const label = cameraGroup.getObjectByName('NodeIDBillboard');
      if (label && typeof label.userData.update === 'function') {
        label.userData.update();
      }
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
