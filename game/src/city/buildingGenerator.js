// Turns the city plan into buildings: glass towers in Glasswater, pastel hotels on Sunrow
// Beach, market shops with awnings and signs, apartment blocks, hillside villas with pools,
// port warehouses and container stacks. One merged mesh per material per block.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';
import { createRandom } from '../core/seededRandom.js';
import { signUv } from './facadeTextures.js';

const WALL_UV = [13.6, 13.6];
const GLASS_UV = [9, 14];
const PAD_HEIGHT = 0.2;
const TRIM = 0xfff8ee;
const CONTAINER_COLORS = [0xc0392b, 0x2a7fba, 0x2e9e5b, 0xf39c12, 0x8e44ad, 0xe8edf0, 0xe67e22, 0x16a3a3];
const AWNING_COLORS = [0xe63946, 0x2a9d8f, 0xf4a261, 0x457b9d, 0xff70a6, 0x70d6ff, 0xffd670];
const SHOP_SIGNS = ['MANGO MART', 'PAPAYA PAWN', 'TIDEWATER TACOS', 'CAFE CORAL', 'GUAVA GRILL', 'PELICAN PIZZA', 'SALT & LIME',
  'BODEGA LUNA', 'ICE POP!', 'KEY LIME RECORDS', '24H LAUNDRO', 'PALM LOANS', 'ZEST GYM', 'SAFFRON SPICE', 'NEON ARCADE', 'FISH SHACK'];
const HOTEL_SIGNS = ['HOTEL CORALINE', 'THE HERON ARMS', 'MOTEL MAR AZUL', 'HOTEL SOLEIL BLEU', 'MIRADOR SUITES', 'CASA VERDE',
  'LOW TIDE LOUNGE', 'SUNROW SURF CO', 'SEAGRASS SPA', 'CINE TROPICO', 'THE SANDBAR', 'CLUB AFTERGLOW'];

/** Which sides of a lot face a street, from its place in the block's grid of lots. */
function streetSides(lot) {
  const sides = [];
  if (lot.b === lot.nz - 1) sides.push('s');
  if (lot.a === 0) sides.push('w');
  if (lot.a === lot.nx - 1) sides.push('e');
  if (lot.b === 0) sides.push('n');
  return sides;
}

/** Corners of an upright rectangle hung on one side of a footprint, facing outward. */
function facePanel(rect, side, y0, y1, width, out = 0.08, along = 0.5) {
  const cx = rect.x0 + (rect.x1 - rect.x0) * along, cz = rect.z0 + (rect.z1 - rect.z0) * along;
  const h = width / 2;
  if (side === 's') return [[cx - h, y0, rect.z1 + out], [cx + h, y0, rect.z1 + out], [cx + h, y1, rect.z1 + out], [cx - h, y1, rect.z1 + out]];
  if (side === 'n') return [[cx + h, y0, rect.z0 - out], [cx - h, y0, rect.z0 - out], [cx - h, y1, rect.z0 - out], [cx + h, y1, rect.z0 - out]];
  if (side === 'e') return [[rect.x1 + out, y0, cz + h], [rect.x1 + out, y0, cz - h], [rect.x1 + out, y1, cz - h], [rect.x1 + out, y1, cz + h]];
  return [[rect.x0 - out, y0, cz - h], [rect.x0 - out, y0, cz + h], [rect.x0 - out, y1, cz + h], [rect.x0 - out, y1, cz - h]];
}

function sideLength(rect, side) {
  return side === 'n' || side === 's' ? rect.x1 - rect.x0 : rect.z1 - rect.z0;
}

function addSign(parts, rect, side, name, y0, height, maxWidth) {
  const width = Math.min(maxWidth, height * 4);
  const p = facePanel(rect, side, y0, y0 + (width / 4), width, 0.25);
  parts.sign.quad(p[0], p[1], p[2], p[3], 0xffffff, signUv(name));
}

