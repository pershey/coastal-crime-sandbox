// The sky dome, the sun and its shadows, drifting clouds and the day-night cycle. One clock
// (hours, 0 to 24) drives the sky colours, the light, the fog, the lit windows and the street lamps.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';
import { createRandom } from '../core/seededRandom.js';
import { clamp, lerp } from '../core/mathUtil.js';
import { CITY } from './cityLayout.js';

/** Colour keys through the day. Hours between two keys blend. */
const SKY_KEYS = [
  { hour: 0, zenith: 0x070b24, horizon: 0x24306a, sun: 0x8fa2ff, light: 0.55, ambient: 0.85, fog: 0x18214a, night: 1 },
  { hour: 5, zenith: 0x0d1638, horizon: 0x3a3566, sun: 0x9fb0ff, light: 0.55, ambient: 0.85, fog: 0x232a52, night: 1 },
  { hour: 6.5, zenith: 0x4a78c8, horizon: 0xffb08a, sun: 0xffc48a, light: 1.5, ambient: 0.7, fog: 0xf2c2a8, night: 0.2 },
  { hour: 9, zenith: 0x2f8fe6, horizon: 0xbfe9ff, sun: 0xfff2d6, light: 2.6, ambient: 1, fog: 0xc6ebff, night: 0 },
  { hour: 15, zenith: 0x2a86e0, horizon: 0xc8ecff, sun: 0xfff0cf, light: 2.7, ambient: 1, fog: 0xcbeeff, night: 0 },
  { hour: 18, zenith: 0x4a6fd0, horizon: 0xffb27a, sun: 0xffb070, light: 2.1, ambient: 0.8, fog: 0xffc9a0, night: 0.1 },
  { hour: 19.5, zenith: 0x2c2f7a, horizon: 0xff7a6a, sun: 0xff8a6a, light: 0.9, ambient: 0.6, fog: 0xc98aa0, night: 0.7 },
  { hour: 21, zenith: 0x0a1030, horizon: 0x3a2f7a, sun: 0x9aa8ff, light: 0.6, ambient: 0.9, fog: 0x1f2656, night: 1 },
  { hour: 24, zenith: 0x070b24, horizon: 0x24306a, sun: 0x8fa2ff, light: 0.55, ambient: 0.85, fog: 0x18214a, night: 1 },
];

const skyVertexShader = /* glsl */ `
  varying vec3 vDirection;
  void main() {
    vDirection = normalize(position);
    vec4 view = modelViewMatrix * vec4(position, 1.0);
    gl_Position = projectionMatrix * view;
    gl_Position.z = gl_Position.w;
  }
`;

