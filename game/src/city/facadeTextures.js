// Textures painted on canvases at start-up: tiling window grids for walls and glass towers,
// their lit-at-night twins, and one atlas of shop and hotel signs. No image file is loaded.
import * as THREE from '../../vendor/three.module.min.js';

const SIGN_COLUMNS = 4;
const SIGN_ROWS = 16;
const SIGN_WIDTH = 256;
const SIGN_HEIGHT = 64;

/** Every sign in the city. All names are this game's own. */
export const SIGN_NAMES = [
  'MANGO MART', 'PAPAYA PAWN', 'TIDEWATER TACOS', 'CAFE CORAL', 'SUNROW SURF CO', 'LOW TIDE LOUNGE',
  'NEON ARCADE', 'GUAVA GRILL', 'PELICAN PIZZA', 'SALT & LIME', 'HOTEL CORALINE', 'THE HERON ARMS',
  'AMMO SHACK', 'QUILL & SONS AUTO', 'SPRAY BAY', 'COAST CLINIC', 'TCPD', 'BODEGA LUNA',
  'ICE POP!', 'KEY LIME RECORDS', 'SEAGRASS SPA', 'BAIT & TACKLE', 'DOCKSIDE DINER', '24H LAUNDRO',
  'PALM LOANS', 'ZEST GYM', 'CINE TROPICO', 'HALCYON CREST', 'RADIO GUAVA 98.1', 'TAMARIND TIMES',
  'CASA VERDE', 'MOTEL MAR AZUL', 'HOTEL SOLEIL BLEU', 'THE SANDBAR', 'PELICAN YACHT CLUB', 'CABANA CAB',
  'MIRADOR SUITES', 'SAFFRON SPICE', 'DOCK 9', 'GLASSWATER BANK', 'CLUB AFTERGLOW', 'FISH SHACK',
];

const SIGN_COLORS = ['#ff4fa3', '#33e1ff', '#ffe14f', '#7dff7a', '#ff8c42', '#c78bff', '#ffffff', '#ff5a5a'];

function makeCanvas(width, height) {
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function tilingTexture(canvas, isColor) {
  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.anisotropy = 8;
  if (isColor) texture.colorSpace = THREE.SRGBColorSpace;
  return texture;
}

/** A 4 x 4 grid of framed windows on a white wall; the wall takes each building's own colour. */
function paintWallWindows(random) {
  const day = makeCanvas(256, 256), night = makeCanvas(256, 256);
  const d = day.getContext('2d'), n = night.getContext('2d');
  d.fillStyle = '#ffffff';
  d.fillRect(0, 0, 256, 256);
  n.fillStyle = '#000000';
  n.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row += 1) {
    d.fillStyle = 'rgba(0, 0, 0, 0.07)';
    d.fillRect(0, row * 64 + 58, 256, 6);
    for (let col = 0; col < 4; col += 1) {
      const x = col * 64 + 14, y = row * 64 + 10;
      d.fillStyle = '#e9e4da';
      d.fillRect(x - 3, y - 3, 42, 44);
      const pane = d.createLinearGradient(x, y, x + 36, y + 38);
      pane.addColorStop(0, '#6f9bb8');
      pane.addColorStop(0.45, '#2f4a63');
      pane.addColorStop(1, '#1b2b3c');
      d.fillStyle = pane;
      d.fillRect(x, y, 36, 38);
      d.fillStyle = '#e9e4da';
      d.fillRect(x + 17, y, 2, 38);
      if (random.chance(0.45)) {
        n.fillStyle = random.chance(0.75) ? '#ffd58a' : '#bfe6ff';
        n.fillRect(x, y, 36, 38);
        n.fillStyle = 'rgba(0, 0, 0, 0.35)';
        n.fillRect(x + 17, y, 2, 38);
      }
    }
  }
  return { map: tilingTexture(day, true), lights: tilingTexture(night, true) };
}

