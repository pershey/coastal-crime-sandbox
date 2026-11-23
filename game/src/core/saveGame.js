// Saving and loading: three slots in the browser's local storage. A save holds the story
// position, cash, reputation, weapons, health, the clock and where the player stood.
// The game autosaves to the current slot after every finished mission.
import { PLACES } from '../city/cityLayout.js';
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { RANKS } from '../missions/progression.js';

const KEY_PREFIX = 'tamarind-coast-save-';
export const SLOT_COUNT = 3;

export function createSaveGame(game) {
  const state = { slot: 0 };

  function read(slot) {
    try {
      const text = window.localStorage.getItem(KEY_PREFIX + slot);
      return text ? JSON.parse(text) : null;
    } catch {
      return null;
    }
  }

  /** One line per slot for the menus: null for an empty slot. */
  function listSlots() {
    const slots = [];
    for (let slot = 0; slot < SLOT_COUNT; slot += 1) {
      const data = read(slot);
      slots.push(data ? {
        slot, missionIndex: data.missionIndex, cash: data.cash, rank: RANKS[data.rankIndex ?? 0].name, savedAt: data.savedAt,
        title: data.missionIndex >= STORY_MISSIONS.length ? 'Story complete' : 'Next: ' + STORY_MISSIONS[data.missionIndex].title,
      } : null);
    }
    return slots;
  }

  function snapshot() {
    const player = game.player.state;
    const p = game.player.position();
    const now = new Date();
    const two = (value) => String(value).padStart(2, '0');
    const savedAt = `${now.getFullYear()}-${two(now.getMonth() + 1)}-${two(now.getDate())} ${two(now.getHours())}:${two(now.getMinutes())}:${two(now.getSeconds())}`;
    return {
      version: 1, savedAt,
      missionIndex: game.missions.state.index, cash: Math.round(player.cash), health: player.health, armor: player.armor,
      rep: game.progress.state.rep, rankIndex: game.progress.rankIndex(), missionsDone: game.progress.state.missionsDone,
      stats: game.progress.state.stats, weapons: game.weapons.state.owned, ammo: game.weapons.state.ammo,
      currentWeapon: game.weapons.state.current, x: p.x, z: p.z, hour: game.city.daylight.state.hour,
    };
  }

  function save(slot = state.slot) {
    state.slot = slot;
    try {
      window.localStorage.setItem(KEY_PREFIX + slot, JSON.stringify(snapshot()));
      return true;
    } catch {
      return false;
    }
  }

  /** Restore a slot into the running game. Returns false when the slot is empty. */
  function load(slot) {
    const data = read(slot);
    if (!data) return false;
    state.slot = slot;
    apply(data);
    return true;
  }

  function apply(data) {
    const player = game.player.state;
    player.cash = data.cash;
    player.health = Math.max(40, data.health);
    player.armor = data.armor;
    game.progress.state.rep = data.rep;
    game.progress.state.missionsDone = data.missionsDone;
    Object.assign(game.progress.state.stats, data.stats);
    game.weapons.state.owned = { fists: true, ...data.weapons };
    game.weapons.state.ammo = { pistol: 0, smg: 0, shotgun: 0, rifle: 0, ...data.ammo };
    game.weapons.state.current = data.currentWeapon ?? 'fists';
    game.missions.state.index = data.missionIndex;
    game.missions.offerNext();
    // Wake up at the garage rather than in the middle of whatever street the save was made on.
    const home = PLACES.garage;
    game.player.placeAt(home.x, home.z + 3, 0);
    game.city.daylight.setHour(data.hour ?? 14);
  }

  function hasAnySave() {
    return listSlots().some((slot) => slot !== null);
  }

  /** The slot saved most recently, or -1. */
  function latestSlot() {
    let best = -1, bestTime = '';
    listSlots().forEach((slot, index) => {
      if (slot && slot.savedAt > bestTime) { bestTime = slot.savedAt; best = index; }
    });
    return best;
  }

  function firstEmptySlot() {
    const index = listSlots().findIndex((slot) => slot === null);
    return index === -1 ? 0 : index;
  }

  game.events.on('missionPassed', () => save());

  return { state, listSlots, save, load, apply, snapshot, hasAnySave, latestSlot, firstEmptySlot };
}
