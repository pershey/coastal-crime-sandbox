// The Tamarind Coast Police Department's response. More stars send more: patrol cruisers
// that chase and ram, officers who get out and shoot or arrest, roadblocks ahead of a
// fleeing car, tactical vans at four stars, and the helicopter (policeHelicopter.js).
import { angleDelta, clamp, distance, distanceSquared, headingTo } from '../core/mathUtil.js';
import { CITY } from '../city/cityLayout.js';

const CRUISERS_BY_STARS = [0, 1, 2, 3, 4, 5];
const TACTICAL_BY_STARS = [0, 0, 0, 0, 1, 2];
const ROADBLOCKS_BY_STARS = [0, 0, 0, 1, 1, 2];
const SIGHT_RANGE = 85;

export function createPoliceDispatch(game) {
  const units = [];
  const roadblocks = [];
  let spawnTimer = 1.5, roadblockTimer = 6;

  function addUnit(type, vehicle, crew) {
    const unit = { type, vehicle, crew, mode: 'pursue', officers: [], routeTimer: 0, aimX: vehicle.x, aimZ: vehicle.z, stuck: 0, reversing: 0, dismountTime: 0 };
    vehicle.role = 'police';
    vehicle.hasDriver = true;
    vehicle.driver = unit;
    vehicle.sirenOn = true;
    vehicle.keep = true;
    units.push(unit);
    return unit;
  }

  /** Send one unit from a street corner out of sight. `at` overrides the spawn position (scenes use it). */
  function dispatch(type, at) {
    const model = type === 'tactical' ? 'bulwark' : 'cruiser';
    const p = game.player.position();
    if (at) return addUnit(type, game.fleet.spawn(model, at.x, at.z, at.heading, { speed: at.speed ?? 0 }), type === 'tactical' ? 4 : 2);
    for (let attempt = 0; attempt < 16; attempt += 1) {
      const node = game.random.pick(game.city.roads.nodes);
      const d = distance(node.x, node.z, p.x, p.z);
      if (d < 80 || d > 160) continue;
      if (game.fleet.nearest(node.x, node.z, 9)) continue;
      const route = game.city.roads.findRoute(node, game.city.roads.nearestNode(p.x, p.z));
      const next = route[1] ?? node.links[0];
      const heading = headingTo(node.x, node.z, next.x, next.z);
      return addUnit(type, game.fleet.spawn(model, node.x, node.z, heading, { speed: 12 }), type === 'tactical' ? 4 : 2);
    }
    return null;
  }

  function dismount(unit) {
    const vehicle = unit.vehicle;
    const fx = Math.sin(vehicle.heading), fz = Math.cos(vehicle.heading);
    const side = vehicle.spec.width / 2 + 0.8;
    for (let k = 0; k < unit.crew; k += 1) {
      const sign = k % 2 === 0 ? 1 : -1, back = Math.floor(k / 2) * 1.4;
      const officer = game.gunmen.spawn(unit.type === 'tactical' ? 'tactical' : 'officer', vehicle.x + fz * side * sign - fx * back, vehicle.z - fx * side * sign - fz * back, { heading: vehicle.heading });
      officer.unit = unit;
      unit.officers.push(officer);
    }
    unit.crew = 0;
    unit.mode = 'dismounted';
    unit.dismountTime = 0;
    vehicle.hasDriver = false;
    vehicle.controls.throttle = 0;
    vehicle.controls.handbrake = true;
  }

  function remount(unit) {
    const alive = unit.officers.filter((officer) => !officer.down);
    for (const officer of alive) game.gunmen.remove(officer);
    unit.officers = [];
    unit.crew = alive.length;
    if (unit.crew === 0 || unit.vehicle.wrecked) return false;
    unit.mode = 'pursue';
    unit.vehicle.hasDriver = true;
    unit.vehicle.controls.handbrake = false;
    return true;
  }

  /** The player took this police vehicle: its crew ends up on the street. */
  function ejectCrew(vehicle, x, z) {
    const index = units.findIndex((unit) => unit.vehicle === vehicle);
    if (index === -1) return;
    const unit = units[index];
    for (let k = 0; k < unit.crew; k += 1) game.gunmen.spawn('officer', x + k * 0.9, z + k * 0.6, {});
    units.splice(index, 1);
  }

  function drive(unit, dt) {
    const vehicle = unit.vehicle;
    const controls = vehicle.controls;
    const player = game.player.state;
    const wanted = game.wanted.state;
    // While the player is in sight, units converge on them; once sight is lost they comb
    // the streets around the place the player was last seen.
    if (!wanted.seen) {
      unit.searchTimer = (unit.searchTimer ?? 0) - dt;
      if (unit.searchTimer <= 0) {
        unit.searchTimer = game.random.range(4, 7);
        unit.searchX = wanted.lastSeenX + game.random.range(-70, 70);
        unit.searchZ = wanted.lastSeenZ + game.random.range(-70, 70);
      }
    }
    const target = wanted.seen ? game.player.position() : { x: unit.searchX ?? wanted.lastSeenX, z: unit.searchZ ?? wanted.lastSeenZ };
    const lead = wanted.seen && player.vehicle ? 0.5 : 0;
    const tx = target.x + (player.vehicle ? player.vehicle.vx * lead : 0), tz = target.z + (player.vehicle ? player.vehicle.vz * lead : 0);
    const range = distance(vehicle.x, vehicle.z, target.x, target.z);
    const roads = game.city.roads;

    unit.routeTimer -= dt;
    if (unit.routeTimer <= 0) {
      unit.routeTimer = 0.4;
      const direct = range < 60 && game.city.collision.hasLineOfSight(vehicle.x, vehicle.z, target.x, target.z, 2);
      if (direct) {
        unit.aimX = tx;
        unit.aimZ = tz;
      } else {
        // Follow the streets: aim for the next corner on the route, or for the corner we are
        // nearest when the next one is not on our street (never through a block).
        const here = roads.nearestNode(vehicle.x, vehicle.z);
        const route = roads.findRoute(here, roads.nearestNode(target.x, target.z));
        let goal = { x: tx, z: tz };
        if (route.length > 1) {
          const next = route[1];
          const atCorner = distanceSquared(vehicle.x, vehicle.z, here.x, here.z) < 16 * 16;
          const sameStreet = Math.abs(vehicle.x - next.x) < CITY.roadHalf + 2 || Math.abs(vehicle.z - next.z) < CITY.roadHalf + 2;
          goal = atCorner || sameStreet ? next : here;
        }
        unit.aimX = goal.x;
        unit.aimZ = goal.z;
      }
    }

    if (unit.reversing > 0) {
      unit.reversing -= dt;
      controls.throttle = -1;
      controls.steer = clamp(-angleDelta(vehicle.heading, headingTo(vehicle.x, vehicle.z, unit.aimX, unit.aimZ)) * 2, -1, 1);
      controls.handbrake = false;
      return;
    }
    const turn = angleDelta(vehicle.heading, headingTo(vehicle.x, vehicle.z, unit.aimX, unit.aimZ));
    controls.steer = clamp(turn * 2.4, -1, 1);
    controls.handbrake = Math.abs(turn) > 1.3 && vehicle.speed > 14;
    let throttle = wanted.seen ? 1 : 0.55;
    if (Math.abs(turn) > 0.6 && vehicle.speed > 13) throttle = -0.6;
    if (!wanted.seen && vehicle.speed > 17) throttle = 0;
    // Someone on foot is arrested or shot at, not run down: pull up and get out.
    if (wanted.seen && !player.vehicle && range < 15 + (vehicle.speed * vehicle.speed) / 34) {
      throttle = vehicle.speed > 1 ? -1 : 0;
      controls.handbrake = true;
      if (Math.abs(vehicle.speed) < 2) dismount(unit);
    }
    controls.throttle = throttle;
    if (throttle > 0 && Math.abs(vehicle.speed) < 0.6) unit.stuck += dt;
    else unit.stuck = 0;
    if (unit.stuck > 1.1) {
      unit.stuck = 0;
      unit.reversing = 1.2;
    }
  }

  function placeRoadblock() {
    const player = game.player.state;
    if (!player.vehicle || Math.abs(player.vehicle.speed) < 8) return false;
    const v = player.vehicle;
    const speed = Math.hypot(v.vx, v.vz) || 1;
    const dirX = v.vx / speed, dirZ = v.vz / speed;
    const alongX = Math.abs(dirX) > Math.abs(dirZ);
    const roads = game.city.roads;
    const ahead = roads.nearestNode(v.x + dirX * 150, v.z + dirZ * 150);
    const before = roads.nodeAt(ahead.i - (alongX ? Math.sign(dirX) : 0), ahead.j - (alongX ? 0 : Math.sign(dirZ)));
    if (!before) return false;
    return buildRoadblock((ahead.x + before.x) / 2, (ahead.z + before.z) / 2, alongX);
  }

  /** Two cruisers nose to nose across a street with officers behind them. */
  function buildRoadblock(x, z, alongX) {
    if (distance(x, z, game.player.position().x, game.player.position().z) < 60) return false;
    if (game.fleet.nearest(x, z, 12)) return false;
    const block = { x, z, vehicles: [], officers: [], alongX };
    for (const side of [-1, 1]) {
      const cx = alongX ? x : x + side * 2.9, cz = alongX ? z + side * 2.9 : z;
      const heading = alongX ? (side > 0 ? 0 : Math.PI) : (side > 0 ? Math.PI / 2 : -Math.PI / 2);
      const vehicle = game.fleet.spawn('cruiser', cx, cz, heading, {});
      vehicle.role = 'police';
      vehicle.sirenOn = true;
      vehicle.keep = true;
      vehicle.controls.handbrake = true;
      block.vehicles.push(vehicle);
    }
    for (let k = 0; k < 3; k += 1) {
      const offset = (k - 1) * 3.4;
      const officer = game.gunmen.spawn('officer', alongX ? x - 3 : x + offset, alongX ? z + offset : z - 3, { hold: true });
      officer.homeX = officer.x;
      officer.homeZ = officer.z;
      block.officers.push(officer);
    }
    roadblocks.push(block);
    game.events.emit('roadblock', { x, z });
    return true;
  }

  function standDown(unit) {
    const vehicle = unit.vehicle;
    vehicle.sirenOn = false;
    vehicle.keep = false;
    for (const officer of unit.officers) game.gunmen.remove(officer);
    if (vehicle.wrecked || vehicle.removed) return;
    if (unit.crew === 0 && unit.officers.every((officer) => officer.down)) {
      vehicle.role = 'abandoned';
      vehicle.driver = null;
      return;
    }
    // Back on patrol: the cruiser rejoins traffic and drives off.
    const roads = game.city.roads;
    const node = roads.nearestNode(vehicle.x, vehicle.z);
    vehicle.driver = null;
    vehicle.controls.handbrake = false;
    game.traffic.addDriver(vehicle, roads.laneBetween(node, game.random.pick(node.links)));
  }

  function update(dt) {
    const stars = game.wanted.state.stars;
    const p = game.player.position();
    if (stars === 0) {
      if (units.length > 0 || roadblocks.length > 0) {
        for (const unit of units) standDown(unit);
        units.length = 0;
        for (const block of roadblocks) {
          for (const officer of block.officers) game.gunmen.remove(officer);
          for (const vehicle of block.vehicles) { vehicle.keep = false; vehicle.sirenOn = false; vehicle.role = 'abandoned'; }
        }
        roadblocks.length = 0;
        game.gunmen.removeWhere((gunman) => gunman.faction === 'police' && !gunman.down);
      }
      return;
    }
    for (let k = units.length - 1; k >= 0; k -= 1) {
      const unit = units[k];
      const vehicle = unit.vehicle;
      if (vehicle.removed || vehicle.role === 'player') {
        units.splice(k, 1);
        continue;
      }
      if (unit.mode === 'pursue') {
        if (vehicle.wrecked) {
          if (!vehicle.exploded && unit.crew > 0) dismount(unit);
          else if (vehicle.exploded) { vehicle.keep = false; vehicle.role = 'abandoned'; units.splice(k, 1); }
          continue;
        }
        drive(unit, dt);
        if (distance(vehicle.x, vehicle.z, p.x, p.z) > 320) {
          game.fleet.remove(vehicle);
          units.splice(k, 1);
        }
      } else {
        unit.dismountTime += dt;
        const allDown = unit.officers.every((officer) => officer.down);
        const far = distance(vehicle.x, vehicle.z, p.x, p.z) > 55;
        if (allDown) {
          vehicle.keep = false;
          vehicle.role = 'abandoned';
          units.splice(k, 1);
        } else if (far && unit.dismountTime > 3 && !remount(unit)) {
          vehicle.keep = false;
          units.splice(k, 1);
        }
      }
    }
    for (let k = roadblocks.length - 1; k >= 0; k -= 1) {
      const block = roadblocks[k];
      if (distance(block.x, block.z, p.x, p.z) > 230) {
        for (const officer of block.officers) game.gunmen.remove(officer);
        for (const vehicle of block.vehicles) if (vehicle.role !== 'player') game.fleet.remove(vehicle);
        roadblocks.splice(k, 1);
      }
    }
    spawnTimer -= dt;
    if (spawnTimer <= 0) {
      spawnTimer = 2.4 - stars * 0.25;
      const cruisers = units.filter((unit) => unit.type === 'cruiser').length;
      const tactical = units.filter((unit) => unit.type === 'tactical').length;
      if (tactical < TACTICAL_BY_STARS[stars]) dispatch('tactical');
      else if (cruisers < CRUISERS_BY_STARS[stars]) dispatch('cruiser');
    }
    roadblockTimer -= dt;
    if (roadblockTimer <= 0) {
      roadblockTimer = 5;
      if (roadblocks.length < ROADBLOCKS_BY_STARS[stars] && placeRoadblock()) roadblockTimer = 12;
    }
  }

  // The first unit is sent the moment a crime is called in.
  game.events.on('wantedChanged', ({ before }) => {
    if (before === 0) spawnTimer = 0.3;
  });

  /** True while any officer, crewed unit or the helicopter has eyes on the player. */
  function canSeePlayer() {
    const p = game.player.position();
    const sight = game.city.collision;
    for (const unit of units) {
      if (unit.mode !== 'pursue' || unit.vehicle.wrecked) continue;
      if (distanceSquared(unit.vehicle.x, unit.vehicle.z, p.x, p.z) < SIGHT_RANGE * SIGHT_RANGE && sight.hasLineOfSight(unit.vehicle.x, unit.vehicle.z, p.x, p.z, 2)) return true;
    }
    for (const gunman of game.gunmen.list) {
      if (gunman.faction === 'police' && !gunman.down && gunman.sees) return true;
    }
    return game.helicopter.seesPlayer();
  }

  /** What is out looking for the player, for the HUD's dispatch panel and the minimap. */
  function summary() {
    const officers = game.gunmen.list.filter((gunman) => gunman.faction === 'police' && !gunman.down).length;
    return {
      cruisers: units.filter((unit) => unit.type === 'cruiser' && !unit.vehicle.wrecked).length + roadblocks.length * 2,
      tactical: units.filter((unit) => unit.type === 'tactical' && !unit.vehicle.wrecked).length,
      officers,
      roadblocks: roadblocks.length,
      helicopter: game.helicopter.state.active,
    };
  }

  return { units, roadblocks, dispatch, buildRoadblock, ejectCrew, update, canSeePlayer, summary };
}
