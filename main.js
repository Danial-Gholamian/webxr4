import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import ForceGraph3D from '3d-force-graph';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

const graphData = {
  nodes: [{ id: 'A', group: 1 }, { id: 'B', group: 2 }],
  links: [{ source: 'A', target: 'B' }]
};

const container = document.createElement('div'); // dummy
const Graph = ForceGraph3D({ renderer, extraRenderers: [] })(container)
  .graphData(graphData)
  .nodeAutoColorBy('group');

scene.add(Graph.scene());

renderer.setAnimationLoop(() => {
  renderer.render(scene, camera);
});
