// questionPanel.js
import * as THREE from 'three';
import { createCapsuleLabel } from './filterUIPanel.js';
import { QUESTIONS } from './questionList.js';

export class QuestionPanel {
    constructor() {
        this.group = new THREE.Group();
        this.group.name = "QuestionPanel";
        this.currentIndex = 0
        this.data = QUESTIONS

        this.selectedAnswer = null;

        this._buildUI();
    }

    _buildUI() {

        const worldHeight = 0.6;

        const bgGeo = new THREE.PlaneGeometry(
            worldHeight * (1024 / 1024),
            worldHeight
        );
        const bgMat = new THREE.MeshBasicMaterial({
            color: 0x111111,
            transparent: true,
            opacity: 0.2,
            depthTest: false,
            depthWrite: false
        });

        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.position.z = -0.01;

        this.group.userData.absorbsOnly = true
        this.group.traverse(obj => {
            obj.userData.absorbsOnly = true;
        });

        this.group.add(bgMesh);

        // -------------------------
        // QUESTION TEXTS
        // -------------------------
        const current = this.data[this.currentIndex];

        const textPanel = createTextPanel(1024, 1024, 1.2);
        bgMesh.renderOrder = 1;
        textPanel.mesh.renderOrder = 2;

        this.questionPanel = textPanel;
        this.group.add(textPanel.mesh);

        textPanel.mesh.position.set(0, 0, 0.001);

        this._drawQuestion()

    }


    _drawQuestion() {
        const { ctx, canvas, texture } = this.questionPanel;
        const current = this.data[this.currentIndex];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // -------------------------
        // Background
        // -------------------------
        ctx.fillStyle = 'rgba(17,17,17,0.45)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);


        // -------------------------
        // HEADER (Question number)
        // -------------------------
        ctx.fillStyle = '#00ffcc';
        ctx.font = 'bold 40px Arial';
        ctx.textAlign = 'left';

        ctx.fillText(
            `Question ${this.currentIndex + 1} / ${this.data.length}`,
            100,
            80
        );

        // -------------------------
        // QUESTION
        // -------------------------
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 33px Arial';
        ctx.textAlign = 'left';

        let y = 170;

        y = drawWrappedText(
            ctx,
            current.question,
            canvas.width - 300,
            70,
            100,
            y
        );

        // -------------------------
        // ANSWERS (NON-INTERACTIVE)
        // -------------------------
        ctx.font = '25px Arial';

        const letters = ['A', 'B', 'C', 'D'];

        y += 25;

        current.answers.forEach((ans, i) => {
            const text = `${letters[i]}. ${ans}`;

            y = drawWrappedText(
                ctx,
                text,
                canvas.width - 300,
                60,
                120,
                y
            );

            y += 20; // spacing between answers
        });

        texture.needsUpdate = true;

        // -------------------------
        // FOOTER
        // -------------------------
        ctx.fillStyle = '#aaaaaa';
        ctx.font = '25px Arial';
        ctx.textAlign = 'center';

        ctx.fillText(
            `Use stick to navigate`,
            canvas.width / 2,
            canvas.height - 60
        );

        // -------------------------
        // NAV ARROWS
        // -------------------------
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 70px Arial';
        ctx.textAlign = 'center';

        ctx.fillText("◀", 120, canvas.height - 120);
        ctx.fillText("▶", canvas.width - 120, canvas.height - 120);
    }

    _onBack() {
        const parent = this.group.userData.parentPanel;

        if (parent) {
            parent.userData.mode = "GUIDE";

            this.group.visible = false;

            parent.children.forEach(child => {
                if (child !== this.group) {
                    child.visible = true;
                }
            });
        }
    }


    handleTriggerSelect() {
        if (this.hoverIndex !== null) {
            this.toggleSelection(this.hoverIndex);
        }
    }

    nextQuestion() {
        if (this.currentIndex < this.data.length - 1) {
            this.currentIndex++;
            this._drawQuestion();
        }
    }

    prevQuestion() {
        if (this.currentIndex > 0) {
            this.currentIndex--;
            this._drawQuestion();
        }
    }
}


function createTextPanel(width = 1024, height = 1024, worldHeight = 1.2) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;

    const ctx = canvas.getContext('2d');

    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;

    const aspect = width / height;

    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(worldHeight * aspect, worldHeight),
        new THREE.MeshBasicMaterial({
            map: texture,
            transparent: true,
            depthTest: false,
            depthWrite: false
        })
    );

    return {
        mesh,
        ctx,
        canvas,
        texture
    };
}


function drawWrappedText(ctx, text, maxWidth, lineHeight, x, y) {
    const words = text.split(' ');
    let line = '';

    for (let n = 0; n < words.length; n++) {
        const testLine = line + words[n] + ' ';
        const metrics = ctx.measureText(testLine);

        if (metrics.width > maxWidth && n > 0) {
            ctx.fillText(line, x, y);
            line = words[n] + ' ';
            y += lineHeight;
        } else {
            line = testLine;
        }
    }

    ctx.fillText(line, x, y);
    return y + lineHeight; // FIXES STACKING
}



