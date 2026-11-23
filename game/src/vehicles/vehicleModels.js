// Builds each vehicle's low-poly mesh from its catalogue entry: body, sloped cabin glass,
// wheels, lights, and extras such as a taxi sign, a pickup bed or a police light bar.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';

const GLASS = 0x1b2836;
const TIRE = 0x15171a;
const HUB = 0xb8c0c8;
const TRIM = 0x23272e;

export const paintMaterial = new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 70, specular: 0x555555 });
export const wreckMaterial = new THREE.MeshLambertMaterial({ color: 0x1b1b1b });
const lampMaterial = new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false });
const sirenRed = new THREE.MeshBasicMaterial({ color: 0xff2020, toneMapped: false });
const sirenBlue = new THREE.MeshBasicMaterial({ color: 0x2060ff, toneMapped: false });
const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xfff1c4, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false });
const wheelMatrix = new THREE.Matrix4();

function addWheel(b, x, z, radius) {
  wheelMatrix.makeRotationZ(Math.PI / 2).setPosition(x, radius, z);
  b.setTransform(wheelMatrix);
  b.cylinder(0, -0.13, 0, radius, radius, 0.26, 10, TIRE, { top: x < 0 ? HUB : TIRE, bottom: true });
  b.cylinder(0, -0.135, 0, radius * 0.55, radius * 0.55, 0.27, 8, HUB, { top: HUB, bottom: true });
  b.setTransform(null);
}

/** The merged body geometry for a catalogue entry in one paint colour. Faces +z. */
function buildBodyGeometry(spec, paint) {
  const b = new MeshBuilder();
  const L = spec.length, W = spec.width, H = spec.height;
  const style = spec.body;
  const wheelR = style === 'truck' ? 0.5 : style === 'pickup' || style === 'van' ? 0.42 : 0.34;
  const floor = wheelR * 0.75;
  const second = spec.stripe ?? paint;

  if (style === 'van' || style === 'truck') {
    const bodyH = H - floor;
    b.prism(0, floor, 0, W, bodyH, L, paint, { topX: W * 0.94, topZ: L * 0.9, shiftZ: -L * 0.04 });
    b.box(0, floor + bodyH * 0.52, L * 0.47, W * 0.86, bodyH * 0.3, 0.08, GLASS);
    b.box(W / 2, floor + bodyH * 0.52, L * 0.28, 0.06, bodyH * 0.26, L * 0.2, GLASS);
    b.box(-W / 2, floor + bodyH * 0.52, L * 0.28, 0.06, bodyH * 0.26, L * 0.2, GLASS);
    b.box(0, floor + bodyH * 0.3, 0, W + 0.04, bodyH * 0.14, L * 0.7, second);
  } else {
    const bodyH = style === 'sports' ? 0.5 : style === 'pickup' ? 0.75 : 0.58;
    b.prism(0, floor, 0, W, bodyH, L, paint, { topX: W * 0.94, topZ: L * 0.93, shiftZ: -L * 0.015 });
    // Dark sills, a grille and number plates break up the slab sides.
    b.box(0, floor - 0.04, 0, W + 0.03, 0.14, L * 0.6, TRIM);
    b.box(0, floor + 0.1, L / 2 - 0.02, W * 0.46, bodyH * 0.42, 0.08, TRIM);
    b.box(0, floor + 0.04, L / 2 + 0.07, 0.5, 0.13, 0.04, 0xf2f2f2);
    b.box(0, floor + 0.2, -L / 2 - 0.03, 0.5, 0.13, 0.04, 0xf2f2f2);
    const cabinH = H - floor - bodyH;
    const plan = {
      compact: { len: 0.56, at: -0.06, top: 0.72 },
      sedan: { len: 0.5, at: -0.04, top: 0.62 },
      sports: { len: 0.4, at: -0.1, top: 0.55 },
      muscle: { len: 0.4, at: -0.12, top: 0.62 },
      convertible: { len: 0.36, at: -0.08, top: 0.5 },
      pickup: { len: 0.32, at: 0.08, top: 0.8 },
    }[style];
    const cabinL = L * plan.len, cabinZ = L * plan.at;
    if (style === 'convertible') {
      b.prism(0, floor + bodyH, cabinZ + cabinL * 0.4, W * 0.88, cabinH * 0.8, 0.5, GLASS, { topX: W * 0.8, topZ: 0.1, shiftZ: -0.3 });
      b.box(0, floor + bodyH, cabinZ - cabinL * 0.1, W * 0.8, 0.22, cabinL * 0.7, 0x5c3d2e);
    } else {
      b.prism(0, floor + bodyH, cabinZ, W * 0.9, cabinH, cabinL, GLASS, { topX: W * 0.78, topZ: cabinL * plan.top, shiftZ: -cabinL * 0.04, noTop: true });
      b.box(0, floor + bodyH + cabinH, cabinZ - cabinL * 0.04, W * 0.79, 0.05, cabinL * plan.top + 0.02, paint);
      // A painted pillar between the front and rear side windows, and door mirrors.
      b.prism(0, floor + bodyH, cabinZ - cabinL * 0.03, W * 0.91, cabinH, 0.1, paint, { topX: W * 0.79, topZ: 0.1, noTop: true });
      for (const side of [-1, 1]) b.box(side * (W * 0.46 + 0.08), floor + bodyH, cabinZ + cabinL * 0.36, 0.16, 0.12, 0.1, paint);
    }
    if (style === 'pickup') {
      const bedL = L * 0.42, bedZ = -L * 0.27;
      b.box(W / 2 - 0.06, floor + bodyH, bedZ, 0.12, 0.42, bedL, paint);
      b.box(-W / 2 + 0.06, floor + bodyH, bedZ, 0.12, 0.42, bedL, paint);
      b.box(0, floor + bodyH, -L / 2 + 0.07, W, 0.42, 0.12, paint);
    }
    if (style === 'sports' || style === 'muscle') {
      b.box(0, floor + bodyH + 0.16, -L / 2 + 0.22, W * 0.9, 0.06, 0.34, style === 'sports' ? TRIM : paint);
      b.box(W * 0.36, floor + bodyH, -L / 2 + 0.22, 0.06, 0.16, 0.1, TRIM);
      b.box(-W * 0.36, floor + bodyH, -L / 2 + 0.22, 0.06, 0.16, 0.1, TRIM);
    }
    if (style === 'muscle') b.box(0, floor + bodyH, L * 0.22, 0.5, 0.1, L * 0.3, TRIM);
    if (spec.stripe) b.box(0, floor + bodyH * 0.35, 0, W + 0.04, bodyH * 0.3, L * 0.5, spec.stripe);
    if (spec.roofSign) b.box(0, H + 0.02, cabinZ, 0.9, 0.2, 0.34, spec.roofSign);
    if (spec.taxi) b.box(0, floor + bodyH * 0.4, 0, W + 0.04, 0.16, L * 0.6, 0x111111);
  }

  // Bumpers, lights and wheels.
  b.box(0, floor, L / 2, W * 0.98, 0.22, 0.16, TRIM);
  b.box(0, floor, -L / 2, W * 0.98, 0.22, 0.16, TRIM);
  // Lamps are a separate unlit mesh, so headlights and tail lights glow after dark.
  const lamps = new MeshBuilder();
  const lightY = floor + (style === 'van' || style === 'truck' ? 0.5 : 0.3);
  for (const side of [-1, 1]) {
    lamps.box(side * W * 0.34, lightY, L / 2 + 0.02, W * 0.22, 0.16, 0.08, 0xfff6cf, { bottom: true });
    lamps.box(side * W * 0.34, lightY, -L / 2 - 0.02, W * 0.24, 0.14, 0.08, 0xff1f1f, { bottom: true });
  }
  if (style === 'sports' || style === 'muscle') lamps.box(0, lightY + 0.02, -L / 2 - 0.02, W * 0.4, 0.05, 0.06, 0xff1f1f);
  const axle = L * 0.31, track = W / 2 - 0.08;
  addWheel(b, track, axle, wheelR);
  addWheel(b, -track, axle, wheelR);
  addWheel(b, track, -axle, wheelR);
  addWheel(b, -track, -axle, wheelR);
  return { body: b.build(), lamps: lamps.build() };
}

