// The people of Tamarind Coast: they stroll the sidewalks and use the crosswalks, run from
// gunfire and speeding cars, get knocked down when hit, and drop the cash they carried.
import { randomCivilianLook } from './crowdRenderer.js';
import { isPointNearVehicle } from '../vehicles/vehiclePhysics.js';
import { dampAngle, distanceSquared, headingTo } from '../core/mathUtil.js';

const TARGET_COUNT = 38;
const SPAWN_MIN = 38;
const SPAWN_MAX = 120;
const DESPAWN = 150;

export function createPedestrians(game) {
  const list = [];
  let spawnTimer = 0;

  function spawnAt(x, z, look, options = {}) {
    const corner = game.city.sidewalks.nearestCorner(x, z);
    const ped = {
      kind: 'civilian', x, z, y: 0, heading: game.random.range(0, 6.28), stride: game.random.range(0, 6),
      pace: game.random.range(1.15, 1.75), look: look ?? randomCivilianLook(game.random),
      target: options.target ?? corner, previous: null, pose: 'walk', running: false,
      health: 30, down: false, downTime: 0, fear: 0, fearX: 0, fearZ: 0, vx: 0, vz: 0,
      cash: game.random.int(8, 60), radius: 0.35,
    };
    list.push(ped);
    return ped;
  }

  function spawnRandom(anywhere = false) {
    const focus = game.player.position();
    for (let attempt = 0; attempt < 10; attempt += 1) {
      const corner = game.random.pick(game.city.sidewalks.corners);
      const next = game.random.pick(corner.links);
      const t = game.random.next();
      const x = corner.x + (next.x - corner.x) * t, z = corner.z + (next.z - corner.z) * t;
      const d2 = distanceSquared(x, z, focus.x, focus.z);
      if (d2 > SPAWN_MAX * SPAWN_MAX || d2 < (anywhere ? 64 : SPAWN_MIN * SPAWN_MIN)) continue;
      const ped = spawnAt(x, z, null, { target: next });
      ped.previous = corner;
      return ped;
    }
    return null;
  }

  /** Make a pedestrian run from a point for a while. */
  function frighten(ped, x, z, seconds) {
    if (ped.down) return;
    ped.fear = Math.max(ped.fear, seconds);
    ped.fearX = x;
    ped.fearZ = z;
  }

  function knockDown(ped, cause = {}) {
    if (ped.down) return;
    ped.down = true;
    ped.downTime = 0;
    ped.pose = 'down';
    ped.vx = cause.vx ?? 0;
    ped.vz = cause.vz ?? 0;
    game.events.emit('pedDown', { ped, x: ped.x, z: ped.z, byPlayer: cause.byPlayer === true, how: cause.how ?? 'hit' });
  }

  /** Hurt a pedestrian (bullets, fists, blasts). */
  function hurt(ped, amount, cause = {}) {
    if (ped.down) return;
    ped.health -= amount;
    if (ped.health <= 0) knockDown(ped, cause);
    else frighten(ped, cause.x ?? ped.x, cause.z ?? ped.z, 9);
  }

  function update(dt) {
    const focus = game.player.position();
    const vehicles = game.fleet.vehicles;
    for (let k = list.length - 1; k >= 0; k -= 1) {
      const ped = list[k];
      if (ped.down) {
        ped.downTime += dt;
        ped.x += ped.vx * dt;
        ped.z += ped.vz * dt;
        ped.vx *= Math.exp(-3 * dt);
        ped.vz *= Math.exp(-3 * dt);
        game.city.collision.resolveCircle(ped, 0.3);
        if (ped.downTime > 22) list.splice(k, 1);
        continue;
      }
      if (distanceSquared(ped.x, ped.z, focus.x, focus.z) > DESPAWN * DESPAWN) {
        list.splice(k, 1);
        continue;
      }
      let speed = ped.pace, wanted;
      if (ped.fear > 0) {
        ped.fear -= dt;
        wanted = headingTo(ped.fearX, ped.fearZ, ped.x, ped.z);
        speed = 5.2;
        ped.running = true;
        ped.pose = ped.fear > 6 && Math.floor(ped.stride) % 5 === 0 ? 'panic' : 'walk';
      } else {
        ped.running = false;
        ped.pose = 'walk';
        const dx = ped.target.x - ped.x, dz = ped.target.z - ped.z;
        if (dx * dx + dz * dz < 1.2) {
          const choices = ped.target.links.filter((corner) => corner !== ped.previous);
          ped.previous = ped.target;
          ped.target = choices.length > 0 ? game.random.pick(choices) : ped.previous;
        }
        wanted = headingTo(ped.x, ped.z, ped.target.x, ped.target.z);
      }
      ped.heading = dampAngle(ped.heading, wanted, 8, dt);
      ped.x += Math.sin(ped.heading) * speed * dt;
      ped.z += Math.cos(ped.heading) * speed * dt;
      ped.stride += speed * dt * 3.2;
      game.city.collision.resolveCircle(ped, ped.radius);
      ped.y = game.city.groundHeight(ped.x, ped.z);

      for (const vehicle of vehicles) {
        if (Math.abs(vehicle.x - ped.x) > 5 || Math.abs(vehicle.z - ped.z) > 5) continue;
        const fast = Math.abs(vehicle.speed) > 4;
        if (isPointNearVehicle(vehicle, ped.x, ped.z, 0.25)) {
          if (fast) {
            knockDown(ped, { vx: vehicle.vx * 0.7, vz: vehicle.vz * 0.7, byPlayer: vehicle.role === 'player', how: 'runOver' });
          } else {
            const away = headingTo(vehicle.x, vehicle.z, ped.x, ped.z);
            ped.x += Math.sin(away) * dt * 3;
            ped.z += Math.cos(away) * dt * 3;
          }
          break;
        }
        if (fast && ped.fear <= 0 && vehicle.role === 'player' && isPointNearVehicle(vehicle, ped.x, ped.z, 3)) frighten(ped, vehicle.x, vehicle.z, 3);
      }
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.25;
      let standing = 0;
      for (const ped of list) if (!ped.down) standing += 1;
      if (standing < TARGET_COUNT) spawnRandom();
    }
  }

  function populate(count = TARGET_COUNT) {
    for (let k = 0; k < count * 3 && list.length < count; k += 1) spawnRandom(true);
  }

  function draw(crowd) {
    for (const ped of list) crowd.draw(ped);
  }

  const scare = ({ x, z, radius }) => {
    const reach = (radius ?? 0) + 42;
    for (const ped of list) {
      if (distanceSquared(x, z, ped.x, ped.z) < reach * reach) frighten(ped, x, z, game.random.range(7, 12));
    }
  };
  game.events.on('gunshot', scare);
  game.events.on('explosion', (blast) => {
    scare(blast);
    for (const ped of list) {
      if (distanceSquared(blast.x, blast.z, ped.x, ped.z) < blast.radius * blast.radius) {
        knockDown(ped, { vx: (ped.x - blast.x) * 1.5, vz: (ped.z - blast.z) * 1.5, byPlayer: blast.byPlayer, how: 'blast' });
      }
    }
  });

  return { list, spawnAt, spawnRandom, populate, frighten, hurt, knockDown, update, draw };
}
