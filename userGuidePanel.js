import * as THREE from 'three';
import { QuestionPanel } from './questionPanel';
import { createCapsuleLabel } from './filterUIPanel';

// Load all the images
const loader = new THREE.TextureLoader();
const guideImages = {
    "edge-mode.jpeg": loader.load(' /webxr4/guide-images/edge-mode.jpeg'),
    "group-filter-a.jpeg": loader.load(' /webxr4/guide-images/group-filter-a.jpeg'),
    "movement.jpeg": loader.load(' /webxr4/guide-images/movement.jpeg'),
    "move-window.jpeg": loader.load(' /webxr4/guide-images/move-window.jpeg'),
    "reset-filter.jpeg": loader.load(' /webxr4/guide-images/reset-filter.jpeg'),
    "rotate.jpeg": loader.load(' /webxr4/guide-images/rotate.jpeg'),
    "trigger.jpeg": loader.load(' /webxr4/guide-images/trigger.jpeg'),
    "trigger-select.jpeg": loader.load(' /webxr4/guide-images/trigger-select.jpeg')
};


const ITEMS_PER_PAGE = 4;
const GUIDE_ITEMS = [
    {
        type: "image",
        title: "Switch edge mode",
        image: "edge-mode.jpeg"
    },
    {
        type: "image",
        title: "Filter groups",
        image: "group-filter-a.jpeg"
    },
    {
        type: "image",
        title: "Move & Rotate",
        image: "movement.jpeg"
    },
    {
        type: "image",
        title: "Resize time window",
        image: "move-window.jpeg"
    },
    {
        type: "image",
        title: "Reset view",
        image: "reset-filter.jpeg"
    },
    {
        type: "image",
        title: "Rotate graph",
        image: "rotate.jpeg"
    },
    {
        type: "image",
        title: "Trigger interaction",
        image: "trigger.jpeg"
    },
    {
        type: "image",
        title: "Select with beam",
        image: "trigger-select.jpeg"
    }
];

let currentPage = 0;
let totalPages = GUIDE_ITEMS.length;

export function createUserGuidePanel() {
    const group = new THREE.Group();
    group.name = "UserGuidePanel";
    group.userData.absorbsOnly = true
    group.traverse(obj => {
        obj.userData.absorbsOnly = true;
    });

    const panelHeight = 1.2;
    const canvasWidth = 1024;
    const canvasHeight = 1024;

    // --- Video Setup ---
    const video = document.createElement('video');
    video.src = 'sample-15s.mp4';
    video.loop = true;
    video.muted = false;
    video.playsInline = true;
    video.crossOrigin = "anonymous";
    video.load();

    const videoTexture = new THREE.VideoTexture(video);
    videoTexture.colorSpace = THREE.SRGBColorSpace;

    const videoWindowHeight = 0.45;
    const videoWindowWidth = videoWindowHeight * (16 / 9);
    const videoGeo = new THREE.PlaneGeometry(videoWindowWidth, videoWindowHeight);
    const videoMat = new THREE.MeshBasicMaterial({
        map: videoTexture,
        depthTest: false,
        transparent: true
    });
    const videoMesh = new THREE.Mesh(videoGeo, videoMat);

    videoMesh.renderOrder = 100;
    videoMesh.position.set(0, 0.28, 0.02);
    videoMesh.visible = false; // Start hidden
    group.add(videoMesh);

    // --- Text/Canvas Setup ---
    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = canvasHeight;
    const ctx = canvas.getContext('2d');

    const textTexture = new THREE.CanvasTexture(canvas);
    textTexture.colorSpace = THREE.SRGBColorSpace
    const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(panelHeight * (canvasWidth / canvasHeight), panelHeight),
        new THREE.MeshBasicMaterial({
            map: textTexture,
            transparent: true,
            depthTest: false,
            toneMapped: false
        })
    );

    textPlane.renderOrder = 99;
    group.add(textPlane);
    group.userData.textPlane = textPlane;


    // QUESTION SETUP
    const questionPanel = new QuestionPanel();
    questionPanel.group.visible = false;

    group.add(questionPanel.group);

    group.userData.questionPanel = questionPanel;
    group.userData.mode = 'GUIDE';
    questionPanel.group.userData.parentPanel = group;


    const prevHitbox = createArrowHitbox(-0.4, -0.5, 0.25, 0.25, () => {
        if (group.userData.mode === "GUIDE") {
            prevGuidePage(group);
        } else {
            group.userData.questionPanel.prevQuestion();
        }
    });

    const nextHitbox = createArrowHitbox(0.4, -0.5, 0.25, 0.25, () => {
        if (group.userData.mode === "GUIDE") {
            nextGuidePage(group);
        } else {
            group.userData.questionPanel.nextQuestion();
        }
    });

    group.add(prevHitbox);
    group.add(nextHitbox);


    // --- Storage & Callbacks ---
    group.userData.video = video;
    group.userData.videoMesh = videoMesh; // Store mesh reference
    group.userData.canvas = canvas;
    group.userData.ctx = ctx;
    group.userData.texture = textTexture;

    const bgGeo = new THREE.PlaneGeometry(panelHeight * (canvasWidth / canvasHeight), panelHeight);
    const bgMat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.2,
        color: 0x111111,
        depthTest: false
    });

    const bgMesh = new THREE.Mesh(bgGeo, bgMat);
    bgMesh.name = "uiPanelBackground";

    bgMesh.userData = {
        absorbsOnly: true
    };

    bgMesh.position.z = -0.01; // slightly behind UI
    bgMesh.renderOrder = 98;

    group.add(bgMesh);

    // Initial draw
    drawGuidePage(ctx, canvas, currentPage);

    group.onToggle = (isVisible) => {
        if (isVisible) {
            if (THREE.AudioContext.getContext().state !== 'running') {
                THREE.AudioContext.getContext().resume();
            }
            // Logic to play only if we are on the correct page
            updateVideoState(group);
        } else {
            video.pause();
        }
    };

    group.visible = false;
    group.position.set(0, 1.2, -1.5);

    return group;
}

