// insightPanel.js
import * as THREE from 'three';
import { createCapsuleLabel, createColorDot } from './filterUIPanel';

const FONT_SIZE = 66
const SUB_HEADING_FONT_SIZE = 70

const HEADER_SPACING = 0.09
const ROW_SPACING = 0.075
const SECTION_GAP = 0.08

export class InsightPanel {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = "InsightLegendPanel";
        // this.groupDots = new THREE.Group(); // Separate group for dots
        // this.group.add(this.groupDots);

        // 1. Opaque Background for high contrast
        const bg = new THREE.Mesh(
            new THREE.PlaneGeometry(1.6, 1.0),
            new THREE.MeshBasicMaterial({
                color: 0x0a0f1a, // Darker navy for better contrast
                transparent: true,
                opacity: 0.98,   // Almost fully opaque to block background "noise"
                depthWrite: false,
                depthTest: false
            })
        );
        this.group.add(bg);

        bg.name = "uiPanelBackground";
        bg.userData = {
            absorbsOnly: true,
            isUIPanel: true,
            noHaptics: true
        };

        // 2. White Border for definition
        const edges = new THREE.EdgesGeometry(bg.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
        this.group.add(line);

        // 3. Title (Bright & Bold)
        this.title = this._createText("LIVE INSIGHTS", 80, 0.4, 0x00ff00);
        this.title.fontWeight = 'bold';
        this.group.add(this.title)

        // 4. Columns
        this.leftTextGroup = new THREE.Group();
        this.leftTextGroup.position.x = 0;

        this.rightTextGroup = new THREE.Group();
        this.rightTextGroup.position.x = 0.1;

        this.group.add(this.leftTextGroup);
        this.group.add(this.rightTextGroup);

        // Position above the Histogram
        this.group.position.set(2.8, 1.9, -3.3);
        this.group.rotation.y = -Math.PI / 2.95;
        this.group.scale.set(1.3, 1.3, 1.3);
        this.modeGroup = new THREE.Group();
        this.group.add(this.modeGroup);
    }

    _createText(text, size = FONT_SIZE, y, color) {
        const label = createCapsuleLabel(text, {
            fontSize: size,
            color: color,
            hoverColor: 0x000000,
            textColor: color,
            opacity: 0
        });

        label.position.set(0, y, 0.01);

        label.traverse(obj => {
            if (obj.material) {
                obj.material.depthTest = false;
                obj.material.depthWrite = false;
                obj.userData.absorbsOnly = true; 
                obj.userData.noHaptics = true;
            }
        });

        label.renderOrder = 10;

        return label;

    }

