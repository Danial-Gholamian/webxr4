import * as THREE from 'three';
import { Text } from 'troika-three-text';

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
                depthWrite: false
            })
        );
        this.group.add(bg);

        // 2. White Border for definition
        const edges = new THREE.EdgesGeometry(bg.geometry);
        const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff, opacity: 0.5, transparent: true }));
        this.group.add(line);

        // 3. Title (Bright & Bold)
        this.title = this._createText("LIVE INSIGHTS", 0.08, 0.4, 0x00ff00);
        this.title.fontWeight = 'bold';

        // 4. Columns
        this.leftColumn = this._createText("", 0.05, 0.25, 0xffffff);
        this.leftColumn.anchorX = 'left';
        this.leftColumn.position.x = -0.75;
        this.leftColumn.maxWidth = 0.7;

        this.rightColumn = this._createText("", 0.05, 0.25, 0xffffff);
        this.rightColumn.anchorX = 'left';
        this.rightColumn.position.x = 0.1;
        this.rightColumn.maxWidth = 0.7;

        // Position above the Histogram
        this.group.position.set(2.8, 1.9, -3.3); 
        this.group.rotation.y = -Math.PI / 2.95;
        this.group.scale.set(1.3, 1.3, 1.3);
    }

    _createText(text, size, y, color) {
        const t = new Text();
        t.text = text;
        t.fontSize = size;
        t.color = color;
        t.position.y = y;
        t.anchorX = 'center';
        t.anchorY = 'top';
        t.renderOrder = 1001; // Draw above background
        t.sync();
        this.group.add(t);
        return t;
    }

    update(stats, colorScale) {
        if (!stats) return;

        // 1. Clear existing dots
        this.groupDots.clear();

        // 2. Generate Node Text (Left)
        let nodeText = `TOP STUDENTS\n`;
        stats.topHubs.forEach((h, i) => nodeText += `${i+1}. ID ${h.id} (${h.count})\n`);
        
        nodeText += `\nQUIET STUDENTS\n`;
        stats.bottomNodes.forEach((n, i) => nodeText += `${i+1}. ID ${n.id} (${n.count})\n`);

        if (stats.nodeRank) {
            nodeText += `\nRANK: ${stats.nodeRank}`;
        }

        // 3. Generate Group Text (Right) with Dots
        let groupText = `TOP GROUPS\n`;
        stats.topGroups.forEach((g, i) => {
            groupText += `   ${g.name} (${g.count})\n`; // Indent for the dot

            // Create Color Dot
            const dotColor = colorScale ? colorScale(g.name) : 0xffffff;
            const dot = new THREE.Mesh(
                new THREE.SphereGeometry(0.02, 16, 16),
                new THREE.MeshBasicMaterial({ color: dotColor })
            );
            // Position dot next to the text line
            dot.position.set(0.13, 0.20 - (i * 0.06), 0.01); 
            this.groupDots.add(dot);
        });
        
        groupText += `\nAVG DENSITY: ${stats.avgDensity}`;
        
        if (stats.bestFriends && stats.bestFriends.length > 0) {
            groupText += `\nFRIENDS: ${stats.bestFriends.join(', ')}`;
        }

        this.leftColumn.text = nodeText;
        this.rightColumn.text = groupText;
        
        this.leftColumn.sync();
        this.rightColumn.sync();
    }

    getObject3D() {
        return this.group;
    }
}