//questionPanel.js
import * as THREE from 'three';

export class QuestionPanel {
    constructor(scene) {
        this.group = new THREE.Group();
        this.group.name = "GiganticQuestionPanel";
        this.currentPage = 0;
        
        // Tracking states for interaction
        this.hoverIndex = null;
        this.selectedIndices = new Set(); // Multi-select support

        this.width = 40.0;
        this.height = 56.5;
        this.canvasWidth = 2048; 
        this.canvasHeight = 2048;

        this.pages = [
            {
                question: "1. Look at the 1554-unit view. Is Node 1564 a significant hub?",
                answers: ["Yes, it's Rank #1", "No, it is Rank #218", "It's in the Top 3", "It is a teacher"],
                correct: 1
            },
            {
                question: "2. Which group does Node 1564 belong to?",
                answers: ["Group 1A", "Group 2B", "Teachers", "Unknown"],
                correct: 0
            },
            {
                question: "3. Is Node 1564 directly connected to the highlighted cluster?",
                answers: ["Yes", "No", "Only temporally", "Only through teachers"],
                correct: 0
            }
        ];

        this.canvas = document.createElement('canvas');
        this.canvas.width = this.canvasWidth;
        this.canvas.height = this.canvasHeight;
        this.ctx = this.canvas.getContext('2d');
        
        this.texture = new THREE.CanvasTexture(this.canvas);
        this.texture.colorSpace = THREE.SRGBColorSpace;

        this.init(scene);
        this.draw();

        this.group.userData.instance = this;
    }

    init(scene) {
        const borderGeo = new THREE.PlaneGeometry(this.width + 1.2, this.height + 1.2);
        const borderMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
        const border = new THREE.Mesh(borderGeo, borderMat);
        border.position.z = -0.1; 
        this.group.add(border);

        const backGeo = new THREE.PlaneGeometry(this.width + 1.2, this.height + 1.2);
        const backMat = new THREE.MeshBasicMaterial({
        color: 0xffffff,
        side: THREE.BackSide
        });

        const backPanel = new THREE.Mesh(backGeo, backMat);
        backPanel.position.z = -0.2; // slightly behind everything
        this.group.add(backPanel);

        const uiGeo = new THREE.PlaneGeometry(this.width, this.height);
        const uiMat = new THREE.MeshBasicMaterial({ map: this.texture, transparent: false });
        this.uiMesh = new THREE.Mesh(uiGeo, uiMat);
        this.uiMesh.renderOrder = 1000; 
        this.group.add(this.uiMesh);

        this.hitboxes = new THREE.Group();
        this.group.add(this.hitboxes);
        this.group.scale.set(3, 3, 3);
        this.group.position.set(-120, 35, 200);
        this.group.rotation.y = 0.8;
        scene.add(this.group);
        this.group.updateMatrixWorld(true);
    }

