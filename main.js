import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import ForceGraph3D from '3d-force-graph';
import graphData from './graph-data.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  setupController,
  handleJoystickInput,
  setupVRNodeSelection,
  setupGraphSwitchButtons,
  updateLaserPointer
} from './vrSetup.js';
import { detectHover, markHoverCacheDirty } from './hover.js'; // Import the necessary functions

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

// Subgraph helper: selected + neighbors
// function getSubgraphOptimized(selectedId) {
//   const neighbors = adjacency.get(selectedId) || new Set();
//   const nodeIds = new Set([selectedId, ...neighbors]);
//   const subNodes = Array.from(nodeIds).map(id => nodeMap.get(id)).filter(Boolean);
//   const subLinks = new Set();

//   (directLinksMap.get(selectedId) || []).forEach(link => {
//     if (nodeIds.has(link.source) && nodeIds.has(link.target)) {
//       subLinks.add(JSON.stringify(link));
//     }
//   });

//   neighbors.forEach(nId => {
//     (directLinksMap.get(nId) || []).forEach(link => {
//       if (link.source !== selectedId && link.target !== selectedId &&
//           nodeIds.has(link.source) && nodeIds.has(link.target)) {
//         subLinks.add(JSON.stringify(link));
//       }
//     });
//   });

//   return { nodes: subNodes, links: Array.from(subLinks).map(str => JSON.parse(str)) };
// }

// Subgraph helper: selected + direct edges
// function getDirectEdgesOnlyOptimized(selectedId) {
//   const nodeIds = new Set([selectedId]);
//   const subLinks = [];

//   (directLinksMap.get(selectedId) || []).forEach(link => {
//     subLinks.push(link);
//     nodeIds.add(link.source === selectedId ? link.target : link.source);
//   });

//   const subNodes = Array.from(nodeIds).map(id => nodeMap.get(id)).filter(Boolean);
//   return { nodes: subNodes, links: subLinks };
// }

// Create graph
const Graph = ForceGraph3D()(document.body)
  .graphData(graphData)
  .nodeAutoColorBy('group')
  .nodeLabel(node => node.label || node.id)
  .onNodeClick((node, event) => {
    if (inVR || event?.shiftKey) {
      highlightSubgraph(node.id, 'DIRECT');
    } else {
      highlightSubgraph(node.id, 'SUBGRAPH');
    }
  });
  
  const GraphRef = { current: Graph };

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
  Graph.graphData(graphData); // Completely reset to original data
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
      console.log('🆗 Left inputSource assigned');
    }
    if (source.handedness === 'right') {
      controller2.userData.inputSource = source;
      console.log('🆗 Right inputSource assigned');
    }
  });

  // LISTEN for future controller reconnections
  session.addEventListener('inputsourceschange', () => {
    session.inputSources.forEach(source => {
      if (source.handedness === 'left') {
        controller1.userData.inputSource = source;
        console.log('🔁 Left inputSource updated');
      }
      if (source.handedness === 'right') {
        controller2.userData.inputSource = source;
        console.log('🔁 Right inputSource updated');
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

function highlightSubgraph(nodeId, mode = 'SUBGRAPH') {
  const selectedIds = new Set();

  // Add selected node and neighbors
  selectedIds.add(nodeId);
  (directLinksMap.get(nodeId) || []).forEach(link => {
    selectedIds.add(link.source);
    selectedIds.add(link.target);
  });

  console.log(`Selected Node: ${nodeId}`);
  console.log(`Selected IDs Set:`, selectedIds);

  Graph.scene().traverse(obj => {
    if (obj.__data && obj.__data.id !== undefined) {
      const id = obj.__data.id;
      const isSelected = selectedIds.has(id);

      // DEBUG each node
      if (id === nodeId) {
        console.log(`NODE ${id} -> isSelected: ${isSelected}, material opacity before: ${obj.material?.opacity}`);
      }
      if (id === '1753') {
        console.log('1753 object:', obj, 'type:', obj.type, 'material:', obj.material);
      }

      if (obj.material?.opacity !== undefined) {
        obj.material.transparent = true;
        obj.material.opacity = isSelected ? 1.0 : 0.05;

        // DEBUG after setting
        if (id === nodeId) {
          console.log(`NODE ${id} -> material opacity after: ${obj.material.opacity}`);
        }
      }
    }

    if (obj.__data && obj.__data.source !== undefined && obj.__data.target !== undefined) {
      const link = obj.__data;
      const isLinkSelected = (link.source === nodeId || link.target === nodeId);

      if (obj.material?.opacity !== undefined) {
        obj.material.transparent = true;
        obj.material.opacity = isLinkSelected ? 1.0 : 0.05;
      }
    }
  });
}




renderer.setAnimationLoop((timestamp, xrFrame) => {
  if (graphUpdateNeeded) {
    switch (graphUpdateMode) {
      case 'FULL':
        // Reset visibility for all nodes and links
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

  if (inVR && xrFrame) {
    handleJoystickInput(xrFrame, camera, cameraGroup); // Handle movement/rotation

    // Call hover detection for both controllers, passing the graph scene
    if (GraphRef.current?.scene) { // Ensure graph scene exists
      detectHover(controller1, GraphRef.current.scene());
      detectHover(controller2, GraphRef.current.scene());
    }

    pollGraphSwitchButtons(); // Handle button presses

    // REMOVE calls to updateLaserPointer
    // updateLaserPointer(controller1); <--- REMOVE
    // updateLaserPointer(controller2); <--- REMOVE

  } else {
    controls.update(); // OrbitControls update for non-VR
  }

  renderer.render(scene, camera);
});
