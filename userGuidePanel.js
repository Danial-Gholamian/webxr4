import * as THREE from 'three';

const ITEMS_PER_PAGE = 4;
const GUIDE_ITEMS = [
  { text: "Right Stick → Move" },
  { text: "Left Stick → Rotate View" },
  { text: "Grip (Squeeze) → Rotate Graph" },
  { text: "Trigger → Select nodes, groups, hierarchy, or time" },
  { text: "Right Stick Press → Next Time Snapshot" },
  { text: "Left Stick Press → Previous Time Snapshot" },
  { text: "A → Toggle Filter Panel (select groups)" },
  { text: "Y → Toggle Drill-Down Panel (zoom in / out of dataset)" },
  { text: "X → Reset Graph to Default View (full aggregation)" },
  { text: "B → Toggle User Guide Panel" }
];

let currentPage = 0;
let totalPages = Math.ceil(GUIDE_ITEMS.length / ITEMS_PER_PAGE);

export function createUserGuidePanel() {
    const group = new THREE.Group();
    group.name = "UserGuidePanel";

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
    const textPlane = new THREE.Mesh(
        new THREE.PlaneGeometry(panelHeight * (canvasWidth/canvasHeight), panelHeight),
        new THREE.MeshBasicMaterial({ 
            map: textTexture, 
            transparent: true, 
            depthTest: false 
        })
    );

    textPlane.renderOrder = 99; 
    group.add(textPlane);

    // --- Storage & Callbacks ---
    group.userData.video = video;
    group.userData.videoMesh = videoMesh; // Store mesh reference
    group.userData.canvas = canvas;
    group.userData.ctx = ctx;
    group.userData.texture = textTexture;

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
    group.position.set(0, 1.5, -1.5);

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
    
    ctx.fillStyle = 'rgba(17, 17, 17, 0.95)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Only draw the video border on Page 3
    if (page === 2) {
        ctx.strokeStyle = '#ffff00'; // Yellow border for Page 3
        ctx.lineWidth = 5;
        ctx.strokeRect(80, 50, canvas.width - 160, 420); 
    }

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 45px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('VR Controls Guide', canvas.width / 2, 520);

    ctx.font = '38px Arial';
    ctx.textAlign = 'left';

    const start = page * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, GUIDE_ITEMS.length);

    let y = 600; 
    for (let i = start; i < end; i++) {
        ctx.fillText("• " + GUIDE_ITEMS[i].text, 100, y);
        y += 85;
    }

    ctx.fillStyle = '#aaaaaa';
    ctx.font = '28px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(
        `Page ${page + 1} / ${totalPages}  —  Use Stick Click to flip`,
        canvas.width / 2,
        canvas.height - 60
    );
}

export function nextGuidePage(panel) {
    currentPage = (currentPage + 1) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
    updateVideoState(panel); // Sync video visibility
}

export function prevGuidePage(panel) {
    currentPage = (currentPage - 1 + totalPages) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
    updateVideoState(panel); // Sync video visibility
}