    draw() {
        const ctx = this.ctx;
        const w = this.canvasWidth;
        const h = this.canvasHeight;
        const data = this.pages[this.currentPage];

        ctx.fillStyle = '#121212';
        ctx.fillRect(0, 0, w, h);

        // Question
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.font = 'bold 95px Arial';
        this.wrapText(ctx, data.question, w / 2, 180, w - 240, 110);

        this.hitboxes.clear();
        const startY = 700; 
        const buttonSpacing = 240;

        // Answers
        data.answers.forEach((ans, i) => {
            const yPos = startY + (i * buttonSpacing);
            const isHovered = (this.hoverIndex === i);
            const isSelected = this.selectedIndices.has(i);

            if (isSelected) {
                ctx.fillStyle = '#00ffff'; 
                ctx.shadowBlur = 30;
                ctx.shadowColor = '#00ffff';
            } else {
                ctx.fillStyle = isHovered ? '#555555' : '#2a2a2a';
                ctx.shadowBlur = 0;
            }

            this.roundRect(ctx, 180, yPos, w - 360, 170, 85, true);
            ctx.shadowBlur = 0; 

            ctx.fillStyle = isSelected ? '#000000' : '#ffffff';
            ctx.textAlign = 'left';
            ctx.textBaseline = 'middle';
            ctx.font = '70px Arial';
            ctx.fillText(`${String.fromCharCode(65 + i)}: ${ans}`, 280, yPos + 85);

            this.createHitbox(i, yPos + 85);
        });

        // --- NAVIGATION BUTTONS ---
        
        // BACK BUTTON (Only if not on first page)
        if (this.currentPage > 0) {
            ctx.fillStyle = this.hoverIndex === -2 ? '#555555' : '#444444';
            this.roundRect(ctx, 180, h - 260, 420, 160, 80, true);
            ctx.fillStyle = '#ffffff';
            ctx.textAlign = 'center';
            ctx.font = 'bold 70px Arial';
            ctx.fillText("< BACK", 390, h - 180);
            this.createHitbox(-2, h - 180, true, -12); // Positioned to the left
        }

        // NEXT / FINISH BUTTON
        const isLastPage = this.currentPage === this.pages.length - 1;
        ctx.fillStyle = this.hoverIndex === -1 ? '#33aa33' : '#228822';
        this.roundRect(ctx, w - 600, h - 260, 420, 160, 80, true);
        ctx.fillStyle = '#ffffff';
        ctx.textAlign = 'center';
        ctx.font = 'bold 70px Arial';
        ctx.fillText(isLastPage ? "FINISH" : "NEXT >", w - 390, h - 180);
        this.createHitbox(-1, h - 180, true, 12); // Positioned to the right

        this.texture.needsUpdate = true;
    }

    createHitbox(index, canvasY, isNext = false, offsetX = 0) {
        const ratioY = canvasY / this.canvasHeight;
        const localY = (0.5 - ratioY) * this.height;
        
        const hbGeo = new THREE.PlaneGeometry(isNext ? 10 : this.width * 0.85, 7); 
        const hbMat = new THREE.MeshBasicMaterial({ 
            color: 0x00ff00, transparent: true, opacity: 0.0, visible: true, depthTest: false 
        });
        
        const hb = new THREE.Mesh(hbGeo, hbMat);
        hb.renderOrder = 9999;
        // Use offsetX to put Back on left and Next on right
        hb.position.set(isNext ? offsetX : 0, localY, 2.0); 
        
        hb.name = 'questionHitbox';
        hb.userData = { index, interactive: true, parentPanel: this };
        this.hitboxes.add(hb);
    }

    toggleSelection(index) {
        if (index === -1) {
            this.nextPage();
        } else if (index === -2) {
            this.prevPage();
        } else {
            if (this.selectedIndices.has(index)) {
                this.selectedIndices.delete(index);
            } else {
                this.selectedIndices.add(index);
            }
        }
        this.draw();
    }

    wrapText(context, text, x, y, maxWidth, lineHeight) {
        const words = text.split(' ');
        let line = '';
        for (let n = 0; n < words.length; n++) {
            let testLine = line + words[n] + ' ';
            let metrics = context.measureText(testLine);
            if (metrics.width > maxWidth && n > 0) {
                context.fillText(line, x, y);
                line = words[n] + ' ';
                y += lineHeight;
            } else {
                line = testLine;
            }
        }
        context.fillText(line, x, y);
    }

    roundRect(ctx, x, y, width, height, radius, fill) {
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + width - radius, y);
        ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        ctx.lineTo(x + width, y + height - radius);
        ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        ctx.lineTo(x + radius, y + height);
        ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        if (fill) ctx.fill();
    }


    handleSelect() {
        if (this.hoverIndex !== null) {
            this.toggleSelection(this.hoverIndex);
        }
    }

    nextPage() {
        if (this.currentPage < this.pages.length - 1) {
            this.currentPage++;
            this.hoverIndex = null;
            this.selectedIndices.clear();
            this.draw();
        } else {
            console.log("Quiz finished");
            this.hoverIndex = null;
            this.draw();
        }
    }
    prevPage() {
        if (this.currentPage > 0) {
            this.currentPage--;
            this.hoverIndex = null;
            this.selectedIndices.clear();
            this.draw();
        }
    }
}