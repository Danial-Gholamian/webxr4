// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { knownUsers } from './network.js';
import {highlightGroup} from './main.js'
import { broadcastGroupSelection } from './network.js';
import { switchToSchoolDataset, switchToHospitalDataset } from './main.js';



const PANEL_SCALE = 0.3;       // 30% of view width
const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.17;      // a12cm between rows
const panelSize = new THREE.Vector3();
let periodTitle = null;
let selectedNodeLabel = null;

const PANEL_LERP_FACTOR = 0.2;



export function updatePeroidLabel(peroidname) {
  if (periodTitle) {
    periodTitle.text = `Time of the day: ${peroidname || 'Default'} 📚`;
    periodTitle.sync();
  }
}
export function createFilterPanel(options = { groupColors: [], camera: null }) {
  const uiPanel = new THREE.Group();
  uiPanel.name = 'FilterUIPanel';

  const aspect = window.innerWidth / window.innerHeight;
  uiPanel.position.set(0, -0.3, -0.8);
  uiPanel.scale.set(PANEL_SCALE * aspect, PANEL_SCALE, 1);

  const userListGroup = new THREE.Group();
  userListGroup.position.set(0.4, 0.1, 0.01);
  uiPanel.add(userListGroup);

  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(1.2, 1.8),
    new THREE.MeshBasicMaterial({
      color: 0x000000,
      transparent: true,
      opacity: 0.6,
      depthWrite: false
    })
  );
    bgPlane.name = 'uiPanelBackground';
    bgPlane.userData = {
    interactive: true,
    isUIPanel: true,
    absorbsOnly: true // prevents hover effects
  };

  uiPanel.userData.bgPlane = bgPlane;
  uiPanel.add(bgPlane);

  periodTitle = new Text();
  periodTitle.text = 'Time of the day: Default 📚';
  periodTitle.fontSize = FONT_SIZE;
  periodTitle.color = 0xffffff;
  periodTitle.anchorX = 'center';
  periodTitle.position.set(0, 0.35, 0.01);
  periodTitle.sync();
  
  
  selectedNodeLabel = new Text();
  selectedNodeLabel.text = 'Selected node: None';
  selectedNodeLabel.fontSize = FONT_SIZE * 0.9;
  selectedNodeLabel.color = 0xffffff;
  selectedNodeLabel.anchorX = 'center';
  selectedNodeLabel.position.set(0, 0.28, 0.01); // just below periodTitle
  selectedNodeLabel.sync();
  
  uiPanel.add(periodTitle);
  uiPanel.add(selectedNodeLabel);

// =========================
// Dataset Selection Buttons
// =========================

const datasetY = 0.47; // slightly above the periodTitle

// SCHOOL button
const schoolCapsule = createCapsuleLabel("School", {
  fontSize: 0.04,
  color: 0x004488,
  hoverColor: 0x0066aa,
  padding: 0.025,
  onClick: () => switchToSchoolDataset()

});
schoolCapsule.position.set(-0.25, datasetY, 0.01);
uiPanel.add(schoolCapsule);

// HOSPITAL button
const hospitalCapsule = createCapsuleLabel("Hospital", {
  fontSize: 0.04,
  color: 0x884400,
  hoverColor: 0xaa6600,
  padding: 0.025,
  onClick: () => switchToHospitalDataset()
});
hospitalCapsule.position.set(0.25, datasetY, 0.01);
uiPanel.add(hospitalCapsule);

  uiPanel.userData.updateSelectedNodeLabel = (nodeId) => {
  selectedNodeLabel.text = `Selected node: ${nodeId ?? 'None'}`;
  selectedNodeLabel.sync();
  };

// ==============================
// Refresh group capsules on load
// ==============================
const groupListGroup = new THREE.Group();
groupListGroup.position.set(0, 0, 0.02);
uiPanel.add(groupListGroup);
uiPanel.userData.groupListGroup = groupListGroup;

