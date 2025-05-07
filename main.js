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
  updateLaserPointer,
  handleXButtonInput,
  setupGraphSwitchButtons
} from './vrSetup.js';
import { detectHover, markHoverCacheDirty } from './hover.js'; // Import the necessary functions
import { createFilterPanel } from './filterUIPanel.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);
// For better performance.
const nodeMeshMap = new Map();
const linkMeshMap = new Map();

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
const cameraGroup = new THREE.Group();
cameraGroup.add(camera);
scene.add(cameraGroup);

const controller1 = renderer.xr.getController(0);
const controller2 = renderer.xr.getController(1);


// Build adjacency and direct links map
const adjacency = new Map();
const directLinksMap = new Map();
const nodeMap = new Map(graphData.nodes.map(node => [node.id, node]));

graphData.nodes.forEach(node => {
  adjacency.set(node.id, new Set());
  directLinksMap.set(node.id, []);
});

function requestGraphUpdateAndMarkHoverCacheDirty(mode, nodeId) {
  requestGraphUpdate(mode, nodeId);
  markHoverCacheDirty(); // Tell the hover system to update its cache
}

graphData.links.forEach(link => {
  const srcId = typeof link.source === 'object' ? link.source.id : link.source;
  const tgtId = typeof link.target === 'object' ? link.target.id : link.target;
  adjacency.get(srcId).add(tgtId);
  adjacency.get(tgtId).add(srcId);

  const storedLink = { source: srcId, target: tgtId };
  directLinksMap.get(srcId).push(storedLink);
  if (srcId !== tgtId) directLinksMap.get(tgtId).push(storedLink);
});


// Create graph
const Graph = ForceGraph3D()(document.body)
  .graphData(graphData)
  .nodeAutoColorBy('group')
  .nodeColor(d => colorScale(d.group))
  .nodeLabel(node => node.label || node.id)
  .onNodeClick((node, event) => {
    if (inVR || event?.shiftKey) {
      highlightSubgraph(node.id, 'DIRECT');
    } else {
      highlightSubgraph(node.id, 'SUBGRAPH');
    }
  });
  
  const GraphRef = { current: Graph };


const colorScale = scaleOrdinal(schemeCategory10)
  .domain([...new Set(graphData.nodes.map(n => n.group))]);

const groups = [...new Set(graphData.nodes.map(n => n.group))]
  .map(group => ({
    name: String(group),
    color: colorScale(group)
  }));

// 2. Create panel with REAL group colors
const uiPanel = createFilterPanel({ 
  groupColors: groups,
  camera: camera 
});

// 3. Add to camera group for VR visibility
cameraGroup.add(uiPanel);

  setupController(controller1, 0, renderer, cameraGroup);
  setupController(controller2, 1, renderer, cameraGroup);
  
  setupVRNodeSelection(controller1, controller2, GraphRef, requestGraphUpdate);
  
  const pollGraphSwitchButtons = setupGraphSwitchButtons(controller1, controller2, GraphRef, requestGraphUpdate);

  

scene.add(Graph.scene());

const resetBtn = document.createElement('button');
resetBtn.textContent = 'Reset View';
resetBtn.style.position = 'absolute';
resetBtn.style.top = '10px';
resetBtn.style.left = '10px';
resetBtn.style.padding = '8px 12px';
resetBtn.style.zIndex = 1;
resetBtn.style.background = 'rgba(0,0,0,0.6)';
resetBtn.style.color = 'white';
resetBtn.style.border = '1px solid white';
resetBtn.style.cursor = 'pointer';
document.body.appendChild(resetBtn);

resetBtn.addEventListener('click', () => {
  Graph.graphData(graphData); // Reset to original data

  // Restore visibility of all links
  Graph.scene().traverse(obj => {
    if (
      obj.__data &&
      obj.__data.source !== undefined &&
      obj.__data.target !== undefined
    ) {
      obj.visible = true;
    }
  });

});




let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  inVR = true;
  console.log('Entered VR');

  const session = renderer.xr.getSession();

  // INITIAL assignment
  session.inputSources.forEach(source => {
    if (source.handedness === 'left') {
      controller1.userData.inputSource = source;
      console.log(' Left inputSource assigned');
    }
    if (source.handedness === 'right') {
      controller2.userData.inputSource = source;
      console.log(' Right inputSource assigned');
    }
  });

  // LISTEN for future controller reconnections
  session.addEventListener('inputsourceschange', () => {
    session.inputSources.forEach(source => {
      if (source.handedness === 'left') {
        controller1.userData.inputSource = source;
        console.log(' Left inputSource updated');
      }
      if (source.handedness === 'right') {
        controller2.userData.inputSource = source;
        console.log(' Right inputSource updated');
      }
    });
  });
});


