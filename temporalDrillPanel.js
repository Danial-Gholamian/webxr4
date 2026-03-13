//temporalDrillPanel.js
import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel.js';

// Configuration
const PANEL_WIDTH = 1.5;
const PANEL_HEIGHT = 2.2; // Taller to fit list
const ITEM_SPACING = 0.18; // Gap between buttons

export function createTemporalDrillPanel({
  cameraGroup,
  camera,
  navigator,
  graphController,
  onStateChange, // NEW
  getDeltaMin,   // NEW
  onDeltaChange  // NEW
}) {
  const panel = new THREE.Group();
  panel.name = 'TemporalDrillPanel';

  // Create a background to block the raycaster (so you don't click things behind the panel)
  const bgPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(PANEL_WIDTH, PANEL_HEIGHT),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.3, depthWrite: false })
  );
  bgPlane.renderOrder = 0
  bgPlane.userData = {
    interactive: true,
    isUIPanel: true,
    absorbsOnly: true // prevents hover effects
  };
  bgPlane.position.z = -0.02;
  bgPlane.userData.isPanelBackground = true;
  panel.add(bgPlane);

  cameraGroup.add(panel);
  panel.visible = false;

  // Track buttons to clean them up on re-render
  let interactables = [];

  function clearButtons() {
    interactables.forEach(btn => {
      panel.remove(btn);
      // specific cleanup if your capsule label has complex geometry
      btn.traverse(c => {
        if (c.geometry) c.geometry.dispose();
        if (c.material) c.material.dispose();
      });
    });
    interactables = [];
  }

  function render() {
    clearButtons();

    // 1. Get current Tree State
    const { current, parent, children } = navigator.getContext();
    const currentLabel = current ? formatBucketLabel(current) : "Root (All Time)";

    let yCursor = 0.8; // Start from top

    // --- A. HEADER (Current Selection) ---
    const header = createCapsuleLabel(`Selected: ${currentLabel}`, {
      width: 1.2,
      color: 0xffaa00, // Gold header
      hoverColor: 0xffaa00  
    });
    header.position.set(0, yCursor, 0);
    panel.add(header);
    interactables.push(header);
    yCursor -= 0.25;
    // --- NEW: DELTA MIN CONTROLS ---
    if (getDeltaMin) {
      const currentDelta = getDeltaMin();

      // Label showing current value
      const deltaLabel = createCapsuleLabel(`Resolution: ${currentDelta}`, {
        width: 0.8, color: 0x222222
      });
      deltaLabel.position.set(0, yCursor, 0);
      panel.add(deltaLabel);
      interactables.push(deltaLabel);

      // MINUS BUTTON
      const minusBtn = createCapsuleLabel("- 10", {
        width: 0.3, color: 0x882222, hoverColor: 0xaa4444,
        onClick: () => { if (onDeltaChange) onDeltaChange(-10); }
      });
      minusBtn.position.set(-0.5, yCursor, 0);
      minusBtn.userData.isInteractable = true;
      panel.add(minusBtn);
      interactables.push(minusBtn);

      // PLUS BUTTON
      const plusBtn = createCapsuleLabel("+ 10", {
        width: 0.3, color: 0x228822, hoverColor: 0x44aa44,
        onClick: () => { if (onDeltaChange) onDeltaChange(10); }
      });
      plusBtn.position.set(0.5, yCursor, 0);
      plusBtn.userData.isInteractable = true;
      panel.add(plusBtn);
      interactables.push(plusBtn);

      yCursor -= 0.25; // Move cursor down for the next buttons
    }
    // --- B. "GO UP" BUTTON (If parent exists) ---
    if (parent) {
      const upBtn = createCapsuleLabel(` Go Up to ${formatBucketLabel(parent)}`, {

        width: 1.0,
        color: 0x444444,
        hoverColor: 0x666666,
        onClick: () => {
          console.log("[UI] Go Up Clicked");
          navigator.goToParent();
          const newCurrent = navigator.getCurrentNode();
          graphController.highlightBucket(newCurrent); // Update Graph
          render(); // Re-render panel
        }
      });
      upBtn.position.set(0, yCursor, 0);
      // TAG FOR RAYCASTER
      upBtn.userData.isInteractable = true;

      panel.add(upBtn);
      interactables.push(upBtn);
      yCursor -= 0.2;
    }

    // --- C. CHILDREN LIST (Drill Down) ---
    if (children && children.length > 0) {
      // Label for list
      const subLabel = createCapsuleLabel("Drill Down:", { color: 0x000000, opacity: 0 });
      subLabel.position.set(-0.4, yCursor, 0);
      panel.add(subLabel);
      interactables.push(subLabel);
      yCursor -= 0.1;

      children.forEach(child => {
        const btn = createCapsuleLabel(formatBucketLabel(child), {

          width: 0.9,
          color: 0x222255, // Dark Blue
          hoverColor: 0x4444aa,
          onClick: () => {
            console.log("[UI] Child Clicked:", child.id);
            navigator.selectNode(child);
            graphController.highlightBucket(child); // Update Graph
            render(); // Re-render panel
          }
        });
        btn.position.set(0, yCursor, 0);
        // TAG FOR RAYCASTER
        btn.userData.isInteractable = true;

        panel.add(btn);
        interactables.push(btn);
        yCursor -= ITEM_SPACING;
      });
    } else {
      const leafMsg = createCapsuleLabel("(Lowest Level - No Children)", { color: 0x222222 });
      leafMsg.position.set(0, yCursor, 0);
      panel.add(leafMsg);
      interactables.push(leafMsg);
    }
  }

  function formatBucketLabel(node) {
    if (!node) return "All";
    // Use the data structure from your temporalHierarchy.js
    return `${Math.floor(node.start)} - ${Math.floor(node.end)}`;
  }

  // --- POSITIONING LOGIC (From previous step) ---
  function update() {
    if (!panel.visible) return;
    const headPos = camera.position;
    const headRot = camera.quaternion;
    const offset = new THREE.Vector3(0, -0.2, -1.8); // Adjust height/depth here
    offset.applyQuaternion(headRot);
    panel.position.copy(headPos).add(offset);
    panel.quaternion.copy(headRot);
  }

  function show() {
    panel.visible = true;
    render(); // Draw the UI for current state
    update();
  }

  function hide() {
    panel.visible = false;
  }

  function toggle() {
    if (panel.visible) hide();
    else show();
  }


  function setNavigator(newNav) {
    navigator = newNav;
    render(); // Redraw the UI with the new tree
  }


  // Expose the group and interactables for the Raycaster
  return {
    group: panel,
    show, hide, toggle, update, setNavigator, // Added setNavigator here
    // We can expose the list of buttons if we want to optimize raycasting
    getInteractables: () => interactables
  };
}