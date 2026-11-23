// The map of Tamarind Coast: a grid of streets between the hills and the sea, cut into seven
// districts, each with its own building mix. This file is data and arithmetic only; the
// meshes are made from it elsewhere, and the minimap, traffic and missions read it too.
import { createRandom, hashCoords } from '../core/seededRandom.js';

export const CITY = {
  name: 'Tamarind Coast',
  cols: 9,
  rows: 7,
  pitch: 84,
  roadHalf: 7,
  sidewalk: 4,
  laneOffset: 3.5,
};
CITY.width = CITY.cols * CITY.pitch;
CITY.depth = CITY.rows * CITY.pitch;
/** Where walking and driving stop: the hills to the north and east, deep water south and west. */
CITY.bounds = { minX: -64, maxX: CITY.width + 40, minZ: -40, maxZ: CITY.depth + 62 };
CITY.shoreZ = CITY.depth + 58;
CITY.beachZ = CITY.depth + 13;
CITY.quayX = -70;

export const DISTRICTS = {
  sunrow: { name: 'Sunrow Beach', color: '#ff8fa3', blurb: 'Pastel hotels and the boulevard' },
  glass: { name: 'Glasswater', color: '#5cc8ff', blurb: 'Bank towers and Halcyon Crest' },
  market: { name: 'Saffron Market', color: '#ffb347', blurb: 'Old town stalls and back alleys' },
  port: { name: 'Port Calder', color: '#9aa7b8', blurb: 'Warehouses, cranes and containers' },
  heights: { name: 'Mirador Heights', color: '#8fe388', blurb: 'Villas with pools above the city' },
  flats: { name: 'Guava Flats', color: '#d9a7ff', blurb: 'Apartment blocks and corner stores' },
  marina: { name: 'Pelican Marina', color: '#6ee7d8', blurb: 'Yachts, clubs and the long pier' },
};

export function districtOfBlock(i, j) {
  if (i <= 1 && j >= 3) return 'port';
  if (j === 6) return i >= 7 ? 'marina' : 'sunrow';
  if (i >= 7 && j === 5) return 'marina';
  if (i >= 3 && i <= 5 && j >= 1 && j <= 3) return 'glass';
  if (i >= 6 && j <= 2) return 'heights';
  if (i >= 2 && i <= 4 && j >= 4 && j <= 5) return 'market';
  return 'flats';
}

/** The district a world position is in, for the HUD's district name. */
export function districtAt(x, z) {
  if (z > CITY.depth + CITY.roadHalf) return x < 2 * CITY.pitch ? 'port' : x > 7 * CITY.pitch ? 'marina' : 'sunrow';
  if (x < 0) return 'port';
  const i = Math.max(0, Math.min(CITY.cols - 1, Math.floor(x / CITY.pitch)));
  const j = Math.max(0, Math.min(CITY.rows - 1, Math.floor(z / CITY.pitch)));
  return districtOfBlock(i, j);
}

/** The raised pad of block (i, j): sidewalk included, roads excluded. */
export function blockRect(i, j) {
  return {
    x0: i * CITY.pitch + CITY.roadHalf,
    z0: j * CITY.pitch + CITY.roadHalf,
    x1: (i + 1) * CITY.pitch - CITY.roadHalf,
    z1: (j + 1) * CITY.pitch - CITY.roadHalf,
  };
}

/** A spot at the kerb in the middle of one side of a block: where missions, shops and markers stand. */
export function kerbPoint(i, j, side, along = 0.5) {
  const r = blockRect(i, j);
  const inset = 1.6;
  if (side === 'n') return { x: r.x0 + (r.x1 - r.x0) * along, z: r.z0 + inset, facing: Math.PI };
  if (side === 's') return { x: r.x0 + (r.x1 - r.x0) * along, z: r.z1 - inset, facing: 0 };
  if (side === 'w') return { x: r.x0 + inset, z: r.z0 + (r.z1 - r.z0) * along, facing: -Math.PI / 2 };
  return { x: r.x1 - inset, z: r.z0 + (r.z1 - r.z0) * along, facing: Math.PI / 2 };
}

