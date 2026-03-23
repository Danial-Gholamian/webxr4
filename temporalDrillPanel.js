// temporalDrillPanel.js
import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel.js';

// Configuration
const PANEL_WIDTH = 1.5;
const PANEL_HEIGHT = 1.6; // Shorter since we don't have a long list of children anymore

export function createTemporalDrillPanel({
  cameraGroup,
  camera,
  timelineManager, // We pass our new manager here
  graphController
}) {
  const panel = new THREE.Group();
  panel.name = 'TemporalDrillPanel';

  // Create a background to block the raycaster
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  bgPlane.renderOrder = 0;
  bgPlane.userData = {
    interactive: true,
    isUIPanel: true,
    absorbsOnly: true
  };
  bgPlane.position.z = -0.02;
  bgPlane.userData.isPanelBackground = true;
  panel.add(bgPlane);

  cameraGroup.add(panel);
  panel.visible = false;

  let interactables = [];

  function clearButtons() {
    interactables.forEach(btn => {
      panel.remove(btn);
      btn.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    });
    interactables = [];
  }

  function render() {
    clearButtons();

    let yCursor = 0.5;

    // 1. HEADER
    const bucket = timelineManager.getCurrentBucket();
    const headerStr = `Time: ${Math.floor(bucket.start)} to ${Math.floor(bucket.end)}`;
    
    const header = createCapsuleLabel(headerStr, {
      width: 1.2,
      color: 0xffaa00,
      hoverColor: 0xffaa00  
    });
    header.position.set(0, yCursor, 0);
    panel.add(header);
    interactables.push(header);
    
    yCursor -= 0.3;

    // 2. WINDOW SIZE CONTROLS
    const sizeLabel = createCapsuleLabel(`Window Size: ${timelineManager.windowSize}`, {
      width: 0.8, color: 0x222222
    });
    sizeLabel.position.set(0, yCursor, 0);
    panel.add(sizeLabel);
    interactables.push(sizeLabel);

    yCursor -= 0.25;

    // [-] MINUS BUTTON
    const minusBtn = createCapsuleLabel("- 1", {
      width: 0.3, color: 0x882222, hoverColor: 0xaa4444,
      onClick: () => { 
        timelineManager.setWindowSize(timelineManager.windowSize - 1);
        updateGraph(); 
      }
    });
    minusBtn.position.set(-0.35, yCursor, 0);
    minusBtn.userData.isInteractable = true;
    panel.add(minusBtn);
    interactables.push(minusBtn);

    // [+] PLUS BUTTON
    const plusBtn = createCapsuleLabel("+ 1", {
      width: 0.3, color: 0x228822, hoverColor: 0x44aa44,
      onClick: () => { 
        timelineManager.setWindowSize(timelineManager.windowSize + 1);
        updateGraph();
      }
    });
    plusBtn.position.set(0.35, yCursor, 0);
    plusBtn.userData.isInteractable = true;
    panel.add(plusBtn);
    interactables.push(plusBtn);

    // Helper to update everything when a button is clicked
    function updateGraph() {
      const newBucket = timelineManager.getCurrentBucket();
      graphController.bucketActiveNodes.clear(); // Clear cache!
      graphController.highlightBucket(newBucket);
      render(); // Re-render this UI to show the new window size number
    }
  }

  // --- POSITIONING LOGIC ---
  function update() {
    if (!panel.visible) return;
    const headPos = camera.position;
    const headRot = camera.quaternion;
    const offset = new THREE.Vector3(0, -0.2, -1.8); 
    offset.applyQuaternion(headRot);
    panel.position.copy(headPos).add(offset);
    panel.quaternion.copy(headRot);
  }

  function show() {
    panel.visible = true;
    render(); 
    update();
  }

  function hide() {
    panel.visible = false;
  }

  function toggle() {
    if (panel.visible) hide();
    else show();
  }

  return {
    group: panel,
    show, hide, toggle, update,
    getInteractables: () => interactables
  };
}