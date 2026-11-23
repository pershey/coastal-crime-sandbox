// Draws every person in the city (the player, pedestrians, police officers, gang gunmen)
// as a low-poly figure with swinging arms and legs. All figures share seven instanced
// meshes, one per body part, so a full street of people costs a handful of draw calls.
import * as THREE from '../../vendor/three.module.min.js';

const PARTS = [
  { name: 'torso', size: [0.46, 0.62, 0.26], offset: [0, -0.31, 0], pivot: [0, 1.47, 0], tint: 'top' },
  { name: 'head', size: [0.25, 0.27, 0.26], offset: [0, 0.135, 0], pivot: [0, 1.5, 0], tint: 'skin' },
  { name: 'hair', size: [0.28, 0.11, 0.29], offset: [0, 0.3, -0.01], pivot: [0, 1.5, 0], tint: 'hair' },
  { name: 'armLeft', size: [0.13, 0.6, 0.14], offset: [0, -0.3, 0], pivot: [0.3, 1.44, 0], tint: 'top' },
  { name: 'armRight', size: [0.13, 0.6, 0.14], offset: [0, -0.3, 0], pivot: [-0.3, 1.44, 0], tint: 'top' },
  { name: 'legLeft', size: [0.18, 0.85, 0.2], offset: [0, -0.425, 0], pivot: [0.12, 0.85, 0], tint: 'bottom' },
  { name: 'legRight', size: [0.18, 0.85, 0.2], offset: [0, -0.425, 0], pivot: [-0.12, 0.85, 0], tint: 'bottom' },
  { name: 'gun', size: [0.07, 0.13, 0.42], offset: [0, -0.62, 0.1], pivot: [-0.3, 1.44, 0], tint: 'gun' },
];

export function createCrowdRenderer(scene, capacity = 220) {
  const material = new THREE.MeshLambertMaterial();
  const meshes = PARTS.map((part) => {
    const geometry = new THREE.BoxGeometry(part.size[0], part.size[1], part.size[2]);
    geometry.translate(part.offset[0], part.offset[1], part.offset[2]);
    const mesh = new THREE.InstancedMesh(geometry, material, capacity);
    mesh.castShadow = part.name !== 'gun';
    mesh.frustumCulled = false;
    mesh.count = 0;
    scene.add(mesh);
    return mesh;
  });
  const counts = PARTS.map(() => 0);
  const base = new THREE.Matrix4(), limb = new THREE.Matrix4(), out = new THREE.Matrix4(), tilt = new THREE.Matrix4();
  const color = new THREE.Color();
  const gunColor = 0x1c1f24;

  function begin() {
    counts.fill(0);
  }

  /**
   * Draw one person this frame. `person` has x, z, heading, stride (walk-cycle phase),
   * pose ('stand', 'walk', 'aim', 'panic', 'down'), look (skin, top, bottom, hair colours),
   * and optionally y (height above ground) and armed.
   */
  function draw(person) {
    const y = person.y ?? 0;
    base.makeRotationY(person.heading);
    if (person.pose === 'down') {
      tilt.makeRotationX(-Math.PI / 2);
      base.multiply(tilt);
      base.setPosition(person.x, y + 0.22, person.z);
    } else {
      base.setPosition(person.x, y + (person.onPad ? 0.2 : 0), person.z);
    }
    const swing = person.pose === 'walk' ? Math.sin(person.stride) * (person.running ? 0.95 : 0.55) : 0;
    for (let p = 0; p < PARTS.length; p += 1) {
      const part = PARTS[p];
      if (part.name === 'gun' && !(person.armed && person.pose === 'aim')) continue;
      if (counts[p] >= capacity) continue;
      let angle = 0;
      if (part.name === 'legLeft') angle = swing;
      else if (part.name === 'legRight') angle = -swing;
      else if (part.name === 'armLeft') angle = person.pose === 'panic' ? Math.PI * 0.9 : person.pose === 'aim' ? -Math.PI / 2.4 : -swing;
      else if (part.name === 'armRight' || part.name === 'gun') angle = person.pose === 'panic' ? Math.PI * 0.9 : person.pose === 'aim' ? -Math.PI / 2 : swing;
      limb.makeRotationX(angle);
      limb.setPosition(part.pivot[0], part.pivot[1], part.pivot[2]);
      out.multiplyMatrices(base, limb);
      const mesh = meshes[p];
      mesh.setMatrixAt(counts[p], out);
      mesh.setColorAt(counts[p], color.setHex(part.tint === 'gun' ? gunColor : person.look[part.tint]));
      counts[p] += 1;
    }
  }

  function end() {
    meshes.forEach((mesh, p) => {
      mesh.count = counts[p];
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    });
  }

  return { begin, draw, end };
}

const SKIN_TONES = [0xf2c9a0, 0xe0ac7e, 0xc68642, 0x8d5524, 0x6b4226, 0xffdbac];
const HAIR_COLORS = [0x1c1410, 0x3b2a1a, 0x6b4f2e, 0xd8b56a, 0x8a8a8a, 0xb5482f, 0xf2f2f2];
const TOP_COLORS = [0xff5d73, 0x35c9f0, 0xffd23f, 0xff8c42, 0x9b5de5, 0x2ec4b6, 0xffffff, 0x3a86ff, 0xff70a6, 0x8ac926, 0xe9c46a];
const BOTTOM_COLORS = [0x264653, 0x3d405b, 0xe9d8a6, 0x6d6875, 0x1d3557, 0xf4f1de, 0x2b2d42, 0x8d99ae];

/** A random civilian outfit: beach-town colours over varied skin and hair. */
export function randomCivilianLook(random) {
  return { skin: random.pick(SKIN_TONES), hair: random.pick(HAIR_COLORS), top: random.pick(TOP_COLORS), bottom: random.pick(BOTTOM_COLORS) };
}

export const OFFICER_LOOK = { skin: 0xe0ac7e, hair: 0x14213d, top: 0x1d3f7a, bottom: 0x14213d };
export const TACTICAL_LOOK = { skin: 0x2b2d42, hair: 0x101418, top: 0x20252b, bottom: 0x101418 };
export const CREST_GUARD_LOOK = { skin: 0xc68642, hair: 0x101010, top: 0x14a38b, bottom: 0x1b1b1b };
export const PLAYER_LOOK = { skin: 0xd9a066, hair: 0x2a1a12, top: 0xf4f4f4, bottom: 0x1f6f8b };
