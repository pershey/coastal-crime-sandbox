// Deterministic random numbers. The same seed always builds the same city, the same traffic
// and the same screenshot scene, so nothing in the game calls Math.random directly.

export function createRandom(seed) {
  let state = (seed >>> 0) || 1;

  /** Next float in [0, 1): the mulberry32 generator. */
  function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }

  return {
    next,
    range: (min, max) => min + (max - min) * next(),
    int: (min, max) => Math.floor(min + (max - min + 1) * next()),
    pick: (list) => list[Math.floor(next() * list.length)],
    chance: (probability) => next() < probability,
    sign: () => (next() < 0.5 ? -1 : 1),
  };
}

/** A stable 32-bit hash of two grid coordinates, for per-block and per-lot seeds. */
export function hashCoords(a, b, salt = 0) {
  let h = (a * 374761393 + b * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return (h ^ (h >>> 16)) >>> 0;
}