/** A slab sticking out of one side: awnings, balconies, loading docks. */
function addLedge(parts, rect, side, y, depth, thickness, color, widthFraction = 0.9) {
  const length = sideLength(rect, side) * widthFraction;
  const cx = (rect.x0 + rect.x1) / 2, cz = (rect.z0 + rect.z1) / 2;
  if (side === 's') parts.plain.box(cx, y, rect.z1 + depth / 2, length, thickness, depth, color);
  else if (side === 'n') parts.plain.box(cx, y, rect.z0 - depth / 2, length, thickness, depth, color);
  else if (side === 'e') parts.plain.box(rect.x1 + depth / 2, y, cz, depth, thickness, length, color);
  else parts.plain.box(rect.x0 - depth / 2, y, cz, depth, thickness, length, color);
}

function addRoofClutter(parts, rect, y, random) {
  const w = rect.x1 - rect.x0, d = rect.z1 - rect.z0;
  const count = random.int(1, 3);
  for (let k = 0; k < count; k += 1) {
    const x = rect.x0 + w * random.range(0.2, 0.8), z = rect.z0 + d * random.range(0.2, 0.8);
    if (random.chance(0.35)) {
      parts.plain.cylinder(x, y + 1.2, z, 1.3, 1.3, 2.2, 8, 0x9c8f7a, { top: 0x7d7261 });
      parts.plain.box(x, y, z, 1.6, 1.2, 1.6, 0x5c5c5c);
    } else {
      parts.plain.box(x, y, z, random.range(1.5, 3), random.range(0.9, 1.6), random.range(1.5, 3), 0xb9c0c7);
    }
  }
}

function footprint(lot, shrink = 0) {
  return { x0: lot.x0 + shrink, z0: lot.z0 + shrink, x1: lot.x1 - shrink, z1: lot.z1 - shrink };
}

function center(rect) {
  return { cx: (rect.x0 + rect.x1) / 2, cz: (rect.z0 + rect.z1) / 2, w: rect.x1 - rect.x0, d: rect.z1 - rect.z0 };
}

function buildTower(parts, lot, random, collision) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  const podium = 7;
  const landmark = lot.landmark === 'crest';
  parts.wall.box(cx, PAD_HEIGHT, cz, w, podium, d, 0xd9dde2, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + podium, cz, w + 0.8, 0.6, d + 0.8, TRIM);
  const shaftW = w - 6, shaftD = d - 6;
  const lower = lot.height * (landmark ? 0.74 : random.range(0.6, 0.8));
  const base = PAD_HEIGHT + podium + 0.6;
  parts.glass.box(cx, base, cz, shaftW, lower, shaftD, lot.color, { uvMeters: GLASS_UV, noTop: true });
  parts.plain.box(cx, base + lower, cz, shaftW + 0.6, 0.8, shaftD + 0.6, TRIM);
  const upperW = shaftW * (landmark ? 0.7 : random.range(0.62, 0.82)), upperD = shaftD * (landmark ? 0.7 : random.range(0.62, 0.82));
  const upper = lot.height - lower;
  parts.glass.prism(cx, base + lower + 0.8, cz, upperW, upper, upperD, lot.color, {
    uvMeters: GLASS_UV, noTop: true, topX: landmark ? upperW * 0.55 : upperW, topZ: landmark ? upperD * 0.55 : upperD,
  });
  const roof = base + lower + 0.8 + upper;
  const roofW = landmark ? upperW * 0.55 : upperW, roofD = landmark ? upperD * 0.55 : upperD;
  parts.plain.box(cx, roof, cz, roofW + 0.5, 0.7, roofD + 0.5, landmark ? 0xffd166 : TRIM);
  parts.plain.box(cx, roof + 0.7, cz, 0.5, landmark ? 26 : random.range(8, 18), 0.5, 0xcfd8dc);
  if (landmark) {
    for (const side of ['s', 'n', 'e', 'w']) {
      const crown = { x0: cx - upperW / 2, z0: cz - upperD / 2, x1: cx + upperW / 2, z1: cz + upperD / 2 };
      addSign(parts, crown, side, 'HALCYON CREST', base + lower + 4, 5, 20);
    }
    addSign(parts, rect, 's', 'HALCYON CREST', PAD_HEIGHT + 3.2, 3, 12);
  } else if (random.chance(0.5)) {
    addSign(parts, rect, streetSides(lot)[0] ?? 's', 'GLASSWATER BANK', PAD_HEIGHT + 3.4, 2.4, 9.6);
  }
  for (const side of streetSides(lot)) {
    const door = facePanel(rect, side, PAD_HEIGHT, PAD_HEIGHT + 3, Math.min(8, sideLength(rect, side) * 0.4));
    parts.plain.quad(door[0], door[1], door[2], door[3], 0x1d2b3a);
  }
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, lot.height);
}

