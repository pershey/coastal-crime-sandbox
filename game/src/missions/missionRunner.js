// Plays the story missions step by step: places the contact's beacon, runs the intro
// dialogue, sets up each step (a car to steal, guards to fight, checkpoints to hit, a
// target to wreck, stars to lose), watches for success or failure, and pays out.
import { STORY_MISSIONS, missionPlace } from './storyMissions.js';
import { PLACES } from '../city/cityLayout.js';
import { CAST } from '../ui/characterPortraits.js';
import { distance, formatCash } from '../core/mathUtil.js';

const CONTACT_COLOR = '#ff8ad0';
const OBJECTIVE_COLOR = '#ffe14f';

export function createMissionRunner(game) {
  const state = { index: 0, active: null, contactMarker: null, cooldown: 0 };

  function clearStepMarkers(active) {
    for (const marker of active.markers) game.markers.remove(marker);
    active.markers = [];
  }

  /** Put the next contact's beacon on the street (or none when the story is finished). */
  function offerNext() {
    game.markers.remove(state.contactMarker);
    state.contactMarker = null;
    const mission = STORY_MISSIONS[state.index];
    if (!mission) return;
    const place = missionPlace(mission);
    state.contactMarker = game.markers.add({ x: place.x, z: place.z, color: CONTACT_COLOR, kind: 'contact', label: CAST[mission.contact].name, radius: 3 });
  }

  function start(mission) {
    game.markers.remove(state.contactMarker);
    state.contactMarker = null;
    game.hud.clearDialogue();
    for (const [who, line] of mission.intro) game.hud.say(who, line);
    if (mission.hour !== undefined) game.city.daylight.setHour(mission.hour);
    state.active = { mission, stepIndex: 0, markers: [], vehicle: null, targets: [], timer: null, count: 0, total: 0, phase: 0 };
    game.hud.announce(mission.title, CAST[mission.contact].name, '#ff8ad0', 3.5);
    game.events.emit('missionStarted', { mission });
    beginStep();
  }

  function objectiveMarker(active, x, z, radius = 5, kind = 'objective') {
    const marker = game.markers.add({ x, z, color: OBJECTIVE_COLOR, kind, radius });
    active.markers.push(marker);
    return marker;
  }

  function spawnMissionVehicle(step, at, tag) {
    const clutter = game.fleet.nearest(at.x, at.z, 7);
    if (clutter && clutter.role !== 'player') game.fleet.remove(clutter);
    const vehicle = game.fleet.spawn(step.model, at.x, at.z, at.heading, { paint: step.paint, tag });
    vehicle.keep = true;
    return vehicle;
  }

  /** Find a clear spot within `spread` metres of a point for a guard to stand. */
  function clearSpotNear(at, spread) {
    for (let attempt = 0; attempt < 20; attempt += 1) {
      const x = at.x + game.random.range(-spread, spread), z = at.z + game.random.range(-spread, spread);
      if (!game.city.collision.isBlocked(x, z, 0.8)) return { x, z };
    }
    return { x: at.x, z: at.z };
  }

  function beginStep() {
    const active = state.active;
    const step = active.mission.steps[active.stepIndex];
    active.step = step;
    active.timer = null;
    active.count = 0;
    active.total = 0;
    active.phase = 0;
    active.targets = [];
    clearStepMarkers(active);
    if (step.say) game.hud.say(step.say[0], step.say[1]);
    const where = step.place ? PLACES[step.place] : step.at;

    if (step.type === 'goto' || step.type === 'deliver') objectiveMarker(active, where.x, where.z, step.radius ?? 5);
    if (step.type === 'steal') {
      active.vehicle = spawnMissionVehicle(step, step.at, 'mission');
      objectiveMarker(active, step.at.x, step.at.z, 3.5);
    }
    if (step.type === 'collect') {
      active.total = step.spots.length;
      for (const spot of step.spots) objectiveMarker(active, spot.x, spot.z, 2.4, 'checkpoint');
    }
    if (step.type === 'eliminate') {
      const groups = [{ kind: step.kind, count: step.count }];
      if (step.extra) groups.push(step.extra);
      for (const group of groups) {
        for (let k = 0; k < group.count; k += 1) {
          const spot = clearSpotNear(step.at, step.spread);
          active.targets.push(game.gunmen.spawn(group.kind, spot.x, spot.z, { tag: 'mission', alert: false, heading: game.random.range(0, 6.28) }));
        }
      }
      active.total = active.targets.length;
      objectiveMarker(active, step.at.x, step.at.z, 6);
    }
    if (step.type === 'destroy') {
      const vehicle = spawnMissionVehicle(step, step.at, 'target');
      const roads = game.city.roads;
      const from = roads.nearestNode(step.at.x, step.at.z);
      let best = from.links[0], bestDot = -Infinity;
      for (const link of from.links) {
        const dot = (link.x - from.x) * Math.sin(step.at.heading) + (link.z - from.z) * Math.cos(step.at.heading);
        if (dot > bestDot) { bestDot = dot; best = link; }
      }
      const driver = game.traffic.addDriver(vehicle, roads.laneBetween(from, best));
      driver.panic = 1e9;
      vehicle.role = 'traffic';
      vehicle.keep = true;
      active.targets.push(vehicle);
      if (step.wanted) game.wanted.setStars(Math.max(game.wanted.state.stars, step.wanted), 10);
    }
    if (step.type === 'destroyParked') {
      for (const spot of step.spots) active.targets.push(spawnMissionVehicle(step, spot, 'target'));
      active.total = active.targets.length;
    }
    if (step.type === 'race') {
      active.timer = step.seconds;
      active.total = step.checkpoints.length;
      objectiveMarker(active, step.checkpoints[0].x, step.checkpoints[0].z, 9, 'objective');
    }
    if (step.type === 'survive') {
      active.timer = step.seconds;
      game.wanted.setStars(Math.max(game.wanted.state.stars, step.stars), step.seconds + 4);
    }
    if (step.type === 'loseWanted' && step.stars) game.wanted.setStars(Math.max(game.wanted.state.stars, step.stars), 8);
    game.events.emit('objective', { text: step.text });
  }

  function completeStep() {
    const active = state.active;
    clearStepMarkers(active);
    active.stepIndex += 1;
    if (active.stepIndex >= active.mission.steps.length) pass();
    else beginStep();
  }

  function releaseMissionProps(active) {
    clearStepMarkers(active);
    game.gunmen.removeWhere((gunman) => gunman.tag === 'mission' && !gunman.down);
    for (const vehicle of game.fleet.vehicles) {
      if ((vehicle.tag === 'mission' || vehicle.tag === 'target') && vehicle.role !== 'player') { vehicle.keep = false; vehicle.tag = null; }
    }
  }

  function pass() {
    const active = state.active;
    const mission = active.mission;
    releaseMissionProps(active);
    state.active = null;
    state.index += 1;
    game.player.addCash(mission.reward.cash);
    game.progress.addRep(mission.reward.rep);
    game.progress.state.missionsDone += 1;
    if (mission.gift) game.weapons.give(mission.gift.weapon, mission.gift.ammo);
    for (const [who, line] of mission.outro) game.hud.say(who, line);
    const finale = state.index >= STORY_MISSIONS.length;
    game.hud.announce(finale ? 'THE COAST IS YOURS' : 'JOB DONE', '+' + formatCash(mission.reward.cash) + '   +' + mission.reward.rep + ' REP', '#6dff8a', finale ? 8 : 4.5);
    game.events.emit('missionPassed', { mission });
    offerNext();
  }

  function fail(reason) {
    const active = state.active;
    if (!active) return;
    releaseMissionProps(active);
    state.active = null;
    state.cooldown = 4;
    game.hud.clearDialogue();
    game.hud.announce('JOB FAILED', reason, '#ff5a5a', 4);
    game.events.emit('missionFailed', { mission: active.mission, reason });
    offerNext();
  }

  function updateStep(dt) {
    const active = state.active;
    const step = active.step;
    const player = game.player.state;
    const p = game.player.position();
    const speed = Math.abs(game.player.speed());
    if (active.timer !== null) active.timer -= dt;

    if (step.type === 'goto') {
      if (game.markers.isPlayerInside(active.markers[0]) && speed < 14) completeStep();
    } else if (step.type === 'steal') {
      if (active.vehicle.wrecked) fail('The car was destroyed');
      else if (player.vehicle === active.vehicle) {
        if (step.wanted) game.wanted.setStars(Math.max(game.wanted.state.stars, step.wanted), 8);
        completeStep();
      }
    } else if (step.type === 'deliver') {
      if (active.vehicle.wrecked) fail('The car was destroyed');
      else if (player.vehicle === active.vehicle && game.markers.isPlayerInside(active.markers[0]) && speed < 5) {
        game.player.exitVehicle();
        active.vehicle.keep = false;
        completeStep();
      }
    } else if (step.type === 'collect') {
      for (let k = active.markers.length - 1; k >= 0; k -= 1) {
        if (!player.vehicle && game.markers.isPlayerInside(active.markers[k])) {
          game.markers.remove(active.markers[k]);
          active.markers.splice(k, 1);
          active.count += 1;
          game.events.emit('pickup', { pickup: { kind: 'cash' } });
        }
      }
      if (active.count >= active.total) completeStep();
    } else if (step.type === 'eliminate') {
      active.count = active.targets.filter((gunman) => gunman.down).length;
      if (active.count >= active.total) completeStep();
    } else if (step.type === 'destroy') {
      const target = active.targets[0];
      if (active.phase === 0) {
        if (target.wrecked) {
          if (!step.grab) completeStep();
          else if (target.exploded) {
            active.phase = 1;
            objectiveMarker(active, target.x, target.z, 5, 'objective');
          }
        } else if (distance(target.x, target.z, p.x, p.z) > 420) fail('The target got away');
      } else if (game.markers.isPlayerInside(active.markers[0]) && speed < 6) completeStep();
    } else if (step.type === 'destroyParked') {
      active.count = active.targets.filter((vehicle) => vehicle.wrecked).length;
      if (active.count >= active.total) completeStep();
    } else if (step.type === 'race') {
      if (active.timer <= 0) fail('Out of time');
      else if (game.markers.isPlayerInside(active.markers[0], 2)) {
        active.count += 1;
        clearStepMarkers(active);
        game.events.emit('checkpoint', {});
        if (active.count >= active.total) completeStep();
        else objectiveMarker(active, step.checkpoints[active.count].x, step.checkpoints[active.count].z, 9, 'objective');
      }
    } else if (step.type === 'survive') {
      if (active.timer <= 0) completeStep();
    } else if (step.type === 'loseWanted') {
      if (game.wanted.state.stars === 0) completeStep();
    }
  }

  function update(dt) {
    state.cooldown = Math.max(0, state.cooldown - dt);
    if (state.active) {
      updateStep(dt);
      return;
    }
    game.hud.state.promptOverride = '';
    const marker = state.contactMarker;
    if (!marker || state.cooldown > 0 || game.player.state.down) return;
    if (game.markers.isPlayerInside(marker, 1) && Math.abs(game.player.speed()) < 8) {
      if (game.wanted.state.stars > 0) game.hud.state.promptOverride = 'Lose the police before you take a job';
      else start(STORY_MISSIONS[state.index]);
    }
  }

  /** The mission title, objective line and timer the HUD shows. */
  function hudState() {
    const active = state.active;
    if (!active) {
      const mission = STORY_MISSIONS[state.index];
      if (!mission) return { title: 'FREE ROAM', objective: 'The coast is yours. Race, drive a cab, cause trouble.', timer: null };
      return { title: '', objective: 'Meet ' + CAST[mission.contact].name + ' at ' + missionPlace(mission).label, timer: null };
    }
    const step = active.step;
    let text = step.text;
    if (step.type === 'destroy' && active.phase === 1) text = step.grab;
    if (step.type === 'deliver' && game.player.state.vehicle !== active.vehicle) text = 'Get back in the ' + active.vehicle.spec.name;
    if (active.total > 1) text += ' (' + active.count + '/' + active.total + ')';
    return {
      title: active.mission.title,
      objective: 'OBJECTIVE ' + (active.stepIndex + 1) + '/' + active.mission.steps.length + ': ' + text,
      timer: active.timer,
    };
  }

  game.events.on('playerDown', () => fail('You were knocked out'));
  game.events.on('playerBusted', () => fail('You were arrested'));

  return { state, offerNext, start, fail, update, hudState };
}
