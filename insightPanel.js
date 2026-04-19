import * as THREE from 'three';

export class InsightPanel {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = "InsightCanvasPanel";

        // 1. Setup Canvas (High resolution for VR clarity)
        this.canvasWidth = 1024;
        this.canvasHeight = 1024;
        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');

        // 2. Setup Texture and Mesh
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        const worldHeight = 1.3;
        const aspect = this.canvasWidth / this.canvasHeight;
        
        this.mesh = new THREE.Mesh(
            new THREE.PlaneGeometry(worldHeight * aspect, worldHeight),
            new THREE.MeshBasicMaterial({
                map: this.texture,
                transparent: true,
                depthTest: false,
                depthWrite: false
            })
        );
        
        // Match your previous panel's transform
        this.group.add(this.mesh);
        this.group.position.set(2.4, 1.9, -2.3);
        this.group.rotation.y = -Math.PI / 2.95;
    }

    _drawRoundedRect(x, y, w, h, r, color) {
        this.ctx.fillStyle = color;
        this.ctx.beginPath();
        this.ctx.roundRect(x, y, w, h, r);
        this.ctx.fill();
    }

    update(stats, colorScale, nodeSelected, edgeMode = 'ALL') {
        if (!stats) return;

        const ctx = this.ctx;
        ctx.clearRect(0, 0, this.canvasWidth, this.canvasHeight);

        // --- 1. BACKGROUND ---
        ctx.fillStyle = 'rgba(10, 15, 26, 0.95)';
        ctx.beginPath();
        ctx.roundRect(0, 0, this.canvasWidth, this.canvasHeight, 20);
        ctx.fill();

        // White border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
        ctx.lineWidth = 5;
        ctx.stroke();

        // --- 2. TITLE ---
        ctx.fillStyle = '#00ff00';
        ctx.font = 'bold 60px Arial';
        ctx.textAlign = 'center';
        ctx.fillText("LIVE INSIGHTS", this.canvasWidth / 2, 80);

        // --- 3. LEFT COLUMN (NODES) ---
        ctx.textAlign = 'left';
        let y = 180;
        const leftX = 60;

        if (!nodeSelected) {
            // High Degree Section
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText("HIGH DEGREE NODES", leftX, y);
            y += 60;

            ctx.font = '32px Arial';
            stats.topHubs.forEach((h, i) => {
                ctx.fillStyle = colorScale(h.group);
                ctx.fillText(`${i + 1}. ID ${h.id} [${h.group}] (${h.count})`, leftX, y);
                y += 50;
            });

            y += 40;
            ctx.fillStyle = '#ffffff';
            ctx.font = 'bold 40px Arial';
            ctx.fillText("LOW DEGREE NODES", leftX, y);
            y += 60;

            ctx.font = '32px Arial';
            stats.bottomNodes.forEach((n, i) => {
                ctx.fillStyle = colorScale(n.group);
                ctx.fillText(`${i + 1}. ID ${n.id} [${n.group}] (${n.count})`, leftX, y);
                y += 50;
            });
        } else {
            // Focused Node View
            ctx.fillStyle = '#00ffcc';
            ctx.font = 'bold 45px Arial';
            ctx.fillText("SELECTED NODE DETAIL", leftX, y);
            y += 80;
            
            const sel = stats.topHubs[0];
            if (sel) {
                ctx.fillStyle = '#ffffff';
                ctx.font = '40px Arial';
                ctx.fillText(`ID: ${sel.id}`, leftX, y); y += 50;
                ctx.fillText(`Group: ${sel.group}`, leftX, y); y += 50;
                ctx.fillText(`Degree: ${sel.count}`, leftX, y); y += 80;
                
                if (stats.bestFriends) {
                    ctx.fillStyle = '#00ffcc';
                    ctx.fillText("TOP NEIGHBORS:", leftX, y); y += 60;
                    ctx.fillStyle = '#ffffff';
                    ctx.fillText(stats.bestFriends.join(", "), leftX, y);
                }
            }
        }

        // --- 4. RIGHT COLUMN (GROUPS) ---
        let yRight = 180;
        const rightX = 550;

        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 40px Arial';
        ctx.fillText("MOST ACTIVE GROUPS", rightX, yRight);
        yRight += 70;

        ctx.font = '32px Arial';
        stats.topGroups.forEach((g) => {
            // Color Dot
            const dotColor = colorScale(g.name);
            ctx.fillStyle = dotColor;
            ctx.beginPath();
            ctx.arc(rightX + 15, yRight - 12, 12, 0, Math.PI * 2);
            ctx.fill();

            // Group Name
            ctx.fillStyle = '#ffffff';
            ctx.fillText(`${g.name} (${g.count})`, rightX + 50, yRight);
            yRight += 45;
        });

        // --- 5. FOOTER (MODE & RANK) ---
        const footerY = this.canvasHeight - 80;
        
        // Edge Mode Label
        let modeColor = '#00ff00';
        if (edgeMode === 'INTRA_ONLY') modeColor = '#4444ff';
        if (edgeMode === 'INTER_ONLY') modeColor = '#ffffff';
        
        ctx.fillStyle = modeColor;
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'center';
        ctx.fillText(`MODE: ${edgeMode.replace('_', ' ')}`, this.canvasWidth / 2, footerY);

        if (stats.nodeRank && !nodeSelected) {
            ctx.fillStyle = '#aaaaaa';
            ctx.font = '30px Arial';
            ctx.fillText(`RANK: ${stats.nodeRank}`, this.canvasWidth / 2, footerY + 50);
        }

        // Finalize
        this.texture.needsUpdate = true;
    }

    getObject3D() {
        return this.group;
    }
}