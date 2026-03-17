// periodStack.js

// Current of logic of the period stack...
// MIGHT NEED TO BE CHANGED LATER
// Condition	Nodes shown
// Period only	All nodes active in that period
// Selection only	Selected node + neighbors
// Period + Selection	Selected node + neighbors within that period
// Group + Period	Group ∩ period
// Group + Selection	Group ∩ neighbors
// All three	Intersection of all
// --------------------------------------------------
// PeriodStack NEVER decides visibility.
// It only asks the GraphVisualController.
//
// Visibility rules live ONLY in the controller.
// --------------------------------------------------

import * as THREE from 'three';
import { forceSimulation, forceManyBody, forceLink, forceCenter } from 'd3-force';
import { Text } from 'troika-three-text';

/* --------------------------------------------------
   2D layout helper (mutates nodes)
-------------------------------------------------- */
function layout2D(nodes, links) {
  const sim = forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-50))
    .force('link', forceLink(links).id(d => d.id).distance(40))
    .force('center', forceCenter(0, 0));

  for (let i = 0; i < 200; i++) sim.tick();
  sim.stop();
}

/* --------------------------------------------------
   Period Stack (controller-driven)
-------------------------------------------------- */
// PeriodStack queries controller synchronously.
// If controller state changes, stack must be rebuilt.
export function createPeriodStack({
  Graph,
  graphData,
  periods,
  colorScale,
  spacing,
  nodeSize = 2.5,
  controller        // ✅ SINGLE SOURCE OF TRUTH
}) {
  if (!Graph) throw new Error('createPeriodStack: Graph is required');
  if (!controller) throw new Error('createPeriodStack: controller is required');

  const root = new THREE.Group();
  root.name = 'PeriodStack';
  root.visible = false;

  const mainRoot = Graph.scene();
  const fgCanvas = Graph.renderer ? Graph.renderer().domElement : null;

  const basePos   = mainRoot.position.clone();
  const baseQuat  = mainRoot.quaternion.clone();
  const baseScale = mainRoot.scale.clone();

  /* --------------------------------------------------
     Optional performance optimization:
     filter graph data by period only
  -------------------------------------------------- */
  function dataForPeriod(period) {
    const links = graphData.links.filter(l => l.periods?.includes(period));

    const nodeIds = new Set();
    links.forEach(l => {
      nodeIds.add(String(l.source?.id ?? l.source));
      nodeIds.add(String(l.target?.id ?? l.target));
    });

    const nodes = graphData.nodes.filter(n =>
      nodeIds.has(String(n.id))
    );

    return { nodes, links };
  }

  const subGroups = [];
  const targets = [];

  /* ---------- grid layout ---------- */
  const count = periods.length;
  const cols = Math.ceil(Math.sqrt(count));
  const rows = Math.ceil(count / cols);
  const cell = spacing * 2;
  const halfW = (cols - 1) * cell * 0.5;
  const halfH = (rows - 1) * cell * 0.5;

  /* --------------------------------------------------
     Build one sub-graph per period
  -------------------------------------------------- */
  periods.forEach((period, idx) => {

    // Period-level filtering (performance only)
    const { nodes: periodNodes, links: periodLinks } = dataForPeriod(period);

    //Ask controller what is visible IN THIS PERIOD
    const visibleNodes = periodNodes.filter(n =>
      controller.isNodeVisibleInContext(n.id, period)
    );

    const visibleLinks = periodLinks.filter(l =>
      controller.isEdgeVisibleInContext(l, period)
    );

    if (!visibleNodes.length || !visibleLinks.length) return;

    // Layout ONLY visible nodes
    const nodesForLayout = visibleNodes.map(n => ({ ...n }));
    layout2D(nodesForLayout, visibleLinks);

    // Build group
    const g = new THREE.Group();
    g.name = `Period_${period}`;
    g.position.copy(basePos);
    g.quaternion.copy(baseQuat);
    g.scale.copy(baseScale).multiplyScalar(0.4);

    /* ---------- nodes ---------- */
    const pos = new Float32Array(nodesForLayout.length * 3);
    const col = new Float32Array(nodesForLayout.length * 3);
    const c = new THREE.Color();

    nodesForLayout.forEach((n, i) => {
      const i3 = i * 3;
      pos[i3]     = n.x;
      pos[i3 + 1] = n.y;
      pos[i3 + 2] = 0;

      c.set(colorScale(n.group));
      col[i3]     = c.r;
      col[i3 + 1] = c.g;
      col[i3 + 2] = c.b;
    });

    const nodeGeom = new THREE.BufferGeometry();
    nodeGeom.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    nodeGeom.setAttribute('color', new THREE.BufferAttribute(col, 3));

    const nodeMat = new THREE.PointsMaterial({
      size: nodeSize,
      sizeAttenuation: true,
      vertexColors: true,
      transparent: true,
      opacity: 0.95,
      depthWrite: false,
      map: circleTexture,
      alphaTest: 0.5
    });

    g.add(new THREE.Points(nodeGeom, nodeMat));

    /* ---------- edges ---------- */
    const edgePos = new Float32Array(visibleLinks.length * 2 * 3);
    let k = 0;

    visibleLinks.forEach(l => {
      const a = nodesForLayout.find(n => String(n.id) === String(l.source?.id ?? l.source));
      const b = nodesForLayout.find(n => String(n.id) === String(l.target?.id ?? l.target));
      if (!a || !b) return;

      edgePos[k++] = a.x; edgePos[k++] = a.y; edgePos[k++] = 0;
      edgePos[k++] = b.x; edgePos[k++] = b.y; edgePos[k++] = 0;
    });

    const edgeGeom = new THREE.BufferGeometry();
    edgeGeom.setAttribute('position', new THREE.BufferAttribute(edgePos, 3));

    const edgeMat = new THREE.LineBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.35,
      depthWrite: false
    });

    g.add(new THREE.LineSegments(edgeGeom, edgeMat));

    /* ---------- labels ---------- */
    nodesForLayout.forEach(n => {
      const label = new Text();
      label.text = String(n.id);
      label.fontSize = 4;
      label.color = 0xffffff;
      label.anchorX = 'center';
      label.anchorY = 'middle';
      label.position.set(n.x, n.y + 5, 0);
      label.sync();
      g.add(label);
    });

    const pLabel = makeTextSprite(String(period));
    pLabel.position.set(0, 30, 0);
    g.add(pLabel);

    root.add(g);
    subGroups.push(g);

    const colIdx = idx % cols;
    const rowIdx = Math.floor(idx / cols);
    targets.push({
      x: colIdx * cell - halfW,
      z: rowIdx * cell - halfH
    });
  });

  /* --------------------------------------------------
     Animation
  -------------------------------------------------- */
  let state = 'hidden';
  let t = 0;
  const duration = 0.7;
  const ease = x => x * x * (3 - 2 * x);

  function show() {
    if (!subGroups.length) return;
    state = 'showing';
    t = 0;
    root.visible = true;
    mainRoot.visible = false;
    if (fgCanvas) fgCanvas.style.display = 'none';
  }

  function hide() {
    if (!subGroups.length) return;
    state = 'hiding';
    t = 0;
  }

  function update(dt) {
    if (state !== 'showing' && state !== 'hiding') return;

    t = Math.min(1, t + dt / duration);
    const u = ease(t);

    subGroups.forEach((g, i) => {
      const tgt = targets[i];

      const fromX = state === 'showing' ? basePos.x : basePos.x + tgt.x;
      const fromZ = state === 'showing' ? basePos.z : basePos.z + tgt.z;
      const toX   = state === 'showing' ? basePos.x + tgt.x : basePos.x;
      const toZ   = state === 'showing' ? basePos.z + tgt.z : basePos.z;

      g.position.x = THREE.MathUtils.lerp(fromX, toX, u);
      g.position.z = THREE.MathUtils.lerp(fromZ, toZ, u);
      g.quaternion.copy(baseQuat);
    });

    if (t >= 1) {
      state = state === 'showing' ? 'shown' : 'hidden';
      if (state === 'hidden') {
        root.visible = false;
        mainRoot.visible = true;
        if (fgCanvas) fgCanvas.style.display = 'block';
      }
    }
  }

  return { group: root, show, hide, update };
}

/* --------------------------------------------------
   Helpers
-------------------------------------------------- */
const circleTexture = makeCircleTexture();

function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pad = 12;

  ctx.font = '32px sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 48 + pad * 2;
  canvas.width = w;
  canvas.height = h;

  ctx.font = '32px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.6)';
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h / 2);

  const tex = new THREE.CanvasTexture(canvas);
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;

  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set((w / h) * 20, 20, 1);
  return sprite;
}

function makeCircleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(size / 2, size / 2, size / 2, 0, Math.PI * 2);
  ctx.fillStyle = '#fff';
  ctx.fill();

  return new THREE.CanvasTexture(canvas);
}