// --- Logic Helper: Toggle Video based on current page ---
function updateVideoState(panel) {
    const video = panel.userData.video;
    const videoMesh = panel.userData.videoMesh;

    // Target Page 3 (Index 2)
    if (currentPage === 2 && panel.visible) {
        videoMesh.visible = true;
        video.play().catch(e => console.warn("Video blocked", e));
    } else {
        videoMesh.visible = false;
        video.pause();
    }
}

function drawGuidePage(ctx, canvas, page) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(17,17,17,0.45)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const item = GUIDE_ITEMS[page];

    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';

    if (item.type === "image") {

        // --- DRAW IMAGE ---
        const img = guideImages[item.image]?.image;

        if (img) {
            ctx.drawImage(img, 100, 50, canvas.width - 200, 500);
        }

        // --- TITLE ---
        ctx.font = 'bold 45px Arial';
        ctx.fillText(item.title, canvas.width / 2, 620);

    } else if (item.type === "text") {

        ctx.font = 'bold 45px Arial';
        ctx.fillText('VR Controls Guide', canvas.width / 2, 150);

        ctx.textAlign = 'left';
        ctx.font = '38px Arial';

        let y = 300;
        item.items.forEach(text => {
            ctx.fillText("• " + text, 120, y);
            y += 80;
        });
    }

    // --- PAGE NUMBER ---
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(
        `Page ${page + 1} / ${GUIDE_ITEMS.length}`,
        canvas.width / 2,
        canvas.height - 60
    );

    // --- ARROWS ---
    ctx.font = 'bold 70px Arial';
    ctx.fillStyle = '#ffffff';

    ctx.fillText("◀", 120, canvas.height - 120);
    ctx.fillText("▶", canvas.width - 120, canvas.height - 120);

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '26px Arial';
    ctx.fillText("Use arrows to navigate", canvas.width / 2, canvas.height - 100);
}

// function drawGuidePage(ctx, canvas, page) {
//     ctx.clearRect(0, 0, canvas.width, canvas.height);

//     ctx.fillStyle = '#111111';
//     ctx.fillRect(0, 0, canvas.width, canvas.height);

//     // Only draw the video border on Page 3
//     if (page === 2) {
//         ctx.strokeStyle = '#ffff00'; // Yellow border for Page 3
//         ctx.lineWidth = 5;
//         ctx.strokeRect(80, 50, canvas.width - 160, 420);
//     }

//     ctx.fillStyle = '#ffffff';
//     ctx.font = 'bold 45px Arial';
//     ctx.textAlign = 'center';
//     ctx.fillText('VR Controls Guide', canvas.width / 2, 520);

//     ctx.font = '38px Arial';
//     ctx.textAlign = 'left';

//     const start = page * ITEMS_PER_PAGE;
//     const end = Math.min(start + ITEMS_PER_PAGE, GUIDE_ITEMS.length);

//     let y = 600;
//     for (let i = start; i < end; i++) {
//         ctx.fillText("• " + GUIDE_ITEMS[i].text, 100, y);
//         y += 85;
//     }

//     ctx.fillStyle = '#aaaaaa';
//     ctx.font = '28px Arial';
//     ctx.textAlign = 'center';
//     ctx.fillText(
//         `Page ${page + 1} / ${totalPages}`,
//         canvas.width / 2,
//         canvas.height - 60
//     );


//     // -------------------------
//     // NAV ARROWS
//     // -------------------------
//     ctx.fillStyle = '#ffffff';
//     ctx.font = 'bold 70px Arial';
//     ctx.textAlign = 'center';

//     // LEFT arrow
//     ctx.fillText("◀", 120, canvas.height - 120);

//     // RIGHT arrow
//     ctx.fillText("▶", canvas.width - 120, canvas.height - 120);
// }

export function nextGuidePage(panel) {
    currentPage = (currentPage + 1) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
    // updateVideoState(panel); // Sync video visibility
}

export function prevGuidePage(panel) {
    currentPage = (currentPage - 1 + totalPages) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
    // updateVideoState(panel); // Sync video visibility
}


function switchToQuestions() {
    guideMode = "QUESTIONS";
    questPanel.group.visible = true;
}

function switchToGuide() {
    guideMode = "GUIDE";
    questPanel.group.visible = false;
}

function createArrowHitbox(x, y, width = 0.2, height = 0.2, onClick) {
    const mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(width, height),
        new THREE.MeshBasicMaterial({
            transparent: true,
            opacity: 0 // 🔥 invisible
        })
    );

    mesh.position.set(x, y, 0.05); // slightly in front
    mesh.name = "capsuleHitbox";

    mesh.userData = {
        interactive: true,
        onClick,
        target: mesh // required by your hover system
    };

    return mesh;
}