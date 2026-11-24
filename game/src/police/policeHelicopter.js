// Air One, the police helicopter. From three stars it circles above the player with a
// searchlight, keeps the police from losing sight of them, and from four stars opens fire.
import * as THREE from '../../vendor/three.module.min.js';
import { MeshBuilder } from '../core/meshBuilder.js';
import { damp, distance } from '../core/mathUtil.js';

const CRUISE_HEIGHT = 24;
const ORBIT_RADIUS = 34;
const TOP_SPEED = 27;

function buildHelicopterMesh(material) {
  const b = new MeshBuilder();
  b.prism(0, 0, 0.4, 2, 2.1, 4.6, 0x1d3f7a, { topX: 1.5, topZ: 3.2 });
  b.prism(0, 0.5, 2.5, 1.7, 1.4, 1.4, 0x18212d, { topX: 1.2, topZ: 0.4, shiftZ: -0.5 });
  b.box(0, 0.25, 0.4, 2.04, 0.5, 4.3, 0xf4f6f8);
  b.prism(0, 0.9, -4.2, 0.5, 0.6, 5.2, 0x1d3f7a, { topX: 0.3, topZ: 5 });
  b.box(0, 1.1, -6.6, 0.12, 1.8, 0.9, 0xf4f6f8);
  b.box(0, 2.1, 0.3, 0.3, 0.5, 0.3, 0x30363d);
  for (const side of [-1, 1]) {
    b.box(side * 1.05, -0.75, 0.4, 0.12, 0.12, 4, 0x30363d);
    b.box(side * 0.9, -0.7, 1.4, 0.1, 0.75, 0.1, 0x30363d);
    b.box(side * 0.9, -0.7, -0.6, 0.1, 0.75, 0.1, 0x30363d);
  }
  const body = new THREE.Mesh(b.build(), material);
  body.castShadow = true;
  const rotor = new THREE.Mesh(new THREE.BoxGeometry(11.5, 0.06, 0.34), new THREE.MeshBasicMaterial({ color: 0x20242a }));
  const rotorCross = new THREE.Mesh(new THREE.BoxGeometry(0.34, 0.06, 11.5), rotor.material);
  rotor.add(rotorCross);
  rotor.position.set(0, 2.65, 0.3);
  const tailRotor = new THREE.Mesh(new THREE.BoxGeometry(0.05, 1.9, 0.2), rotor.material);
  tailRotor.position.set(0.14, 1.6, -6.6);
  const group = new THREE.Group();
  group.add(body, rotor, tailRotor);
  return { group, rotor, tailRotor };
}

