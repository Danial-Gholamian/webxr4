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
            opacity: 0.9,
            depthTest: false
        });

        const bgMesh = new THREE.Mesh(bgGeo, bgMat);
        bgMesh.position.z = -0.01;

        this.group.add(bgMesh);

        // -------------------------
        // QUESTION TEXTS
        // -------------------------
        const current = this.data[this.currentIndex];

        const textPanel = createTextPanel(1024, 1024, 0.6);

        this.questionPanel = textPanel;
        this.group.add(textPanel.mesh);

        textPanel.mesh.position.set(0, 0, 0.001);

        this._drawQuestion()


        // // -------------------------
        // // BACK BUTTON
        // // -------------------------
        // this.backButton = createCapsuleLabel("Back", {
        //     fontSize: 40,
        //     color: 0x884444,
        //     onClick: () => this._onBack()
        // });

        // this.backButton.position.set(-0.2, -0.45, 0);
        // this.group.add(this.backButton);

        // // -------------------------
        // // SUBMIT BUTTON
        // // -------------------------
        // this.submitButton = createCapsuleLabel("Submit", {
        //     fontSize: 40,
        //     color: 0x448844,
        //     onClick: () => this._onSubmit()
        // });

        // this.submitButton.position.set(0.2, -0.45, 0);
        // this.group.add(this.submitButton);
    }

    // -------------------------
    // LOGIC
    // -------------------------

    // _selectAnswer(index) {
    //     this.selectedAnswer = index;

    //     console.log("Selected:", this.answers[index]);

    //     // visual feedback
    //     this.answerButtons.forEach((btn, i) => {
    //         const mesh = btn.children[0];
    //         mesh.userData.isSelected = (i === index);

    //         mesh.userData.redraw(
    //             i === index ? "#3366ff" : mesh.userData.defaultColor
    //         );
    //     });
    // }

    // _onSubmit() {
    //     if (this.selectedAnswer === null) {
    //         console.log("No answer selected");
    //         return;
    //     }

    //     console.log("Submitted answer:", this.answers[this.selectedAnswer]);
    // }

    _drawQuestion() {
        const { ctx, canvas, texture } = this.questionPanel;
        const current = this.data[this.currentIndex];

        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // -------------------------
        // Background
        // -------------------------
        ctx.fillStyle = 'rgba(17,17,17,0.95)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // -------------------------
        // QUESTION
        // -------------------------
        ctx.fillStyle = '#ffffff';
        ctx.font = 'bold 46px Arial';
        ctx.textAlign = 'left';

        let y = 150;

        y = drawWrappedText(
            ctx,
            current.question,
            canvas.width - 300,
            55,
            100,
            y
        );

        // -------------------------
        // ANSWERS (NON-INTERACTIVE)
        // -------------------------
        ctx.font = '38px Arial';

        const letters = ['A', 'B', 'C', 'D'];

        y += 60;

        current.answers.forEach((ans, i) => {
            const text = `${letters[i]}. ${ans}`;

            y = drawWrappedText(
                ctx,
                text,
                canvas.width - 300,
                50,
                120,
                y
            );

            y += 20; // spacing between answers
        });

        texture.needsUpdate = true;
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

    // _refreshUI() {
    //     // remove old buttons
    //     this.answerButtons.forEach(btn => this.group.remove(btn));
    //     this.group.remove(this.questionLabel);

    //     // rebuild UI
    //     this._buildUI();
    // }

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


function createTextPanel(width = 1024, height = 1024, worldHeight = 0.6) {
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
            depthTest: false
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



