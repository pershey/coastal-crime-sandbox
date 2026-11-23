// The edges of the city: the beach with its umbrellas, the animated sea, the long pier and
// its boats at Pelican Marina, Port Calder's quay with gantry cranes and a cargo ship, and
// the hills behind the town.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';
import { createRandom } from '../core/seededRandom.js';
import { CITY } from './cityLayout.js';

const SAND = 0xf5e3b5;
const UMBRELLA_COLORS = [0xff5d73, 0x35c9f0, 0xffd23f, 0xff8c42, 0x9b5de5, 0x2ec4b6, 0xffffff];

const seaVertexShader = /* glsl */ `
  varying vec3 vWorld;
  void main() {
    vec4 world = modelMatrix * vec4(position, 1.0);
    vWorld = world.xyz;
    gl_Position = projectionMatrix * viewMatrix * world;
  }
`;

const seaFragmentShader = /* glsl */ `
  uniform float uTime;
  uniform float uShoreZ;
  uniform float uQuayX;
  uniform float uDaylight;
  uniform vec3 uFogColor;
  uniform float uFogDensity;
  varying vec3 vWorld;
  void main() {
    float fromShore = max(vWorld.z - uShoreZ, (uQuayX - vWorld.x) * 1.4);
    float depth = clamp(fromShore / 260.0, 0.0, 1.0);
    vec3 shallow = vec3(0.16, 0.82, 0.80);
    vec3 deep = vec3(0.02, 0.30, 0.58);
    vec3 color = mix(shallow, deep, pow(depth, 0.6));
    float swell = sin(vWorld.x * 0.07 + uTime * 0.7) * sin(vWorld.z * 0.09 - uTime * 0.5);
    float glint = pow(max(0.0, sin(vWorld.x * 0.83 + uTime * 1.9) * sin(vWorld.z * 1.21 - uTime * 1.6)), 10.0);
    color += swell * 0.035 + glint * 0.35;
    float surf = vWorld.z - uShoreZ - 2.0 - sin(uTime * 0.8 + vWorld.x * 0.06) * 1.6;
    float foam = smoothstep(2.4, 0.0, abs(surf)) * step(uQuayX, vWorld.x);
    color = mix(color, vec3(1.0), foam * 0.85);
    color *= mix(0.16, 1.0, uDaylight);
    float distanceToEye = length(vWorld - cameraPosition);
    float fog = 1.0 - exp(-uFogDensity * uFogDensity * distanceToEye * distanceToEye);
    gl_FragColor = vec4(mix(color, uFogColor, fog), 1.0);
    #include <tonemapping_fragment>
    #include <colorspace_fragment>
  }
`;

function buildSea(scene) {
  const uniforms = {
    uTime: { value: 0 },
    uShoreZ: { value: CITY.shoreZ },
    uQuayX: { value: CITY.quayX },
    uDaylight: { value: 1 },
    uFogColor: { value: new THREE.Color(0xbfe6ff) },
    uFogDensity: { value: 0.0012 },
  };
  const material = new THREE.ShaderMaterial({ uniforms, vertexShader: seaVertexShader, fragmentShader: seaFragmentShader });
  const south = new THREE.Mesh(new THREE.PlaneGeometry(7000, 3600), material);
  south.rotation.x = -Math.PI / 2;
  south.position.set(CITY.width / 2, -0.35, CITY.beachZ + 1800);
  const west = new THREE.Mesh(new THREE.PlaneGeometry(3400, 3600), material);
  west.rotation.x = -Math.PI / 2;
  west.position.set(CITY.quayX - 1700, -0.35, CITY.beachZ - 1800);
  scene.add(south, west);
  return uniforms;
}

