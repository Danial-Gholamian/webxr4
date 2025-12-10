import * as THREE from 'three';

const GUIDE_ITEMS = [
    {
        img: "/public/img/trigger.png",
        text: "Trigger → Select Node"
    },
    {
        img: "/public/img/grip.png",
        text: "Grip (Squeeze) → Rotate Graph"
    },
    {
        img: "/public/img/left-stick.png",
        text: "Left Stick → Rotate View"
    },
    {
        img: "/public/img/right-stick.png",
        text: "Right Stick → Move"
    },
    {
        img: "/public/img/a-button.png",
        text: "A → Toggle Filter Panel"
    },
    {
        img: "/public/img/b-button.png",
        text: "B → Toggle Period Stack"
    },
    {
        img: "/public/img/x-button.png",
        text: "X → Reset Graph"
    },
    {
        img: "/public/img/y-button.png",
        text: "Y → Toggle User Guide Panel"
    }
];

// The user guide panel with the help instructions
export function createUserGuidePanel() {
    const group = new THREE.Group();
    group.name = "UserGuidePanel";

    // --- Canvas Setup ---
    const canvasWidth = 1024;
    const rowHeight = 80;
    const titleHeight = 120;
    const footerHeight = 60;
    const totalHeight = titleHeight + GUIDE_ITEMS.length * rowHeight + footerHeight;

    const canvas = document.createElement('canvas');
    canvas.width = canvasWidth;
    canvas.height = totalHeight;

    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // --- Draw Background ---
    ctx.fillStyle = 'rgba(17, 17, 17, 0.92)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // --- Draw Title ---
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 60px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText('VR Controls Guide', canvas.width / 2, 20);

    // --- Draw Items ---
    ctx.font = '48px Arial';
    ctx.textAlign = 'left';
    ctx.fillStyle = '#ffffff';

    let y = titleHeight;
    for (const item of GUIDE_ITEMS) {
        ctx.fillText(item.text, 40, y);
        y += rowHeight;
    }

    // --- Draw Footer ---
    ctx.fillStyle = '#aaaaaa';
    ctx.font = '36px Arial';
    ctx.textAlign = 'center';
    ctx.fillText('Press Y anytime to reopen this guide', canvas.width / 2, totalHeight - footerHeight + 10);

    // --- Texture & Mesh ---
    const texture = new THREE.CanvasTexture(canvas);
    texture.needsUpdate = true;

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

function createImagePlane(url, width = 0.25, height = 0.25) {
    const texture = new THREE.TextureLoader().load(url);
    const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });

    const geo = new THREE.PlaneGeometry(width, height);
    return new THREE.Mesh(geo, mat);
}

// Creates the ? help icon that the user can click on to expand the
// user guide panel
export function createHelpIcon() {
    const group = new THREE.Group();
    group.name = "HelpIcon";

    const circleGeo = new THREE.CircleGeometry(0.06, 32);
    const mat = new THREE.MeshBasicMaterial({ color: 0x2266ff });
    const circle = new THREE.Mesh(circleGeo, mat);

    const canvas = document.createElement("canvas");
    canvas.width = 256;
    canvas.height = 256;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "white";
    ctx.font = "180px Arial";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("?", 128, 128);

    const tex = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({ map: tex, transparent: true });
    const textPlane = new THREE.Mesh(circleGeo, textMat);
    textPlane.position.z = 0.002;

    group.add(circle);
    group.add(textPlane);

    // makes it clickable with VR raycaster
    group.userData.interactive = false;
    group.userData.onClick = () => toggleUserGuide();

    // Float top-right of user view
    group.position.set(0, 1.8, -0.6);
    // group.scale.set(2, 2, 2); // bigger so readable


    console.log("--------------- CREATED USER HELP ICON ---------------")
    return group;
}