// Visual effects: exhaust and wreck smoke, sparks, muzzle flashes, bullet tracers, and the
// fireball of an exploding car. Two instanced meshes (solid puffs and glowing ones) draw
// every particle in the world.
import * as THREE from '../../vendor/three.module.min.js';

const CAPACITY = 500;

export function createParticleEffects(game) {
  const solid = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), new THREE.MeshLambertMaterial(), CAPACITY);
  const glowMaterial = new THREE.MeshBasicMaterial({ toneMapped: false, transparent: true, opacity: 0.92, blending: THREE.AdditiveBlending, depthWrite: false });
  const glowing = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.5, 0), glowMaterial, CAPACITY);
  const beams = new THREE.InstancedMesh(new THREE.BoxGeometry(0.05, 0.05, 1), glowMaterial, 120);
  for (const mesh of [solid, glowing, beams]) {
    mesh.frustumCulled = false;
    mesh.count = 0;
    game.scene.add(mesh);
  }
  const particles = [];
  const tracers = [];
  const dummy = new THREE.Object3D();
  const color = new THREE.Color();

  function add(glow, x, y, z, vx, vy, vz, life, size, growth, hex) {
    if (particles.length >= CAPACITY * 2 - 2) particles.shift();
    particles.push({ glow, x, y, z, vx, vy, vz, life, maxLife: life, size, growth, hex });
  }

  /** A puff of smoke; `fire` adds a lick of flame under it. */
  function smoke(x, y, z, fire = false) {
    const r = game.random;
    add(false, x, y, z, r.range(-0.4, 0.4), r.range(1.2, 2.2), r.range(-0.4, 0.4), r.range(1.1, 1.9), 0.5, 1.1, fire ? 0x2a2a2a : 0x8a8a8a);
    if (fire) add(true, x, y - 0.2, z, r.range(-0.3, 0.3), r.range(0.8, 1.6), r.range(-0.3, 0.3), 0.45, 0.7, -0.6, r.chance(0.5) ? 0xff7b00 : 0xffc300);
  }

  function sparks(x, y, z, count = 5, hex = 0xffe08a) {
    const r = game.random;
    for (let k = 0; k < count; k += 1) add(true, x, y, z, r.range(-4, 4), r.range(1, 5), r.range(-4, 4), r.range(0.15, 0.4), 0.14, -0.2, hex);
  }

  function dust(x, y, z, hex = 0xd8cfc0) {
    const r = game.random;
    add(false, x, y, z, r.range(-0.8, 0.8), r.range(0.3, 1), r.range(-0.8, 0.8), r.range(0.4, 0.8), 0.3, 0.9, hex);
  }

  function muzzleFlash(x, y, z) {
    add(true, x, y, z, 0, 0, 0, 0.06, 0.55, 2, 0xfff1a8);
  }

  /** A streak from one point to another that lasts a few frames. */
  function tracer(x0, y0, z0, x1, y1, z1, hex = 0xfff3b0) {
    if (tracers.length >= 118) tracers.shift();
    tracers.push({ x0, y0, z0, x1, y1, z1, life: 0.07, hex });
  }

  function explosion(x, z) {
    const r = game.random;
    for (let k = 0; k < 16; k += 1) {
      add(true, x + r.range(-1.5, 1.5), r.range(0.5, 2.5), z + r.range(-1.5, 1.5), r.range(-7, 7), r.range(2, 11), r.range(-7, 7), r.range(0.35, 0.8), r.range(1.6, 3.4), 2.5, r.pick([0xff5400, 0xff9e00, 0xffd000, 0xffffff]));
    }
    for (let k = 0; k < 14; k += 1) {
      add(false, x + r.range(-2, 2), r.range(1, 3), z + r.range(-2, 2), r.range(-3, 3), r.range(2.5, 7), r.range(-3, 3), r.range(1.6, 3), r.range(1.4, 2.6), 1.6, r.pick([0x1f1f1f, 0x333333, 0x4a4a4a]));
    }
    sparks(x, 1.5, z, 18, 0xffb703);
  }

  function update(dt) {
    let solidCount = 0, glowCount = 0;
    for (let k = particles.length - 1; k >= 0; k -= 1) {
      const p = particles[k];
      p.life -= dt;
      if (p.life <= 0) {
        particles.splice(k, 1);
        continue;
      }
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.z += p.vz * dt;
      if (p.glow && p.growth < 0) p.vy -= 12 * dt;
      p.size = Math.max(0.02, p.size + p.growth * dt);
      const fade = Math.min(1, (p.life / p.maxLife) * 2.2);
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(p.life * 2, p.life * 3, 0);
      dummy.scale.setScalar(p.size * fade);
      dummy.updateMatrix();
      const mesh = p.glow ? glowing : solid;
      const index = p.glow ? glowCount : solidCount;
      if (index >= CAPACITY) continue;
      mesh.setMatrixAt(index, dummy.matrix);
      mesh.setColorAt(index, color.setHex(p.hex));
      if (p.glow) glowCount += 1;
      else solidCount += 1;
    }
    solid.count = solidCount;
    glowing.count = glowCount;
    let beamCount = 0;
    for (let k = tracers.length - 1; k >= 0; k -= 1) {
      const t = tracers[k];
      t.life -= dt;
      if (t.life <= 0) {
        tracers.splice(k, 1);
        continue;
      }
      dummy.position.set((t.x0 + t.x1) / 2, (t.y0 + t.y1) / 2, (t.z0 + t.z1) / 2);
      dummy.scale.set(1, 1, Math.hypot(t.x1 - t.x0, t.y1 - t.y0, t.z1 - t.z0));
      dummy.lookAt(t.x1, t.y1, t.z1);
      dummy.updateMatrix();
      beams.setMatrixAt(beamCount, dummy.matrix);
      beams.setColorAt(beamCount, color.setHex(t.hex));
      beamCount += 1;
    }
    beams.count = beamCount;
    for (const mesh of [solid, glowing, beams]) {
      mesh.instanceMatrix.needsUpdate = true;
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }

  game.events.on('explosion', ({ x, z }) => explosion(x, z));
  game.events.on('carImpact', ({ vehicle, impact }) => {
    if (impact > 6) sparks(vehicle.x + Math.sin(vehicle.heading) * 2, 0.8, vehicle.z + Math.cos(vehicle.heading) * 2, 6);
  });
  game.events.on('carCrash', ({ a, b, closing }) => {
    if (closing > 4) sparks((a.x + b.x) / 2, 0.9, (a.z + b.z) / 2, 7);
  });

  return { smoke, sparks, dust, muzzleFlash, tracer, explosion, update };
}