/** Curtain-wall glass: 4 x 4 panels between dark mullions, tinted per tower. */
function paintTowerGlass(random) {
  const day = makeCanvas(256, 256), night = makeCanvas(256, 256);
  const d = day.getContext('2d'), n = night.getContext('2d');
  d.fillStyle = '#3d5a73';
  d.fillRect(0, 0, 256, 256);
  n.fillStyle = '#000000';
  n.fillRect(0, 0, 256, 256);
  for (let row = 0; row < 4; row += 1) {
    for (let col = 0; col < 4; col += 1) {
      const x = col * 64 + 3, y = row * 64 + 3;
      const shade = random.range(0.82, 1);
      const pane = d.createLinearGradient(x, y, x + 58, y + 58);
      pane.addColorStop(0, `rgb(${Math.round(214 * shade)}, ${Math.round(240 * shade)}, ${Math.round(255 * shade)})`);
      pane.addColorStop(1, `rgb(${Math.round(120 * shade)}, ${Math.round(176 * shade)}, ${Math.round(220 * shade)})`);
      d.fillStyle = pane;
      d.fillRect(x, y, 58, 58);
      if (random.chance(0.3)) {
        n.fillStyle = random.chance(0.5) ? '#ffe2a8' : '#cfeaff';
        n.fillRect(x, y, 58, 58);
      }
    }
  }
  return { map: tilingTexture(day, true), lights: tilingTexture(night, true) };
}

function paintSignAtlas() {
  const canvas = makeCanvas(SIGN_COLUMNS * SIGN_WIDTH, SIGN_ROWS * SIGN_HEIGHT);
  const c = canvas.getContext('2d');
  c.fillStyle = '#10131a';
  c.fillRect(0, 0, canvas.width, canvas.height);
  c.textAlign = 'center';
  c.textBaseline = 'middle';
  SIGN_NAMES.forEach((name, index) => {
    const x = (index % SIGN_COLUMNS) * SIGN_WIDTH, y = Math.floor(index / SIGN_COLUMNS) * SIGN_HEIGHT;
    const color = SIGN_COLORS[index % SIGN_COLORS.length];
    c.fillStyle = index % 3 === 0 ? '#1d1030' : index % 3 === 1 ? '#0d2233' : '#2b1320';
    c.fillRect(x, y, SIGN_WIDTH, SIGN_HEIGHT);
    c.strokeStyle = color;
    c.lineWidth = 4;
    c.strokeRect(x + 5, y + 5, SIGN_WIDTH - 10, SIGN_HEIGHT - 10);
    let size = 40;
    c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    const fit = (SIGN_WIDTH - 30) / c.measureText(name).width;
    if (fit < 1) {
      size = Math.floor(size * fit);
      c.font = `900 ${size}px Impact, "Arial Black", sans-serif`;
    }
    c.shadowColor = color;
    c.shadowBlur = 10;
    c.fillStyle = color;
    c.fillText(name, x + SIGN_WIDTH / 2, y + SIGN_HEIGHT / 2 + 2);
    c.shadowBlur = 0;
  });
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return texture;
}

/** [u0, v0, u1, v1] of a named sign in the atlas. */
export function signUv(name) {
  const index = Math.max(0, SIGN_NAMES.indexOf(name));
  const col = index % SIGN_COLUMNS, row = Math.floor(index / SIGN_COLUMNS);
  return [col / SIGN_COLUMNS, 1 - (row + 1) / SIGN_ROWS, (col + 1) / SIGN_COLUMNS, 1 - row / SIGN_ROWS];
}

/** The four materials every building is made of. Night lighting raises their emissive strength. */
export function createCityMaterials(random) {
  const wall = paintWallWindows(random);
  const glass = paintTowerGlass(random);
  return {
    wall: new THREE.MeshLambertMaterial({ map: wall.map, vertexColors: true, emissive: 0xffffff, emissiveMap: wall.lights, emissiveIntensity: 0 }),
    glass: new THREE.MeshPhongMaterial({ map: glass.map, vertexColors: true, shininess: 80, specular: 0x8fb4d6, emissive: 0xffffff, emissiveMap: glass.lights, emissiveIntensity: 0 }),
    plain: new THREE.MeshLambertMaterial({ vertexColors: true }),
    sign: new THREE.MeshBasicMaterial({ map: paintSignAtlas(), toneMapped: false }),
  };
}
