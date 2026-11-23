// Progression: reputation earned from missions and side jobs raises the player's rank,
// which unlocks weapons at the Ammo Shack, and lifetime statistics shown on the pause map.

export const RANKS = [
  { name: 'Nobody', rep: 0 },
  { name: 'Runner', rep: 100 },
  { name: 'Wheelman', rep: 280 },
  { name: 'Enforcer', rep: 520 },
  { name: 'Underboss', rep: 900 },
  { name: 'Queen of the Coast', rep: 1300 },
];

export function createProgression(game) {
  const state = {
    rep: 0, missionsDone: 0,
    stats: { carsStolen: 0, policeEvaded: 0, bestSprint: null, faresDelivered: 0, knockedOut: 0, arrested: 0, cashEarned: 0 },
  };

  function rankIndex() {
    let index = 0;
    for (let r = 0; r < RANKS.length; r += 1) if (state.rep >= RANKS[r].rep) index = r;
    return index;
  }

  /** "REP: WHEELMAN 280/520" for the HUD. */
  function rankLabel() {
    const index = rankIndex();
    const next = RANKS[index + 1];
    return 'RANK: ' + RANKS[index].name.toUpperCase() + (next ? '  ' + state.rep + '/' + next.rep + ' REP' : '  MAX REP');
  }

  function addRep(amount) {
    const before = rankIndex();
    state.rep += amount;
    if (rankIndex() > before) game.events.emit('rankUp', { rank: RANKS[rankIndex()].name });
  }

  game.events.on('carjack', () => { state.stats.carsStolen += 1; });
  game.events.on('carTheft', () => { state.stats.carsStolen += 1; });
  game.events.on('wantedCleared', () => { state.stats.policeEvaded += 1; addRep(5); });
  game.events.on('cash', ({ amount }) => { if (amount > 0) state.stats.cashEarned += amount; });

  return { state, rankIndex, rankLabel, addRep };
}
