// Owns every vehicle in the world: spawning and removing them, stepping their physics,
// car-to-car crashes, damage, fires and explosions, sirens and headlights.
import { VEHICLES } from './vehicleCatalog.js';
import { createVehicleMesh, setHeadlightStrength, wreckMaterial } from './vehicleModels.js';
import { collideVehicles, stepVehicle } from './vehiclePhysics.js';
import { distanceSquared } from '../core/mathUtil.js';

const EXPLOSION_RADIUS = 9;

export function createVehicleFleet(game) {
  const vehicles = [];
  let nextId = 1;

  /** Put a vehicle in the world. Options: paint, role, speed, tag, locked. */
  function spawn(modelKey, x, z, heading, options = {}) {
    const spec = VEHICLES[modelKey];
    const paint = options.paint ?? game.random.pick(spec.paints);
    const parts = createVehicleMesh(modelKey, spec, paint);
    game.scene.add(parts.group);
    const speed = options.speed ?? 0;
    const vehicle = {
      id: nextId, modelKey, spec, paint, parts,
      x, z, heading, vx: Math.sin(heading) * speed, vz: Math.cos(heading) * speed, speed, steer: 0, spin: 0, slip: 0,
      health: spec.health, wrecked: false, fuse: 0, exploded: false, smokeTimer: 0,
      controls: { throttle: 0, steer: 0, handbrake: false },
      hasDriver: false, driver: null, role: options.role ?? 'parked', tag: options.tag ?? null,
      sirenOn: false, removed: false, age: 0,
    };
    nextId += 1;
    vehicles.push(vehicle);
    syncMesh(vehicle, 0);
    return vehicle;
  }

  function remove(vehicle) {
    if (vehicle.removed) return;
    vehicle.removed = true;
    game.scene.remove(vehicle.parts.group);
    const index = vehicles.indexOf(vehicle);
    if (index !== -1) vehicles.splice(index, 1);
    game.events.emit('vehicleRemoved', { vehicle });
  }

  /** Hurt a vehicle. `byPlayer` marks damage the player caused, for the wanted level. */
  function damage(vehicle, amount, byPlayer = false) {
    if (vehicle.wrecked || amount <= 0) return;
    vehicle.health -= amount;
    if (byPlayer) vehicle.hurtByPlayer = true;
    if (vehicle.health <= 0) {
      vehicle.health = 0;
      vehicle.wrecked = true;
      vehicle.fuse = 2.2;
      game.events.emit('vehicleWrecked', { vehicle, byPlayer: byPlayer || vehicle.hurtByPlayer === true });
    }
  }

  function explode(vehicle) {
    vehicle.exploded = true;
    vehicle.parts.body.material = wreckMaterial;
    vehicle.parts.lamps.visible = false;
    if (vehicle.parts.sirens) for (const lamp of vehicle.parts.sirens) lamp.visible = false;
    game.events.emit('explosion', { x: vehicle.x, z: vehicle.z, radius: EXPLOSION_RADIUS, vehicle, byPlayer: vehicle.hurtByPlayer === true });
    for (const other of vehicles) {
      if (other === vehicle) continue;
      const d2 = distanceSquared(vehicle.x, vehicle.z, other.x, other.z);
      if (d2 < EXPLOSION_RADIUS * EXPLOSION_RADIUS) {
        damage(other, 90 * (1 - Math.sqrt(d2) / EXPLOSION_RADIUS) + 20, vehicle.hurtByPlayer === true);
        const d = Math.sqrt(d2) || 1;
        other.vx += ((other.x - vehicle.x) / d) * 6;
        other.vz += ((other.z - vehicle.z) / d) * 6;
      }
    }
  }

  function syncMesh(vehicle, dt) {
    const group = vehicle.parts.group;
    const ground = game.city.groundHeight(vehicle.x, vehicle.z);
    group.position.set(vehicle.x, group.position.y + (ground - group.position.y) * Math.min(1, dt * 12 + (dt === 0 ? 1 : 0)), vehicle.z);
    group.rotation.set(0, vehicle.heading, 0);
    // Lean into corners and squat under drift.
    const lateral = vehicle.vx * -Math.cos(vehicle.heading) + vehicle.vz * Math.sin(vehicle.heading);
    vehicle.parts.body.rotation.z = Math.max(-0.09, Math.min(0.09, lateral * 0.02 + vehicle.steer * vehicle.speed * 0.0016));
    if (vehicle.parts.sirens) {
      const flash = vehicle.sirenOn && !vehicle.wrecked && Math.floor(game.time * 6 + vehicle.id) % 2 === 0;
      vehicle.parts.sirens[0].visible = !vehicle.exploded && (!vehicle.sirenOn || flash);
      vehicle.parts.sirens[1].visible = !vehicle.exploded && (!vehicle.sirenOn || !flash);
    }
    vehicle.parts.beam.visible = game.nightGlow > 0.05 && vehicle.hasDriver && !vehicle.wrecked;
  }

  function update(dt) {
    setHeadlightStrength(game.nightGlow * 0.32);
    for (const vehicle of vehicles) {
      vehicle.age += dt;
      const impact = stepVehicle(vehicle, dt, game.city.collision);
      if (impact > 5) {
        damage(vehicle, (impact - 5) * 1.5, vehicle.role === 'player');
        game.events.emit('carImpact', { vehicle, impact });
      }
    }
    for (let i = 0; i < vehicles.length; i += 1) {
      for (let j = i + 1; j < vehicles.length; j += 1) {
        const a = vehicles[i], b = vehicles[j];
        const closing = collideVehicles(a, b);
        if (closing > 2.5) {
          const playerInvolved = a.role === 'player' || b.role === 'player';
          // The car the player is driving shrugs off a little more, so a chase lasts.
          damage(a, (closing - 2.5) * (a.role === 'player' ? 0.6 : 1.1) * (b.spec.mass / 1500), playerInvolved && b.role === 'player');
          damage(b, (closing - 2.5) * (b.role === 'player' ? 0.6 : 1.1) * (a.spec.mass / 1500), playerInvolved && a.role === 'player');
          game.events.emit('carCrash', { a, b, closing });
        }
      }
    }
    for (let k = vehicles.length - 1; k >= 0; k -= 1) {
      const vehicle = vehicles[k];
      if (vehicle.wrecked && !vehicle.exploded) {
        vehicle.fuse -= dt;
        if (vehicle.fuse <= 0) explode(vehicle);
      }
      // Tyre smoke off the rear wheels in a drift or a hard launch.
      if (vehicle.slip > 4.5 && Math.abs(vehicle.speed) > 5 && game.effects) {
        vehicle.skidTimer = (vehicle.skidTimer ?? 0) - dt;
        if (vehicle.skidTimer <= 0) {
          vehicle.skidTimer = 0.04;
          const back = vehicle.spec.length * 0.32, side = game.random.sign() * vehicle.spec.width * 0.42;
          game.effects.dust(vehicle.x - Math.sin(vehicle.heading) * back + Math.cos(vehicle.heading) * side, 0.3, vehicle.z - Math.cos(vehicle.heading) * back - Math.sin(vehicle.heading) * side, 0xe8e8e8);
        }
      }
      if (vehicle.health < vehicle.spec.health * 0.4 || vehicle.wrecked) {
        vehicle.smokeTimer -= dt;
        if (vehicle.smokeTimer <= 0) {
          vehicle.smokeTimer = vehicle.wrecked ? 0.07 : 0.16;
          const nose = vehicle.spec.length * 0.36;
          game.effects?.smoke(vehicle.x + Math.sin(vehicle.heading) * nose, 1.1, vehicle.z + Math.cos(vehicle.heading) * nose, vehicle.wrecked && !vehicle.exploded);
        }
      }
      syncMesh(vehicle, dt);
    }
  }

  /** Give a vehicle a fresh coat: Spray Bay swaps its body for one in the new colour. */
  function repaint(vehicle, paint) {
    game.scene.remove(vehicle.parts.group);
    vehicle.paint = paint;
    vehicle.parts = createVehicleMesh(vehicle.modelKey, vehicle.spec, paint);
    game.scene.add(vehicle.parts.group);
    syncMesh(vehicle, 0);
  }
  game.events.on('respray', ({ vehicle, paint }) => repaint(vehicle, paint));

  /** The closest vehicle to a point within `range` that passes `filter`. */
  function nearest(x, z, range, filter) {
    let best = null, bestD2 = range * range;
    for (const vehicle of vehicles) {
      if (filter && !filter(vehicle)) continue;
      const d2 = distanceSquared(x, z, vehicle.x, vehicle.z);
      if (d2 < bestD2) { bestD2 = d2; best = vehicle; }
    }
    return best;
  }

  return { vehicles, spawn, remove, damage, update, nearest };
}
