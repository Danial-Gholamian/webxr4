// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
// import { broadcastDatasetChange } from './network.js';
import { buildGroupColorList, highlightGroup, switchDataset } from './main.js'
// import { broadcastGroupSelection } from './network.js';
import { getGraphController } from './main.js';


const PANEL_SCALE = 0.28;       // 30% of view width
const PANEL_WIDTH = 1.5;
const PANEL_HEIGHT = 2.5; // Taller to fit list
// const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const ITEM_SIZE = 0.055;   // Group names
const TITLE_SIZE = 0.07;   // "Time of the day"
// const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.17;      // a12cm between rows
// const panelSize = new THREE.Vector3();
let periodTitle = null;
let selectedNodeLabel = null;

const PANEL_LERP_FACTOR = 0.2;



export function updatePeroidLabel(peroidname) {
  if (periodTitle) {
    periodTitle.text = `Time of the day: ${peroidname || 'Default'} 📚`;
    periodTitle.sync();
  }
}
export async function createFilterPanel(options = { groupColors: [], camera: null, datasets: [] }) {
  let cursorY = 1;   // top of panel (local space)
  const SECTION_GAP = 0.12;
  const uiPanel = new THREE.Group();
  uiPanel.name = 'FilterUIPanel';

  const aspect = window.innerWidth / window.innerHeight;
  // uiPanel.position.set(0, -0.6, -0.8);
  uiPanel.scale.set(PANEL_SCALE, PANEL_SCALE, 1);


  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  bgPlane.renderOrder = 0
  bgPlane.name = 'uiPanelBackground';
  bgPlane.userData = {
    interactive: true,
    isUIPanel: true,
    absorbsOnly: true // prevents hover effects
  };

  uiPanel.userData.bgPlane = bgPlane;
  uiPanel.add(bgPlane);


  selectedNodeLabel = createCapsuleLabel('Selected node: None', {
    color: 0xffaa00,
    hoverColor: 0xffaa00
  })
  selectedNodeLabel.position.set(0, cursorY, 0.01);
  // uiPanel.add(periodTitle);
  uiPanel.add(selectedNodeLabel);


  uiPanel.userData.updateSelectedNodeLabel = (nodeId) => {
    selectedNodeLabel.userData.setText(
      `Selected node: ${nodeId ?? 'None'}`
    );
  };

  cursorY -= ROW_SPACING * 1.2;

  const nodeGroupList = new THREE.Group()
  // nodeGroupList.position.set(0, 0, 0.01);
  nodeGroupList.name = 'NodeGroupList'
  uiPanel.add(nodeGroupList)

  // store references
  uiPanel.userData.nodeGroupList = nodeGroupList
  uiPanel.userData.nodenodeGroupButtons = []
  uiPanel.userData.nodeGroupListCursorY = cursorY

  updateGroupList(uiPanel, buildGroupColorList(getGraphController().graph.graphData()))

  uiPanel.traverse(child => {
    if (child.material) {
      child.userData.originalColor = child.material.color.clone();
    }
  });

  const cameraRef = options.camera;
  uiPanel.userData.update = () => {
    if (cameraRef) {
      const camPos = cameraRef.getWorldPosition(new THREE.Vector3());
      uiPanel.lookAt(camPos);
    }
  };


  uiPanel.userData.boundingBox = new THREE.Box3().setFromObject(uiPanel);
  return uiPanel;
}

