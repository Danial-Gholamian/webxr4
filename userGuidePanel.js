import * as THREE from 'three';

// The user guide panel with the help instructions
export function createUserGuidePanel() {
    const group = new THREE.Group();
    group.name = "UserGuidePanel";

    const bgGeo = new THREE.PlaneGeometry(0.9, 0.8);
    const bgMat = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0.92
    });
    const bg = new THREE.Mesh(bgGeo, bgMat);
    group.add(bg);

    // ---- Canvas Text ----
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 1024;
    const ctx = canvas.getContext("2d");

    ctx.fillStyle = "#ffffff";
    ctx.font = "48px Arial";
    ctx.fillText("🎮 USER GUIDE", 40, 80);

    const lines = [
        "JUST FOR NOW... WILL CHANGE GUIDE TEXT AND ADD IMAGES LATER",
        "Trigger → Select Node",
        "Grip (Squeeze) → Rotate Graph",
        "Left Stick → Rotate View",
        "Right Stick → Move",
        "A → Toggle Filter Panel",
        "B → Toggle Period Stack",
        "X → Reset Graph",
        "",
        "Point at ? icon anytime to reopen this guide"
    ];

    lines.forEach((line, i) => {
        ctx.fillText(line, 60, 160 + i * 75);
    });

    const texture = new THREE.CanvasTexture(canvas);
    const textMat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true
    });

    const textPlane = new THREE.Mesh(bgGeo, textMat);
    textPlane.position.z = 0.001;
    group.add(textPlane);


    group.visible = false;
    group.position.set(0, 1.5, -1.5); // 60cm in front of eyes
    // group.scale.set(2, 2, 2); // bigger so readable

    console.log("--------------- CREATED USER HELP GUIDE PANEL ---------------")
    return group;
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