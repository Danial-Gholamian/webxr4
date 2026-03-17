// userGuidePanel.js 

import * as THREE from 'three';

const ITEMS_PER_PAGE = 4;
const GUIDE_ITEMS = [
  {
    text: "Right Stick → Move"
  },
  {
    text: "Left Stick → Rotate View"
  },
  {
    text: "Grip (Squeeze) → Rotate Graph"
  },
  {
    text: "Trigger → Select nodes, groups, hierarchy, or time"
  },
  {
    text: "Right Stick Press → Next Time Snapshot"
  },
  {
    text: "Left Stick Press → Previous Time Snapshot"
  },
  {
    text: "A → Toggle Filter Panel (select groups)"
  },
  {
    text: "Y → Toggle Drill-Down Panel (zoom in / out of dataset)"
  },
  {
    text: "X → Reset Graph to Default View (full aggregation)"
  },
  {
    text: "B → Toggle User Guide Panel"
  }
];

let currentPage = 0;
let totalPages = Math.ceil(GUIDE_ITEMS.length / ITEMS_PER_PAGE);


// The user guide panel with the help instructions
export function createUserGuidePanel() {
    const group = new THREE.Group();
    group.name = "UserGuidePanel";

    // --- Canvas Setup ---
    const canvasWidth = 1024;
    const rowHeight = 80;
    const titleHeight = 120;
    const footerHeight = 60;
    const totalHeight = titleHeight + ITEMS_PER_PAGE * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Background ---
    ctx.fillStyle = 'rgba(17, 17, 17, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    drawGuidePage(ctx, canvas, currentPage);

    // // --- Draw Title ---
    // ctx.fillStyle = '#ffffff';
    // ctx.font = 'bold 60px Arial';
    // ctx.textAlign = 'center';
    // ctx.textBaseline = 'top';
    // ctx.fillText('VR Controls Guide', canvas.width / 2, 20);

    // // --- Draw Items ---
    // ctx.font = '48px Arial';
    // ctx.textAlign = 'left';
    // ctx.fillStyle = '#ffffff';

    // let y = titleHeight;
    // for (const item of GUIDE_ITEMS) {
    //     ctx.fillText(item.text, 40, y);
    //     y += rowHeight;
    // }

    // // --- Draw Footer ---
    // ctx.fillStyle = '#aaaaaa';
    // ctx.font = '36px Arial';
    // ctx.textAlign = 'center';
    // ctx.fillText('Press Y anytime to reopen this guide', canvas.width / 2, totalHeight - footerHeight + 10);

    // --- Texture & Mesh ---
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

    group.userData.canvas = canvas;
    group.userData.ctx = ctx;
    group.userData.texture = texture;

    const aspect = canvas.width / canvas.height;
    const panelHeight = 0.9;        // world units
    const panelWidth = panelHeight * aspect;

    const planeGeo = new THREE.PlaneGeometry(panelWidth, panelHeight);
    const planeMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        depthTest: false
    });

    const panelMesh = new THREE.Mesh(planeGeo, planeMat);
    group.add(panelMesh);

    group.visible = false;
    group.position.set(0, 1.5, -1.5); // 60cm in front of eyes
    // group.scale.set(2, 2, 2); // bigger so readable

    console.log("--------------- CREATED USER HELP GUIDE PANEL ---------------")
    return group;
}

// Use a modular function to draw each paginated panel
function drawGuidePage(ctx, canvas, page) {

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Background
    ctx.fillStyle = 'rgba(17, 17, 17, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Title
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 50px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('VR Controls Guide', canvas.width / 2, 20);

    ctx.font = '40px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';

    const start = page * ITEMS_PER_PAGE;
    const end = Math.min(start + ITEMS_PER_PAGE, GUIDE_ITEMS.length);

    let y = 120;

    for (let i = start; i < end; i++) {
        ctx.fillText(GUIDE_ITEMS[i].text, 40, y);
        y += 80;
    }

    // Footer
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '30px Arial';
    ctx.textAlign = 'center';

    ctx.fillText(
        `Page ${page + 1} / ${totalPages}  —  Use ← → to navigate and B to toggle the help panel`,
        canvas.width / 2,
        canvas.height - 40
    );
}

export function nextGuidePage(panel) {
    currentPage = (currentPage + 1) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
}

export function prevGuidePage(panel) {
    currentPage = (currentPage - 1 + totalPages) % totalPages;
    const { canvas, ctx, texture } = panel.userData;
    drawGuidePage(ctx, canvas, currentPage);
    texture.needsUpdate = true;
}

function createImagePlane(url, width = 0.25, height = 0.25) {
    const texture = new THREE.TextureLoader().load(url);
    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });

    const geo = new THREE.PlaneGeometry(width, height);
    return new THREE.Mesh(geo, mat);
}
