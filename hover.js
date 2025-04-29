// hover.js
import * as THREE from 'three';

const intersected = []; // Keep track of currently hovered
const tempMatrix = new THREE.Matrix4();
const raycaster = new THREE.Raycaster(); // Reuse raycaster

// Store node meshes temporarily to avoid traversing every frame if scene doesn't change structurally
// This is a simple cache; more robust caching might be needed if nodes are added/removed.
let nodeMeshesCache = [];
let cacheNeedsUpdate = true;

export function markHoverCacheDirty() {
  cacheNeedsUpdate = true;
}

// Modified detectHover
export function detectHover(controller, graphScene) {
  // --- 1. Clear previous hover state ---
  while (intersected.length) {
    const obj = intersected.pop();
    // Check if material exists and has emissive property
    if (obj.material?.emissive) {
        obj.material.emissive.setRGB(0, 0, 0); // Reset emissive color
    }
     if (obj.userData) {
        delete obj.userData.isHovered; // Remove hovered flag
     }
  }
  controller.userData.hoveredObject = null; // Clear controller's hovered object reference

  // --- 2. Raycasting Setup ---
  if (!controller || !graphScene) return; // Guard clause

  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 10; // Max distance for hover detection

  // --- 3. Get Target Objects (Graph Nodes) ---
  // Basic caching: Re-traverse only if graph data changed significantly
  if (cacheNeedsUpdate) {
    nodeMeshesCache = [];
    graphScene.traverse(obj => {
      // Check if it's a mesh AND has node data associated by the library
      if (obj instanceof THREE.Mesh && obj.__data && obj.__data.id !== undefined) {
        nodeMeshesCache.push(obj);
      }
    });
    cacheNeedsUpdate = false; // Reset flag until next graph update
     console.log(`Updated node mesh cache: ${nodeMeshesCache.length} nodes found.`);
  }

   if (nodeMeshesCache.length === 0) {
       // console.warn("detectHover: No node meshes found in cache to intersect with.");
       return; // Nothing to intersect
   }


  // --- 4. Perform Intersection ---
  // Intersect specifically with the cached node meshes, non-recursively
  const intersections = raycaster.intersectObjects(nodeMeshesCache, false);
  const line = controller.userData.laser; // Get the laser line associated with the controller

  // --- 5. Handle Intersections ---
  if (intersections.length > 0) {
    // Hit detected
    const intersection = intersections[0]; // Closest hit
    const hitObject = intersection.object;

    // Set laser length to hit distance
    if (line) line.scale.z = intersection.distance;

    // Check if it's a mesh (it should be based on our collection logic)
    if (hitObject instanceof THREE.Mesh) {
      hitObject.userData.isHovered = true; // Mark object as hovered
      controller.userData.hoveredObject = hitObject; // Store reference on controller
      intersected.push(hitObject); // Add to list for highlighting/cleanup

      // --- Visual Feedback (Example: Emissive color) ---
      if (hitObject.material?.emissive) {
          hitObject.material.emissive.setHex(0xff0000); // Highlight the object
      }


      // --- Haptic Feedback ---
      try {
        const inputSource = controller.userData.inputSource;
        if (inputSource && inputSource.gamepad && Array.isArray(inputSource.gamepad.hapticActuators) && inputSource.gamepad.hapticActuators.length > 0) {
          const actuator = inputSource.gamepad.hapticActuators[0];
           if (actuator && typeof actuator.pulse === 'function') {
             actuator.pulse(0.8, 50); // Short, strong pulse (Intensity 0.0-1.0, Duration ms)
           } else {
             console.warn("Haptic actuator found, but pulse method is missing or not a function.");
           }
        } else {
           console.warn("No valid haptic actuators found for this controller.");
        }
      } catch (error) {
        console.error("Error during haptic feedback:", error);
      }
    }

  } else {
    // No hit
    if (line) line.scale.z = raycaster.far; // Reset laser to max length
    controller.userData.hoveredObject = null;
  }
}

// Removed setupInteractiveGroup as it wasn't used for the graph