    update(stats, colorScale, nodeSelected, edgeMode = 'ALL') {

        if (!stats) return;
        this.leftTextGroup.clear();
        this.rightTextGroup.clear();
        this.modeGroup.clear();

        // 1. Clear existing dots
        // this.rowGroup.clear();
        this.rightTextGroup.position.x = 0.1;
        this.leftTextGroup.visible = true; // Make sure left is visible

        // 2. Generate Node Text (Left)

        let y = 0.25;

        // --- HIGH DEGREE SECTION ---
        const header = this._createText("HIGH DEGREE NODES", SUB_HEADING_FONT_SIZE, y, 0xffffff);
        header.position.x = -0.4;
        this.leftTextGroup.add(header);
        y -= HEADER_SPACING;

        stats.topHubs.forEach((h, i) => {
            const groupColor = h.group !== 'N/A' ? colorScale(h.group) : 0xffffff;
            const row = this._createText(`${i + 1}. ID ${h.id} [${h.group || 'N/A'}] (${h.count})`, FONT_SIZE, y, groupColor);
            row.position.x = -0.4;
            y -= ROW_SPACING;
            this.leftTextGroup.add(row);
        });

        // --- SPACE BETWEEN SECTIONS ---
        y -= SECTION_GAP;

        // --- LOW DEGREE SECTION ---
        const quietHeader = this._createText("LOW DEGREE NODES", SUB_HEADING_FONT_SIZE, y, 0xffffff);
        quietHeader.position.x = -0.4;
        this.leftTextGroup.add(quietHeader);
        y -= HEADER_SPACING;

        stats.bottomNodes.forEach((n, i) => {
            const groupColor = n.group !== 'N/A' ? colorScale(n.group) : 0xffffff;
            const row = this._createText(`${i + 1}. ID ${n.id} [${n.group || 'N/A'}] (${n.count})`, FONT_SIZE, y, groupColor);
            row.position.x = -0.4;
            y -= ROW_SPACING;
            this.leftTextGroup.add(row);
        });


        // 2. Generate Node Text (Right)
        let yRight = 0.25;

        const groupHeader = this._createText("MOST ACTIVE GROUPS", SUB_HEADING_FONT_SIZE, yRight, 0xffffff);
        groupHeader.position.x = 0.3;
        this.rightTextGroup.add(groupHeader)

        yRight -= HEADER_SPACING;

        // GROUP OBJECT TO HOLD COLOR DOTS AND CORRESPONDING GROUPS
        const rowGroup = new THREE.Group();

        stats.topGroups.forEach((g, i) => {

            // TEXT
            const row = this._createText(`${g.name} (${g.count})`, FONT_SIZE, yRight, 0xffffff);
            row.position.x = 0.20; // relative to rowGroup
            rowGroup.add(row);

            // DOT
            const dotColor = colorScale ? colorScale(g.name) : 0xffffff;
            const dot = createColorDot(dotColor, 20);

            dot.position.set(0, yRight, 0.02); // relative to rowGroup

            dot.material.depthTest = false;
            dot.material.depthWrite = false;
            dot.renderOrder = 11;

            yRight -= ROW_SPACING;
            rowGroup.add(dot);


        });
        // 3. Add EDGE MODE Readout 
        let modeColor = 0x00ff00; // Default Green for ALL
        if (edgeMode === 'INTRA_ONLY') modeColor = 0x4444ff; // Blue for Intra
        if (edgeMode === 'INTER_ONLY') modeColor = 0xffffff; // White for Inter

        const modeLabel = this._createText(`MODE: ${edgeMode.replace('_', ' ')}`, 75, -0.42, modeColor);
        modeLabel.position.x = 0.25;
        this.modeGroup.add(modeLabel);

        // POSITION THE WHOLE ROW
        rowGroup.position.x = (0.1);
        this.rightTextGroup.add(rowGroup)

        yRight -= SECTION_GAP;

        // const density = this._createText(`AVG DENSITY: ${stats.avgDensity}`, FONT_SIZE, yRight, 0xffffff);
        // density.position.x = 0.25;

        // yRight -= ROW_SPACING;


        if (stats.bestFriends?.length) {

            const friends = this._createText(
                `TOP NEIGHBOURS: ${stats.bestFriends.join(", ")}`,
                FONT_SIZE,
                yRight,
                0xffffff
            );

            friends.position.x = 0.25;
            this.rightTextGroup.add(friends)
        }

        yRight -= ROW_SPACING;

        // ADD THE RANKING OF THE SELECTED NODE AMONG THE OTHER NODES
        if (stats.nodeRank && !nodeSelected) {
            const rank = this._createText(`DEGREE RANK: ${stats.nodeRank}`, FONT_SIZE, yRight, 0xffffff);
            rank.position.x = 0.30
            this.rightTextGroup.add(rank)
        }

        //  IF NODE IS SELECTED CLEAR THE RIGHT COLUMN, TOP NODES AND QUIET NODES INFO NOT NEEDED
        if (nodeSelected) {
            groupHeader.position.x = 0.25;
            this.leftTextGroup.clear();

            const selectedNodeInfo = stats.topHubs && stats.topHubs.length > 0 ? stats.topHubs[0] : null;

            if (selectedNodeInfo) {
                yRight -= ROW_SPACING;
                //  Modified: Added group to the detail view as well
                const selected = this._createText(`NODE: ${selectedNodeInfo.id} [${selectedNodeInfo.group || 'N/A'}]`, FONT_SIZE, yRight, 0xffffff);
                selected.position.x = 0.25;
                this.rightTextGroup.add(selected);
            } else {
                const inactiveMsg = this._createText(`NODE INACTIVE IN THIS WINDOW`, FONT_SIZE, y, 0xff6666);
                inactiveMsg.position.x = 0.25;
                this.rightTextGroup.add(inactiveMsg);
            }

            this.rightTextGroup.position.x = -0.25;
        }
    }

    getObject3D() {
        return this.group;
    }
}