/** Named places the story, the shops and the map legend point at. */
export const PLACES = {
  garage: { ...kerbPoint(2, 5, 's'), label: 'Quill & Sons Auto', icon: 'home' },
  market: { ...kerbPoint(3, 4, 'e'), label: 'Saffron Market', icon: 'job' },
  marinaClub: { ...kerbPoint(7, 6, 'n'), label: 'Pelican Yacht Club', icon: 'job' },
  portLockup: { ...kerbPoint(0, 4, 'e'), label: 'Dock 9 Lock-up', icon: 'job' },
  crestTower: { ...kerbPoint(4, 2, 's'), label: 'Halcyon Crest Tower', icon: 'job' },
  heightsVilla: { ...kerbPoint(7, 1, 's'), label: 'Lasker Estate', icon: 'job' },
  boulevard: { ...kerbPoint(4, 6, 's'), label: 'Sunrow Boulevard', icon: 'job' },
  ammoShop: { ...kerbPoint(5, 5, 'w'), label: 'Ammo Shack', icon: 'ammo' },
  respray: { ...kerbPoint(1, 2, 's'), label: 'Spray Bay', icon: 'spray' },
  clinic: { ...kerbPoint(6, 4, 'n'), label: 'Coast Clinic', icon: 'clinic' },
  policeHq: { ...kerbPoint(5, 0, 's'), label: 'TCPD Headquarters', icon: 'police' },
  raceStart: { ...kerbPoint(6, 6, 's', 0.2), label: 'Boulevard Sprint', icon: 'race' },
  taxiRank: { ...kerbPoint(3, 6, 'n'), label: 'Cabana Cab Rank', icon: 'taxi' },
};

const SPECIAL_BLOCKS = {
  '5,4': 'park',
  '2,2': 'park',
  '6,5': 'parking',
  '2,0': 'parking',
  '4,2': 'crest',
  '5,0': 'policeHq',
  '2,5': 'garage',
};

const PALETTES = {
  sunrow: [0xffb3c1, 0xffd6a5, 0xfdffb6, 0xcaffbf, 0x9bf6ff, 0xbdb2ff, 0xffc6ff, 0xfff1e6],
  market: [0xf4a261, 0xe9c46a, 0xe76f51, 0xf2cc8f, 0xd4a373, 0xffe5b4, 0x81b29a, 0xf28482],
  flats: [0xe8dccb, 0xd8e2dc, 0xffe5d9, 0xcdb4db, 0xbde0fe, 0xf5cac3, 0xdde5b6, 0xf7ede2],
  glass: [0x7fd4f5, 0x8fb8ff, 0x74e0d0, 0xa5c8e8, 0x6fb7d9, 0xc9b38a, 0x9be7ff],
  port: [0xa8b2bd, 0x8d99ae, 0xc2b8a3, 0x7f9aa8, 0xb5c0c9],
  heights: [0xfffaf0, 0xfff1d6, 0xfde8e9, 0xf1faee, 0xffffff],
  marina: [0xffffff, 0xe0fbfc, 0xffe8d6, 0xc8f4f0, 0xfff3b0],
};

/**
 * Decide what stands on every block. Returns blocks with their lots (each a footprint, a
 * height and a style), and the parking stalls where parked cars spawn.
 */
export function planCity(seed) {
  const blocks = [];
  const parkingStalls = [];
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      const random = createRandom(hashCoords(i, j, seed));
      const district = districtOfBlock(i, j);
      const kind = SPECIAL_BLOCKS[i + ',' + j] ?? district;
      const rect = blockRect(i, j);
      const inner = { x0: rect.x0 + CITY.sidewalk, z0: rect.z0 + CITY.sidewalk, x1: rect.x1 - CITY.sidewalk, z1: rect.z1 - CITY.sidewalk };
      const block = { i, j, district, kind, rect, inner, lots: [] };
      planLots(block, random, parkingStalls);
      blocks.push(block);
    }
  }
  return { blocks, parkingStalls };
}

function splitGrid(inner, nx, nz, gap) {
  const lots = [];
  const w = (inner.x1 - inner.x0 - gap * (nx - 1)) / nx;
  const d = (inner.z1 - inner.z0 - gap * (nz - 1)) / nz;
  for (let a = 0; a < nx; a += 1) {
    for (let b = 0; b < nz; b += 1) {
      const x0 = inner.x0 + a * (w + gap), z0 = inner.z0 + b * (d + gap);
      lots.push({ x0, z0, x1: x0 + w, z1: z0 + d, a, b, nx, nz });
    }
  }
  return lots;
}

