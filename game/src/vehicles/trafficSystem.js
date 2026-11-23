// Civilian traffic: drivers who keep to their lane, stop for red lights, queue behind the
// car ahead, brake for people in the road, and floor it when shots are fired. Cars are
// spawned on streets just out of sight and removed once they are far behind.
import { TRAFFIC_MIX } from './vehicleCatalog.js';
import { angleDelta, clamp, distanceSquared, headingTo } from '../core/mathUtil.js';
import { districtAt } from '../city/cityLayout.js';
import { randomCivilianLook } from '../actors/crowdRenderer.js';

const TARGET_MOVING = 22;
const SPAWN_MIN = 75;
const SPAWN_MAX = 185;
const DESPAWN = 230;

export function createTrafficSystem(game) {
  const drivers = new Set();
  const spawnedStalls = new Set();
  let spawnTimer = 0;

  function addDriver(vehicle, lane) {
    const driver = {
      vehicle, lane, cruise: game.random.range(9, 13.5), panic: 0, stuck: 0, reversing: 0,
      look: randomCivilianLook(game.random),
    };
    vehicle.hasDriver = true;
    vehicle.driver = driver;
    vehicle.role = 'traffic';
    drivers.add(driver);
    return driver;
  }

  /** Take the AI driver out of a car (carjacking, or the car was wrecked). Returns their look. */
  function removeDriver(vehicle) {
    const driver = vehicle.driver;
    if (!driver || !drivers.has(driver)) return null;
    drivers.delete(driver);
    vehicle.driver = null;
    vehicle.hasDriver = false;
    vehicle.controls.throttle = 0;
    vehicle.controls.steer = 0;
    return driver.look;
  }

  function focusPoint() {
    return game.player.position();
  }

  function isSpotClear(x, z, gap) {
    for (const other of game.fleet.vehicles) {
      if (distanceSquared(x, z, other.x, other.z) < gap * gap) return false;
    }
    return true;
  }

  /** Spawn one moving car on a random lane near the player. With `anywhere`, ignore the minimum distance. */
  function spawnMoving(anywhere = false) {
    const focus = focusPoint();
    for (let attempt = 0; attempt < 14; attempt += 1) {
      const node = game.random.pick(game.city.roads.nodes);
      const to = game.random.pick(node.links);
      const lane = game.city.roads.laneBetween(node, to);
      const along = game.random.range(0.05, 0.9) * lane.length;
      const x = lane.startX + lane.dx * along, z = lane.startZ + lane.dz * along;
      const d2 = distanceSquared(x, z, focus.x, focus.z);
      if (d2 > SPAWN_MAX * SPAWN_MAX || d2 < (anywhere ? 22 * 22 : SPAWN_MIN * SPAWN_MIN)) continue;
      if (!isSpotClear(x, z, 11)) continue;
      const mix = TRAFFIC_MIX[districtAt(x, z)] ?? TRAFFIC_MIX.default;
      const vehicle = game.fleet.spawn(game.random.pick(mix), x, z, lane.heading, { speed: 9 });
      addDriver(vehicle, lane);
      return vehicle;
    }
    return null;
  }

  function spawnParked() {
    const focus = focusPoint();
    game.city.plan.parkingStalls.forEach((stall, index) => {
      if (spawnedStalls.has(index)) return;
      const d2 = distanceSquared(stall.x, stall.z, focus.x, focus.z);
      if (d2 > 170 * 170 || !isSpotClear(stall.x, stall.z, 4)) return;
      const mix = TRAFFIC_MIX[districtAt(stall.x, stall.z)] ?? TRAFFIC_MIX.default;
      const vehicle = game.fleet.spawn(stall.model ?? game.random.pick(mix), stall.x, stall.z, stall.heading, { role: 'parked' });
      vehicle.stallIndex = index;
      spawnedStalls.add(index);
    });
  }

  /** What blocks the way within `range` metres ahead: returns the speed the driver may keep. */
  function speedAllowedAhead(vehicle, range) {
    const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
    let allowed = Infinity;
    const consider = (x, z, speedAlong, halfWidth) => {
      const dx = x - vehicle.x, dz = z - vehicle.z;
      const along = dx * fx + dz * fz;
      if (along < 1 || along > range) return;
      const across = Math.abs(dx * -fz + dz * fx);
      if (across > halfWidth) return;
      const gap = along - vehicle.spec.length / 2 - 2.5;
      allowed = Math.min(allowed, gap < 1.5 ? 0 : Math.max(0, speedAlong) + gap * 0.6);
    };
    for (const other of game.fleet.vehicles) {
      if (other === vehicle) continue;
      if (Math.abs(other.x - vehicle.x) > range + 6 || Math.abs(other.z - vehicle.z) > range + 6) continue;
      consider(other.x, other.z, other.vx * fx + other.vz * fz, 1.9);
    }
    for (const ped of game.pedestrians.list) {
      if (!ped.down) consider(ped.x, ped.z, 0, 1.5);
    }
    if (!game.player.vehicle) {
      const p = game.player.position();
      consider(p.x, p.z, 0, 1.5);
    }
    return allowed;
  }

  function drive(driver, dt) {
    const vehicle = driver.vehicle;
    const controls = vehicle.controls;
    const roads = game.city.roads;
    let lane = driver.lane;
    let along = (vehicle.x - lane.startX) * lane.dx + (vehicle.z - lane.startZ) * lane.dz;
    if (along > lane.length - 1.5) {
      const choices = lane.to.links.filter((node) => node !== lane.from);
      const next = choices.length > 0 ? game.random.pick(choices) : lane.from;
      lane = roads.laneBetween(lane.to, next);
      driver.lane = lane;
      along = (vehicle.x - lane.startX) * lane.dx + (vehicle.z - lane.startZ) * lane.dz;
    }
    const carrot = clamp(along + 7 + Math.abs(vehicle.speed) * 0.45, 0, lane.length);
    const turn = angleDelta(vehicle.heading, headingTo(vehicle.x, vehicle.z, lane.startX + lane.dx * carrot, lane.startZ + lane.dz * carrot));

    if (driver.reversing > 0) {
      driver.reversing -= dt;
      controls.throttle = -0.7;
      controls.steer = clamp(-turn * 2, -1, 1);
      controls.handbrake = false;
      return;
    }
    controls.steer = clamp(turn * 1.9, -1, 1);
    const panicking = driver.panic > 0;
    if (panicking) driver.panic -= dt;
    let target = panicking ? vehicle.spec.maxSpeed * 0.75 : driver.cruise;
    if (Math.abs(turn) > 0.45) target = Math.min(target, 6.5);
    const toStopLine = lane.length - along;
    if (!panicking && toStopLine < 18 && toStopLine > -1 && roads.signalState(lane.axis, game.time) !== 'green') {
      target = toStopLine < 2.5 ? 0 : Math.min(target, toStopLine * 0.7);
    }
    target = Math.min(target, speedAllowedAhead(vehicle, 7 + Math.abs(vehicle.speed) * 1.1));
    if (target <= 0.2) {
      controls.throttle = vehicle.speed > 0.6 ? -1 : 0;
      controls.handbrake = vehicle.speed < 0.6;
    } else {
      controls.handbrake = false;
      controls.throttle = vehicle.speed < target - 0.6 ? 0.75 : vehicle.speed > target + 1.2 ? -0.7 : 0.12;
    }
    // Wedged against something: back out, or give up if nobody is watching.
    if (target > 2 && Math.abs(vehicle.speed) < 0.4) driver.stuck += dt;
    else driver.stuck = Math.max(0, driver.stuck - dt * 2);
    if (driver.stuck > 4) {
      driver.stuck = 0;
      driver.reversing = 1.3;
    }
  }

  function update(dt) {
    const focus = focusPoint();
    for (const driver of drivers) {
      const vehicle = driver.vehicle;
      if (vehicle.removed || vehicle.wrecked) {
        removeDriver(vehicle);
        continue;
      }
      drive(driver, dt);
    }
    // Remove what is far away, keep the streets topped up.
    for (let k = game.fleet.vehicles.length - 1; k >= 0; k -= 1) {
      const vehicle = game.fleet.vehicles[k];
      if (vehicle.role !== 'traffic' && vehicle.role !== 'parked' && vehicle.role !== 'abandoned') continue;
      if (vehicle.keep) continue;
      const d2 = distanceSquared(vehicle.x, vehicle.z, focus.x, focus.z);
      const limit = vehicle.wrecked ? 150 : DESPAWN;
      if (d2 > limit * limit) {
        if (vehicle.stallIndex !== undefined) spawnedStalls.delete(vehicle.stallIndex);
        removeDriver(vehicle);
        game.fleet.remove(vehicle);
      }
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 0.35;
      if (drivers.size < TARGET_MOVING) spawnMoving();
      spawnParked();
    }
  }

  /** Fill the streets at once: used when a game starts and when a screenshot scene is staged. */
  function populate(count = TARGET_MOVING) {
    for (let k = 0; k < count * 3 && drivers.size < count; k += 1) spawnMoving(true);
    spawnParked();
  }

  const scare = ({ x, z }) => {
    for (const driver of drivers) {
      if (distanceSquared(x, z, driver.vehicle.x, driver.vehicle.z) < 50 * 50) driver.panic = game.random.range(6, 11);
    }
  };
  game.events.on('gunshot', scare);
  game.events.on('explosion', scare);

  return { drivers, addDriver, removeDriver, spawnMoving, populate, update };
}
