// The street graph: intersections, two-way streets with a lane each way, traffic signals,
// and route finding. Traffic follows its lanes, police plan pursuits over it, and street
// races and roadblocks pick their spots from it.
import { CITY } from './cityLayout.js';
import { clamp } from '../core/mathUtil.js';

export const SIGNAL_CYCLE = 22;
const GREEN_TIME = 9;
const YELLOW_TIME = 2;
/** How far from an intersection's centre a lane's stop line sits. */
export const STOP_DISTANCE = CITY.roadHalf + 4;

export function createRoadNetwork() {
  const nodes = [];
  const nodeAt = (i, j) => (i < 0 || j < 0 || i > CITY.cols || j > CITY.rows ? null : nodes[j * (CITY.cols + 1) + i]);

  for (let j = 0; j <= CITY.rows; j += 1) {
    for (let i = 0; i <= CITY.cols; i += 1) {
      nodes.push({ id: nodes.length, i, j, x: i * CITY.pitch, z: j * CITY.pitch, links: [] });
    }
  }
  for (const node of nodes) {
    for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const other = nodeAt(node.i + di, node.j + dj);
      if (other) node.links.push(other);
    }
  }

  /**
   * The lane a car drives from node `from` to its neighbour `to`: its unit direction, the
   * point just past the first intersection and the stop line before the second.
   */
  function laneBetween(from, to) {
    const dx = Math.sign(to.x - from.x), dz = Math.sign(to.z - from.z);
    const rx = -dz, rz = dx;
    const ox = rx * CITY.laneOffset, oz = rz * CITY.laneOffset;
    return {
      from, to, dx, dz,
      axis: dx !== 0 ? 'ew' : 'ns',
      heading: Math.atan2(dx, dz),
      startX: from.x + dx * STOP_DISTANCE + ox,
      startZ: from.z + dz * STOP_DISTANCE + oz,
      endX: to.x - dx * STOP_DISTANCE + ox,
      endZ: to.z - dz * STOP_DISTANCE + oz,
      length: CITY.pitch - STOP_DISTANCE * 2,
    };
  }

  /** green, yellow or red for traffic on the given axis ('ns' or 'ew'). All signals share one clock. */
  function signalState(axis, time) {
    const t = ((time % SIGNAL_CYCLE) + SIGNAL_CYCLE) % SIGNAL_CYCLE;
    const local = axis === 'ns' ? t : (t + SIGNAL_CYCLE / 2) % SIGNAL_CYCLE;
    if (local < GREEN_TIME) return 'green';
    if (local < GREEN_TIME + YELLOW_TIME) return 'yellow';
    return 'red';
  }

  function nearestNode(x, z) {
    const i = clamp(Math.round(x / CITY.pitch), 0, CITY.cols);
    const j = clamp(Math.round(z / CITY.pitch), 0, CITY.rows);
    return nodeAt(i, j);
  }

  /** Breadth-first route between two intersections, as a list of nodes including both ends. */
  function findRoute(start, goal) {
    if (start === goal) return [start];
    const cameFrom = new Map([[start, null]]);
    const queue = [start];
    for (let head = 0; head < queue.length; head += 1) {
      const node = queue[head];
      if (node === goal) break;
      for (const next of node.links) {
        if (!cameFrom.has(next)) {
          cameFrom.set(next, node);
          queue.push(next);
        }
      }
    }
    const route = [];
    for (let node = goal; node; node = cameFrom.get(node)) route.unshift(node);
    return route;
  }

  /** The nearest point on any street's centre line, and that street's axis: for spawning cars on the road. */
  function snapToRoad(x, z) {
    const gx = clamp(Math.round(x / CITY.pitch), 0, CITY.cols) * CITY.pitch;
    const gz = clamp(Math.round(z / CITY.pitch), 0, CITY.rows) * CITY.pitch;
    const cx = clamp(x, 0, CITY.width), cz = clamp(z, 0, CITY.depth);
    return Math.abs(x - gx) < Math.abs(z - gz) ? { x: gx, z: cz, axis: 'ns' } : { x: cx, z: gz, axis: 'ew' };
  }

  /** True when a position is on asphalt (a street or an intersection), not on a block. */
  function isOnRoad(x, z) {
    if (x < -CITY.roadHalf || z < -CITY.roadHalf || x > CITY.width + CITY.roadHalf || z > CITY.depth + CITY.roadHalf) return false;
    const mx = Math.abs(x - Math.round(x / CITY.pitch) * CITY.pitch);
    const mz = Math.abs(z - Math.round(z / CITY.pitch) * CITY.pitch);
    return mx <= CITY.roadHalf || mz <= CITY.roadHalf;
  }

  return { nodes, nodeAt, laneBetween, signalState, nearestNode, findRoute, snapToRoad, isOnRoad };
}

