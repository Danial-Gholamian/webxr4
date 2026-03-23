import * as THREE from 'three';

export const gridGeo = new THREE.PlaneGeometry(1000, 1000);
gridGeo.rotateX(-Math.PI / 2);


export const gridMaterial = new THREE.ShaderMaterial({
  side: THREE.DoubleSide,
  transparent: true,
  uniforms: {
    // uColor: { value: new THREE.Color(0x2f3b4e) },
    uColor: { value: new THREE.Color(0x3f6f9f) },
    uScale: { value: 1.0 },
    uFade: { value: 0.0006 }
  },
  vertexShader: `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `,
  fragmentShader: `
    varying vec3 vWorldPosition;
    uniform vec3 uColor;
    uniform float uScale;
    uniform float uFade;

    float grid(vec2 coord) {
      vec2 grid = abs(fract(coord - 0.5) - 0.5) / fwidth(coord);
      float line = min(grid.x, grid.y);
      return 1.0 - min(line, 1.0);
    }

    void main() {
      float g = grid(vWorldPosition.xz * uScale);
      float dist = length(vWorldPosition.xz);
      float fade = exp(-dist * uFade);
      gl_FragColor = vec4(uColor, g * fade * 0.25);
      float visibility = max(g * fade, 0.08);
      gl_FragColor = vec4(uColor, visibility * 0.35);
    }
  `
});

gridMaterial.depthWrite = false;
gridMaterial.depthTest = true;

export function createSky() {
  const geometry = new THREE.SphereGeometry(500, 32, 32);

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
      topColor: { value: new THREE.Color(0x2e5a88) },   // soft blue
      bottomColor: { value: new THREE.Color(0x1c3552) }, // deep blue, not black
      exponent: { value: 0.8 }
    },
    depthWrite: false,
    depthTest: false,
    vertexShader: `
      varying vec3 vWorldPosition;
      void main() {
        vec4 worldPosition = modelMatrix * vec4(position, 1.0);
        vWorldPosition = worldPosition.xyz;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 topColor;
      uniform vec3 bottomColor;
      uniform float exponent;
      varying vec3 vWorldPosition;

      void main() {

        vec3 viewDir = normalize(vWorldPosition - cameraPosition);

        // Y direction
        float h = viewDir.y;

        // Remap [-1,1] → [0,1]
        float t = h * 0.5 + 0.5;

        // smooth floor instead of hard clamp
        t = mix(0.08, t, smoothstep(0.0, 0.2, t));

        // KEY: create a horizon lift
        float horizon = smoothstep(0.0, 0.4, t);

        // Blend two gradients
        float gradient = mix(
          t * 0.5 + 0.25,   // compress bottom (avoid flat dark)
          t,                // normal gradient
          horizon
        );

        // Optional smoothing
        gradient = pow(gradient, exponent);

        gl_FragColor = vec4(mix(bottomColor, topColor, gradient), 1.0);
      }
    `
  });


  return new THREE.Mesh(geometry, material);
}

export function keepUserNearGraph() {
  const center = graphRoot.position;
  const pos = cameraGroup.position;

  const maxRadius = 120;   // how far user can go
  const softZone = 80;     // where push starts

  const offset = new THREE.Vector3().subVectors(pos, center);
  const dist = offset.length();

  if (dist > 150) {
    graphRoot.position.lerp(cameraGroup.position, 0.02);
  }

  if (dist > softZone) {
    const excess = dist - softZone;

    // smooth push strength
    const strength = Math.min(excess / (maxRadius - softZone), 1);

    offset.normalize();

    // gently pull back
    pos.addScaledVector(offset, -strength * 0.5);
  } else {
    gridMaterial.uniforms.uColor.value.set(0x2a4f7a);
  }
}