function planLots(block, random, parkingStalls) {
  const { inner, kind } = block;
  const palette = PALETTES[block.district];
  const add = (lot, style, height, extra = {}) => {
    block.lots.push({ ...lot, style, height, color: random.pick(palette), seed: random.int(1, 1e9), ...extra });
  };
  if (kind === 'park') return;
  if (kind === 'parking') {
    for (let row = 0; row < 3; row += 1) {
      for (let slot = 0; slot < 8; slot += 1) {
        const x = inner.x0 + 6 + slot * 7.2;
        const z = inner.z0 + 9 + row * 20;
        if (random.chance(0.55)) parkingStalls.push({ x, z, heading: random.chance(0.5) ? 0 : Math.PI });
      }
    }
    return;
  }
  if (kind === 'crest') {
    const cx = (inner.x0 + inner.x1) / 2, cz = (inner.z0 + inner.z1) / 2;
    add({ x0: cx - 17, z0: cz - 22, x1: cx + 17, z1: cz + 8, a: 0, b: 0, nx: 1, nz: 1 }, 'tower', 150, { color: 0x5ee0c8, landmark: 'crest' });
    return;
  }
  if (kind === 'policeHq') {
    add({ x0: inner.x0 + 4, z0: inner.z0 + 4, x1: inner.x1 - 4, z1: inner.z1 - 22, a: 0, b: 0, nx: 1, nz: 1 }, 'civic', 22, { color: 0xdfe7ef, sign: 'TCPD' });
    for (let slot = 0; slot < 5; slot += 1) parkingStalls.push({ x: inner.x0 + 10 + slot * 10, z: inner.z1 - 9, heading: 0, model: 'cruiser' });
    return;
  }
  if (kind === 'garage') {
    const lots = splitGrid(inner, 2, 2, 5);
    for (const lot of lots) {
      if (lot.a === 0 && lot.b === 1) add({ ...lot, x1: lot.x1 + 12 }, 'garage', 7, { color: 0xffd166, sign: 'QUILL & SONS AUTO' });
      else if (lot.a === 1 && lot.b === 1) continue;
      else add(lot, 'shop', random.range(7, 13));
    }
    parkingStalls.push({ x: inner.x1 - 9, z: inner.z1 - 12, heading: Math.PI / 2, model: 'pico' });
    return;
  }
  if (kind === 'glass') {
    const pattern = random.int(0, 2);
    const lots = pattern === 0 ? splitGrid(inner, 1, 1, 0) : pattern === 1 ? splitGrid(inner, 2, 1, 8) : splitGrid(inner, 2, 2, 8);
    for (const lot of lots) add(lot, 'tower', pattern === 0 ? random.range(95, 135) : pattern === 1 ? random.range(70, 115) : random.range(42, 86));
    return;
  }
  if (kind === 'sunrow') {
    for (const lot of splitGrid(inner, 2, 2, 6)) add(lot, 'hotel', lot.b === 1 ? random.range(16, 30) : random.range(24, 46));
    return;
  }
  if (kind === 'market') {
    for (const lot of splitGrid(inner, 3, 3, 4)) {
      if (lot.a === 1 && lot.b === 1) continue;
      add(lot, 'shop', random.range(6, 14));
    }
    return;
  }
  if (kind === 'port') {
    if (random.chance(0.5)) {
      for (const lot of splitGrid(inner, 1, 2, 10)) add(lot, random.chance(0.6) ? 'warehouse' : 'containers', random.range(9, 13));
    } else {
      for (const lot of splitGrid(inner, 2, 2, 8)) add(lot, random.chance(0.5) ? 'warehouse' : 'containers', random.range(8, 12));
    }
    return;
  }
  if (kind === 'heights') {
    for (const lot of splitGrid(inner, 2, 2, 4)) add(lot, 'villa', random.range(5, 8));
    return;
  }
  if (kind === 'marina') {
    for (const lot of splitGrid(inner, 2, 2, 7)) add(lot, random.chance(0.5) ? 'hotel' : 'club', random.range(10, 22));
    return;
  }
  for (const lot of splitGrid(inner, 2, 2, 6)) add(lot, random.chance(0.25) ? 'shop' : 'apartment', random.range(12, 30));
}
