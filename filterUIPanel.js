// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text'; // Import the Text class

// --- Configuration ---
const panelWidth = 0.3;  // Width of the panel in meters
const panelHeight = 0.4; // Height of the panel
const panelPadding = 0.02; // Padding inside the panel
const textColor = 0xFFFFFF;
const backgroundColor = 0x222222;
const backgroundOpacity = 0.85;
const elementSpacing = 0.05; // Vertical spacing between UI elements

/**
 * Creates the filter UI panel group.
 * @param {object} options - Configuration options (e.g., { availableGroups: ['A', 'B'] })
 * @returns {THREE.Group} The created UI panel group, initially hidden.
 */
export function createFilterPanel(options = {}) {

    const uiPanelGroup = new THREE.Group();
    uiPanelGroup.name = "FilterUIPanel"; // Helpful for debugging
    uiPanelGroup.visible = false; // Start hidden

    // --- Positioning relative to the controller (Needs Tweaking!) ---
    // Example: Slightly above and forward, tilted back
    uiPanelGroup.position.set(0, 0.15, -0.1);
    uiPanelGroup.rotation.x = -Math.PI / 5; // Approx 36 degrees back


    // --- Panel Background ---
    const panelGeometry = new THREE.PlaneGeometry(panelWidth, panelHeight);
    const panelMaterial = new THREE.MeshBasicMaterial({
        color: backgroundColor,
        opacity: backgroundOpacity,
        transparent: true,
        side: THREE.DoubleSide
    });
    const panelBackground = new THREE.Mesh(panelGeometry, panelMaterial);
    panelBackground.name = "uiPanelBackground";
    // Background is at the group's local 0,0,0
    uiPanelGroup.add(panelBackground);


    // --- UI Elements (To be added) ---
    let currentY = panelHeight / 2 - panelPadding; // Start position for elements (top)

    // --- Title ---
    const titleText = new Text();
    titleText.text = "Filters";
    titleText.fontSize = 0.025;
    titleText.color = textColor;
    titleText.anchorX = 'center';
    titleText.anchorY = 'top';
    // Position slightly in front of background (Z=0.001) to avoid z-fighting
    titleText.position.set(0, currentY, 0.001);
    titleText.sync(); // Important for Troika Text
    uiPanelGroup.add(titleText);

    currentY -= elementSpacing; // Move down for next element


    // --- Placeholder for Group Filters ---
    console.log("Placeholder: Add Group Filter checkboxes here.");
    // Example: You would loop through options.availableGroups
    // and create Text labels and interactive Checkbox Meshes here,
    // adjusting 'currentY' for each one.


    // --- Placeholder for other filters ---
    currentY -= elementSpacing * 2; // Add more space
    const otherFilterText = new Text();
    otherFilterText.text = "Other Filters (TBD)";
    otherFilterText.fontSize = 0.02;
    otherFilterText.color = 0xAAAAAA;
    otherFilterText.anchorX = 'center';
    otherFilterText.anchorY = 'top';
    otherFilterText.position.set(0, currentY, 0.001);
    otherFilterText.sync();
    uiPanelGroup.add(otherFilterText);


    // --- Return the main group ---
    // The calling code will add this to the controller
    return uiPanelGroup;
}

// Optional: Helper function example (can be defined here or imported)
function createCheckbox(/*...*/) {
    // ... implementation ...
}

console.log(`filterUIPanel.js loaded (Current time: ${new Date().toLocaleString('sv-SE', { timeZone: 'Europe/Stockholm' })}).`);