export function createPoliceHelicopter(game) {
  const { group, rotor, tailRotor } = buildHelicopterMesh(game.city.materials.plain);
  group.visible = false;
  game.scene.add(group);

  // The searchlight: a soft cone from the helicopter to a pool of light on the ground.
  const beamMaterial = new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0.16, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, toneMapped: false, fog: false });
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 5.5, 1, 14, 1, true), beamMaterial);
  beam.geometry.translate(0, -0.5, 0);
  beam.geometry.rotateX(-Math.PI / 2);
  const pool = new THREE.Mesh(new THREE.CircleGeometry(5.5, 20), new THREE.MeshBasicMaterial({ color: 0xdfefff, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false, fog: false }));
  pool.rotation.x = -Math.PI / 2;
  beam.visible = false;
  pool.visible = false;
  game.scene.add(beam, pool);

  const state = { active: false, x: 0, y: 120, z: 0, heading: 0, orbit: 0, radius: ORBIT_RADIUS, height: CRUISE_HEIGHT, cooldown: 3, spotX: 0, spotZ: 0 };

  /**
   * Put the helicopter straight on station (screenshot scenes and mission set-pieces).
   * A wider, lower station than the default has it trail the chase down the street.
   */
  function placeOnStation(orbitAngle = 0.6, radius = ORBIT_RADIUS, height = CRUISE_HEIGHT) {
    const p = game.player.position();
    state.active = true;
    state.orbit = orbitAngle;
    state.radius = radius;
    state.height = height;
    state.x = p.x + Math.sin(orbitAngle) * radius;
    state.z = p.z + Math.cos(orbitAngle) * radius;
    state.y = height;
    state.spotX = p.x;
    state.spotZ = p.z;
  }

  /** The crew sees the player when close enough and no tall building is in the way. */
  function seesPlayer() {
    if (!state.active) return false;
    const p = game.player.position();
    if (distance(state.x, state.z, p.x, p.z) > 70) return false;
    // On foot, pressing up against a building hides you from the searchlight.
    if (!game.player.state.vehicle && game.city.collision.isBlocked(p.x, p.z, 3.2)) return false;
    return game.city.collision.hasLineOfSight(state.x, state.z, p.x, p.z, 16);
  }

  function update(dt) {
    const stars = game.wanted.state.stars;
    const p = game.player.position();
    if (stars >= 3 && !state.active) {
      state.active = true;
      state.x = p.x - 220;
      state.z = p.z - 160;
      state.y = 90;
      state.spotX = state.x;
      state.spotZ = state.z;
      state.radius = ORBIT_RADIUS;
      state.height = CRUISE_HEIGHT;
      game.events.emit('helicopterInbound', {});
    }
    if (!state.active) {
      group.visible = false;
      beam.visible = false;
      pool.visible = false;
      return;
    }
    // Circle the player while anyone has eyes on them; otherwise sweep the place they were last seen.
    const wanted = game.wanted.state;
    const focus = wanted.seen ? p : { x: wanted.lastSeenX, z: wanted.lastSeenZ };
    let goalX, goalZ, goalY;
    if (stars >= 3) {
      state.orbit += dt * 0.35;
      goalX = focus.x + Math.sin(state.orbit) * state.radius;
      goalZ = focus.z + Math.cos(state.orbit) * state.radius;
      goalY = state.height;
    } else {
      goalX = state.x - 60;
      goalZ = state.z - 60;
      goalY = 160;
      if (state.y > 140) state.active = false;
    }
    // It eases toward its station but tops out at TOP_SPEED, so a fast car can outrun it.
    const beforeX = state.x, beforeZ = state.z;
    let moveX = damp(state.x, goalX, 1.1, dt) - state.x, moveZ = damp(state.z, goalZ, 1.1, dt) - state.z;
    const moved = Math.hypot(moveX, moveZ);
    if (moved > TOP_SPEED * dt) {
      moveX *= (TOP_SPEED * dt) / moved;
      moveZ *= (TOP_SPEED * dt) / moved;
    }
    state.x += moveX;
    state.z += moveZ;
    state.y = damp(state.y, goalY, 0.9, dt);
    const vx = (state.x - beforeX) / dt, vz = (state.z - beforeZ) / dt;
    state.heading = Math.atan2(focus.x - state.x, focus.z - state.z);
    group.visible = true;
    group.position.set(state.x, state.y, state.z);
    group.rotation.set(Math.min(0.3, Math.hypot(vx, vz) * 0.012), state.heading, 0);
    rotor.rotation.y += dt * 38;
    tailRotor.rotation.x += dt * 50;

    const searching = stars >= 3;
    const sweep = wanted.seen ? 0 : 14;
    state.spotX = damp(state.spotX, focus.x + Math.sin(game.time * 0.9) * sweep, 3.5, dt);
    state.spotZ = damp(state.spotZ, focus.z + Math.cos(game.time * 0.7) * sweep, 3.5, dt);
    beam.visible = searching;
    pool.visible = searching;
    if (searching) {
      const length = Math.hypot(state.spotX - state.x, state.y - 1, state.spotZ - state.z);
      beam.position.set(state.x, state.y - 0.6, state.z);
      beam.scale.set(1, 1, length);
      beam.lookAt(state.spotX, 0.3, state.spotZ);
      pool.position.set(state.spotX, game.city.groundHeight(state.spotX, state.spotZ) + 0.08, state.spotZ);
      const night = game.nightGlow;
      beamMaterial.opacity = 0.1 + night * 0.16;
      pool.material.opacity = 0.14 + night * 0.25;
    }

    // The door gunner, from four stars.
    state.cooldown -= dt;
    if (stars >= 4 && state.cooldown <= 0 && seesPlayer() && !game.player.state.down) {
      state.cooldown = game.random.range(1.6, 2.8);
      for (let k = 0; k < 3; k += 1) {
        const missX = p.x + game.random.range(-3.5, 3.5), missZ = p.z + game.random.range(-3.5, 3.5);
        game.effects.tracer(state.x, state.y - 0.5, state.z, missX, 0.3, missZ, 0xffd9a0);
        game.effects.dust(missX, 0.3, missZ);
        if (Math.hypot(missX - p.x, missZ - p.z) < 1.6) {
          if (game.player.state.vehicle) game.fleet.damage(game.player.state.vehicle, 9, false);
          game.player.hurt(game.player.state.vehicle ? 3 : 8, { how: 'shot' });
        }
      }
      game.events.emit('gunshot', { x: p.x, z: p.z, byPlayer: false });
    }
  }

  return { state, update, seesPlayer, placeOnStation };
}
