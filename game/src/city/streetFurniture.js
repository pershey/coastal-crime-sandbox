// Everything on the street that is not a building: asphalt and lane markings, crosswalks,
// palm trees, street lamps and the traffic signals whose lamps follow the signal clock.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';
import { createRandom } from '../core/seededRandom.js';
import { CITY } from './cityLayout.js';
import { STOP_DISTANCE } from './roadNetwork.js';

// Sun-bleached asphalt: light enough that cars and palm shadows read against it.
const ASPHALT = 0x5c616b;
const LINE_YELLOW = 0xf2c744;
const LINE_WHITE = 0xf1f1ee;

function buildRoadSurface(scene, materials) {
  const surface = new MeshBuilder();
  const h = CITY.roadHalf;
  surface.ground(-h, -h, CITY.width + h, CITY.depth + h, 0, ASPHALT);
  // The seafront promenade south of Sunrow Boulevard, and kerbs along the other edges.
  surface.box(CITY.width / 2, 0, CITY.depth + h + 3, CITY.width + h * 2, 0.2, 6, 0xe9dfcc);
  surface.box(CITY.width / 2, 0, -h - 2, CITY.width + h * 2, 0.2, 4, 0xd8d2c4);
  surface.box(CITY.width + h + 2, 0, CITY.depth / 2, 4, 0.2, CITY.depth + h * 2, 0xd8d2c4);
  scene.add(surface.toMesh(materials.plain, { castShadow: false }));

  const marks = new MeshBuilder();
  const y = 0.03;
  for (let j = 0; j <= CITY.rows; j += 1) {
    const z = j * CITY.pitch;
    for (let i = 0; i < CITY.cols; i += 1) {
      const x0 = i * CITY.pitch + STOP_DISTANCE, x1 = (i + 1) * CITY.pitch - STOP_DISTANCE;
      if (j === CITY.rows) {
        marks.ground(x0, z - 0.35, x1, z - 0.15, y, LINE_YELLOW);
        marks.ground(x0, z + 0.15, x1, z + 0.35, y, LINE_YELLOW);
      } else {
        for (let x = x0; x < x1 - 2; x += 7) marks.ground(x, z - 0.12, x + 3.2, z + 0.12, y, LINE_YELLOW);
      }
      marks.ground(x1 - 0.5, z, x1, z + h, y, LINE_WHITE);
      marks.ground(x0, z - h, x0 + 0.5, z, y, LINE_WHITE);
      for (let s = -h + 0.9; s < h - 0.4; s += 1.4) {
        marks.ground(x0 - 3.4, z + s, x0 - 1, z + s + 0.7, y, LINE_WHITE);
        marks.ground(x1 + 1, z + s, x1 + 3.4, z + s + 0.7, y, LINE_WHITE);
      }
    }
  }
  for (let i = 0; i <= CITY.cols; i += 1) {
    const x = i * CITY.pitch;
    for (let j = 0; j < CITY.rows; j += 1) {
      const z0 = j * CITY.pitch + STOP_DISTANCE, z1 = (j + 1) * CITY.pitch - STOP_DISTANCE;
      for (let z = z0; z < z1 - 2; z += 7) marks.ground(x - 0.12, z, x + 0.12, z + 3.2, y, LINE_YELLOW);
      marks.ground(x - h, z1 - 0.5, x, z1, y, LINE_WHITE);
      marks.ground(x, z0, x + h, z0 + 0.5, y, LINE_WHITE);
      for (let s = -h + 0.9; s < h - 0.4; s += 1.4) {
        marks.ground(x + s, z0 - 3.4, x + s + 0.7, z0 - 1, y, LINE_WHITE);
        marks.ground(x + s, z1 + 1, x + s + 0.7, z1 + 3.4, y, LINE_WHITE);
      }
    }
  }
  const paint = new THREE.MeshLambertMaterial({ vertexColors: true, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  scene.add(marks.toMesh(paint, { castShadow: false }));
}

/** One palm: a leaning trunk in rings and a crown of drooping fronds. */
function buildPalmGeometry() {
  const b = new MeshBuilder();
  const rings = 5, height = 8.2;
  let lean = 0;
  for (let k = 0; k < rings; k += 1) {
    const y0 = (k / rings) * height, nextLean = lean + 0.16 + k * 0.05;
    const r0 = 0.3 - k * 0.025, r1 = 0.3 - (k + 1) * 0.025;
    b.cylinder(lean, y0, 0, r0, r1, height / rings, 6, k % 2 ? 0x9b7b56 : 0x8a6b48, { shiftX: nextLean - lean, noTop: true });
    lean = nextLean;
  }
  const fronds = 9;
  for (let f = 0; f < fronds; f += 1) {
    const angle = (f / fronds) * Math.PI * 2 + (f % 2) * 0.2;
    const dx = Math.sin(angle), dz = Math.cos(angle), sx = Math.cos(angle), sz = -Math.sin(angle);
    const green = f % 3 === 0 ? 0x3f9e4d : f % 3 === 1 ? 0x2f8a45 : 0x57b35a;
    let px = lean, py = height, pz = 0, half = 0.75;
    for (let seg = 0; seg < 3; seg += 1) {
      const reach = 1.5, drop = seg === 0 ? -0.35 : seg === 1 ? 0.45 : 1.2;
      const qx = px + dx * reach, qy = py - drop, qz = pz + dz * reach;
      const nextHalf = half * 0.62;
      b.quad(
        [px - sx * half, py, pz - sz * half], [px + sx * half, py, pz + sz * half],
        [qx + sx * nextHalf, qy, qz + sz * nextHalf], [qx - sx * nextHalf, qy, qz - sz * nextHalf], green,
      );
      px = qx; py = qy; pz = qz; half = nextHalf;
    }
  }
  b.cylinder(lean, height - 0.5, 0, 0.5, 0.2, 0.6, 6, 0x6b4f2e);
  return b.build();
}

function plantPalms(scene, extraSpots, seed) {
  const random = createRandom(seed + 404);
  const spots = [...extraSpots];
  const south = CITY.depth + CITY.roadHalf;
  for (let x = 6; x < CITY.width; x += 12) {
    const nearCorner = Math.abs(x - Math.round(x / CITY.pitch) * CITY.pitch) < CITY.roadHalf + 2;
    if (!nearCorner) spots.push({ x, z: south - CITY.roadHalf * 2 - 1.3, scale: random.range(0.95, 1.2) });
    spots.push({ x: x + 6, z: south + 4.6, scale: random.range(1, 1.3) });
  }
  // A palm-lined central avenue and a scatter along the back of the beach.
  for (const column of [4, 7]) {
    for (let z = 14; z < CITY.depth - 10; z += 14) {
      if (Math.abs(z - Math.round(z / CITY.pitch) * CITY.pitch) < CITY.roadHalf + 3) continue;
      spots.push({ x: column * CITY.pitch - CITY.roadHalf - 1.3, z, scale: random.range(0.85, 1.1) });
      spots.push({ x: column * CITY.pitch + CITY.roadHalf + 1.3, z: z + 7, scale: random.range(0.85, 1.1) });
    }
  }
  for (let k = 0; k < 46; k += 1) {
    spots.push({ x: random.range(-40, CITY.width + 30), z: random.range(CITY.beachZ + 3, CITY.beachZ + 16), scale: random.range(0.9, 1.4) });
  }
  const material = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  const palms = new THREE.InstancedMesh(buildPalmGeometry(), material, spots.length);
  const dummy = new THREE.Object3D();
  spots.forEach((spot, index) => {
    dummy.position.set(spot.x, 0.15, spot.z);
    dummy.rotation.set(0, random.range(0, Math.PI * 2), 0);
    dummy.scale.setScalar(spot.scale);
    dummy.updateMatrix();
    palms.setMatrixAt(index, dummy.matrix);
  });
  palms.castShadow = true;
  palms.receiveShadow = false;
  palms.frustumCulled = false;
  scene.add(palms);
}

function placeStreetLamps(scene, materials) {
  const pole = new MeshBuilder();
  pole.cylinder(0, 0, 0, 0.16, 0.1, 7.4, 6, 0x56606b, { noTop: true });
  pole.box(0, 7.3, 1.1, 0.16, 0.16, 2.4, 0x56606b);
  pole.box(0, 7.05, 2.1, 0.5, 0.22, 0.9, 0xfff4d0);
  const spots = [];
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      const x0 = i * CITY.pitch + CITY.roadHalf + 0.8, x1 = (i + 1) * CITY.pitch - CITY.roadHalf - 0.8;
      const z0 = j * CITY.pitch + CITY.roadHalf + 0.8, z1 = (j + 1) * CITY.pitch - CITY.roadHalf - 0.8;
      for (const t of [0.28, 0.72]) {
        spots.push({ x: x0 + (x1 - x0) * t, z: z0, heading: Math.PI });
        spots.push({ x: x0 + (x1 - x0) * t, z: z1, heading: 0 });
        spots.push({ x: x0, z: z0 + (z1 - z0) * t, heading: -Math.PI / 2 });
        spots.push({ x: x1, z: z0 + (z1 - z0) * t, heading: Math.PI / 2 });
      }
    }
  }
  const lamps = new THREE.InstancedMesh(pole.build(), materials.plain, spots.length);
  const dummy = new THREE.Object3D();
  const glowPositions = [];
  spots.forEach((spot, index) => {
    dummy.position.set(spot.x, 0.2, spot.z);
    dummy.rotation.set(0, spot.heading, 0);
    dummy.updateMatrix();
    lamps.setMatrixAt(index, dummy.matrix);
    glowPositions.push(spot.x + Math.sin(spot.heading) * 2.1, 7.1, spot.z + Math.cos(spot.heading) * 2.1);
  });
  lamps.castShadow = false;
  lamps.frustumCulled = false;
  scene.add(lamps);

  // Soft halos that only show after dark.
  const glowCanvas = document.createElement('canvas');
  glowCanvas.width = 64;
  glowCanvas.height = 64;
  const g = glowCanvas.getContext('2d');
  const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 236, 180, 1)');
  gradient.addColorStop(0.3, 'rgba(255, 210, 130, 0.5)');
  gradient.addColorStop(1, 'rgba(255, 200, 120, 0)');
  g.fillStyle = gradient;
  g.fillRect(0, 0, 64, 64);
  const glowGeometry = new THREE.BufferGeometry();
  glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3));
  const glowMaterial = new THREE.PointsMaterial({
    map: new THREE.CanvasTexture(glowCanvas), size: 9, sizeAttenuation: true, transparent: true,
    depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, fog: false,
  });
  const glow = new THREE.Points(glowGeometry, glowMaterial);
  glow.frustumCulled = false;
  scene.add(glow);

  // And a pool of warm light on the ground under each lamp.
  const poolGeometry = new THREE.CircleGeometry(8, 14);
  poolGeometry.rotateX(-Math.PI / 2);
  const poolMaterial = new THREE.MeshBasicMaterial({
    map: glowMaterial.map, color: 0xffd9a0, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
  });
  const pools = new THREE.InstancedMesh(poolGeometry, poolMaterial, spots.length);
  spots.forEach((spot, index) => {
    dummy.position.set(glowPositions[index * 3], 0.25, glowPositions[index * 3 + 2]);
    dummy.rotation.set(0, 0, 0);
    dummy.updateMatrix();
    pools.setMatrixAt(index, dummy.matrix);
  });
  pools.frustumCulled = false;
  pools.renderOrder = 2;
  scene.add(pools);
  return { halo: glowMaterial, pool: poolMaterial };
}

