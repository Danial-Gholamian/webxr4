// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { broadcastDatasetChange, knownUsers } from './network.js';
import { buildGroupColorList, highlightGroup, switchDataset } from './main.js'
import { broadcastGroupSelection } from './network.js';
import { getGraphController } from './main.js';


const PANEL_SCALE = 0.3;       // 30% of view width
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
  let cursorY = 0.75;   // top of panel (local space)
  const SECTION_GAP = 0.12;
  const uiPanel = new THREE.Group();
  uiPanel.name = 'FilterUIPanel';

  const aspect = window.innerWidth / window.innerHeight;
  uiPanel.position.set(0, -0.3, -0.8);
  uiPanel.scale.set(PANEL_SCALE, PANEL_SCALE, 1);

  const userListGroup = new THREE.Group();
  userListGroup.position.set(0.4, 0.1, 0.01);
  uiPanel.add(userListGroup);

  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.8),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.6,
      depthWrite: false,
      depthTest: true
    })
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

  // OLD SECTION FOR CHANGING DATASETS

  // const datasetTitle = new Text();
  // datasetTitle.text = 'Dataset';
  // datasetTitle.fontSize = TITLE_SIZE * 0.85;
  // datasetTitle.color = 0xffffff;
  // datasetTitle.anchorX = 'center';
  // datasetTitle.position.set(0, cursorY, 0.01);
  // datasetTitle.sync();
  // datasetTitle.renderOrder = 10; // <--- Higher than the background (0)
    
  // datasetTitle.material.depthWrite = false;

  // uiPanel.add(datasetTitle);

  // // move cursor down
  // // cursorY -= SECTION_GAP;
  // cursorY -= SECTION_GAP * 1.2;


  // let datasetStartY = 0.12;

  // options.datasets.forEach((ds, index) => {
  //   const capsule = createCapsuleLabel(ds.id, {
  //     fontSize: ITEM_SIZE,
  //     color: 0x2a2a3d,
  //     hoverColor: 0x444488,
  //     padding: 0.03,
  //     onClick: () => {
  //       console.log(`Dataset selected: ${ds.id}`);
  //       // local switch data set
  //       switchDataset(ds.key);

  //       // broadcast it across :) 
  //       broadcastDatasetChange(ds.key)
  //     }
  //   });

  //   capsule.position.set(0, cursorY, 0.01);
  //   uiPanel.add(capsule);

  //   cursorY -= ROW_SPACING * 0.8;
  // });

  // cursorY -= SECTION_GAP * 0.5;


  // periodTitle = new Text();
  // periodTitle.text = 'Time of the day: Default 📚';
  // periodTitle.fontSize = TITLE_SIZE;
  // periodTitle.color = 0xffffff;
  // periodTitle.anchorX = 'center';
  // // periodTitle.position.set(0, 0.35, 0.01);
  // periodTitle.position.set(0, cursorY, 0.01);
  // periodTitle.renderOrder = 10; // <--- Higher than the background (0)
    
  // periodTitle.material.depthWrite = false;
  // cursorY -= SECTION_GAP * 0.7;
  // periodTitle.sync();



  selectedNodeLabel = new Text();
  selectedNodeLabel.text = 'Selected node: None';
  // selectedNodeLabel.fontSize = FONT_SIZE * 0.9;
  selectedNodeLabel.fontSize = ITEM_SIZE;
  selectedNodeLabel.color = 0xffffff;
  selectedNodeLabel.anchorX = 'center';
  // selectedNodeLabel.position.set(0, 0.28, 0.01); // just below periodTitle
  selectedNodeLabel.position.set(0, cursorY, 0.01);
  selectedNodeLabel.renderOrder = 10; // <--- Higher than the background (0)
    
  selectedNodeLabel.material.depthWrite = false;
  cursorY -= SECTION_GAP;
  selectedNodeLabel.sync();

  // uiPanel.add(periodTitle);
  uiPanel.add(selectedNodeLabel);

  uiPanel.userData.updateSelectedNodeLabel = (nodeId) => {
    selectedNodeLabel.text = `Selected node: ${nodeId ?? 'None'}`;
    selectedNodeLabel.sync();
  };

  const nodeGroupList = new THREE.Group()
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

  uiPanel.userData.refreshUsers = (selfId) => {
    while (userListGroup.children.length > 0) userListGroup.remove(userListGroup.children[0]);

    Object.entries(knownUsers).forEach(([id, name], index) => {
      const label = id === selfId ? `${name} (you)` : name;

      const capsule = createCapsuleLabel(label, {
        // fontSize: 0.038,
        color: 0x333333,
        hoverColor: 0x555577,
        padding: 0.025,
        onClick: () => console.log(`Clicked ${label}`)
      });


      const yPos = 0.1 - index * ROW_SPACING * 0.85;
      capsule.position.set(0, yPos, 0);
      userListGroup.add(capsule);
    });
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

  // 2️ Sort groups (same logic you already had)
  const sortedGroups = groupColors
    .slice()
    .sort((a, b) => {
      const aStartsDigit = /^\d/.test(a.name);
      const bStartsDigit = /^\d/.test(b.name);
      if (aStartsDigit && !bStartsDigit) return -1;
      if (!aStartsDigit && bStartsDigit) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    });

  // 3️ Rebuild UI
  let y = uiPanel.userData.nodeGroupListCursorY;

  sortedGroups.forEach(group => {
    const dot = new THREE.Mesh(
      new THREE.SphereGeometry(0.02),
      new THREE.MeshBasicMaterial({
        color: group.color,
        depthTest: false,
        depthWrite: false
      })
    );
    dot.material.depthTest = false;
    dot.material.depthWrite = false;
    dot.renderOrder = 1000;

    dot.position.set(-0.4, y, 0.01);
    nodeGroupList.add(dot);

    const capsule = createCapsuleLabel(group.name, {
      color: 0x222244,
      hoverColor: 0x444488,
      padding: 0.03,
      onClick: () => {
        highlightGroup(group.name);
        broadcastGroupSelection(group.name);
      }
    });

    capsule.position.set(-0.05, y, 0.01);
    nodeGroupList.add(capsule);


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
  fontSize = 72,
  color = "#222244",
  hoverColor = "#444488",
  textColor = "#ffffff",
  opacity = 0.9,
  onClick = null
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

  const width = textWidth + paddingX * 2;
  const height = 120;

  canvas.width = width;
  canvas.height = height;

  // ----------------------------
  // Texture
  // ----------------------------
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;

  function drawCapsule(bgColor) {
    console.log("REDRAW CAPSULE COLOR:", bgColor)

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
    const metrics = ctx.measureText(text);
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";

    ctx.fillText(text, width / 2, height / 2);

    texture.needsUpdate = true;
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
  mesh.userData.selectedColor = "#3366ff";
  mesh.userData.isSelected = false;

  group.add(mesh);

  // ----------------------------
  // Hitbox for interaction
  // ----------------------------
  const hitbox = new THREE.Mesh(
    new THREE.PlaneGeometry(0.35, 0.14),
    new THREE.MeshBasicMaterial({ visible: false })
  );

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

// export function createCapsuleLabel(text, {
//   // fontSize = 0.045,
//   fontSize = ITEM_SIZE,
//   color = 0x222244,
//   hoverColor = 0x444488,
//   textColor = 0xffffff,
//   padding = 0.03,
//   opacity = 0.9,
//   onClick = null
// } = {}) {
//   const group = new THREE.Group();

//   const label = new Text();
//   label.text = text;
//   label.fontSize = fontSize;
//   label.color = textColor;
//   label.anchorX = 'center';
//   label.anchorY = 'middle';
//   label.position.set(0, 0, 0.01);
//   label.renderOrder = 10; // <--- Higher than the background (0)
    
//   label.material.depthWrite = false;
//   group.add(label);

//   label.sync(() => {
//     const info = label.textRenderInfo;
//     const textWidth = info?.width ?? 0.3;
//     const textHeight = info?.height ?? 0.1;

//     const width = textWidth + padding * 2;
//     const height = textHeight + padding * 2;
//     const radius = Math.min(height / 2, 0.1);

//     const shape = new THREE.Shape();
//     shape.moveTo(-width / 2 + radius, -height / 2);
//     shape.lineTo(width / 2 - radius, -height / 2);
//     shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
//     shape.lineTo(width / 2, height / 2 - radius);
//     shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
//     shape.lineTo(-width / 2 + radius, height / 2);
//     shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
//     shape.lineTo(-width / 2, -height / 2 + radius);
//     shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

//     const geometry = new THREE.ShapeGeometry(shape);
//     const bgMaterial = new THREE.MeshBasicMaterial({
//       color,
//       transparent: true,
//       opacity,
//       depthWrite: false,
//       depthTest: false
//     });

//     const bg = new THREE.Mesh(geometry, bgMaterial);
//     bg.position.z = 0;
//     bg.userData.defaultColor = new THREE.Color(color);
//     bg.userData.hoverColor = new THREE.Color(hoverColor);
//     bg.userData.selectedColor = new THREE.Color(0x3366ff);
//     bg.userData.isSelected = false;

//     // bg.renderOrder = 0

//     group.add(bg);

//     // filterUIPanel.js --> createCapsuleLabel()

//     const hitbox = new THREE.Mesh(
//       new THREE.PlaneGeometry(width, height),
//       // Fix: visible: false makes it invisible to the camera, but not the raycaster
//       new THREE.MeshBasicMaterial({ visible: false })
//     );
//     hitbox.position.z = 0.02;
//     hitbox.name = 'capsuleHitbox';
//     hitbox.userData = {
//       interactive: true,
//       label: text,
//       onClick,
//       target: bg
//     };

//     group.userData.hitbox = hitbox;
//     group.add(hitbox);
//   });

//   return group;
// }


// //This is today
