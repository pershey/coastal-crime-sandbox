// Small 2D math helpers shared by driving, walking, police pursuit and the camera.
// The world is flat: x runs east, z runs south, y is up. A heading of 0 faces +z and
// grows toward +x, which is how three.js turns an object around its y axis.

export const TAU = Math.PI * 2;

export function clamp(value, min, max) {
  return value < min ? min : value > max ? max : value;
}

export function lerp(a, b, t) {
  return a + (b - a) * t;
}

/** Frame-rate independent smoothing: how much of the gap to close in dt seconds. */
export function damp(current, target, rate, dt) {
  return current + (target - current) * (1 - Math.exp(-rate * dt));
}

/** Wrap an angle into (-PI, PI]. */
export function wrapAngle(angle) {
  let a = angle % TAU;
  if (a > Math.PI) a -= TAU;
  if (a <= -Math.PI) a += TAU;
  return a;
}

/** Signed shortest turn from one heading to another. */
export function angleDelta(from, to) {
  return wrapAngle(to - from);
}

export function dampAngle(current, target, rate, dt) {
  return current + angleDelta(current, target) * (1 - Math.exp(-rate * dt));
}

/** Heading that faces from (x0, z0) toward (x1, z1). */
export function headingTo(x0, z0, x1, z1) {
  return Math.atan2(x1 - x0, z1 - z0);
}

export function distance(x0, z0, x1, z1) {
  return Math.hypot(x1 - x0, z1 - z0);
}

export function distanceSquared(x0, z0, x1, z1) {
  const dx = x1 - x0;
  const dz = z1 - z0;
  return dx * dx + dz * dz;
}

/** Dollar amounts as the HUD shows them: $12,450. */
export function formatCash(amount) {
  return '$' + Math.round(amount).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Seconds as m:ss for race and mission timers. */
export function formatClock(seconds) {
  const whole = Math.max(0, Math.ceil(seconds));
  return Math.floor(whole / 60) + ':' + String(whole % 60).padStart(2, '0');
}
