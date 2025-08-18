// import ForceGraph3D from '3d-force-graph';
// import { scaleOrdinal } from 'd3-scale';
// import { schemeCategory10 } from 'd3-scale-chromatic';
// import * as THREE from 'three';
// import graphData from './graph-data.js';
// import { PathFinder } from './pathFinder.js';
// import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
// import { createFilterPanel } from './filterUIPanel.js';
// import { broadcastNodeSelection } from './network.js';

// export const GraphRef = { current: null };
// export let pathFinder = null;
// export let uiPanel = null;

// const adjacency = new Map();
// const directLinksMap = new Map();
// const nodeMap = new Map(graphData.nodes.map(n => [String(n.id), n]));

// for (const node of graphData.nodes) {
//   const id = String(node.id);
//   adjacency.set(id, new Set());
//   directLinksMap.set(id, []);
// }
// for (const link of graphData.links) {
//   const srcId = String(link.source?.id ?? link.source);
//   const tgtId = String(link.target?.id ?? link.target);
//   adjacency.get(srcId).add(tgtId);
//   adjacency.get(tgtId).add(srcId);
//   const storedLink = { source: srcId, target: tgtId };
//   directLinksMap.get(srcId).push(storedLink);
//   if (srcId !== tgtId) directLinksMap.get(tgtId).push(storedLink);
// }

// const colorScale = scaleOrdinal(schemeCategory10)
//   .domain([...new Set(graphData.nodes.map(n => n.group))]);

// export function createGraphScene(scene, camera, cameraGroup, renderer) {
//   const Graph = ForceGraph3D()(document.body)
//     .graphData(graphData)
//     .nodeAutoColorBy('group')
//     .nodeColor(d => colorScale(d.group))
//     .nodeLabel(d => d.label || d.id)
//     .onNodeClick((node, event) => {
//       highlightSubgraph(node.id, event?.shiftKey ? 'DIRECT' : 'DIREKT');
//       broadcastNodeSelection(node.id, 'DIRECT');
//     });

//   GraphRef.current = Graph;
//   scene.add(Graph.scene());

//   pathFinder = new PathFinder(Graph, adjacency, directLinksMap, colorScale);

//   const vrButton = VRButton.createButton(renderer);
//   vrButton.id = 'VRButton';
//   vrButton.textContent = 'Enter VR';
//   Object.assign(vrButton.style, {
//     position: 'absolute', top: '20px', right: '20px',
//     padding: '10px 16px', background: 'rgba(0,0,0,0.6)',
//     color: 'white', border: '1px solid white',
//     zIndex: '999', cursor: 'pointer', fontFamily: 'sans-serif', fontSize: '14px'
//   });
//   document.body.appendChild(vrButton);

//   const groups = [...new Set(graphData.nodes.map(n => n.group))].map(group => ({
//     name: String(group),
//     color: colorScale(group)
//   }));
//   uiPanel = createFilterPanel({ groupColors: groups, camera });
//   cameraGroup.add(uiPanel);

//   const resetBtn = document.createElement('button');
//   resetBtn.textContent = 'Reset View';
//   Object.assign(resetBtn.style, {
//     position: 'absolute', top: '10px', left: '10px', padding: '8px 12px',
//     background: 'rgba(0,0,0,0.6)', color: 'white', border: '1px solid white',
//     zIndex: 1, cursor: 'pointer'
//   });
//   document.body.appendChild(resetBtn);

//   resetBtn.addEventListener('click', () => {
//     Graph.graphData(graphData);
//     pathFinder.reset();
//     Graph.scene().traverse(obj => {
//       if (obj.__data?.source !== undefined && obj.__data?.target !== undefined) {
//         obj.visible = true;
//       }
//     });
//   });

//   return { Graph, resetBtn };
// }

// export function highlightSubgraph(nodeId, mode = 'DIRECT') {
//   const clickedId = String(nodeId);
//   const neighbourIds = adjacency.get(clickedId) || new Set();

//   GraphRef.current.nodeVisibility(node =>
//     mode === 'DIRECT'
//       ? node.id === clickedId || neighbourIds.has(String(node.id))
//       : true
//   ).linkVisibility(link => {
//     const s = String(link.source.id);
//     const t = String(link.target.id);
//     return s === clickedId || t === clickedId;
//   }).refresh();
// }

// export function requestGraphUpdate(mode, nodeId) {
//   graphUpdateMode = mode;
//   graphUpdateNodeId = nodeId;
//   graphUpdateNeeded = true;
// }

// // Internal state (used in main.js)
// let graphUpdateMode = null;
// let graphUpdateNodeId = null;
// let graphUpdateNeeded = false;

// export function consumeGraphUpdate() {
//   const result = { mode: graphUpdateMode, nodeId: graphUpdateNodeId };
//   graphUpdateMode = null;
//   graphUpdateNodeId = null;
//   graphUpdateNeeded = false;
//   return result;
// }