function buildLand(scene, materials, collision) {
  const land = new MeshBuilder();
  const far = 2600;
  const h = CITY.roadHalf;
  // Scrub and grass behind the city, concrete on the quay, sand sloping into the water.
  land.ground(CITY.quayX, -far, far, -h - 4, -0.02, 0x86b862);
  land.ground(CITY.width + h + 4, -h - 4, far, CITY.beachZ, -0.02, 0x86b862);
  land.ground(CITY.quayX, -h - 4, -h, CITY.beachZ, 0, 0x9ea3a6);
  const slopeZ = CITY.shoreZ - 14;
  land.quad([CITY.quayX, 0.12, slopeZ], [far, 0.12, slopeZ], [far, 0.12, CITY.beachZ], [CITY.quayX, 0.12, CITY.beachZ], SAND);
  land.quad([CITY.quayX, -3, CITY.shoreZ + 60], [far, -3, CITY.shoreZ + 60], [far, 0.12, slopeZ], [CITY.quayX, 0.12, slopeZ], SAND);
  land.quad([CITY.quayX, -3, -far], [CITY.quayX, -3, CITY.beachZ + 120], [CITY.quayX, 0.12, CITY.beachZ + 120], [CITY.quayX, 0.12, -far], 0x7d8286);
  // Low sea wall between the promenade and the sand, with gaps to walk through.
  for (let x = -20; x < CITY.width + 20; x += 42) {
    land.box(x + 16, 0.2, CITY.beachZ - 0.3, 32, 0.7, 0.5, 0xfdf6e3);
    collision.addBox(x, CITY.beachZ - 0.55, x + 32, CITY.beachZ - 0.05, 0.9);
  }
  scene.add(land.toMesh(materials.plain, { castShadow: false }));
}

function buildBeachLife(scene, materials, seed) {
  const random = createRandom(seed + 909);
  const beach = new MeshBuilder();
  for (let k = 0; k < 70; k += 1) {
    const x = random.range(2 * CITY.pitch - 20, 7.4 * CITY.pitch), z = random.range(CITY.beachZ + 8, CITY.shoreZ - 16);
    const color = random.pick(UMBRELLA_COLORS);
    beach.cylinder(x, 0.1, z, 0.06, 0.06, 2.3, 5, 0xeeeeee, { noTop: true });
    beach.cylinder(x, 2.1, z, 1.9, 0.1, 0.7, 8, color);
    const lounger = random.pick([0xffffff, 0xfff2cc, color]);
    beach.box(x + 1.4, 0.12, z + 0.6, 0.7, 0.3, 1.9, lounger);
    if (random.chance(0.6)) beach.box(x - 1.4, 0.12, z + 0.6, 0.7, 0.3, 1.9, lounger);
    if (random.chance(0.4)) beach.ground(x + 2.6, z - 1.5, x + 3.6, z + 0.5, 0.16, random.pick(UMBRELLA_COLORS));
  }
  // Lifeguard towers every couple of blocks.
  for (let x = 2.5 * CITY.pitch; x < 7 * CITY.pitch; x += 2 * CITY.pitch) {
    const z = CITY.shoreZ - 20;
    for (const [lx, lz] of [[-1.2, -1.2], [1.2, -1.2], [-1.2, 1.2], [1.2, 1.2]]) beach.box(x + lx, 0.1, z + lz, 0.2, 2.6, 0.2, 0xfafafa);
    beach.box(x, 2.6, z, 3.2, 0.2, 3.2, 0xfafafa);
    beach.box(x, 2.8, z - 0.3, 2.6, 2, 2.2, 0xff5d73);
    beach.prism(x, 4.8, z - 0.3, 3.2, 0.8, 2.8, 0xffffff, { topX: 2.4, topZ: 1.6 });
  }
  scene.add(beach.toMesh(materials.plain));
}

