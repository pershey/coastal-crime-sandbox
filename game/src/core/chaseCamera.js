// The third-person camera: an over-the-shoulder orbit on foot, a chase view that swings in
// behind the car when driving, a wider lens at speed, a shake on crashes and explosions,
// and it never slips behind a wall.
import { clamp, damp, dampAngle } from './mathUtil.js';

export function createChaseCamera(game) {
  const state = { yaw: 0, pitch: 0.22, distance: 6, zoom: 1, idle: 0, shake: 0, fov: 58, x: 0, y: 10, z: 0, focusX: 0, focusY: 0, focusZ: 0, started: false };

  function addShake(amount) {
    state.shake = Math.min(1.4, state.shake + amount);
  }

  /** Jump straight to the right spot behind the player (after a respawn or a scene change). */
  function snap(yaw) {
    if (yaw !== undefined) state.yaw = yaw;
    state.started = false;
  }

  function update(dt) {
    const input = game.input.state;
    const player = game.player.state;
    const vehicle = player.vehicle;
    const turned = input.mouseDX !== 0 || input.mouseDY !== 0;
    state.yaw -= input.mouseDX * 0.0026;
    state.pitch = clamp(state.pitch + input.mouseDY * 0.002, -0.12, 1.2);
    if (game.input.isHeld('KeyQ')) { state.yaw += dt * 2.2; state.idle = 0; }
    if (game.input.isHeld('KeyE')) { state.yaw -= dt * 2.2; state.idle = 0; }
    state.idle = turned ? 0 : state.idle + dt;

    let height, wantedDistance, shoulder = 0;
    if (vehicle) {
      height = 1.2 + vehicle.spec.height * 0.55;
      wantedDistance = 6.6 + vehicle.spec.length * 0.55;
      if (state.idle > 0.9 && Math.abs(vehicle.speed) > 1.5) {
        state.yaw = dampAngle(state.yaw, vehicle.heading + (vehicle.speed < -1 ? Math.PI : 0), 3.2, dt);
        state.pitch = damp(state.pitch, 0.2, 2, dt);
      }
    } else {
      height = 1.6;
      wantedDistance = player.aiming ? 3.3 : 5.6;
      shoulder = player.aiming ? 0.75 : 0.45;
    }
    // Z and X pull the camera in and out.
    if (game.input.isHeld('KeyZ')) state.zoom = Math.max(0.7, state.zoom - dt);
    if (game.input.isHeld('KeyX')) state.zoom = Math.min(1.8, state.zoom + dt);
    wantedDistance *= state.zoom;
    state.distance = state.started ? damp(state.distance, wantedDistance, 6, dt) : wantedDistance;
    const sin = Math.sin(state.yaw), cos = Math.cos(state.yaw);
    const p = game.player.position();
    const baseY = game.city.groundHeight(p.x, p.z);
    // Look over the right shoulder on foot, so the crosshair is clear of the character.
    const focusX = p.x - cos * shoulder, focusZ = p.z + sin * shoulder, focusY = baseY + height;
    const flat = state.distance * Math.cos(state.pitch);
    const reach = game.city.collision.raycast(focusX, focusZ, -sin, -cos, flat + 0.6, focusY + 0.5) - 0.6;
    const usable = Math.max(1.2, Math.min(flat, reach));
    const targetX = focusX - sin * usable, targetZ = focusZ - cos * usable;
    const targetY = Math.max(baseY + 0.6, focusY + state.distance * Math.sin(state.pitch));
    if (!state.started) {
      state.x = targetX; state.y = targetY; state.z = targetZ;
      state.focusX = focusX; state.focusY = focusY; state.focusZ = focusZ;
      state.started = true;
    }
    const follow = vehicle ? 14 : 18;
    state.x = damp(state.x, targetX, follow, dt);
    state.y = damp(state.y, targetY, follow, dt);
    state.z = damp(state.z, targetZ, follow, dt);
    state.focusX = damp(state.focusX, focusX, 24, dt);
    state.focusY = damp(state.focusY, focusY, 24, dt);
    state.focusZ = damp(state.focusZ, focusZ, 24, dt);

    state.shake = Math.max(0, state.shake - dt * 2.2);
    const jitter = state.shake * state.shake * 0.35;
    const t = game.time * 47;
    const camera = game.camera;
    camera.position.set(state.x + Math.sin(t) * jitter, state.y + Math.sin(t * 1.31) * jitter, state.z + Math.cos(t * 0.87) * jitter);
    const ahead = vehicle ? 5 : 8;
    camera.lookAt(state.focusX + sin * ahead, state.focusY - Math.tan(state.pitch) * ahead * 0.55 + (vehicle ? 0.2 : 0.3), state.focusZ + cos * ahead);
    const wantedFov = 56 + Math.min(20, Math.abs(game.player.speed()) * 0.42);
    state.fov = damp(state.fov, wantedFov, 4, dt);
    if (Math.abs(camera.fov - state.fov) > 0.05) {
      camera.fov = state.fov;
      camera.updateProjectionMatrix();
    }
  }

  return { state, update, addShake, snap };
}
