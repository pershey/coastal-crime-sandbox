// Armed people on foot: TCPD officers, tactical squads and Halcyon Crest's hired guards.
// They close in on the player, take aim when they have a clear line, fire in bursts, and
// officers try an arrest when the player is stopped at a low wanted level.
import { CREST_GUARD_LOOK, OFFICER_LOOK, TACTICAL_LOOK } from '../actors/crowdRenderer.js';
import { dampAngle, distance, headingTo } from '../core/mathUtil.js';
import { isPointNearVehicle } from '../vehicles/vehiclePhysics.js';

const KINDS = {
  officer: { look: OFFICER_LOOK, health: 60, damage: 7, interval: 0.7, range: 38, accuracy: 0.5, speed: 4.6, faction: 'police' },
  tactical: { look: TACTICAL_LOOK, health: 110, damage: 9, interval: 0.22, range: 46, accuracy: 0.45, speed: 4.9, faction: 'police' },
  guard: { look: CREST_GUARD_LOOK, health: 70, damage: 8, interval: 0.5, range: 40, accuracy: 0.45, speed: 4.4, faction: 'crest' },
  enforcer: { look: { ...CREST_GUARD_LOOK, top: 0x7a1f3d }, health: 160, damage: 11, interval: 0.16, range: 44, accuracy: 0.5, speed: 4.2, faction: 'crest' },
};

