// Arcade driving physics for every car: engine and brakes, speed-sensitive steering, tyre
// grip that lets go under the handbrake (drifts), and collisions with buildings and with
// other cars. The player, traffic, police and mission drivers all steer the same model
// through `controls`.
import { clamp, damp } from '../core/mathUtil.js';

const WHEELBASE = 2.7;
const BRAKE = 24;
const RESTITUTION = 0.25;

/** Advance one vehicle by dt seconds. Returns the hardest impact speed against a wall this step. */
export function stepVehicle(vehicle, dt, collision) {
  const spec = vehicle.spec;
  const controls = vehicle.controls;
  const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
  const rx = -fz, rz = fx;
  let forward = vehicle.vx * fx + vehicle.vz * fz;
  let lateral = vehicle.vx * rx + vehicle.vz * rz;
  const powered = !vehicle.wrecked && vehicle.hasDriver;
  const throttle = powered ? controls.throttle : 0;
  const top = spec.maxSpeed * (vehicle.boost ?? 1);

  if (throttle > 0) {
    if (forward < -0.5) forward += BRAKE * dt;
    else forward += spec.accel * throttle * dt * (1 - Math.pow(clamp(forward / top, 0, 1), 1.6));
  } else if (throttle < 0) {
    if (forward > 0.5) forward -= BRAKE * -throttle * dt;
    else if (forward > -top * 0.3) forward -= spec.accel * 0.6 * -throttle * dt;
  }
  // Rolling resistance and air drag; a car with nobody at the wheel coasts to a stop.
  const drag = (powered ? 1.2 : 5) + Math.abs(forward) * 0.05;
  forward -= Math.sign(forward) * Math.min(Math.abs(forward), drag * dt);
  if (controls.handbrake && powered) forward -= Math.sign(forward) * Math.min(Math.abs(forward), 9 * dt);

  vehicle.steer = damp(vehicle.steer, powered ? controls.steer : 0, 10, dt);
  const steerAngle = vehicle.steer * 0.62 / (1 + Math.abs(forward) * 0.04);
  let turnRate = (forward * Math.tan(steerAngle)) / WHEELBASE;
  const limit = (spec.cornering * (controls.handbrake ? 1.5 : 1)) / Math.max(Math.abs(forward), 3.5);
  turnRate = clamp(turnRate, -limit, limit);

  const grip = controls.handbrake && powered ? 1.5 : spec.grip;
  lateral *= Math.exp(-grip * dt);
  vehicle.slip = Math.abs(lateral);
  vehicle.vx = fx * forward + rx * lateral;
  vehicle.vz = fz * forward + rz * lateral;
  vehicle.heading += turnRate * dt + vehicle.spin * dt;
  vehicle.spin *= Math.exp(-4 * dt);
  vehicle.x += vehicle.vx * dt;
  vehicle.z += vehicle.vz * dt;

  // Two circles, nose and tail, stand in for the body against walls.
  let hardest = 0;
  const nx = Math.sin(vehicle.heading), nz = Math.cos(vehicle.heading);
  const reach = spec.length / 2 - spec.width / 2;
  const radius = spec.width / 2 + 0.1;
  for (const end of [1, -1]) {
    const probe = { x: vehicle.x + nx * reach * end, z: vehicle.z + nz * reach * end };
    const beforeX = probe.x, beforeZ = probe.z;
    const hit = collision.resolveCircle(probe, radius);
    if (!hit) continue;
    vehicle.x += probe.x - beforeX;
    vehicle.z += probe.z - beforeZ;
    const into = vehicle.vx * hit.nx + vehicle.vz * hit.nz;
    if (into < 0) {
      vehicle.vx -= (1 + RESTITUTION) * into * hit.nx;
      vehicle.vz -= (1 + RESTITUTION) * into * hit.nz;
      hardest = Math.max(hardest, -into);
      // Glance off: swing the struck end away from the wall.
      const cross = nx * hit.nz - nz * hit.nx;
      vehicle.spin -= end * cross * Math.min(-into, 12) * 0.12;
    }
  }
  vehicle.speed = vehicle.vx * nx + vehicle.vz * nz;
  return hardest;
}

/** Push two overlapping vehicles apart and trade momentum. Returns the closing speed, or 0. */
export function collideVehicles(a, b) {
  const reachA = a.spec.length / 2 - a.spec.width / 2, reachB = b.spec.length / 2 - b.spec.width / 2;
  const radiusA = a.spec.width / 2, radiusB = b.spec.width / 2;
  const dx = b.x - a.x, dz = b.z - a.z;
  const span = reachA + reachB + radiusA + radiusB;
  if (dx * dx + dz * dz > span * span) return 0;
  const afx = Math.sin(a.heading), afz = Math.cos(a.heading), bfx = Math.sin(b.heading), bfz = Math.cos(b.heading);
  let worst = 0;
  for (const endA of [1, 0, -1]) {
    for (const endB of [1, 0, -1]) {
      const ax = a.x + afx * reachA * endA, az = a.z + afz * reachA * endA;
      const bx = b.x + bfx * reachB * endB, bz = b.z + bfz * reachB * endB;
      const ox = bx - ax, oz = bz - az;
      const distance = Math.hypot(ox, oz);
      const overlap = radiusA + radiusB - distance;
      if (overlap <= 0 || distance < 1e-4) continue;
      const ux = ox / distance, uz = oz / distance;
      const shareA = b.spec.mass / (a.spec.mass + b.spec.mass), shareB = 1 - shareA;
      a.x -= ux * overlap * shareA;
      a.z -= uz * overlap * shareA;
      b.x += ux * overlap * shareB;
      b.z += uz * overlap * shareB;
      const closing = (a.vx - b.vx) * ux + (a.vz - b.vz) * uz;
      if (closing > 0) {
        const impulse = ((1 + RESTITUTION) * closing) / (1 / a.spec.mass + 1 / b.spec.mass);
        a.vx -= (impulse / a.spec.mass) * ux;
        a.vz -= (impulse / a.spec.mass) * uz;
        b.vx += (impulse / b.spec.mass) * ux;
        b.vz += (impulse / b.spec.mass) * uz;
        a.spin += (afx * uz - afz * ux) * endA * closing * 0.05 * shareA;
        b.spin -= (bfx * uz - bfz * ux) * endB * closing * 0.05 * shareB;
        worst = Math.max(worst, closing);
      }
    }
  }
  return worst;
}

/** True when a point is within `margin` metres of the vehicle's body. */
export function isPointNearVehicle(vehicle, x, z, margin) {
  const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
  const dx = x - vehicle.x, dz = z - vehicle.z;
  const along = dx * fx + dz * fz, across = dx * -fz + dz * fx;
  return Math.abs(along) < vehicle.spec.length / 2 + margin && Math.abs(across) < vehicle.spec.width / 2 + margin;
}