export function updateGroupList(uiPanel, groupColors) {
  if (!uiPanel?.userData?.nodeGroupList) return;

  const nodeGroupList = uiPanel.userData.nodeGroupList;

  // 1️ Remove old groups
  nodeGroupList.children.forEach(child => {
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) child.material.dispose?.();
  });
  nodeGroupList.clear();

  uiPanel.userData.nodeGroupButtons = [];

  // 2️ Sort groups 
  const sortedGroups = groupColors
    .slice()
    .sort((a, b) => {
      const aStartsDigit = /^\d/.test(a.name);
      const bStartsDigit = /^\d/.test(b.name);
      if (aStartsDigit && !bStartsDigit) return -1;
      if (!aStartsDigit && bStartsDigit) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

  // 3️ Rebuild UI for the group list
  let y = uiPanel.userData.nodeGroupListCursorY;

  sortedGroups.forEach(group => {
    // const dot = new THREE.Mesh(
    //   new THREE.SphereGeometry(0.02),
    //   new THREE.MeshBasicMaterial({
    //     color: group.color,
    //     depthTest: false,
    //     depthWrite: false
    //   })
    // );

    const dot = createColorDot(group.color);

    dot.material.depthTest = false;
    dot.material.depthWrite = false;
    dot.renderOrder = 1000;

    // dot.position.set(-0.4, y, 0.01);
    // nodeGroupList.add(dot);

    const capsule = createCapsuleLabel(group.name, {
      color: 0x222244,
      hoverColor: 0x444488,
      padding: 0.03,
      onClick: () => {
        highlightGroup(group.name);
        // broadcastGroupSelection(group.name);
      }
    });

    // Each row consists of the color swatch and the corresponding group
    const row = new THREE.Group();
    dot.position.set(-0.25, 0, 0);
    capsule.position.set(0.1, 0, 0);

    row.add(dot);
    row.add(capsule);

    nodeGroupList.add(row);

    // capsule.position.set(-0.05, y, 0.01);
    // dot.position.set(-0.42, y, 0.01);
    // capsule.position.set(-0.04, y, 0.01);
    // dot.position.set(-0.28, y, 0);
    // capsule.position.set(0.08, y, 0);
    // nodeGroupList.add(capsule);

    layoutVertical(nodeGroupList, uiPanel.userData.nodeGroupListCursorY, ROW_SPACING);

    // // Center the groups in panel
    // const rowCount = nodeGroupList.children.length;
    // const totalHeight = rowCount * ROW_SPACING;

    // nodeGroupList.position.y = totalHeight / 2;

    uiPanel.userData.nodeGroupButtons.push(capsule);
    y -= 0.17;
  });
}





// filterUIPanel.js

// ... (keep all the code above this function the same)

export function updatePanelPosition({ uiPanel, panelState, camera, cameraGroup, controller, scene, inVR }) {
  if (!uiPanel) return;

  const bgPlane = uiPanel.userData.bgPlane;

  const moveToCamera = () => {
    const offset = new THREE.Vector3(0, 0.1, -0.8);
    return offset.clone().applyQuaternion(camera.quaternion).add(camera.position);
  };

  const moveToController = () => {
    const controllerWorldPos = new THREE.Vector3();
    controller.getWorldPosition(controllerWorldPos);

    const controllerQuat = new THREE.Quaternion();
    controller.getWorldQuaternion(controllerQuat);

    const offset = new THREE.Vector3(0, 0.05, -0.25).applyQuaternion(controllerQuat);
    return controllerWorldPos.add(offset);
  };

  uiPanel.userData.panelState = panelState;

  if (panelState === 'shown') {

    uiPanel.visible = true;

    if (bgPlane) {
      bgPlane.visible = true;
      bgPlane.material.opacity = 0.3;
      bgPlane.userData.isUIPanel = true;
    }

    if (uiPanel.parent !== cameraGroup) {
      scene.remove(uiPanel);
      cameraGroup.add(uiPanel);
    }

    uiPanel.position.copy(moveToCamera());
    if (inVR) uiPanel.userData.update?.(panelState);
  }

  else if (panelState === 'hiding') {
    // ✨ CHANGE: Ensure panel is visible during the hiding animation
    uiPanel.visible = true;

    if (bgPlane) {
      bgPlane.material.opacity = 0.6;
      bgPlane.userData.isUIPanel = true;
    }

    if (uiPanel.parent !== scene) {
      cameraGroup.remove(uiPanel);
      scene.add(uiPanel);
    }

    const targetPos = moveToController();
    uiPanel.position.lerp(targetPos, PANEL_LERP_FACTOR);
    if (uiPanel.position.distanceTo(targetPos) < 0.01) {
      panelState = 'hidden';
    }

    uiPanel.userData.update?.();
  }

  else if (panelState === 'hidden') {

    uiPanel.visible = false;

    // console.warn("HIDDEN - Panel is now invisible");
  }

  else if (panelState === 'showing') {

    uiPanel.visible = true;

    if (bgPlane) {
      bgPlane.visible = false;
      bgPlane.userData.isUIPanel = false;
    }

    if (uiPanel.parent !== cameraGroup) {

      scene.remove(uiPanel);
      cameraGroup.add(uiPanel);
    }

    const targetPos = moveToCamera();
    uiPanel.position.lerp(targetPos, PANEL_LERP_FACTOR);
    if (uiPanel.position.distanceTo(targetPos) < 0.01) {
      panelState = 'shown';
    }

    if (inVR) uiPanel.userData.update?.(panelState);
  }

  return panelState;
}



console.log(`FilterUI panel system initialized at ${new Date().toLocaleTimeString()}`);

// --------------------Sake of Test--------------------
const DEBUG = true;

export function createCapsuleLabel(text, {
  selectedColor = "#3366ff",
  fontSize = 72,
  color = "#222244",
  hoverColor = "#444488",
  textColor = "#ffffff",
  opacity = 0.9,
  onClick = null,
  dotColor = null,
  dotRadius = 0,
  dotGap = 0,
} = {}) {

  const group = new THREE.Group();

  // ----------------------------
  // Canvas setup
  // ----------------------------

  const canvas = document.createElement("canvas");

  const ctx = canvas.getContext("2d");
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = "high";

  ctx.font = `bold ${fontSize}px Arial`;
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;

  const paddingX = 60;
  const paddingY = 40;

  const extraDotSpace = dotColor ? (dotRadius * 2 + dotGap) : 0;

  const width = textWidth + paddingX * 2 + extraDotSpace;
  const height = 120;

  canvas.width = width;
  canvas.height = height;

  // ----------------------------
  // Texture
  // ----------------------------
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  let labelText = text;
  function drawCapsule(bgColor) {


    ctx.globalAlpha = 1;

    ctx.clearRect(0, 0, width, height);

    const radius = height / 2;

    const cssColor = "#" + new THREE.Color(bgColor).getHexString();
    ctx.fillStyle = cssColor;
    ctx.globalAlpha = opacity;

    ctx.beginPath();
    ctx.moveTo(radius, 0);
    ctx.lineTo(width - radius, 0);
    ctx.quadraticCurveTo(width, 0, width, radius);
    ctx.lineTo(width, height - radius);
    ctx.quadraticCurveTo(width, height, width - radius, height);
    ctx.lineTo(radius, height);
    ctx.quadraticCurveTo(0, height, 0, height - radius);
    ctx.lineTo(0, radius);
    ctx.quadraticCurveTo(0, 0, radius, 0);
    ctx.closePath();

    ctx.fill();

    // ----------------------------
    // Text
    // ----------------------------
    ctx.globalAlpha = 1;
    ctx.fillStyle = textColor;

    ctx.font = `bold ${fontSize}px Arial`;   // fixed pixel size
    const metrics = ctx.measureText(labelText);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    // =======================================
    // DOT (ONLY if provided)
    // =======================================
    let textX = width / 2;

    if (dotColor) {
      const cssDot = "#" + new THREE.Color(dotColor).getHexString();

      const dotX = paddingX; // left side
      const dotY = height / 2;

      ctx.beginPath();
      ctx.fillStyle = cssDot;
      ctx.arc(dotX, dotY, dotRadius, 0, Math.PI * 2);
      ctx.fill();

      // shift text right
      textX = width / 2 + dotRadius + dotGap;
    }

    // =======================================
    // TEXT
    // =======================================
    ctx.fillStyle = textColor;
    ctx.font = `bold ${fontSize}px Arial`;
    ctx.textAlign = "left";
    ctx.fillText(labelText, paddingX + dotRadius * 2 + dotGap, height / 2);

    texture.needsUpdate = true;

    group.userData.setText = (newText) => {
      labelText = newText;

      ctx.clearRect(0, 0, width, height);
      drawCapsule(mesh.userData.defaultColor);
    };
  }

  drawCapsule(color);


  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    toneMapped: false
  });

  const aspect = canvas.width / canvas.height;

  const geometry = new THREE.PlaneGeometry(
    0.1 * aspect,
    0.14
  );

  const mesh = new THREE.Mesh(geometry, material);

  mesh.userData.defaultColor = color;
  mesh.userData.hoverColor = hoverColor;
  mesh.userData.selectedColor = selectedColor;
  mesh.userData.isSelected = false;
  mesh.userData.redraw = drawCapsule;

  group.add(mesh);

  // ----------------------------
  // Hitbox for interaction
  // ----------------------------
  const hitbox = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.14),
    new THREE.MeshBasicMaterial({ visible: false })
  );

  hitbox.name = "capsuleHitbox";
  hitbox.position.z = 0.01;

  hitbox.userData = {
    interactive: true,
    label: text,
    onClick,
    target: mesh,
    redraw: drawCapsule,
    texture
  };

  group.userData.hitbox = hitbox;

  group.add(hitbox);

  return group;
}

