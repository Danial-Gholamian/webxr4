//insightPanel.js
import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel.js';
import { highlightGroup, getGraphController } from './main.js'; // Added controller import

export class InsightPanel {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = "InsightCanvasPanel";

        this.canvasWidth = 1024;
        this.canvasHeight = 1400;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        const worldWidth = 1.3;
        const aspect = this.canvasHeight / this.canvasWidth;
        this.worldWidth = worldWidth;
        this.worldHeight = worldWidth * aspect;

        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(this.worldWidth, this.worldHeight),
            new THREE.MeshBasicMaterial({
                map: this.texture,
                transparent: true,
                depthTest: false,
                depthWrite: false
            })
        );
        this.mesh.renderOrder = 900;
        this.mesh.userData.absorbsOnly = true;

        this.hitPlane = new THREE.Mesh(
            new THREE.PlaneGeometry(this.worldWidth, this.worldHeight),
            new THREE.MeshBasicMaterial({ transparent: true, opacity: 0.001 })
        );
        this.hitPlane.name = 'uiPanelBackground';
        this.hitPlane.userData.absorbsOnly = true;

        this.interactionGroup = new THREE.Group();
        this.interactionGroup.name = "InsightInteractionLayer";
        this.interactionGroup.position.z = 0.01;

        this.group.add(this.hitPlane);
        this.group.add(this.mesh);
        this.group.add(this.interactionGroup);

        this.group.position.set(2.2, 1.8, -2.1);
        this.group.rotation.y = -Math.PI / 3.2;

        this.selectedGroup = null;

        // --- CALIBRATION CONSTANTS ---
        this.RIGHT_COL_CENTER_X = 680;
        this.START_Y_PIXELS = 250;
        this.ROW_HEIGHT_PIXELS = 82;

        // Mode Button Pixels (Near bottom)
        this.MODE_Y_PIXELS = 1240;
        this.MODE_X_ALL = 250;
        this.MODE_X_INTRA = 512;
        this.MODE_X_INTER = 774;
    }

    _pixelToWorldY(pixelY) {
        return (0.5 - (pixelY / this.canvasHeight)) * this.worldHeight;
    }

    _pixelToWorldX(pixelX) {
        return ((pixelX / this.canvasWidth) - 0.5) * this.worldWidth;
    }

    clearInteractionLayer() {
        this.interactionGroup.children.forEach(child => {
            child.traverse(obj => {
                if (obj.geometry) obj.geometry.dispose();
                if (obj.material) obj.material.dispose();
            });
        });
        this.interactionGroup.clear();
    }

    _drawInteractionElements(stats, edgeMode, colorScale) {
        this.clearInteractionLayer();
        const controller = getGraphController();

        // 1. Spawning Group Buttons
        const btnWorldX = this._pixelToWorldX(this.RIGHT_COL_CENTER_X);
        stats.topGroups.slice(0, 12).forEach((g, i) => {
            const currentYPixel = this.START_Y_PIXELS + (i * this.ROW_HEIGHT_PIXELS);
            const btnWorldY = this._pixelToWorldY(currentYPixel);

            const capsule = createCapsuleLabel(`${g.name}`, {
                color: 0x1f2a44,
                hoverColor: 0x3366ff,
                selectedColor: 0x00ffcc,
                fontSize: 80,
                // DOT HERE
                dotColor: colorScale(g.name),
                dotRadius: 30,
                dotGap: 50,

                onClick: () => {
                    this.selectedGroup = g.name;
                    highlightGroup(g.name);
                }
            });

            capsule.position.set(btnWorldX, btnWorldY, 0);
            capsule.scale.set(0.65, 0.65, 0.65);
            this._applyVRStyles(capsule, false);
            this.interactionGroup.add(capsule);
        });

        // 2. Spawning Mode Toggles (All, Intra, Inter)
        const modes = [
            { label: 'ALL', x: this.MODE_X_ALL, color: 0x00ff00 },
            { label: 'INTRA', x: this.MODE_X_INTRA, color: 0x4444ff },
            { label: 'INTER', x: this.MODE_X_INTER, color: 0xaa00ff  }
        ];

        modes.forEach(m => {
            const worldX = this._pixelToWorldX(m.x);
            const worldY = this._pixelToWorldY(this.MODE_Y_PIXELS);
            const isActive = edgeMode.startsWith(m.label); // Matches 'ALL', 'INTRA_ONLY', etc.

            const capsule = createCapsuleLabel(m.label, {
                color: 0x111827,
                hoverColor: 0x3366ff,
                selectedColor: m.color,
                fontSize: 55,
                onClick: () => {
                    const fullMode = m.label === 'ALL' ? 'ALL' : m.label + '_ONLY';
                    controller.setEdgeMode(fullMode);
                },
            });

            capsule.position.set(worldX, worldY, 0);
            capsule.scale.set(0.85, 0.85, 0.85);
            this._applyVRStyles(capsule, isActive);
            this.interactionGroup.add(capsule);
        });
    }

    _applyVRStyles(capsule, isSelected) {
        capsule.traverse(obj => {
            if (obj.isMesh) {
                obj.material.depthTest = false;
                obj.material.depthWrite = false;
                obj.renderOrder = 999;
            }
        });
        const mesh = capsule.children[0];
        if (mesh?.userData) {
            mesh.userData.isSelected = isSelected;
            mesh.userData.redraw(
                isSelected ? mesh.userData.selectedColor : mesh.userData.defaultColor
            );
        }
    }

    update(stats, colorScale, nodeSelected, edgeMode = 'ALL') {
        if (!stats) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // Background
        ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
        ctx.beginPath();
        ctx.roundRect(0, 0, this.canvasWidth, this.canvasHeight, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 5;
        ctx.stroke();

        // Title
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("LIVE INSIGHTS", 512, 80);

        // Group Content
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText("MOST ACTIVE GROUPS", 550, 180);

        stats.topGroups.slice(0, 12).forEach((g, i) => {
            const yPos = this.START_Y_PIXELS + (i * this.ROW_HEIGHT_PIXELS);
            // ctx.fillStyle = colorScale(g.name);
            // ctx.beginPath();
            // const DOT_OFFSET = -60; // tweak this
            // const dotX = this.RIGHT_COL_CENTER_X + DOT_OFFSET;

            // ctx.beginPath();
            // ctx.arc(dotX, yPos - 12, 16, 0, Math.PI * 2);
            // ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '48px Arial';
            ctx.fillText(`(${g.count})`, this.RIGHT_COL_CENTER_X + 120, yPos + 8);
        });

        this._drawNodeList(ctx, stats, colorScale, nodeSelected);

        // Footer & Mode Labels
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 45px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("EDGE FILTER MODE", 512, this.MODE_Y_PIXELS - 80);

        if (stats.nodeRank && !nodeSelected) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '30px Arial';
            ctx.fillText(`NETWORK RANK: ${stats.nodeRank}`, 512, this.canvasHeight - 60);
        }

        this.texture.needsUpdate = true;
        this._drawInteractionElements(stats, edgeMode, colorScale);
    }

    _drawNodeList(ctx, stats, colorScale, nodeSelected) {
        ctx.textAlign = 'left';
        let y = 180;
        const leftX = 60;
        if (!nodeSelected) {
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText("HIGH DEGREE NODES", leftX, y);
            y += 60;
            stats.topHubs.slice(0, 6).forEach(h => {
                ctx.fillStyle = colorScale(h.group);
                ctx.fillText(`ID ${h.id} [${h.group}] (${h.count})`, leftX, y);
                y += 50;
            });
            y += 60;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText("LOW DEGREE NODES", leftX, y);
            y += 60;
            stats.bottomNodes.slice(0, 6).forEach(n => {
                ctx.fillStyle = colorScale(n.group);
                ctx.fillText(`ID ${n.id} [${n.count}]`, leftX, y);
                y += 50;
            });
        } else {
            // Selected Node Details logic
            ctx.fillStyle = '#00ffcc';
            ctx.font = 'bold 45px Arial';
            ctx.fillText("SELECTED NODE DETAIL", leftX, y);
            const sel = stats.topHubs[0];
            if (sel) {
                y += 80; ctx.fillStyle = '#ffffff'; ctx.font = '40px Arial';
                ctx.fillText(`ID: ${sel.id}`, leftX, y); y += 50;
                ctx.fillText(`Group: ${sel.group}`, leftX, y); y += 50;
                ctx.fillText(`Degree: ${sel.count}`, leftX, y); y += 80;
                if (stats.bestFriends) {
                    ctx.fillStyle = '#00ffcc'; ctx.fillText("TOP NEIGHBORS:", leftX, y); y += 60;
                    ctx.fillStyle = '#ffffff'; ctx.font = '32px Arial';
                    ctx.fillText(stats.bestFriends.join(", "), leftX, y);
                }
            }
        }
    }

    clearSelection() { this.selectedGroup = null; }
    getObject3D() { return this.group; }
}