// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';
import { knownUsers } from './network.js';



const PANEL_SCALE = 0.3;       // 30% of view width
const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.12;      // 12cm between rows
const panelSize = new THREE.Vector3();
let periodTitle = null;

const PANEL_LERP_FACTOR = 0.2;



export function updatePeroidLabel(peroidname) {
    if (periodTitle) {
        periodTitle.text = `Time of the day: ${peroidname || 'Default'} 📚`;
        periodTitle.sync();
    }
}
export function createFilterPanel(options = { groupColors: [], camera: null }) {
    const uiPanel = new THREE.Group();
    uiPanel.name = "FilterUIPanel";
    

    const aspect = window.innerWidth / window.innerHeight;
    uiPanel.position.set(0, -0.3, -0.8);
    uiPanel.scale.set(PANEL_SCALE * aspect, PANEL_SCALE, 1);

    const userListGroup = new THREE.Group();
    userListGroup.position.set(0.2, 0.15, 0.01); // Right side of panel
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

    bgPlane.name = "uiPanelBackground";
    bgPlane.position.set(0, 0, 0);
    bgPlane.userData.isUIPanel = true;
    uiPanel.userData.bgPlane = bgPlane; // store reference for later
    uiPanel.add(bgPlane);


    // --- Title ---
    periodTitle = new Text();
    periodTitle.text = "Time of the day:  Default 📚";  // default state
    periodTitle.fontSize = FONT_SIZE;
    periodTitle.color = 0xFFFFFF;
    periodTitle.anchorX = 'center';
    periodTitle.position.set(0, 0.35, 0.01);
    periodTitle.sync();
    uiPanel.add(periodTitle);


    // --- Dynamic Group Labels ---

    options.groupColors
  .slice()
  .sort((a, b) => {
    const aStartsDigit = /^\d/.test(a.name);
    const bStartsDigit = /^\d/.test(b.name);

    if (aStartsDigit && !bStartsDigit) return -1;
    if (!aStartsDigit && bStartsDigit) return 1;
    return a.name.localeCompare(b.name, undefined, { numeric: true });
  })
  .forEach((group, index) => {

        const yPos = 0.2 - (index * ROW_SPACING);
        
        // Color indicator (dot)
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.02),
            new THREE.MeshBasicMaterial({ 
                color: group.color,
                depthTest: false
            })
        );
        dot.position.set(-0.4, yPos, 0.01);
        dot.renderOrder = 2;
        uiPanel.add(dot);

        // Group name
        const label = new Text();
        label.text = group.name;
        label.fontSize = FONT_SIZE;
        label.color = 0xFFFFFF;
        label.anchorX = 'left';
        label.anchorY = 'middle'; // Add this to vertically center text
        label.position.set(-0.35, yPos, 0.01); // Remove the -0.015 offset
        label.sync();
        // ── NEW: hit‐target plane for VR raycasts ───────────────────────────────
const LEFT_SECTION_WIDTH = 0.45; 
const RIGHT_SECTION_WIDTH = 0.35;
const CENTER_GAP = 0.05;
const DEBUG = false;

function makeHitbox(width, height, x, y, z, userData) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: DEBUG ? 0.3 : 0,
    color: DEBUG ? 0xff0000 : 0x000000,
    depthWrite: false
  });

  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, y, z);
  mesh.userData = { ...userData };
  return mesh;
}

// LEFT — group selector (dot + label)
const leftX = -0.3 + (LEFT_SECTION_WIDTH / 2);
const leftZ = 0.0051;
const leftHitBox = makeHitbox(
  LEFT_SECTION_WIDTH,
  ROW_SPACING,
  leftX,
  yPos,
  leftZ,
  {
    type: 'filter',
    periodName: group.name,
    periodIndex: index
  }
);
uiPanel.add(leftHitBox);

// RIGHT — extra action
const rightX = 0.1 + (RIGHT_SECTION_WIDTH / 2) + CENTER_GAP;
const rightZ = 0.0052;
const rightHitBox = makeHitbox(
  RIGHT_SECTION_WIDTH,
  ROW_SPACING,
  rightX,
  yPos,
  rightZ,
  {
    type: 'extra',
    periodName: group.name,
    periodIndex: index
  }
);
uiPanel.add(rightHitBox);

        // ── NEW: hit‐target plane for VR raycasts ───────────────────────────────

        uiPanel.add(label);
    });

    uiPanel.traverse(child => {
      if (child.material) {
      child.userData.originalColor = child.material.color.clone();
      }
    });


    // --- Always face camera ---
    uiPanel.rotateY(Math.PI); // Rotate 180° to face -Z direction
    uiPanel.userData.update = (panelState) => {
      if (options.camera) {
        uiPanel.quaternion.copy(options.camera.quaternion);
      }

      if (panelState === 'showing' || panelState === 'shown') {
        uiPanel.lookAt(options.camera.position);
      }
    };


      uiPanel.userData.refreshUsers = (selfId) => {
    // Clear previous labels
    while (userListGroup.children.length > 0) {
      userListGroup.remove(userListGroup.children[0]);
    }

    // Add updated labels
    const entries = Object.entries(knownUsers);
    entries.forEach(([id, name], index) => {
      const userLabel = new Text();
      userLabel.text = id === selfId ? `${name} (you)` : name;
      userLabel.fontSize = FONT_SIZE * 0.8;
      userLabel.color = 0xffffaa;
      userLabel.anchorX = 'left';
      userLabel.anchorY = 'middle';
      userLabel.position.set(0, -index * ROW_SPACING * 0.6, 0);
      userLabel.sync();
      userListGroup.add(userLabel);
    });

  };
    uiPanel.userData.boundingBox = new THREE.Box3();
    uiPanel.userData.boundingBox.setFromObject(uiPanel);
    return uiPanel;
}

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

  if (panelState === 'hidden') {
    if (bgPlane) {
      bgPlane.visible = true;
      bgPlane.material.opacity = 0.3;     // nearly invisible but still raycastable
      bgPlane.userData.isUIPanel = true;   // logic-level: not interactive
    }

    if (uiPanel.parent !== cameraGroup) {
      scene.remove(uiPanel);
      cameraGroup.add(uiPanel);
    }

    uiPanel.position.copy(moveToCamera());
    if (inVR) uiPanel.userData.update?.(panelState);
  }

  else if (panelState === 'showing') {
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
      panelState = 'shown';
    }

    uiPanel.lookAt(camera.position);
    if (inVR) uiPanel.userData.update?.(panelState);
  }

  else if (panelState === 'shown') {
    if (bgPlane) {
      bgPlane.material.opacity = 0.6;         // Keep visible
      bgPlane.userData.isUIPanel = true;
    }

    uiPanel.position.copy(moveToController());
    uiPanel.lookAt(camera.position);
    if (inVR) uiPanel.userData.update?.(panelState);
  }

  else if (panelState === 'hiding') {
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
      panelState = 'hidden';
    }

    if (inVR) uiPanel.userData.update?.(panelState);
  }

  return panelState;
}


console.log(`FilterUI panel system initialized at ${new Date().toLocaleTimeString()}`);