export function createGunmen(game) {
  const list = [];

  /** Add an armed person. Options: tag (missions count these), hold (stay near the spawn point). */
  function spawn(kindName, x, z, options = {}) {
    const kind = KINDS[kindName];
    const gunman = {
      kind: 'gunman', kindName, faction: kind.faction, spec: kind, x, z, y: 0, heading: options.heading ?? 0, stride: 0,
      pose: 'stand', running: false, armed: true, look: kind.look, radius: 0.38,
      health: kind.health, down: false, downTime: 0, cooldown: game.random.range(0.4, 1.4), burst: 0,
      tag: options.tag ?? null, hold: options.hold ?? false, homeX: x, homeZ: z, arrestTime: 0, alert: options.alert ?? true,
      vx: 0, vz: 0, strafe: game.random.sign(), repath: 0,
    };
    list.push(gunman);
    return gunman;
  }

  function hurt(gunman, amount, cause = {}) {
    if (gunman.down) return;
    gunman.health -= amount;
    gunman.alert = true;
    if (gunman.health > 0) return;
    gunman.down = true;
    gunman.pose = 'down';
    gunman.vx = cause.vx ?? 0;
    gunman.vz = cause.vz ?? 0;
    game.events.emit('gunmanDown', { gunman, x: gunman.x, z: gunman.z, faction: gunman.faction, byPlayer: cause.byPlayer === true, tag: gunman.tag });
  }

  function remove(gunman) {
    const index = list.indexOf(gunman);
    if (index !== -1) list.splice(index, 1);
  }

  function removeWhere(test) {
    for (let k = list.length - 1; k >= 0; k -= 1) if (test(list[k])) list.splice(k, 1);
  }

  function think(gunman, dt) {
    const target = game.player.position();
    const player = game.player.state;
    const spec = gunman.spec;
    const range = distance(gunman.x, gunman.z, target.x, target.z);
    const sees = range < 70 && game.city.collision.hasLineOfSight(gunman.x, gunman.z, target.x, target.z, 1.3);
    gunman.sees = sees;
    if (!gunman.alert) {
      if (sees && range < 28) gunman.alert = true;
      gunman.pose = 'stand';
      return;
    }
    const toTarget = headingTo(gunman.x, gunman.z, target.x, target.z);
    const police = gunman.faction === 'police';
    const stars = game.wanted.state.stars;
    if (police && stars === 0) {
      gunman.pose = 'stand';
      return;
    }
    // Officers who have lost the player head for where they were last seen, not where they are.
    if (police && !sees && !game.wanted.state.seen) {
      const lastX = game.wanted.state.lastSeenX, lastZ = game.wanted.state.lastSeenZ;
      if (distance(gunman.x, gunman.z, lastX, lastZ) > 4 && !gunman.hold) {
        gunman.heading = dampAngle(gunman.heading, headingTo(gunman.x, gunman.z, lastX, lastZ), 9, dt);
        gunman.x += Math.sin(gunman.heading) * spec.speed * 0.7 * dt;
        gunman.z += Math.cos(gunman.heading) * spec.speed * 0.7 * dt;
        game.city.collision.resolveCircle(gunman, gunman.radius);
        gunman.stride += spec.speed * 0.7 * dt * 3;
        gunman.pose = 'walk';
      } else gunman.pose = 'stand';
      return;
    }
    // At one star an officer walks up and makes the arrest rather than opening fire.
    const arresting = police && stars <= 1 && !game.wanted.state.shotsFired;
    const preferred = arresting ? 1.4 : gunman.hold ? spec.range * 0.8 : 13;
    let moveHeading = null;
    if (!sees || range > preferred + 2) moveHeading = toTarget;
    else if (!arresting && range < 6) moveHeading = toTarget + Math.PI;
    if (gunman.hold && distance(gunman.x, gunman.z, gunman.homeX, gunman.homeZ) > 14) moveHeading = headingTo(gunman.x, gunman.z, gunman.homeX, gunman.homeZ);

    if (moveHeading !== null && !(gunman.hold && sees && range < spec.range)) {
      gunman.heading = dampAngle(gunman.heading, moveHeading, 9, dt);
      const before = { x: gunman.x, z: gunman.z };
      gunman.x += Math.sin(gunman.heading) * spec.speed * dt;
      gunman.z += Math.cos(gunman.heading) * spec.speed * dt;
      const hit = game.city.collision.resolveCircle(gunman, gunman.radius);
      if (hit) {
        // Slide along the wall, choosing a side and keeping to it for a while.
        gunman.x += -hit.nz * gunman.strafe * spec.speed * dt * 0.9;
        gunman.z += hit.nx * gunman.strafe * spec.speed * dt * 0.9;
        gunman.repath += dt;
        if (gunman.repath > 2.5) { gunman.strafe *= -1; gunman.repath = 0; }
      }
      gunman.stride += Math.hypot(gunman.x - before.x, gunman.z - before.z) * 3;
      gunman.pose = 'walk';
      gunman.running = true;
    } else {
      gunman.heading = dampAngle(gunman.heading, toTarget, 12, dt);
      gunman.pose = arresting ? 'stand' : 'aim';
    }

    if (arresting) {
      if (range < 2.4 && Math.abs(game.player.speed()) < 1.2 && !player.down) {
        gunman.arrestTime += dt;
        if (gunman.arrestTime > 1.6) game.events.emit('playerBusted', {});
      } else gunman.arrestTime = Math.max(0, gunman.arrestTime - dt);
      return;
    }
    gunman.cooldown -= dt;
    if (sees && range < spec.range && gunman.cooldown <= 0 && !player.down) {
      gunman.cooldown = spec.interval * (gunman.burst > 0 ? 1 : game.random.range(1.5, 3.2));
      gunman.burst = gunman.burst > 0 ? gunman.burst - 1 : spec.interval < 0.3 ? 4 : 0;
      gunman.pose = 'aim';
      const moving = Math.min(1, Math.abs(game.player.speed()) / 22);
      const chance = spec.accuracy * (1 - range / (spec.range * 1.5)) * (1 - moving * 0.6);
      const miss = game.random.chance(chance) ? 0 : game.random.sign() * game.random.range(0.05, 0.14);
      game.ballistics.fire({ x: gunman.x + Math.sin(toTarget) * 0.7, z: gunman.z + Math.cos(toTarget) * 0.7, heading: toTarget + miss, range: spec.range + 10, damage: spec.damage, shooter: gunman, byPlayer: false });
      game.effects.muzzleFlash(gunman.x + Math.sin(toTarget) * 0.8, 1.4, gunman.z + Math.cos(toTarget) * 0.8);
      game.events.emit('gunshot', { x: gunman.x, z: gunman.z, byPlayer: false });
    }
  }

  function update(dt) {
    for (let k = list.length - 1; k >= 0; k -= 1) {
      const gunman = list[k];
      if (gunman.down) {
        gunman.downTime += dt;
        gunman.x += gunman.vx * dt;
        gunman.z += gunman.vz * dt;
        gunman.vx *= Math.exp(-3 * dt);
        gunman.vz *= Math.exp(-3 * dt);
        if (gunman.downTime > 25) list.splice(k, 1);
        continue;
      }
      think(gunman, dt);
      gunman.y = game.city.groundHeight(gunman.x, gunman.z);
      // A fast car knocks a gunman down like anyone else.
      for (const vehicle of game.fleet.vehicles) {
        if (Math.abs(vehicle.x - gunman.x) > 5 || Math.abs(vehicle.z - gunman.z) > 5 || Math.abs(vehicle.speed) < 5) continue;
        if (isPointNearVehicle(vehicle, gunman.x, gunman.z, 0.25)) {
          hurt(gunman, 40 + Math.abs(vehicle.speed) * 6, { byPlayer: vehicle.role === 'player', vx: vehicle.vx * 0.7, vz: vehicle.vz * 0.7 });
          break;
        }
      }
    }
  }

  function draw(crowd) {
    for (const gunman of list) crowd.draw(gunman);
  }

  game.events.on('explosion', (blast) => {
    for (const gunman of list) {
      const d = distance(blast.x, blast.z, gunman.x, gunman.z);
      if (d < blast.radius) hurt(gunman, 200, { byPlayer: blast.byPlayer, vx: (gunman.x - blast.x) * 1.5, vz: (gunman.z - blast.z) * 1.5 });
    }
  });

  return { list, spawn, hurt, remove, removeWhere, update, draw };
}