uiPanel.userData.updateGroupList = (groups) => {

  // remove old capsules
  while (groupListGroup.children.length > 0) {
    groupListGroup.remove(groupListGroup.children[0]);
  }

  groups
    .slice()
    .sort((a, b) => {
      const aDigit = /^\d/.test(a.name);
      const bDigit = /^\d/.test(b.name);
      if (aDigit && !bDigit) return -1;
      if (!aDigit && bDigit) return 1;
      return a.name.localeCompare(b.name, undefined, { numeric: true });
    })
    .forEach((group, index) => {
      const yPos = 0.1 - index * ROW_SPACING;

      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.02),
        new THREE.MeshBasicMaterial({ color: group.color, depthTest: false })
      );
      dot.position.set(-0.4, yPos, 0.01);
      dot.renderOrder = 2;
      groupListGroup.add(dot);

      const capsule = createCapsuleLabel(group.name, {
        fontSize: 0.045,
        color: 0x222244,
        hoverColor: 0x444488,
        padding: 0.03,
        onClick: () => {
          highlightGroup(group.name);
          broadcastGroupSelection(group.name);
        }
      });

      capsule.position.set(-0.05, yPos, 0.01);
      groupListGroup.add(capsule);
    });
};


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
        fontSize: 0.038,
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

  uiPanel.userData.updatePeriods = (periods) => {
  console.log("Periods updated from dataset:", periods);
  // OPTIONAL: later add period capsules here
};

  return uiPanel;
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
  fontSize = 0.045,
  color = 0x222244,
  hoverColor = 0x444488,
  textColor = 0xffffff,
  padding = 0.03,
  opacity = 0.9,
  onClick = null
} = {}) {
  const group = new THREE.Group();

  const label = new Text();
  label.text = text;
  label.fontSize = fontSize;
  label.color = textColor;
  label.anchorX = 'center';
  label.anchorY = 'middle';
  label.position.set(0, 0, 0.01);
  group.add(label);

  label.sync(() => {
    const info = label.textRenderInfo;
    const textWidth = info?.width ?? 0.3;
    const textHeight = info?.height ?? 0.1;

    const width = textWidth + padding * 2;
    const height = textHeight + padding * 2;
    const radius = Math.min(height / 2, 0.1);

    const shape = new THREE.Shape();
    shape.moveTo(-width / 2 + radius, -height / 2);
    shape.lineTo(width / 2 - radius, -height / 2);
    shape.quadraticCurveTo(width / 2, -height / 2, width / 2, -height / 2 + radius);
    shape.lineTo(width / 2, height / 2 - radius);
    shape.quadraticCurveTo(width / 2, height / 2, width / 2 - radius, height / 2);
    shape.lineTo(-width / 2 + radius, height / 2);
    shape.quadraticCurveTo(-width / 2, height / 2, -width / 2, height / 2 - radius);
    shape.lineTo(-width / 2, -height / 2 + radius);
    shape.quadraticCurveTo(-width / 2, -height / 2, -width / 2 + radius, -height / 2);

    const geometry = new THREE.ShapeGeometry(shape);
    const bgMaterial = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false
    });

    const bg = new THREE.Mesh(geometry, bgMaterial);
    bg.position.z = 0;
    bg.userData.defaultColor = new THREE.Color(color);
    bg.userData.hoverColor = new THREE.Color(hoverColor);
    bg.userData.selectedColor = new THREE.Color(0x3366ff);
    bg.userData.isSelected = false;                        

    group.add(bg);

// filterUIPanel.js --> createCapsuleLabel()

    const hitbox = new THREE.Mesh(
      new THREE.PlaneGeometry(width, height),
      // Fix: visible: false makes it invisible to the camera, but not the raycaster
      new THREE.MeshBasicMaterial({ visible: false }) 
    );
    hitbox.position.z = 0.02;
    hitbox.name = 'capsuleHitbox';
    hitbox.userData = {
      interactive: true,
      label: text,
      onClick,
      target: bg
    };

    group.userData.hitbox = hitbox;
    group.add(hitbox);
  });

  return group;
}


//This is today