function placeTrafficSignals(scene, roads, materials) {
  const masts = new MeshBuilder();
  const lampNames = ['red', 'yellow', 'green'];
  const lampOn = { red: 0xff3b30, yellow: 0xffcc00, green: 0x34e36a };
  const bulbs = {};
  for (const axis of ['ns', 'ew']) {
    for (const name of lampNames) bulbs[axis + name] = { builder: new MeshBuilder(), material: new THREE.MeshBasicMaterial({ color: 0x222222, toneMapped: false }) };
  }
  for (const node of roads.nodes) {
    if (node.links.length < 3) continue;
    for (const from of node.links) {
      const lane = roads.laneBetween(from, node);
      const rx = -lane.dz, rz = lane.dx;
      const px = node.x - lane.dx * (CITY.roadHalf + 1.5) + rx * (CITY.roadHalf + 1.2);
      const pz = node.z - lane.dz * (CITY.roadHalf + 1.5) + rz * (CITY.roadHalf + 1.2);
      masts.cylinder(px, 0.2, pz, 0.14, 0.12, 6, 6, 0x2f3640, { noTop: true });
      const hx = px - rx * 3.6, hz = pz - rz * 3.6;
      masts.box((px + hx) / 2, 6, (pz + hz) / 2, Math.abs(rx) * 3.6 + 0.14, 0.14, Math.abs(rz) * 3.6 + 0.14, 0x2f3640);
      masts.box(hx, 4.5, hz, 0.5, 1.5, 0.5, 0x1b1f24);
      lampNames.forEach((name, k) => {
        bulbs[lane.axis + name].builder.box(hx - lane.dx * 0.28, 5.55 - k * 0.46, hz - lane.dz * 0.28, 0.3, 0.3, 0.3, 0xffffff);
      });
    }
  }
  scene.add(masts.toMesh(materials.plain, { castShadow: false }));
  for (const entry of Object.values(bulbs)) scene.add(entry.builder.toMesh(entry.material, { castShadow: false, receiveShadow: false }));

  /** Light the lamps to match the signal clock. */
  return function updateSignals(time) {
    for (const axis of ['ns', 'ew']) {
      const state = roads.signalState(axis, time);
      for (const name of lampNames) bulbs[axis + name].material.color.setHex(state === name ? lampOn[name] : 0x20242a);
    }
  };
}

export function buildStreetFurniture(scene, roads, materials, palmSpots, seed) {
  buildRoadSurface(scene, materials);
  plantPalms(scene, palmSpots, seed);
  const lampGlow = placeStreetLamps(scene, materials);
  const updateSignals = placeTrafficSignals(scene, roads, materials);
  return { lampGlow, updateSignals };
}