function addBoat(b, x, z, length, color, heading) {
  const m = new THREE.Matrix4().makeRotationY(heading).setPosition(x, -0.2, z);
  b.setTransform(m);
  b.prism(0, 0, 0, length * 0.2, 1.3, length * 0.9, 0xffffff, { topX: length * 0.3, topZ: length });
  b.box(0, 1.3, 0, length * 0.3, 0.12, length, color);
  b.prism(0, 1.42, -length * 0.08, length * 0.22, 1.2, length * 0.36, 0xf7f7f7, { topX: length * 0.18, topZ: length * 0.26 });
  b.box(0, 1.42, -length * 0.08, length * 0.225, 0.6, length * 0.3, 0x263645);
  b.box(0, 2.62, -length * 0.08, 0.1, 2.2, 0.1, 0xdddddd);
  b.setTransform(null);
}

function buildMarina(scene, materials, seed) {
  const random = createRandom(seed + 1212);
  const marina = new MeshBuilder();
  const pierX = 7.5 * CITY.pitch;
  const pierEnd = CITY.shoreZ + 150;
  marina.box(pierX, 0.2, (CITY.beachZ + pierEnd) / 2, 7, 0.35, pierEnd - CITY.beachZ, 0xb08968);
  for (let z = CITY.beachZ + 10; z < pierEnd; z += 12) {
    marina.cylinder(pierX - 3, -3, z, 0.3, 0.3, 3.3, 6, 0x6f5843, { noTop: true });
    marina.cylinder(pierX + 3, -3, z, 0.3, 0.3, 3.3, 6, 0x6f5843, { noTop: true });
  }
  for (let z = CITY.shoreZ + 30; z < pierEnd; z += 26) {
    for (const side of [-1, 1]) {
      marina.box(pierX + side * 13, 0.1, z, 20, 0.25, 2, 0xc9a783);
      if (random.chance(0.85)) addBoat(marina, pierX + side * 13, z + 6.5, random.range(9, 15), random.pick(UMBRELLA_COLORS), side * Math.PI / 2);
    }
  }
  marina.box(pierX, 0.55, pierEnd - 6, 9, 3.5, 9, 0xffffff);
  marina.prism(pierX, 4.05, pierEnd - 6, 10, 2, 10, 0x35c9f0, { topX: 0.4, topZ: 0.4 });
  // Boats out on the water, and a lighthouse on a rock.
  for (let k = 0; k < 9; k += 1) {
    addBoat(marina, random.range(60, CITY.width + 200), CITY.shoreZ + random.range(90, 420), random.range(10, 22), random.pick(UMBRELLA_COLORS), random.range(0, 6.28));
  }
  const rockX = 2.2 * CITY.pitch, rockZ = CITY.shoreZ + 330;
  marina.cylinder(rockX, -3, rockZ, 30, 12, 5, 7, 0x8a8f8c);
  marina.cylinder(rockX, 2, rockZ, 3.2, 2.2, 24, 8, 0xffffff);
  marina.cylinder(rockX, 12, rockZ, 2.85, 2.6, 5, 8, 0xff5d73, { noTop: true });
  marina.cylinder(rockX, 26, rockZ, 2.6, 0.3, 3, 8, 0x263645);
  scene.add(marina.toMesh(materials.plain));
}

