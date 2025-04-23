import * as THREE from 'three';

const intersected = [];
const raycaster = new THREE.Raycaster();
const tempMatrix = new THREE.Matrix4();

export function setupInteractiveGroup(pendulums) {
  const group = new THREE.Group();
  pendulums.forEach(p => group.add(p.pivot));
  return group;
}

export function detectHover(controller, group) {
  if (controller.userData.selected) return;

  const handedness = controller.userData.handedness || "unknown";

  // Clear previous highlights, unless being held
  while (intersected.length) {
    const obj = intersected.pop();
    if (!obj.userData.isBeingHeld && obj.material?.emissive) {
      obj.material.emissive.setRGB(0, 0, 0);
      delete obj.userData.isHovered;
    }
  }

  // Ray from controller
  tempMatrix.identity().extractRotation(controller.matrixWorld);
  raycaster.ray.origin.setFromMatrixPosition(controller.matrixWorld);
  raycaster.ray.direction.set(0, 0, -1).applyMatrix4(tempMatrix);
  raycaster.far = 10;

  const intersections = raycaster.intersectObjects(group.children, true);
  const line = controller.userData.laser;

  if (intersections.length > 0) {
    const hit = intersections[0].object;

    // Skip hover effects if being held
    if (hit.userData.isBeingHeld) {
      controller.userData.hoveredObject = null;
      if (line) line.scale.z = intersections[0].distance;
      return;
    }

    if (hit instanceof THREE.Mesh) {
      hit.userData.isHovered = true;
      controller.userData.hoveredObject = hit;
      intersected.push(hit);

      const inputSource = controller.userData.inputSource;
      const actuator = inputSource?.gamepad?.hapticActuators?.[0];
      if (actuator?.pulse) actuator.pulse(1.0, 100);
    }

    if (line) line.scale.z = intersections[0].distance;
  } else {
    // No intersection
    controller.userData.hoveredObject = null;
    if (line) line.scale.z = 10;
  }
}