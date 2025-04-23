# WebXR4 – Interactive 3D Force Graph in VR

This project integrates a 3D force-directed graph into a custom WebXR + THREE.js scene. It builds upon a previous VR pendulum setup (`vrSetup.js`) and transitions to using the `3d-force-graph` library for a more dynamic, interactive visualization.

## Features

-  Force-directed graph visualization (with node groups, links, and labels)
-  Mouse interaction (hover, click, drag nodes)
-  Clickable nodes that open external pages
-  VR-ready structure using THREE.js + WebXR
-  Future support planned: controller-based grabbing + movement in VR

## Tech Stack

- [THREE.js](https://threejs.org/)
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph)
- [WebXR](https://immersive-web.github.io/webxr/)
- [VRButton.js](https://threejs.org/docs/#examples/en/webxr/VRButton)

## Setup & Usage

### 1. Clone the repo

```
git clone https://github.com/YOUR_USERNAME/webxr4.git
cd webxr4
```

### 2. Install dependencies (if you're using a bundler like Vite or Webpack)

```
npm install
```

If you're using vanilla JS + modules (e.g., in `vite`), make sure the following packages are installed:

```
npm install three 3d-force-graph
```

### 3. Run the project

If using Vite:

```
npx vite
```

Or open `index.html` directly in a local server (e.g. with Live Server in VS Code).

### 4. VR Mode

Click the **"Enter VR"** button (enabled via `VRButton.js`) to enter WebXR mode using a compatible headset like Meta Quest 2.

## File Structure

```
webxr4/
├── index.html
├── main.js            # Entry point for rendering and interaction
├── vrSetup.js         # Sets up the VR scene (camera, lights, renderer, controllers)
├── graphData.js       # Contains node/link data for the 3D graph
├── README.md
└── package.json       # (if using npm)
```

---

## Todo (Coming Next)

- [ ] Controller-based node grabbing in VR
- [ ] Visual feedback when hovering/selecting nodes in VR
- [ ] Expand graph data from static to dynamic
- [ ] Add physics-based animation when dragging in VR

---

## Credits

- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) by @vasturiano
- [THREE.js](https://threejs.org/) for the rendering engine

## Build & Deploy (e.g. GitHub Pages)

If you're using a bundler like Vite, you can build and deploy the project like this:

### Build

```
npm run build
```

This will output the production-ready files to the `dist/` folder (or `docs/` if configured in `vite.config.js`).

### Deploy to GitHub Pages (using `docs/` folder)

If your repo is set up to serve GitHub Pages from the `docs/` folder:

1. Copy the build output to `docs/`:
    ```
    cp -r dist docs
    ```

2. Add and commit the `docs` folder forcefully:
    ```
    git add docs -f
    git commit -m "Deploy build to GitHub Pages"
    git push
    ```

### GitHub Settings

Make sure to go to your GitHub repo → Settings → Pages, and set the **Source** to:
```
Branch: main / Folder: /docs
```

Then your site will be live at:
```
https://your-username.github.io/webxr4/
```

