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
        this.groupDots = new THREE.Group(); // Separate group for dots
        this.group.add(this.groupDots);

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
            }
        });

        label.renderOrder = 10;

        return label;

    }

    update(stats, colorScale) {

        if (!stats) return;
        this.leftTextGroup.clear();
        this.rightTextGroup.clear();
        this.groupDots.clear();

        // 1. Clear existing dots
        this.groupDots.clear();

        // 2. Generate Node Text (Left)
        let y = 0.25;

        const header = this._createText("TOP NODES", SUB_HEADING_FONT_SIZE, y, 0xffffff);
        header.position.x = -0.4;
        this.leftTextGroup.add(header)

        y -= HEADER_SPACING;

        stats.topHubs.forEach((h, i) => {
            const row = this._createText(`${i + 1}. ID ${h.id} (${h.count})`, FONT_SIZE, y, 0xffffff);
            row.position.x = -0.4;
            y -= ROW_SPACING;
            this.leftTextGroup.add(row)
        });

        y -= SECTION_GAP;

        const quietHeader = this._createText("QUIET NODES", SUB_HEADING_FONT_SIZE, y, 0xffffff);
        quietHeader.position.x = -0.4;
        this.leftTextGroup.add(quietHeader)
        y -= HEADER_SPACING;

        stats.bottomNodes.forEach((n, i) => {
            const row = this._createText(`${i + 1}. ID ${n.id} (${n.count})`, FONT_SIZE, y, 0xffffff);
            row.position.x = -0.4;
            y -= ROW_SPACING;
            this.leftTextGroup.add(row)
        });


        // 2. Generate Node Text (Right)
        let yRight = 0.25;

        const groupHeader = this._createText("TOP GROUPS", SUB_HEADING_FONT_SIZE, yRight, 0xffffff);
        groupHeader.position.x = 0.25;
        this.rightTextGroup.add(groupHeader)

        yRight -= HEADER_SPACING;

        stats.topGroups.forEach((g, i) => {

            const row = this._createText(`${g.name} (${g.count})`, FONT_SIZE, yRight, 0xffffff);

            row.position.x = 0.30;
            this.rightTextGroup.add(row)

            const dotColor = colorScale ? colorScale(g.name) : 0xffffff;
            const dot = createColorDot(dotColor, 20);

            dot.position.set(0.13, yRight, 0.02);

            dot.material.depthTest = false;
            dot.material.depthWrite = false;
            dot.renderOrder = 11;

            this.groupDots.add(dot);
            yRight -= ROW_SPACING;

        });

        yRight -= SECTION_GAP;

        const density = this._createText(`AVG DENSITY: ${stats.avgDensity}`, FONT_SIZE, yRight, 0xffffff);
        density.position.x = 0.25;

        yRight -= HEADER_SPACING;

        if (stats.bestFriends?.length) {

            const friends = this._createText(
                `FRIENDS: ${stats.bestFriends.join(", ")}`,
                FONT_SIZE,
                yRight,
                0xffffff
            );

            friends.position.x = 0.25;
        }
    }

    getObject3D() {
        return this.group;
    }
}