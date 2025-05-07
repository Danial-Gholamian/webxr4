// filterUIPanel.js
import * as THREE from 'three';
import { Text } from 'troika-three-text';

// --- Constants ---
const PANEL_SCALE = 0.3;       // 30% of view width
const PANEL_MARGIN = 0.1;      // 10% margin from bottom
const FONT_SIZE = 0.05;        // 5cm in VR units
const ROW_SPACING = 0.12;      // 12cm between rows

export function createFilterPanel(options = { groupColors: [], camera: null }) {
    const uiPanel = new THREE.Group();
    uiPanel.name = "FilterUIPanel";
    
    // --- Screen-Aligned Positioning ---
    const aspect = window.innerWidth / window.innerHeight;
    uiPanel.position.set(0, -0.3, -0.8);
    uiPanel.scale.set(PANEL_SCALE * aspect, PANEL_SCALE, 1);

    // --- Background (Fix depth issues) ---
    const bgGeometry = new THREE.PlaneGeometry(1.5, 0.8);
    const bgMaterial = new THREE.MeshBasicMaterial({
        color: 0x222222,
        transparent: true,
        opacity: 0.9,
        depthTest: false,  // Add this
        depthWrite: false, // Add this
        side: THREE.DoubleSide
    });
    const background = new THREE.Mesh(bgGeometry, bgMaterial);
    background.renderOrder = 1;  // Ensure it draws on top
    uiPanel.add(background);

    // --- Title ---
    const title = new Text();
    title.text = "Group Legend";
    title.fontSize = FONT_SIZE;
    title.color = 0xFFFFFF;
    title.anchorX = 'center';
    title.position.set(0, 0.35, 0.01);
    title.sync();
    uiPanel.add(title);

    // --- Dynamic Group Labels ---
    options.groupColors.forEach((group, index) => {
        const yPos = 0.2 - (index * ROW_SPACING);
        
        // Color indicator
        const dot = new THREE.Mesh(
            new THREE.SphereGeometry(0.02),
            new THREE.MeshBasicMaterial({ 
                color: group.color,
                depthTest: false  // Add this
            })
        );
        dot.position.set(-0.4, yPos, 0.01);
        dot.renderOrder = 2;  // Higher than background
        uiPanel.add(dot);

        // Group name
        const label = new Text();
        label.text = group.name;
        label.fontSize = FONT_SIZE;
        label.color = 0xFFFFFF;
        label.anchorX = 'left';
        label.position.set(-0.35, yPos - 0.015, 0.01);
        label.sync();
        uiPanel.add(label);
    });

    // --- Always face camera ---
    uiPanel.userData.update = () => {
        if (options.camera) {
            uiPanel.quaternion.copy(options.camera.quaternion);
        }
    };

    return uiPanel;
}

console.log(`FilterUI panel system initialized at ${new Date().toLocaleTimeString()}`);