import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel.js';
import { highlightGroup } from './main.js';

export class InsightPanel {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = "InsightCanvasPanel";

        // 1. TALLER CANVAS SETUP (1024x1400)
        this.canvasWidth = 1024;
        this.canvasHeight = 1400; // Increased from 1024
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');

        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        // 2. ADJUST GEOMETRY (Maintain scale, but increase length)
        const worldWidth = 1.3;
        const aspect = this.canvasHeight / this.canvasWidth; // Flip aspect for verticality
        this.worldWidth = worldWidth;
        this.worldHeight = worldWidth * aspect; // Resulting height ~1.77m
        
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
        
        // 3. MOVE CLOSER TO EYE (Z: -2.3 -> -2.1)
        this.group.position.set(2.2, 1.8, -2.1); 
        this.group.rotation.y = -Math.PI / 3.2; // Adjusted angle for closer view

        this.selectedGroup = null;

        // --- CALIBRATION CONSTANTS ---
        this.RIGHT_COL_CENTER_X = 680;
        this.START_Y_PIXELS = 250;
        this.ROW_HEIGHT_PIXELS = 82; 
    }

    _pixelToWorldY(pixelY) {
        // Now accounts for the 1400px height center-point
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

    _drawGroupButtons(stats) {
        this.clearInteractionLayer();
        const btnWorldX = this._pixelToWorldX(this.RIGHT_COL_CENTER_X);

        // Increased slice to 13 groups
        stats.topGroups.slice(0, 13).forEach((g, i) => {
            const currentYPixel = this.START_Y_PIXELS + (i * this.ROW_HEIGHT_PIXELS);
            const btnWorldY = this._pixelToWorldY(currentYPixel);

            const capsule = createCapsuleLabel(`${g.name}`, {
                color: 0x1f2a44,
                hoverColor: 0x3366ff,
                selectedColor: 0x00ffcc,
                fontSize: 38, 
                onClick: () => {
                    this.selectedGroup = g.name;
                    highlightGroup(g.name);
                }
            });

            capsule.position.set(btnWorldX, btnWorldY, 0);
            capsule.scale.set(0.75, 0.75, 0.75);

            capsule.traverse(obj => {
                if (obj.isMesh) {
                    obj.material.depthTest = false;
                    obj.material.depthWrite = false;
                    obj.renderOrder = 999;
                }
            });

            const mesh = capsule.children[0];
            if (mesh?.userData) {
                mesh.userData.isSelected = (this.selectedGroup === g.name);
                mesh.userData.redraw(
                    mesh.userData.isSelected ? mesh.userData.selectedColor : mesh.userData.defaultColor
                );
            }

            this.interactionGroup.add(capsule);
        });
    }

    update(stats, colorScale, nodeSelected, edgeMode = 'ALL') {
        if (!stats) return;
        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // 1. Background (Taller)
        ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
        ctx.beginPath();
        ctx.roundRect(0, 0, this.canvasWidth, this.canvasHeight, 20);
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 5;
        ctx.stroke();

        // 2. Title
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("LIVE INSIGHTS", 512, 80);

        // 3. Content Logic
        ctx.textAlign = 'left';
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText("MOST ACTIVE GROUPS", 550, 180);

        // Increased loop to match buttons
        stats.topGroups.slice(0, 13).forEach((g, i) => {
            const yPos = this.START_Y_PIXELS + (i * this.ROW_HEIGHT_PIXELS);
            ctx.fillStyle = colorScale(g.name);
            ctx.beginPath();
            ctx.arc(585, yPos - 12, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.fillStyle = '#ffffff';
            ctx.font = '32px Arial';
            ctx.fillText(`(${g.count})`, 820, yPos);
        });

        this._drawNodeList(ctx, stats, colorScale, nodeSelected);
        this._drawFooter(ctx, edgeMode, stats.nodeRank, nodeSelected);

        this.texture.needsUpdate = true;
        this._drawGroupButtons(stats);
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
        }
    }

    _drawFooter(ctx, edgeMode, rank, nodeSelected) {
        // Footer stays relative to the bottom of the tall canvas
        const footerY = this.canvasHeight - 100;
        let modeColor = (edgeMode === 'INTRA_ONLY') ? '#4444ff' : (edgeMode === 'INTER_ONLY' ? '#ffffff' : '#00ff00');
        ctx.fillStyle = modeColor;
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`MODE: ${edgeMode.replace('_', ' ')}`, 512, footerY);

        if (rank && !nodeSelected) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '30px Arial';
            ctx.fillText(`RANK: ${rank}`, 512, footerY + 50);
        }
    }

    clearSelection() { this.selectedGroup = null; }
    getObject3D() { return this.group; }
}