// Create the color dot for the groups
export function createColorDot(color, width = 80, height = 40) {

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;

  const ctx = canvas.getContext("2d");

  const radius = height / 2;

  const cssColor = "#" + new THREE.Color(color).getHexString();

  ctx.clearRect(0, 0, width, height);
  ctx.fillStyle = cssColor;

  ctx.beginPath();
  ctx.moveTo(radius, 0);
  ctx.lineTo(width - radius, 0);
  ctx.quadraticCurveTo(width, 0, width, radius);
  ctx.lineTo(width, height - radius);
  ctx.quadraticCurveTo(width, height, width - radius, height);
  ctx.lineTo(radius, height);
  ctx.quadraticCurveTo(0, height, 0, height - radius);
  ctx.lineTo(0, radius);
  ctx.quadraticCurveTo(0, 0, radius, 0);
  ctx.closePath();

  ctx.fill();

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    transparent: true,
    depthTest: false,
    toneMapped: false
  });

  const aspect = width / height;

  const geometry = new THREE.PlaneGeometry(
    0.06 * aspect,
    0.06
  );

  const mesh = new THREE.Mesh(geometry, material);

  return mesh;
}

function layoutVertical(container, startY, spacing) {

  let y = startY;

  container.children.forEach(child => {
    child.position.y = y;
    y -= spacing;
  });

}

export function createSelectionRing() {
  const geometry = new THREE.RingGeometry(1.2, 1.6, 32);

  const material = new THREE.MeshBasicMaterial({
    color: 0x00ffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.9
  });

  const ring = new THREE.Mesh(geometry, material);
  ring.userData.isRemoteRing = true;

  ring.scale.set(3, 3, 3)
  return ring;
}
