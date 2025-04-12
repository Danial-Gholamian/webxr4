import * as THREE from 'three';
import { VRButton } from 'three/examples/jsm/webxr/VRButton.js';
import ForceGraph3D from '3d-force-graph';
import graphData from './graphData.js';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(75, window.innerWidth / window.innerHeight, 0.1, 1000);
camera.position.set(0, 1.6, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
document.body.appendChild(renderer.domElement);
document.body.appendChild(VRButton.createButton(renderer));

// OrbitControls for desktop
const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;

// Full-control Force Graph using custom renderer and canvas
const Graph = ForceGraph3D()(document.body)
  .graphData(graphData)
  .nodeAutoColorBy('group')
  .nodeLabel(node => node.label || node.id)
  .onNodeClick(node => {
    if (node.url) window.open(node.url, '_blank');
  });


scene.add(Graph.scene()); // attach graph's scene to ours

// VR session tracking
let inVR = false;

renderer.xr.addEventListener('sessionstart', () => {
  inVR = true;
  console.log(' Entered VR');
});

renderer.xr.addEventListener('sessionend', () => {
  inVR = false;
  console.log(' Exited VR');
});

// Animation loop
renderer.setAnimationLoop(() => {
  if (!inVR) controls.update();
  renderer.render(scene, camera);
});