const skyFragmentShader = /* glsl */ `
  uniform vec3 uZenith;
  uniform vec3 uHorizon;
  uniform vec3 uSunColor;
  uniform vec3 uSunDirection;
  uniform float uNight;
  varying vec3 vDirection;
  float hash(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
  void main() {
    vec3 dir = normalize(vDirection);
    float up = clamp(dir.y, 0.0, 1.0);
    vec3 color = mix(uHorizon, uZenith, pow(up, 0.55));
    float toSun = max(dot(dir, uSunDirection), 0.0);
    color += uSunColor * (pow(toSun, 900.0) * 6.0 + pow(toSun, 24.0) * 0.28 + pow(toSun, 4.0) * 0.08);
    vec3 cell = floor(dir * 420.0);
    float star = step(0.9984, hash(cell)) * uNight * smoothstep(0.02, 0.3, dir.y);
    color += vec3(star);
    gl_FragColor = vec4(color, 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildClouds(scene, seed) {
  const random = createRandom(seed + 2718);
  const clouds = new MeshBuilder();
  for (let k = 0; k < 34; k += 1) {
    const x = random.range(-1800, 2400), z = random.range(-1800, 2400), y = random.range(260, 420);
    const puffs = random.int(3, 6);
    for (let p = 0; p < puffs; p += 1) {
      const w = random.range(60, 140);
      clouds.prism(x + p * random.range(40, 70), y + random.range(-8, 8), z + random.range(-30, 30), w, random.range(18, 34), w * 0.7, 0xffffff, {
        topX: w * 0.55, topZ: w * 0.4, bottom: true,
      });
    }
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, fog: false, emissive: 0xffffff, emissiveIntensity: 0.35 });
  const mesh = clouds.toMesh(material, { castShadow: false, receiveShadow: false });
  scene.add(mesh);
  return { mesh, material };
}

export function createSkyAndDaylight(scene, renderer, seed) {
  const skyUniforms = {
    uZenith: { value: new THREE.Color() },
    uHorizon: { value: new THREE.Color() },
    uSunColor: { value: new THREE.Color() },
    uSunDirection: { value: new THREE.Vector3(0, 1, 0) },
    uNight: { value: 0 },
  };
  const dome = new THREE.Mesh(
    new THREE.SphereGeometry(900, 24, 12),
    new THREE.ShaderMaterial({ uniforms: skyUniforms, vertexShader: skyVertexShader, fragmentShader: skyFragmentShader, side: THREE.BackSide, depthWrite: false, fog: false }),
  );
  dome.frustumCulled = false;
  dome.renderOrder = -10;
  scene.add(dome);

  const sun = new THREE.DirectionalLight(0xffffff, 2.5);
  sun.castShadow = true;
  sun.shadow.mapSize.set(2048, 2048);
  sun.shadow.camera.left = -120;
  sun.shadow.camera.right = 120;
  sun.shadow.camera.top = 120;
  sun.shadow.camera.bottom = -120;
  sun.shadow.camera.near = 50;
  sun.shadow.camera.far = 900;
  sun.shadow.bias = -0.0006;
  sun.shadow.normalBias = 0.6;
  scene.add(sun, sun.target);
  const ambient = new THREE.HemisphereLight(0xcfeaff, 0xcaa77a, 1);
  scene.add(ambient);
  scene.fog = new THREE.FogExp2(0xc6ebff, 0.00105);
  const clouds = buildClouds(scene, seed);

  const state = { hour: 14, night: 0, sunDirection: new THREE.Vector3(0, 1, 0) };
  const a = new THREE.Color(), b = new THREE.Color();
  const blend = (target, keyA, keyB, name, t) => target.copy(a.setHex(keyA[name])).lerp(b.setHex(keyB[name]), t);

  /** Set the clock (hours) and recolour the whole scene for it. */
  function setHour(hour) {
    state.hour = ((hour % 24) + 24) % 24;
    let index = 0;
    while (index < SKY_KEYS.length - 2 && SKY_KEYS[index + 1].hour <= state.hour) index += 1;
    const from = SKY_KEYS[index], to = SKY_KEYS[index + 1];
    const t = clamp((state.hour - from.hour) / (to.hour - from.hour), 0, 1);
    blend(skyUniforms.uZenith.value, from, to, 'zenith', t);
    blend(skyUniforms.uHorizon.value, from, to, 'horizon', t);
    blend(skyUniforms.uSunColor.value, from, to, 'sun', t);
    blend(sun.color, from, to, 'sun', t);
    blend(scene.fog.color, from, to, 'fog', t);
    sun.intensity = lerp(from.light, to.light, t);
    ambient.intensity = lerp(from.ambient, to.ambient, t) * 1.15;
    ambient.color.copy(skyUniforms.uHorizon.value).lerp(a.setHex(0xffffff), 0.35);
    state.night = lerp(from.night, to.night, t);
    skyUniforms.uNight.value = state.night;
    clouds.material.emissiveIntensity = lerp(0.35, 0.05, state.night);
    // The sun climbs over the hills in the morning and sets over the sea; at night the moon takes its arc.
    const dayPart = state.hour >= 6 && state.hour <= 20 ? (state.hour - 6) / 14 : ((state.hour + 4) % 24) / 10;
    const arc = dayPart * Math.PI;
    const elevation = Math.max(0.22, Math.sin(arc) * 0.95);
    state.sunDirection.set(Math.cos(arc) * 0.75, elevation, 0.42 + Math.sin(arc) * 0.25).normalize();
    skyUniforms.uSunDirection.value.copy(state.sunDirection);
  }

  /** Keep the shadow map and the sky centred on what the camera looks at. */
  function follow(focus, cameraPosition) {
    sun.target.position.set(focus.x, 0, focus.z);
    sun.position.copy(sun.target.position).addScaledVector(state.sunDirection, 420);
    dome.position.copy(cameraPosition);
    clouds.mesh.position.x = (state.hour * 40) % 400;
  }

  setHour(state.hour);
  return { state, setHour, follow, sun, fog: scene.fog };
}

/** How strongly windows, signs and lamps should glow for a given night factor (0 day, 1 night). */
export function nightGlow(night) {
  return clamp((night - 0.25) / 0.5, 0, 1);
}