/**
 * The sidewalk graph pedestrians stroll on: one corner point per block corner, joined along
 * the block's kerbs and across the street to the next block's corner (the crosswalks).
 */
export function createSidewalkGraph() {
  const corners = [];
  const inset = 2;
  const index = (i, j, corner) => (j * CITY.cols + i) * 4 + corner;
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      const x0 = i * CITY.pitch + CITY.roadHalf + inset, x1 = (i + 1) * CITY.pitch - CITY.roadHalf - inset;
      const z0 = j * CITY.pitch + CITY.roadHalf + inset, z1 = (j + 1) * CITY.pitch - CITY.roadHalf - inset;
      // Corner order: 0 north-west, 1 north-east, 2 south-east, 3 south-west.
      const points = [[x0, z0], [x1, z0], [x1, z1], [x0, z1]];
      for (let c = 0; c < 4; c += 1) corners.push({ x: points[c][0], z: points[c][1], i, j, corner: c, links: [] });
    }
  }
  const link = (a, b) => { a.links.push(b); b.links.push(a); };
  for (let j = 0; j < CITY.rows; j += 1) {
    for (let i = 0; i < CITY.cols; i += 1) {
      for (let c = 0; c < 4; c += 1) link(corners[index(i, j, c)], corners[index(i, j, (c + 1) % 4)]);
      if (i + 1 < CITY.cols) {
        link(corners[index(i, j, 1)], corners[index(i + 1, j, 0)]);
        link(corners[index(i, j, 2)], corners[index(i + 1, j, 3)]);
      }
      if (j + 1 < CITY.rows) {
        link(corners[index(i, j, 3)], corners[index(i, j + 1, 0)]);
        link(corners[index(i, j, 2)], corners[index(i, j + 1, 1)]);
      }
    }
  }
  // The seafront promenade: a walk along the beach side of Sunrow Boulevard, joined to
  // every block of the front row by a crosswalk.
  const promenadeZ = CITY.depth + CITY.roadHalf + 3;
  let lastOnPromenade = null;
  for (let i = 0; i < CITY.cols; i += 1) {
    const west = { x: corners[index(i, CITY.rows - 1, 3)].x, z: promenadeZ, i, j: CITY.rows, corner: 0, links: [] };
    const east = { x: corners[index(i, CITY.rows - 1, 2)].x, z: promenadeZ, i, j: CITY.rows, corner: 1, links: [] };
    corners.push(west, east);
    link(west, east);
    link(west, corners[index(i, CITY.rows - 1, 3)]);
    link(east, corners[index(i, CITY.rows - 1, 2)]);
    if (lastOnPromenade) link(lastOnPromenade, west);
    lastOnPromenade = east;
  }

  function nearestCorner(x, z) {
    const i = clamp(Math.floor(x / CITY.pitch), 0, CITY.cols - 1);
    const j = clamp(Math.floor(z / CITY.pitch), 0, CITY.rows - 1);
    let best = null, bestDistance = Infinity;
    for (let c = 0; c < 4; c += 1) {
      const corner = corners[index(i, j, c)];
      const d = (corner.x - x) ** 2 + (corner.z - z) ** 2;
      if (d < bestDistance) { bestDistance = d; best = corner; }
    }
    return best;
  }
  return { corners, nearestCorner };
}
