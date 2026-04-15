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

        // Updated questionPanel.js logic
        this.pages = [
            {
                question: "TASK 1: Adjust window size to match one histogram bar width. What are the top 3 active groups?",
                answers: ["Group 1A, 2B, 3C", "Teachers, 1B, 2A", "Group 4, 5, 6", "Others"],
                correct: 0 
            },
            {
                question: "TASK 2: Select a Teacher. Review activity over 2 days. Which student class do they manage?",
                answers: ["Class A", "Class B", "Class C", "Class D"],
                correct: 1
            },
            {
                question: "TASK 3: Set window 4300-5600. Note top groups. Now traverse with window size 100. Discuss findings.",
                answers: ["Consistency found", "New groups appeared", "Activity peaked later", "No change"],
                correct: 0
            },
            {
                question: "TASK 4: Set INTRA, window size 1. Traverse 1-1540 & 4600-5800. Identify lunch times (No Teacher interaction).",
                answers: ["700-850 & 5000-5200", "1000-1100 & 4800-4900", "1200-1300 & 5300-5450", "Unknown"],
                correct: 2
            },
            {
                question: "TASK 5: Based on the global timeline activity, can you identify the groups that leave the school early?",
                answers: ["Group 1A", "Teachers", "Group 3B", "Group 2C"],
                correct: 3
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