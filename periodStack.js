// periodStack.js
import * as THREE from 'three';
import { forceSimulation, forceManyBody, forceLink, forceCenter } from 'd3-force';
import { Text } from 'troika-three-text';






function layout2D(nodes, links) {
  const sim = forceSimulation(nodes)
    .force('charge', forceManyBody().strength(-50))
    .force('link', forceLink(links).id(d => d.id).distance(40))
    .force('center', forceCenter(0, 0));

  // Run the simulation for some ticks (no animation, just compute)
  for (let i = 0; i < 200; i++) sim.tick();
  sim.stop();
  return nodes; // now nodes have .x and .y
}


export function createPeriodStack({
  Graph,
  graphData,
  periods,
  colorScale,
  spacing = 80,
  nodeSize = 2.5,
  selectionState = null,
  groupFilterState = null
  }) {
  if (!Graph) throw new Error('createPeriodStack: Graph is required');

  const root = new THREE.Group();
  root.name = 'PeriodStack';
  root.visible = false;

  const mainRoot = Graph.scene();
  const fgCanvas = Graph.renderer ? Graph.renderer().domElement : null;
  const basePos = mainRoot.position.clone();
  const baseQuat = mainRoot.quaternion.clone();
  const baseScale = mainRoot.scale.clone();

  function dataForPeriod(period) {
    const links = graphData.links.filter(l => l.periods?.includes(period));
    const nodeIds = new Set();
    for (const l of links) {
      nodeIds.add(String(l.source?.id ?? l.source));
      nodeIds.add(String(l.target?.id ?? l.target));
    }
    const nodes = graphData.nodes.filter(n => nodeIds.has(String(n.id)));
    return { nodes: nodes.map(n => ({ ...n })), links }; // clone nodes for layout
  }

  const subGroups = [];
  const targetsZ = [];
  const startZ = -((periods.length - 1) * spacing) / 2;

periods.forEach((period, idx) => {
  const { nodes, links } = dataForPeriod(period);
  if (!nodes.length && !links.length) return;

  // --- apply selection/group filters ---
  let filteredNodes = nodes;
  let filteredLinks = links;

  // node selection
  if (selectionState?.isActive && selectionState.selectedNodeId) {
    const selId = String(selectionState.selectedNodeId);
    const neighborIds = selectionState.neighborIds || new Set();
    filteredNodes = nodes.filter(n => n.id === selId || neighborIds.has(String(n.id)));
    filteredLinks = links.filter(l => {
      const s = String(l.source?.id ?? l.source);
      const t = String(l.target?.id ?? l.target);
      return (s === selId || t === selId);
    });
  }

  // group selection
  if (groupFilterState?.isActive && groupFilterState.activeGroup) {
    const gname = groupFilterState.activeGroup.toLowerCase();
    filteredNodes = nodes.filter(n => String(n.group).toLowerCase() === gname);
    filteredLinks = links.filter(l => {
      const s = String(l.source?.id ?? l.source);
      const t = String(l.target?.id ?? l.target);
      return filteredNodes.some(n => String(n.id) === s) &&
             filteredNodes.some(n => String(n.id) === t);
    });
  }

  if (!filteredNodes.length && !filteredLinks.length) return;

  // compute 2D layout
  layout2D(filteredNodes, filteredLinks);

  const g = new THREE.Group();
  g.name = `Period_${period}`;
  g.position.copy(basePos);
  g.quaternion.copy(baseQuat);
  g.scale.copy(baseScale).multiplyScalar(0.4); // shrink

  // --- Nodes ---
  const posArr = new Float32Array(filteredNodes.length * 3);
  const colArr = new Float32Array(filteredNodes.length * 3);
  const c = new THREE.Color();
  filteredNodes.forEach((n, i) => {
    const i3 = i * 3;
    posArr[i3]     = n.x;
    posArr[i3 + 1] = n.y;
    posArr[i3 + 2] = 0;
    c.set(colorScale(n.group));
    colArr[i3]     = c.r;
    colArr[i3 + 1] = c.g;
    colArr[i3 + 2] = c.b;
  });

    const nodeGeom = new THREE.BufferGeometry();
    nodeGeom.setAttribute('position', new THREE.BufferAttribute(posArr, 3));
    nodeGeom.setAttribute('color', new THREE.BufferAttribute(colArr, 3));
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

    // --- Edges ---
    if (filteredLinks.length) {
      const epos = new Float32Array(filteredLinks.length * 2 * 3);
      let k = 0;
      filteredLinks.forEach(l => {
        const a = filteredNodes.find(n => String(n.id) === String(l.source?.id ?? l.source));
        const b = filteredNodes.find(n => String(n.id) === String(l.target?.id ?? l.target));
        if (!a || !b) return;
        epos[k++] = a.x; epos[k++] = a.y; epos[k++] = 0;
        epos[k++] = b.x; epos[k++] = b.y; epos[k++] = 0;
      });
      const edgeGeom = new THREE.BufferGeometry();
      edgeGeom.setAttribute('position', new THREE.BufferAttribute(epos, 3));
      const edgeMat = new THREE.LineBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.35,
        depthWrite: false
      });
      g.add(new THREE.LineSegments(edgeGeom, edgeMat));
    }

    filteredNodes.forEach(n => {
    const label = new Text();
    label.text = String(n.id);
    label.fontSize = 4;   // adjust relative to your scale
    label.color = 0xffffff;
    label.anchorX = 'center';
    label.anchorY = 'middle';
    label.position.set(n.x, n.y + 5, 0); // offset above node
    label.sync(); // troika needs this
    g.add(label);
    });

    // Label
    const label = makeTextSprite(String(period));
    label.position.set(0, 30, 0);
    g.add(label);

    root.add(g);
    subGroups.push(g);
    targetsZ.push(startZ + idx * spacing);
  });

  // --- show/hide/toggle ---
  let state = 'hidden';
  let t = 0;
  const duration = 0.7;
  const ease = x => x * x * (3 - 2 * x);

  function show() {
    if (!subGroups.length) return;
    state = 'showing'; t = 0; root.visible = true;
    if (mainRoot) mainRoot.visible = false;
    if (fgCanvas) fgCanvas.style.display = 'none';
  }
  function hide() { if (subGroups.length) { state = 'hiding'; t = 0; } }
  function toggle() { (state === 'hidden' || state === 'hiding') ? show() : hide(); }

  function update(dt) {
    if (state !== 'showing' && state !== 'hiding') return;
    t = Math.min(1, t + dt / duration);
    const u = ease(t);
    subGroups.forEach((g, i) => {
      const fromZ = (state === 'showing') ? basePos.z : basePos.z + targetsZ[i];
      const toZ   = (state === 'showing') ? basePos.z + targetsZ[i] : basePos.z;
      g.position.z = THREE.MathUtils.lerp(fromZ, toZ, u);
      g.quaternion.copy(baseQuat);
    });
    if (t >= 1) {
      state = (state === 'showing') ? 'shown' : 'hidden';
      if (state === 'hidden') {
        root.visible = false;
        if (mainRoot) mainRoot.visible = true;
        if (fgCanvas) fgCanvas.style.display = 'block';
      }
    }
  }

  return { group: root, show, hide, toggle, update };
}
const circleTexture = makeCircleTexture();

// Label sprite
function makeTextSprite(text) {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  const pad = 12;
  ctx.font = '32px sans-serif';
  const w = Math.ceil(ctx.measureText(text).width) + pad * 2;
  const h = 48 + pad * 2;
  canvas.width = w; canvas.height = h;
  ctx.font = '32px sans-serif';
  ctx.fillStyle = 'rgba(0,0,0,0.6)'; ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = '#fff'; ctx.textBaseline = 'middle';
  ctx.fillText(text, pad, h / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.generateMipmaps = false;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  const mat = new THREE.SpriteMaterial({ map: tex, transparent: true });
  const sprite = new THREE.Sprite(mat);
  const scale = 20;
  sprite.scale.set((w / h) * scale, scale, 1);
  return sprite;
}

  function makeCircleTexture() {
  const size = 64;
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = size;
  const ctx = canvas.getContext('2d');

  ctx.beginPath();
  ctx.arc(size/2, size/2, size/2, 0, Math.PI * 2);
  ctx.closePath();
  ctx.fillStyle = '#fff'; // solid white, color comes from vertexColors
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.needsUpdate = true;
  tex.minFilter = THREE.LinearFilter;
  tex.magFilter = THREE.LinearFilter;
  return tex;
}


// Today