function buildHotel(parts, lot, random, collision, signs) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  const h = lot.height;
  const accent = random.pick(AWNING_COLORS);
  parts.wall.box(cx, PAD_HEIGHT, cz, w, h, d, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + h, cz, w + 0.9, 0.7, d + 0.9, TRIM);
  const capW = w * random.range(0.45, 0.7), capD = d * random.range(0.45, 0.7), capH = random.range(3.5, 7);
  parts.wall.box(cx, PAD_HEIGHT + h + 0.7, cz, capW, capH, capD, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + h + 0.7 + capH, cz, capW + 0.7, 0.5, capD + 0.7, accent);
  const sides = streetSides(lot);
  for (const side of sides) {
    addLedge(parts, rect, side, PAD_HEIGHT + 3.3, 1.8, 0.3, accent, 0.94);
    const floors = Math.min(7, Math.floor((h - 6) / 3.4));
    for (let f = 1; f <= floors; f += 1) addLedge(parts, rect, side, PAD_HEIGHT + 3.3 + f * 3.4, 1.1, 0.22, TRIM, 0.8);
    const door = facePanel(rect, side, PAD_HEIGHT, PAD_HEIGHT + 2.9, sideLength(rect, side) * 0.5);
    parts.plain.quad(door[0], door[1], door[2], door[3], 0x1d2b3a);
  }
  // A fin up one street corner, the art-deco touch every Sunrow hotel has.
  const finSide = sides[0] ?? 's';
  const fin = facePanel(rect, finSide, 0, 1, 1.2, 0.6, 0.18);
  parts.plain.box(fin[0][0], PAD_HEIGHT, fin[0][2], 1.3, h + capH + 4, 1.3, accent);
  if (sides.length > 0) addSign(parts, rect, sides[0], signs.pick(HOTEL_SIGNS), PAD_HEIGHT + h - 4.6, 3.6, Math.min(w, d) * 0.8);
  addRoofClutter(parts, rect, PAD_HEIGHT + h + 0.7, random);
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, h);
}

function buildShop(parts, lot, random, collision, signs, fixedSign) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  const h = lot.height;
  parts.wall.box(cx, PAD_HEIGHT, cz, w, h, d, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + h, cz, w + 0.6, 0.6, d + 0.6, TRIM);
  for (const side of streetSides(lot)) {
    const front = facePanel(rect, side, PAD_HEIGHT, PAD_HEIGHT + 2.8, sideLength(rect, side) * 0.78);
    parts.plain.quad(front[0], front[1], front[2], front[3], 0x1d2b3a);
    addLedge(parts, rect, side, PAD_HEIGHT + 2.9, 1.7, 0.25, random.pick(AWNING_COLORS), 0.92);
    addSign(parts, rect, side, fixedSign ?? signs.pick(SHOP_SIGNS), PAD_HEIGHT + 3.5, 2, sideLength(rect, side) * 0.8);
  }
  addRoofClutter(parts, rect, PAD_HEIGHT + h + 0.6, random);
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, h);
}

function buildApartment(parts, lot, random, collision) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  const h = lot.height;
  parts.wall.box(cx, PAD_HEIGHT, cz, w, h, d, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + h, cz, w + 0.6, 0.6, d + 0.6, TRIM);
  for (const side of streetSides(lot)) {
    const floors = Math.min(6, Math.floor((h - 4) / 3.4));
    for (let f = 1; f <= floors; f += 1) addLedge(parts, rect, side, PAD_HEIGHT + f * 3.4, 1, 0.2, 0xe6ded2, 0.5);
    const door = facePanel(rect, side, PAD_HEIGHT, PAD_HEIGHT + 2.6, 3);
    parts.plain.quad(door[0], door[1], door[2], door[3], 0x3b2f2f);
  }
  parts.plain.box(cx + w * 0.2, PAD_HEIGHT + h + 0.6, cz - d * 0.2, 4, 2.6, 4, lot.color);
  addRoofClutter(parts, rect, PAD_HEIGHT + h + 0.6, random);
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, h);
}

