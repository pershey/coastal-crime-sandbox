// The player character, Mara Quill: running and sprinting on foot, getting in and out of
// vehicles, carjacking occupied ones, driving, taking damage and going down.
import { PLAYER_LOOK } from './crowdRenderer.js';
import { isPointNearVehicle } from '../vehicles/vehiclePhysics.js';
import { clamp, dampAngle } from '../core/mathUtil.js';
import { PLACES } from '../city/cityLayout.js';

const JOG_SPEED = 4.3;
const SPRINT_SPEED = 7.2;
const AIM_SPEED = 2.4;

export function createPlayer(game) {
  const start = PLACES.garage;
  const state = {
    kind: 'player', x: start.x, z: start.z + 3, y: 0, heading: 0, stride: 0, pose: 'stand', running: false,
    look: PLAYER_LOOK, armed: false, radius: 0.4,
    health: 100, maxHealth: 100, armor: 0, cash: 300, down: false, busy: 0, aiming: false,
    vehicle: null, moveSpeed: 0, lastVehicle: null,
  };
  const spot = { x: state.x, z: state.z };

  /** Where the player is, on foot or at the wheel. The same object is reused every call. */
  function position() {
    spot.x = state.vehicle ? state.vehicle.x : state.x;
    spot.z = state.vehicle ? state.vehicle.z : state.z;
    return spot;
  }

  function speed() {
    return state.vehicle ? state.vehicle.speed : state.moveSpeed;
  }

  function placeAt(x, z, heading = 0) {
    if (state.vehicle) leaveSeat();
    state.x = x;
    state.z = z;
    state.heading = heading;
    state.down = false;
  }

  function takeSeat(vehicle) {
    state.vehicle = vehicle;
    state.lastVehicle = vehicle;
    vehicle.role = 'player';
    vehicle.hasDriver = true;
    vehicle.driver = 'player';
    vehicle.keep = true;
    state.busy = 0.35;
    game.events.emit('enterVehicle', { vehicle });
  }

  function leaveSeat() {
    const vehicle = state.vehicle;
    if (!vehicle) return;
    vehicle.role = 'abandoned';
    vehicle.hasDriver = false;
    vehicle.driver = null;
    vehicle.keep = false;
    vehicle.controls.throttle = 0;
    vehicle.controls.steer = 0;
    vehicle.controls.handbrake = false;
    vehicle.sirenOn = false;
    state.vehicle = null;
    game.events.emit('exitVehicle', { vehicle });
  }

  /** Get into a vehicle, throwing out whoever is driving it. */
  function enterVehicle(vehicle) {
    if (vehicle.exploded) return false;
    if (vehicle.driver && vehicle.driver !== 'player') {
      const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
      const doorX = vehicle.x + fz * (vehicle.spec.width / 2 + 0.8), doorZ = vehicle.z - fx * (vehicle.spec.width / 2 + 0.8);
      const wasPolice = vehicle.role === 'police';
      if (wasPolice) game.police?.ejectCrew(vehicle, doorX, doorZ);
      else {
        const look = game.traffic.removeDriver(vehicle);
        const victim = game.pedestrians.spawnAt(doorX, doorZ, look);
        game.pedestrians.frighten(victim, vehicle.x, vehicle.z, 14);
      }
      game.events.emit('carjack', { vehicle, x: vehicle.x, z: vehicle.z, police: wasPolice });
    } else if ((vehicle.role === 'parked' || vehicle.spec.police) && vehicle.tag !== 'mission') {
      game.events.emit('carTheft', { vehicle, x: vehicle.x, z: vehicle.z, police: vehicle.spec.police === true });
    }
    takeSeat(vehicle);
    return true;
  }

  function exitVehicle() {
    const vehicle = state.vehicle;
    if (!vehicle || Math.abs(vehicle.speed) > 9) return false;
    const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
    const side = vehicle.spec.width / 2 + 0.9;
    // Driver's side first, then the passenger side if a wall is in the way.
    for (const sign of [1, -1]) {
      const x = vehicle.x + fz * side * sign, z = vehicle.z - fx * side * sign;
      if (!game.city.collision.isBlocked(x, z, 0.4)) {
        leaveSeat();
        state.x = x;
        state.z = z;
        state.heading = vehicle.heading;
        state.busy = 0.3;
        return true;
      }
    }
    return false;
  }

  /** The vehicle the player could get into right now, if any. */
  function vehicleInReach() {
    if (state.vehicle || state.down) return null;
    return game.fleet.nearest(state.x, state.z, 7, (vehicle) => !vehicle.exploded && isPointNearVehicle(vehicle, state.x, state.z, 2));
  }

  /** Take damage: armour soaks it up first. */
  function hurt(amount, cause = {}) {
    if (state.down || game.cheats?.invincible) return;
    const soaked = Math.min(state.armor, amount * 0.8);
    state.armor -= soaked;
    state.health -= amount - soaked;
    game.events.emit('playerHurt', { amount, cause });
    if (state.health <= 0) {
      state.health = 0;
      state.down = true;
      state.pose = 'down';
      if (state.vehicle) leaveSeat();
      game.events.emit('playerDown', { cause });
    }
  }

  function heal(amount) {
    state.health = Math.min(state.maxHealth, state.health + amount);
  }

  function addCash(amount) {
    state.cash = Math.max(0, state.cash + amount);
    game.events.emit('cash', { amount });
  }

  function updateOnFoot(dt) {
    const input = game.input;
    const forward = input.axis('KeyS', 'KeyW', 'ArrowDown', 'ArrowUp');
    const strafe = input.axis('KeyA', 'KeyD');
    const yaw = game.cameraRig.state.yaw;
    const moveX = Math.sin(yaw) * forward - Math.cos(yaw) * strafe;
    const moveZ = Math.cos(yaw) * forward + Math.sin(yaw) * strafe;
    const moving = forward !== 0 || strafe !== 0;
    state.aiming = (input.state.aim || input.state.fire) && state.armed;
    const sprinting = input.isHeld('ShiftLeft') || input.isHeld('ShiftRight');
    const top = state.aiming ? AIM_SPEED : sprinting ? SPRINT_SPEED : JOG_SPEED;
    const targetSpeed = moving ? top : 0;
    state.moveSpeed += (targetSpeed - state.moveSpeed) * Math.min(1, dt * 12);
    if (moving) {
      const length = Math.hypot(moveX, moveZ);
      state.x += (moveX / length) * state.moveSpeed * dt;
      state.z += (moveZ / length) * state.moveSpeed * dt;
      if (!state.aiming) state.heading = dampAngle(state.heading, Math.atan2(moveX, moveZ), 14, dt);
      state.stride += state.moveSpeed * dt * 2.6;
    }
    if (state.aiming) state.heading = dampAngle(state.heading, yaw, 20, dt);
    state.running = sprinting && moving;
    state.pose = state.aiming ? 'aim' : state.moveSpeed > 0.4 ? 'walk' : 'stand';
    game.city.collision.resolveCircle(state, state.radius);
    // Cars are solid to someone on foot.
    for (const vehicle of game.fleet.vehicles) {
      if (Math.abs(vehicle.x - state.x) > 5 || Math.abs(vehicle.z - state.z) > 5) continue;
      if (!isPointNearVehicle(vehicle, state.x, state.z, 0.3)) continue;
      const hitSpeed = Math.hypot(vehicle.vx, vehicle.vz);
      if (hitSpeed > 5 && vehicle.role !== 'abandoned') hurt(hitSpeed * 2.2, { how: 'runOver', vehicle });
      const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
      const across = (state.x - vehicle.x) * -fz + (state.z - vehicle.z) * fx;
      const push = (vehicle.spec.width / 2 + 0.35 - Math.abs(across)) * (across >= 0 ? 1 : -1);
      state.x += -fz * push;
      state.z += fx * push;
    }
    state.y = game.city.groundHeight(state.x, state.z);
  }

  function updateDriving(dt) {
    const input = game.input;
    const vehicle = state.vehicle;
    if (vehicle.wrecked) {
      if (vehicle.exploded) hurt(999, { how: 'explosion' });
      else exitVehicle();
      return;
    }
    // Screenshot scenes hold the wheel themselves; otherwise the keys drive.
    const auto = game.autopilot;
    vehicle.controls.throttle = auto ? auto.throttle : input.axis('KeyS', 'KeyW', 'ArrowDown', 'ArrowUp');
    vehicle.controls.steer = auto ? auto.steer : input.axis('KeyD', 'KeyA', 'ArrowRight', 'ArrowLeft');
    vehicle.controls.handbrake = auto ? auto.handbrake : input.isHeld('Space');
    if (vehicle.spec.police && input.wasPressed('KeyH')) vehicle.sirenOn = !vehicle.sirenOn;
    state.x = vehicle.x;
    state.z = vehicle.z;
    state.heading = vehicle.heading;
    state.moveSpeed = 0;
  }

  function update(dt) {
    if (state.down) return;
    state.busy = Math.max(0, state.busy - dt);
    if (game.input.wasPressed('KeyF') && state.busy <= 0) {
      if (state.vehicle) exitVehicle();
      else {
        const vehicle = vehicleInReach();
        if (vehicle) enterVehicle(vehicle);
      }
    }
    if (state.vehicle) updateDriving(dt);
    else updateOnFoot(dt);
    state.health = clamp(state.health, 0, state.maxHealth);
  }

  function draw(crowd) {
    if (!state.vehicle) crowd.draw(state);
  }

  return { state, position, speed, placeAt, enterVehicle, exitVehicle, takeSeat, vehicleInReach, hurt, heal, addCash, update, draw };
}
