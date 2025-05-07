# WebXR4 – Interactive 3D Force Graph in VR

This project integrates a 3D force-directed graph into a custom WebXR + THREE.js scene. It uses the `3d-force-graph` library to enable dynamic, interactive node-link visualizations that can be experienced in immersive VR.

## Features

- Force-directed graph visualization with node groups, links, and labels
- Mouse interaction: hover, click, and drag nodes
- Clickable nodes that can trigger subgraph highlighting or navigation
- VR-ready scene with controller-based interactions, built using THREE.js + WebXR
- Optional UI panel to filter by group (visible in VR)
- Future support planned: controller-based node grabbing and physics interaction

## Tech Stack

- [THREE.js](https://threejs.org/)
- [3d-force-graph](https://github.com/vasturiano/3d-force-graph)
- [WebXR](https://immersive-web.github.io/webxr/)
- [D3.js](https://d3js.org/)

## Setup & Usage

### 1. Clone the repo

```bash
git clone https://github.com/Danial-Gholamian/webxr4.git
cd webxr4
```

### 2. Install dependencies (if you're using a bundler like Vite or Webpack)

```bash
npm install
```

If you're using vanilla JS + modules (e.g., with Vite), make sure the following packages are installed:

```bash
npm install three 3d-force-graph
```

### 3. Run the project (Vite dev server)

```bash
npx vite
```

Or open `index.html` directly in a local dev server (e.g., using Live Server in VS Code).

### 4. Enter VR Mode

Click the **"Enter VR"** button (enabled via `VRButton.js`) when using a compatible headset like **Meta Quest 2/3**.

## File Structure

```
webxr4/
├── index.html                # Main HTML file
├── main.js                   # Entry point: initializes scene, renderer, graph, and VR loop
├── vrSetup.js                # Sets up controllers, teleport, joystick movement, selection, haptics
├── graph-data.js             # Static graph data (nodes + links)
├── graphData.js              # (Possibly older or alternate dataset)
├── filterUIPanel.js          # 3D VR panel for filtering nodes by group
├── hover.js                  # Hover detection logic for desktop and VR
├── student.dat               # Raw data for graph generation
├── primarySchool.dat         # Another input dataset
├── vite.config.js            # Vite config for dev/build
├── package.json              # NPM config with dependencies
├── package-lock.json         # Locked versions of installed packages
├── node_modules/             # Installed dependencies
├── docs/                     # GitHub Pages build output
├── README.md
└── static-pages/             # Additional static HTML content
```

## Todo (Coming Next)

- [ ] Controller-based node grabbing in VR
- [ ] Highlight links and nodes when hovering in VR
- [ ] Support dynamic graph updates from external data
- [ ] Add animations or physics on drag events

## Credits

- [3d-force-graph](https://github.com/vasturiano/3d-force-graph) by @vasturiano
- [THREE.js](https://threejs.org/)
- [WebXR](https://immersive-web.github.io/webxr/)

## Build & Deploy (e.g., GitHub Pages)

### Build

```bash
npm run build
```

This will output the production-ready files to the `dist/` folder.

### Deploy to GitHub Pages (using `docs/` folder)

If your repo is set up to serve GitHub Pages from the `docs/` folder:

1. Copy the build output to `docs/`:

```bash
cp -r dist docs
```

2. Add and commit the `docs` folder forcefully:

```bash
git add docs -f
git commit -m "Deploy build to GitHub Pages"
git push
```

### GitHub Settings

Go to your GitHub repo → **Settings** → **Pages**, and set the **Source** to:

```
Branch: main / Folder: /docs
```

Then your site will be live at:

```
https://your-username.github.io/webxr4(or any other project name)/
```



<!-- A label must be readable in front of me, instead of far away inside the node. -->