function buildVilla(parts, lot, random, collision, palms) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  parts.plain.ground(rect.x0, rect.z0, rect.x1, rect.z1, PAD_HEIGHT + 0.02, 0x6fbf5a);
  const hedge = 0x2f7d3c;
  parts.plain.box(cx, PAD_HEIGHT, rect.z0 + 0.4, w, 1, 0.8, hedge);
  parts.plain.box(cx, PAD_HEIGHT, rect.z1 - 0.4, w, 1, 0.8, hedge);
  parts.plain.box(rect.x0 + 0.4, PAD_HEIGHT, cz, 0.8, 1, d, hedge);
  parts.plain.box(rect.x1 - 0.4, PAD_HEIGHT, cz, 0.8, 1, d, hedge);
  const hw = w * 0.52, hd = d * 0.42;
  const hx = cx - w * 0.14, hz = cz - d * 0.18;
  const roofColor = random.pick([0xc8553d, 0xb5482f, 0xd9734e, 0x8c5e4a]);
  parts.wall.box(hx, PAD_HEIGHT, hz, hw, lot.height, hd, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.prism(hx, PAD_HEIGHT + lot.height, hz, hw + 1.4, 2.4, hd + 1.4, roofColor, { topX: hw * 0.5, topZ: 0.3 });
  parts.wall.box(hx + hw * 0.5, PAD_HEIGHT, hz + hd * 0.55, hw * 0.5, lot.height * 0.6, hd * 0.6, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.prism(hx + hw * 0.5, PAD_HEIGHT + lot.height * 0.6, hz + hd * 0.55, hw * 0.5 + 1, 1.6, hd * 0.6 + 1, roofColor, { topX: 0.3, topZ: hd * 0.3 });
  const px = cx + w * 0.2, pz = cz + d * 0.26;
  parts.plain.box(px, PAD_HEIGHT, pz, w * 0.36, 0.12, d * 0.24, 0xf4f1ea);
  parts.plain.ground(px - w * 0.16, pz - d * 0.1, px + w * 0.16, pz + d * 0.1, PAD_HEIGHT + 0.14, 0x3fd0e0);
  palms.push({ x: rect.x0 + 3, z: rect.z1 - 3, scale: random.range(0.8, 1.1) });
  if (random.chance(0.6)) palms.push({ x: rect.x1 - 3, z: rect.z0 + 3, scale: random.range(0.8, 1.1) });
  collision.addBox(hx - hw / 2, hz - hd / 2, hx + hw / 2, hz + hd / 2, lot.height);
}

function buildWarehouse(parts, lot, random, collision) {
  const rect = footprint(lot, 1);
  const { cx, cz, w, d } = center(rect);
  const h = lot.height;
  const color = random.pick([0x8fa3b0, 0xb0a48f, 0x7d8f8a, 0xa66f5b, 0x5f7f99]);
  parts.plain.box(cx, PAD_HEIGHT, cz, w, h, d, color, { noTop: true });
  parts.plain.prism(cx, PAD_HEIGHT + h, cz, w + 0.8, 2.6, d + 0.8, 0x6b7780, { topX: w + 0.8, topZ: 0.4 });
  for (const side of streetSides(lot)) {
    const n = Math.max(1, Math.floor(sideLength(rect, side) / 14));
    for (let k = 0; k < n; k += 1) {
      const door = facePanel(rect, side, PAD_HEIGHT, PAD_HEIGHT + 5, 6, 0.08, (k + 0.5) / n);
      parts.plain.quad(door[0], door[1], door[2], door[3], 0x39424a);
    }
    addSign(parts, rect, side, random.pick(['DOCK 9', 'DOCKSIDE DINER', 'BAIT & TACKLE']), PAD_HEIGHT + 6, 2.2, 9);
  }
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, h);
}

