// Solid things in the city: building footprints, containers, walls. A uniform grid makes
// "what is near this point" cheap, which cars, people, bullets and the camera all ask.
import { CITY } from './cityLayout.js';

const CELL = 24;

export function createCityCollision() {
  const boxes = [];
  const cells = new Map();
  const key = (cx, cz) => cx * 4096 + cz;

  /** Register an axis-aligned solid from (x0, z0) to (x1, z1), `height` metres tall. */
  function addBox(x0, z0, x1, z1, height = 10) {
    const box = { x0: Math.min(x0, x1), z0: Math.min(z0, z1), x1: Math.max(x0, x1), z1: Math.max(z0, z1), height };
    boxes.push(box);
    for (let cx = Math.floor(box.x0 / CELL); cx <= Math.floor(box.x1 / CELL); cx += 1) {
      for (let cz = Math.floor(box.z0 / CELL); cz <= Math.floor(box.z1 / CELL); cz += 1) {
        const k = key(cx, cz);
        if (!cells.has(k)) cells.set(k, []);
        cells.get(k).push(box);
      }
    }
    return box;
  }

  /**
   * Push a circle out of every solid it overlaps and out of the world's edge. Mutates
   * `body` (x, z) and returns the contact normal of the deepest push, or null if it was free.
   */
  function resolveCircle(body, radius) {
    let hit = null, deepest = 0;
    const cx0 = Math.floor((body.x - radius) / CELL), cx1 = Math.floor((body.x + radius) / CELL);
    const cz0 = Math.floor((body.z - radius) / CELL), cz1 = Math.floor((body.z + radius) / CELL);
    for (let cx = cx0; cx <= cx1; cx += 1) {
      for (let cz = cz0; cz <= cz1; cz += 1) {
        const list = cells.get(key(cx, cz));
        if (!list) continue;
        for (const box of list) {
          const nearX = Math.max(box.x0, Math.min(body.x, box.x1));
          const nearZ = Math.max(box.z0, Math.min(body.z, box.z1));
          let dx = body.x - nearX, dz = body.z - nearZ;
          const d2 = dx * dx + dz * dz;
          if (d2 >= radius * radius) continue;
          let depth, nx, nz;
          if (d2 > 1e-8) {
            const d = Math.sqrt(d2);
            nx = dx / d; nz = dz / d; depth = radius - d;
          } else {
            // The centre is inside the box: leave through the nearest wall.
            const left = body.x - box.x0, right = box.x1 - body.x, top = body.z - box.z0, bottom = box.z1 - body.z;
            const m = Math.min(left, right, top, bottom);
            nx = m === left ? -1 : m === right ? 1 : 0;
            nz = m === top ? -1 : m === bottom ? 1 : 0;
            if (nx !== 0) nz = 0;
            depth = m + radius;
          }
          body.x += nx * depth;
          body.z += nz * depth;
          if (depth > deepest) { deepest = depth; hit = { nx, nz, depth }; }
        }
      }
    }
    const b = CITY.bounds;
    if (body.x < b.minX) { body.x = b.minX; hit = { nx: 1, nz: 0, depth: 0.1 }; }
    if (body.x > b.maxX) { body.x = b.maxX; hit = { nx: -1, nz: 0, depth: 0.1 }; }
    if (body.z < b.minZ) { body.z = b.minZ; hit = { nx: 0, nz: 1, depth: 0.1 }; }
    if (body.z > b.maxZ) { body.z = b.maxZ; hit = { nx: 0, nz: -1, depth: 0.1 }; }
    return hit;
  }

  /**
   * Distance along a ray from (x, z) in unit direction (dx, dz) to the first solid taller
   * than `minHeight`, or `maxDistance` when nothing is in the way.
   */
  function raycast(x, z, dx, dz, maxDistance, minHeight = 0) {
    let best = maxDistance;
    const seen = new Set();
    const steps = Math.ceil(maxDistance / (CELL * 0.5));
    for (let s = 0; s <= steps; s += 1) {
      const t = Math.min(maxDistance, s * CELL * 0.5);
      const list = cells.get(key(Math.floor((x + dx * t) / CELL), Math.floor((z + dz * t) / CELL)));
      if (!list) continue;
      for (const box of list) {
        if (seen.has(box) || box.height < minHeight) continue;
        seen.add(box);
        const tx0 = dx !== 0 ? (box.x0 - x) / dx : -Infinity, tx1 = dx !== 0 ? (box.x1 - x) / dx : Infinity;
        const tz0 = dz !== 0 ? (box.z0 - z) / dz : -Infinity, tz1 = dz !== 0 ? (box.z1 - z) / dz : Infinity;
        if (dx === 0 && (x < box.x0 || x > box.x1)) continue;
        if (dz === 0 && (z < box.z0 || z > box.z1)) continue;
        const enter = Math.max(Math.min(tx0, tx1), Math.min(tz0, tz1));
        const exit = Math.min(Math.max(tx0, tx1), Math.max(tz0, tz1));
        if (exit >= Math.max(enter, 0) && enter < best) best = Math.max(enter, 0);
      }
      if (best < t) break;
    }
    return best;
  }

  /** True when nothing solid stands between two points. */
  function hasLineOfSight(x0, z0, x1, z1, minHeight = 2) {
    const dx = x1 - x0, dz = z1 - z0;
    const length = Math.hypot(dx, dz);
    if (length < 0.01) return true;
    return raycast(x0, z0, dx / length, dz / length, length, minHeight) >= length - 0.01;
  }

  /** True when a circle at (x, z) would overlap a solid: for choosing spawn points. */
  function isBlocked(x, z, radius) {
    const probe = { x, z };
    return resolveCircle(probe, radius) !== null;
  }

  return { boxes, addBox, resolveCircle, raycast, hasLineOfSight, isBlocked };
}