const geometryCache = new Map();

/**
 * A scene object for one vehicle. Returns the group, plus the siren lamps (police only)
 * and the headlight beam that the fleet switches on after dark.
 */
export function createVehicleMesh(modelKey, spec, paint) {
  const cacheKey = modelKey + ':' + paint;
  if (!geometryCache.has(cacheKey)) geometryCache.set(cacheKey, buildBodyGeometry(spec, paint));
  const group = new THREE.Group();
  const geometry = geometryCache.get(cacheKey);
  const body = new THREE.Mesh(geometry.body, paintMaterial);
  body.castShadow = true;
  body.receiveShadow = true;
  const lamps = new THREE.Mesh(geometry.lamps, lampMaterial);
  body.add(lamps);
  group.add(body);
  const parts = { group, body, lamps, sirens: null, beam: null };
  if (spec.police) {
    const barY = spec.height + 0.04;
    const red = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.36, 0.16, 0.3), sirenRed);
    const blue = new THREE.Mesh(new THREE.BoxGeometry(spec.width * 0.36, 0.16, 0.3), sirenBlue);
    red.position.set(spec.width * 0.2, barY + 0.08, -spec.length * 0.04);
    blue.position.set(-spec.width * 0.2, barY + 0.08, -spec.length * 0.04);
    group.add(red, blue);
    parts.sirens = [red, blue];
  }
  const beam = new THREE.Mesh(new THREE.PlaneGeometry(spec.width * 1.5, 9), beamMaterial);
  beam.rotation.x = -Math.PI / 2;
  beam.position.set(0, 0.06, spec.length / 2 + 4.6);
  beam.visible = false;
  group.add(beam);
  parts.beam = beam;
  return parts;
}

/** How bright headlight beams are (0 by day, up to about 0.3 at night); paint picks up a little street glow too. */
export function setHeadlightStrength(strength) {
  beamMaterial.opacity = strength;
  paintMaterial.emissive.setScalar(strength * 0.22);
}