function buildContainers(parts, lot, random, collision) {
  const rect = footprint(lot, 2);
  const { w, d } = center(rect);
  const alongX = w >= d;
  const rows = Math.floor((alongX ? d : w) / 4.2), cols = Math.floor((alongX ? w : d) / 13.4);
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      if (random.chance(0.3)) continue;
      const along = 6.7 + c * 13.4, across = 2 + r * 4.2;
      const x = alongX ? rect.x0 + along : rect.x0 + across, z = alongX ? rect.z0 + across : rect.z0 + along;
      const sx = alongX ? 12.2 : 2.5, sz = alongX ? 2.5 : 12.2;
      const stack = random.int(1, 3);
      for (let level = 0; level < stack; level += 1) {
        parts.plain.box(x, PAD_HEIGHT + level * 2.6, z, sx, 2.55, sz, random.pick(CONTAINER_COLORS));
      }
      collision.addBox(x - sx / 2, z - sz / 2, x + sx / 2, z + sz / 2, stack * 2.6);
    }
  }
}

function buildCivic(parts, lot, random, collision) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  parts.wall.box(cx, PAD_HEIGHT, cz, w, lot.height, d, lot.color, { uvMeters: WALL_UV, noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + lot.height, cz, w + 1, 0.8, d + 1, 0x2b4c7e);
  for (let k = 0; k < 6; k += 1) parts.plain.cylinder(rect.x0 + 6 + k * ((w - 12) / 5), PAD_HEIGHT, rect.z1 + 1.6, 0.6, 0.6, 9, 8, TRIM);
  parts.plain.box(cx, PAD_HEIGHT + 9, rect.z1 + 1.4, w - 6, 1.2, 3.4, TRIM);
  addSign(parts, rect, 's', lot.sign, PAD_HEIGHT + 11, 4, 16);
  parts.plain.box(cx, PAD_HEIGHT + lot.height + 0.8, cz, 0.3, 12, 0.3, 0xcfd8dc);
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, lot.height);
}

function buildGarage(parts, lot, random, collision) {
  const rect = footprint(lot);
  const { cx, cz, w, d } = center(rect);
  parts.plain.box(cx, PAD_HEIGHT, cz, w, lot.height, d, lot.color, { noTop: true });
  parts.plain.box(cx, PAD_HEIGHT + lot.height, cz, w + 0.8, 0.7, d + 0.8, 0x1f3a5f);
  for (let k = 0; k < 3; k += 1) {
    const door = facePanel(rect, 's', PAD_HEIGHT, PAD_HEIGHT + 4.2, w / 4, 0.08, (k + 0.5) / 3);
    parts.plain.quad(door[0], door[1], door[2], door[3], k === 1 ? 0x24313d : 0x8a99a6);
  }
  addSign(parts, rect, 's', lot.sign, PAD_HEIGHT + 4.6, 2.3, w * 0.8);
  addSign(parts, rect, 'w', lot.sign, PAD_HEIGHT + 4.6, 2, d * 0.8);
  collision.addBox(rect.x0, rect.z0, rect.x1, rect.z1, lot.height);
}

function buildPark(parts, block, random, collision, palms) {
  const r = block.inner;
  const { cx, cz, w, d } = center(r);
  parts.plain.ground(r.x0, r.z0, r.x1, r.z1, PAD_HEIGHT + 0.02, 0x62b852);
  parts.plain.ground(r.x0, cz - 2, r.x1, cz + 2, PAD_HEIGHT + 0.04, 0xe8d8b0);
  parts.plain.ground(cx - 2, r.z0, cx + 2, r.z1, PAD_HEIGHT + 0.04, 0xe8d8b0);
  parts.plain.cylinder(cx, PAD_HEIGHT, cz, 6, 6, 0.7, 12, 0xd9d2c5, { top: 0x4fc3e8 });
  parts.plain.cylinder(cx, PAD_HEIGHT, cz, 1, 0.6, 2.6, 8, 0xd9d2c5);
  collision.addBox(cx - 4.5, cz - 4.5, cx + 4.5, cz + 4.5, 1);
  for (let k = 0; k < 14; k += 1) {
    const x = r.x0 + random.range(4, w - 4), z = r.z0 + random.range(4, d - 4);
    if (Math.abs(x - cx) < 8 && Math.abs(z - cz) < 8) continue;
    if (Math.abs(x - cx) < 3 || Math.abs(z - cz) < 3) continue;
    palms.push({ x, z, scale: random.range(0.85, 1.25) });
  }
  for (const [bx, bz] of [[cx - 9, cz - 3.2], [cx + 9, cz + 3.2], [cx - 3.2, cz + 10], [cx + 3.2, cz - 10]]) {
    parts.plain.box(bx, PAD_HEIGHT, bz, 2.2, 0.5, 0.7, 0x8d6e4b);
  }
}

