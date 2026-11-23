// Side jobs outside the story: the Boulevard Sprint street race against your own best time,
// and cab fares in a Cabana Cab (press T to pick up a passenger and get them across town
// before they lose patience).
import { CITY, PLACES, kerbPoint } from '../city/cityLayout.js';
import { distance, formatCash, formatClock } from '../core/mathUtil.js';

const SPRINT_ROUTE = [[5, 7], [3, 7], [1, 7], [1, 5], [3, 5], [3, 3], [6, 3], [6, 6], [8, 7]];
const SPRINT_PAR = 95;

export function createSideActivities(game) {
  const state = { race: null, fare: null, raceMarker: null };

  function placeRaceMarker() {
    if (state.raceMarker || state.race) return;
    const start = PLACES.raceStart;
    state.raceMarker = game.markers.add({ x: start.x, z: start.z + 4, color: '#33e1ff', kind: 'service', label: 'Boulevard Sprint', radius: 4 });
  }

  function startRace() {
    game.markers.remove(state.raceMarker);
    state.raceMarker = null;
    state.race = { index: 0, time: 0, marker: null };
    nextCheckpoint();
    game.hud.announce('BOULEVARD SPRINT', 'Par ' + formatClock(SPRINT_PAR), '#33e1ff', 3);
  }

  function nextCheckpoint() {
    const race = state.race;
    game.markers.remove(race.marker);
    const [i, j] = SPRINT_ROUTE[race.index];
    race.marker = game.markers.add({ x: i * CITY.pitch, z: j * CITY.pitch, color: '#33e1ff', kind: 'objective', radius: 9 });
  }

  function endRace(finished) {
    const race = state.race;
    game.markers.remove(race.marker);
    state.race = null;
    if (!finished) return;
    const stats = game.progress.state.stats;
    const record = stats.bestSprint === null || race.time < stats.bestSprint;
    if (record) stats.bestSprint = race.time;
    const prize = race.time <= SPRINT_PAR ? 800 : 250;
    game.player.addCash(prize);
    game.progress.addRep(race.time <= SPRINT_PAR ? 40 : 10);
    game.hud.announce(record ? 'NEW RECORD' : 'SPRINT FINISHED', formatClock(race.time) + '   +' + formatCash(prize), '#33e1ff', 4.5);
  }

  function startFare() {
    const taxi = game.player.state.vehicle;
    const blocks = [];
    for (let k = 0; k < 2; k += 1) blocks.push(kerbPoint(game.random.int(0, CITY.cols - 1), game.random.int(0, CITY.rows - 1), game.random.pick(['n', 's', 'e', 'w'])));
    const [pickup, dropoff] = blocks;
    state.fare = { stage: 'pickup', pickup, dropoff, time: 25 + distance(taxi.x, taxi.z, pickup.x, pickup.z) / 9, marker: null, pay: 0 };
    state.fare.marker = game.markers.add({ x: pickup.x, z: pickup.z, color: '#ffc300', kind: 'objective', radius: 6 });
    game.hud.ticker('FARE WAITING - PICK THEM UP', 4);
  }

  function endFare(paid) {
    const fare = state.fare;
    game.markers.remove(fare.marker);
    state.fare = null;
    if (paid) {
      game.player.addCash(fare.pay);
      game.progress.addRep(8);
      game.progress.state.stats.faresDelivered += 1;
      game.hud.announce('FARE PAID', '+' + formatCash(fare.pay), '#ffc300', 3);
    } else game.hud.ticker('FARE LOST', 3);
  }

  function update(dt) {
    const player = game.player.state;
    const vehicle = player.vehicle;
    const busy = game.missions.state.active !== null;
    if (busy) {
      if (state.race) endRace(false);
      if (state.fare) endFare(false);
      game.markers.remove(state.raceMarker);
      state.raceMarker = null;
      return;
    }
    // The sprint opens once Sparks has been beaten in the story.
    if (game.missions.state.index >= 4) placeRaceMarker();
    if (state.raceMarker && vehicle && game.markers.isPlayerInside(state.raceMarker, 2) && Math.abs(vehicle.speed) < 4) startRace();
    if (state.race) {
      state.race.time += dt;
      if (!vehicle) endRace(false);
      else if (game.markers.isPlayerInside(state.race.marker, 2)) {
        state.race.index += 1;
        game.events.emit('checkpoint', {});
        if (state.race.index >= SPRINT_ROUTE.length) endRace(true);
        else nextCheckpoint();
      }
    }
    const inTaxi = vehicle && vehicle.spec.taxi === true;
    if (inTaxi && !state.fare && !state.race && game.input.wasPressed('KeyT')) startFare();
    if (state.fare) {
      const fare = state.fare;
      fare.time -= dt;
      if (!inTaxi || fare.time <= 0) endFare(false);
      else if (game.markers.isPlayerInside(fare.marker, 1) && Math.abs(vehicle.speed) < 3) {
        if (fare.stage === 'pickup') {
          fare.stage = 'dropoff';
          const trip = distance(fare.pickup.x, fare.pickup.z, fare.dropoff.x, fare.dropoff.z);
          fare.time = 22 + trip / 8;
          fare.pay = Math.round(60 + trip * 0.9);
          game.markers.remove(fare.marker);
          fare.marker = game.markers.add({ x: fare.dropoff.x, z: fare.dropoff.z, color: '#ffc300', kind: 'objective', radius: 6 });
          game.hud.ticker('PASSENGER ABOARD - GO', 3);
        } else endFare(true);
      }
    }
  }

  /** What the HUD's objective line should say while a side job runs, or null. */
  function hudState() {
    if (state.race) return { title: 'BOULEVARD SPRINT', objective: 'CHECKPOINT ' + (state.race.index + 1) + '/' + SPRINT_ROUTE.length + '   ' + formatClock(state.race.time), timer: null };
    if (state.fare) return { title: 'CABANA CAB', objective: state.fare.stage === 'pickup' ? 'Pick up the fare' : 'Drop the fare off - ' + formatCash(state.fare.pay), timer: state.fare.time };
    return null;
  }

  return { state, update, hudState };
}