renderer.xr.addEventListener('sessionend', () => {
  inVR = false;
  console.log('Exited VR');
});

let graphUpdateNeeded = false;
let graphUpdateMode = null;
let graphUpdateNodeId = null;

function requestGraphUpdate(mode, nodeId) {
  graphUpdateMode = mode;
  graphUpdateNodeId = nodeId;
  graphUpdateNeeded = true;
}

// In the adjacency and directLinksMap setup:
graphData.nodes.forEach(node => {
  const idStr = String(node.id); // Convert node.id to string
  adjacency.set(idStr, new Set());
  directLinksMap.set(idStr, []);
});

graphData.links.forEach(link => {
  // Convert source and target to strings
  const srcId = String(typeof link.source === 'object' ? link.source.id : link.source);
  const tgtId = String(typeof link.target === 'object' ? link.target.id : link.target);

  adjacency.get(srcId).add(tgtId);
  adjacency.get(tgtId).add(srcId);

  const storedLink = { source: srcId, target: tgtId };
  directLinksMap.get(srcId).push(storedLink);
  if (srcId !== tgtId) directLinksMap.get(tgtId).push(storedLink);
});

// In highlightSubgraph function:
function highlightSubgraph(nodeId) {
  const clickedId = String(nodeId); // Ensure clickedId is a string

  const neighbourIds = new Set([
    ...(adjacency.get(clickedId) ? Array.from(adjacency.get(clickedId)) : [])
  ]);
  const selectedIds = new Set([clickedId, ...neighbourIds]);

  Graph.scene().traverse(obj => {
    if (obj.__data?.id !== undefined) {
      const objId = String(obj.__data.id); // Convert to string for comparison
      const isSelected = selectedIds.has(objId);
      // Rest of the node styling...
    }

    if (obj.__data?.source !== undefined && obj.__data?.target !== undefined) {
      const s = String(obj.__data.source?.id ?? obj.__data.source);
      const t = String(obj.__data.target?.id ?? obj.__data.target);
      obj.visible = (s === clickedId || t === clickedId);
    }
  });
}



renderer.setAnimationLoop((timestamp, xrFrame) => {
  // --- 1. Handle pending graph updates ---
  if (graphUpdateNeeded) {
    switch (graphUpdateMode) {
      case 'FULL':
        Graph.scene().traverse(obj => {
          if (obj.material && obj.material.opacity !== undefined) {
            obj.material.transparent = false;
            obj.material.opacity = 1.0;
          }
        });
        break;

      case 'SUBGRAPH':
      case 'DIRECT':
        highlightSubgraph(graphUpdateNodeId, graphUpdateMode);
        break;
    }

    graphUpdateNeeded = false;
    graphUpdateMode = null;
    graphUpdateNodeId = null;
  }

  // --- 2. Always make labels face the camera ---
  Graph.scene().traverse(obj => {
    if (obj.userData?.labelSprite) {
      obj.userData.labelSprite.lookAt(camera.position);
    }
  });

  if (uiPanel) {
    // Position relative to camera
    const panelOffset = new THREE.Vector3(0, -0.3, -0.8);
    const worldPosition = new THREE.Vector3()
        .copy(camera.position)
        .add(panelOffset.applyQuaternion(camera.quaternion));
    
    uiPanel.position.copy(worldPosition);
    
    // Force update if using XR
    if (inVR) uiPanel.userData.update?.();
}

  // --- 3. VR / non-VR update logic ---
  if (inVR && xrFrame) {
    handleJoystickInput(xrFrame, camera, cameraGroup);

    // — Reset view on X-button press (with haptics) —
    handleXButtonInput(xrFrame, () => {
      resetBtn.click();
      console.log(' View reset via X button');
      
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


    detectHover(controller1, GraphRef.current.scene());
    detectHover(controller2, GraphRef.current.scene());
    pollGraphSwitchButtons();

  }  else {
    controls.update(); // OrbitControls update for desktop
  }

  // --- 4. Final render ---
  renderer.render(scene, camera);
});