function buildPort(scene, materials, collision, seed) {
  const random = createRandom(seed + 3131);
  const port = new MeshBuilder();
  const craneColor = 0xe76f51;
  for (const z of [3.6 * CITY.pitch, 4.8 * CITY.pitch, 6 * CITY.pitch]) {
    const x = CITY.quayX + 14;
    for (const [lx, lz] of [[-8, -7], [8, -7], [-8, 7], [8, 7]]) {
      port.box(x + lx, 0, z + lz, 1.4, 34, 1.4, craneColor);
      collision.addBox(x + lx - 0.9, z + lz - 0.9, x + lx + 0.9, z + lz + 0.9, 34);
    }
    port.box(x, 34, z, 18, 2.4, 16, craneColor);
    port.box(x - 26, 36.4, z, 78, 2, 3, craneColor);
    port.box(x - 6, 38.4, z, 5, 5, 5, 0xf1f1f1);
    port.box(x - 40, 30, z, 4, 6.4, 3.4, 0x39424a);
    port.box(x - 40, 22, z, 0.3, 8, 0.3, 0x1b1f24);
    port.box(x - 40, 19.4, z, 12.2, 2.6, 2.5, 0x2a7fba);
  }
  // Container yard on the quay.
  for (let k = 0; k < 26; k += 1) {
    const x = CITY.quayX + 32 + (k % 2) * 14 + random.range(-0.4, 0.4), z = 3.1 * CITY.pitch + Math.floor(k / 2) * 21;
    const stack = random.int(1, 3);
    for (let level = 0; level < stack; level += 1) port.box(x, level * 2.6, z, 12.2, 2.55, 2.5, random.pick([0xc0392b, 0x2a7fba, 0x2e9e5b, 0xf39c12, 0xe8edf0, 0x16a3a3]));
    collision.addBox(x - 6.1, z - 1.25, x + 6.1, z + 1.25, stack * 2.6);
  }
  // The freighter Calder Star alongside.
  const shipX = CITY.quayX - 22, shipZ = 4.8 * CITY.pitch, shipLength = 190;
  port.prism(shipX, -1.5, shipZ, 20, 4, shipLength * 0.94, 0x7a1f1f, { topX: 30, topZ: shipLength });
  port.box(shipX, 2.5, shipZ, 30, 5, shipLength, 0x1f2a36);
  port.box(shipX, 7.5, shipZ + shipLength * 0.36, 26, 16, 22, 0xf4f4f4);
  port.box(shipX, 23.5, shipZ + shipLength * 0.36, 30, 3, 10, 0xf4f4f4);
  port.cylinder(shipX, 26.5, shipZ + shipLength * 0.4, 2.4, 2, 8, 8, 0xe76f51);
  for (let row = 0; row < 9; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const stack = random.int(1, 4);
      for (let level = 0; level < stack; level += 1) {
        port.box(shipX - 10.5 + col * 7, 7.5 + level * 2.6, shipZ - shipLength * 0.44 + row * 13.4, 2.5 * 2.6, 2.55, 12.2, random.pick([0xc0392b, 0x2a7fba, 0x2e9e5b, 0xf39c12, 0x8e44ad, 0xe8edf0]));
      }
    }
  }
  scene.add(port.toMesh(materials.plain));
}

function buildHills(scene, materials, seed) {
  const random = createRandom(seed + 5150);
  const hills = new MeshBuilder();
  const greens = [0x6fa86a, 0x7fb574, 0x5d9a66, 0x8dbb7a, 0x9aa37a];
  for (let k = 0; k < 26; k += 1) {
    const x = -500 + k * 95 + random.range(-30, 30), z = -260 - random.range(0, 520);
    hills.cylinder(x, -4, z, random.range(170, 320), random.range(10, 40), random.range(90, 260), 7, random.pick(greens));
  }
  for (let k = 0; k < 12; k += 1) {
    const x = CITY.width + 320 + random.range(0, 520), z = -300 + k * 90 + random.range(-30, 30);
    hills.cylinder(x, -4, z, random.range(160, 300), random.range(10, 40), random.range(80, 220), 7, random.pick(greens));
  }
  // Two green islands on the horizon.
  hills.cylinder(CITY.width + 300, -6, CITY.shoreZ + 900, 260, 40, 70, 8, 0x6fa86a);
  hills.cylinder(-520, -6, CITY.shoreZ + 1200, 340, 60, 110, 8, 0x7fb574);
  scene.add(hills.toMesh(materials.plain, { castShadow: false, receiveShadow: false }));
}

/** Build the coast and return the sea's shader uniforms, which the daylight cycle updates. */
export function buildCoast(scene, materials, collision, seed) {
  buildLand(scene, materials, collision);
  buildBeachLife(scene, materials, seed);
  buildMarina(scene, materials, seed);
  buildPort(scene, materials, collision, seed);
  buildHills(scene, materials, seed);
  return buildSea(scene);
}
