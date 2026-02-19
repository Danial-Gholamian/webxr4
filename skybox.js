import * as THREE from 'three';

export const gridGeo = new THREE.PlaneGeometry(1000, 1000);
gridGeo.rotateX(-Math.PI / 2);


export const gridMaterial = new THREE.ShaderMaterial({
    side: THREE.DoubleSide,
    transparent: true,
    uniforms: {
        uColor: { value: new THREE.Color(0x2f3b4e) },
        uScale: { value: 1.0 },
        uFade: { value: 0.002 }
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
    }
  `
});

gridMaterial.depthWrite = false;
gridMaterial.depthTest = true; 


export const skyGeo = new THREE.SphereGeometry(500, 32, 32);
export const skyMat = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    uniforms: {
        topColor: new THREE.Color(0x2a3648),
        bottomColor: new THREE.Color(0x182230)
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
    uniform vec3 topColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;
    void main() {
      float h = normalize(vWorldPosition).y * 0.5 + 0.5;
      gl_FragColor = vec4(mix(bottomColor, topColor, h), 1.0);
    }
  `
});