function buildParkingLot(parts, block) {
  const r = block.inner;
  parts.plain.ground(r.x0, r.z0, r.x1, r.z1, PAD_HEIGHT + 0.02, 0x4a4f57);
  for (let row = 0; row < 3; row += 1) {
    for (let slot = 0; slot <= 8; slot += 1) {
      const x = r.x0 + 2.4 + slot * 7.2, z = r.z0 + 9 + row * 20;
      parts.plain.ground(x - 0.1, z - 3.2, x + 0.1, z + 3.2, PAD_HEIGHT + 0.04, 0xf2f2f2);
    }
  }
}

/**
 * Build every block of the plan into `scene`, registering solids in `collision`.
 * Returns the palm spots that villas and parks asked for.
 */
export function buildCityBlocks(plan, scene, collision, materials, seed) {
  const palms = [];
  const signs = createRandom(seed + 77);
  const ground = new MeshBuilder();
  for (const block of plan.blocks) {
    const random = createRandom(seed * 31 + block.i * 97 + block.j * 389);
    const parts = { wall: new MeshBuilder(), glass: new MeshBuilder(), plain: new MeshBuilder(), sign: new MeshBuilder() };
    const r = block.rect;
    const sidewalk = block.district === 'port' ? 0xb7b7ad : block.district === 'heights' ? 0xe9dcc3 : 0xd8d2c4;
    ground.box((r.x0 + r.x1) / 2, 0, (r.z0 + r.z1) / 2, r.x1 - r.x0, PAD_HEIGHT, r.z1 - r.z0, sidewalk);
    if (block.kind === 'park') buildPark(parts, block, random, collision, palms);
    if (block.kind === 'parking') buildParkingLot(parts, block);
    for (const lot of block.lots) {
      const lotRandom = createRandom(lot.seed);
      if (lot.style === 'tower') buildTower(parts, lot, lotRandom, collision);
      else if (lot.style === 'hotel') buildHotel(parts, lot, lotRandom, collision, signs);
      else if (lot.style === 'club') buildShop(parts, lot, lotRandom, collision, signs, signs.pick(['PELICAN YACHT CLUB', 'CLUB AFTERGLOW', 'THE SANDBAR', 'FISH SHACK']));
      else if (lot.style === 'shop') buildShop(parts, lot, lotRandom, collision, signs);
      else if (lot.style === 'apartment') buildApartment(parts, lot, lotRandom, collision);
      else if (lot.style === 'villa') buildVilla(parts, lot, lotRandom, collision, palms);
      else if (lot.style === 'warehouse') buildWarehouse(parts, lot, lotRandom, collision);
      else if (lot.style === 'containers') buildContainers(parts, lot, lotRandom, collision);
      else if (lot.style === 'civic') buildCivic(parts, lot, lotRandom, collision);
      else if (lot.style === 'garage') buildGarage(parts, lot, lotRandom, collision);
    }
    for (const name of ['wall', 'glass', 'plain', 'sign']) {
      const mesh = parts[name].toMesh(materials[name], { castShadow: name !== 'sign' });
      if (mesh) scene.add(mesh);
    }
  }
  const groundMesh = ground.toMesh(materials.plain, { castShadow: false });
  scene.add(groundMesh);
  return { palms };
}
