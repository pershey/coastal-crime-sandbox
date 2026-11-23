// The wanted level: crimes the player commits add heat, heat becomes one to five stars,
// and stars only clear once the police have lost sight of the player for long enough.
import { distanceSquared } from '../core/mathUtil.js';

/** Heat needed for each star count. */
const STAR_HEAT = [0, 8, 30, 70, 130, 210];
const CRIME_HEAT = {
  carTheft: 5, carjack: 9, policeCarTheft: 30, hitAndRun: 14, assault: 8, shooting: 9,
  murder: 22, officerDown: 48, policeRam: 7, policeWrecked: 40, explosion: 34, armedRobbery: 30,
};
const CRIME_LABELS = {
  carTheft: 'Vehicle theft', carjack: 'Carjacking', policeCarTheft: 'Stole a police cruiser', hitAndRun: 'Hit and run',
  assault: 'Assault', shooting: 'Shots fired', murder: 'Homicide', officerDown: 'Officer down', policeRam: 'Rammed a police unit',
  policeWrecked: 'Police unit destroyed', explosion: 'Explosion reported', armedRobbery: 'Armed robbery',
};

export function createWantedLevel(game) {
  const state = {
    heat: 0, stars: 0, seen: false, hiddenFor: 0, evadeNeeded: 0, lastSeenX: 0, lastSeenZ: 0,
    shotsFired: false, lastCrime: '', lastCrimeTime: -99, lockedUntil: 0, minimumStars: 0,
  };

  function starsForHeat(heat) {
    let stars = 0;
    for (let s = 1; s < STAR_HEAT.length; s += 1) if (heat >= STAR_HEAT[s]) stars = s;
    return stars;
  }

  function applyStars(stars) {
    if (stars === state.stars) return;
    const before = state.stars;
    state.stars = stars;
    state.evadeNeeded = 7 + stars * 4.5;
    game.events.emit('wantedChanged', { stars, before });
  }

  /** Report a crime at a place. Witnesses are assumed: this is a busy town. */
  function commit(crime, x, z) {
    state.heat = Math.min(STAR_HEAT[5] + 40, state.heat + CRIME_HEAT[crime]);
    state.lastCrime = CRIME_LABELS[crime];
    state.lastCrimeTime = game.time;
    state.hiddenFor = 0;
    if (crime === 'shooting' || crime === 'murder' || crime === 'officerDown') state.shotsFired = true;
    const p = game.player.position();
    state.lastSeenX = x ?? p.x;
    state.lastSeenZ = z ?? p.z;
    applyStars(Math.max(state.stars, starsForHeat(state.heat)));
    game.events.emit('crime', { crime, label: state.lastCrime });
  }

  /** Force a wanted level (missions do this). `hold` keeps it from clearing for that many seconds. */
  function setStars(stars, hold = 0) {
    state.heat = Math.max(state.heat, STAR_HEAT[stars]);
    if (stars === 0) state.heat = 0;
    state.hiddenFor = 0;
    state.lockedUntil = game.time + hold;
    if (stars > 0) {
      const p = game.player.position();
      state.lastSeenX = p.x;
      state.lastSeenZ = p.z;
    }
    applyStars(stars);
  }

  function clear() {
    state.heat = 0;
    state.shotsFired = false;
    state.hiddenFor = 0;
    applyStars(0);
    game.events.emit('wantedCleared', {});
  }

  function update(dt) {
    if (state.stars === 0) {
      state.heat = Math.max(0, state.heat - dt * 0.5);
      state.seen = false;
      return;
    }
    state.seen = game.police.canSeePlayer();
    if (state.seen) {
      const p = game.player.position();
      state.lastSeenX = p.x;
      state.lastSeenZ = p.z;
      state.hiddenFor = 0;
    } else if (game.time > state.lockedUntil) {
      state.hiddenFor += dt;
      if (state.hiddenFor >= state.evadeNeeded) clear();
    }
  }

  /** 0 to 1: how close the player is to shaking the police off. */
  function evadeProgress() {
    return state.stars === 0 || state.seen ? 0 : Math.min(1, state.hiddenFor / state.evadeNeeded);
  }

  // Crimes, as the rest of the game reports them.
  game.events.on('carTheft', ({ x, z, police }) => commit(police ? 'policeCarTheft' : 'carTheft', x, z));
  game.events.on('carjack', ({ x, z, police }) => commit(police ? 'policeCarTheft' : 'carjack', x, z));
  game.events.on('pedDown', ({ x, z, byPlayer, how }) => {
    if (byPlayer) commit(how === 'runOver' ? 'hitAndRun' : how === 'punch' ? 'assault' : 'murder', x, z);
  });
  game.events.on('gunmanDown', ({ x, z, byPlayer, faction }) => {
    if (byPlayer && faction === 'police') commit('officerDown', x, z);
  });
  game.events.on('gunshot', ({ x, z, byPlayer }) => {
    if (!byPlayer) return;
    // Gunfire is only a crime when someone is close enough to hear it.
    const heard = game.pedestrians.list.some((ped) => !ped.down && distanceSquared(ped.x, ped.z, x, z) < 55 * 55) || state.stars > 0;
    if (heard && game.time - state.lastShotReport > 2.5) {
      state.lastShotReport = game.time;
      commit('shooting', x, z);
    }
  });
  state.lastShotReport = -99;
  game.events.on('carCrash', ({ a, b, closing }) => {
    const police = a.role === 'police' ? a : b.role === 'police' ? b : null;
    const other = police === a ? b : a;
    if (police && other.role === 'player' && closing > 5 && state.stars > 0) commit('policeRam', police.x, police.z);
  });
  game.events.on('vehicleWrecked', ({ vehicle, byPlayer }) => {
    if (byPlayer && vehicle.spec.police) commit('policeWrecked', vehicle.x, vehicle.z);
  });
  game.events.on('explosion', ({ x, z, byPlayer }) => {
    if (byPlayer) commit('explosion', x, z);
  });

  return { state, commit, setStars, clear, update, evadeProgress };
}
