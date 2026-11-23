// The four screenshot scenes behind ?shot=chase|shootout|night|title. Each one sets the
// real game up at a moment of play (a mission under way, the police called, weapons in
// hand) and returns how many simulation steps to run before the frame is drawn, so every
// screenshot is the game itself, a little way into the action.
import { STORY_MISSIONS } from '../missions/storyMissions.js';
import { CITY } from '../city/cityLayout.js';

const P = CITY.pitch;
const BOULEVARD = CITY.depth;

function equip(game, cash, rep, missionsDone) {
  game.mode = 'play';
  game.player.state.cash = cash;
  game.hud.state.cashShown = cash;
  game.progress.state.rep = rep;
  game.progress.state.missionsDone = missionsDone;
  game.missions.state.index = missionsDone;
  game.weapons.give('pistol', 84);
  if (missionsDone >= 2) game.weapons.give('smg', 240);
  if (missionsDone >= 5) game.weapons.give('shotgun', 32);
}

/** Skip past the mission's opening card and intro lines to a line spoken mid-job. */
function midMission(game, speaker, line) {
  game.hud.clearDialogue();
  game.hud.state.messageTime = 0;
  game.hud.say(speaker, line, 30);
}

/** Cover: five stars on Sunrow Boulevard in a stolen Kestrel GT, mid-way through "Hot Property". */
function stageChase(game) {
  equip(game, 48250, 300, 1);
  game.city.daylight.setHour(16.4);
  game.player.state.health = 82;
  game.player.state.armor = 64;
  game.weapons.select('pistol');
  game.missions.start(STORY_MISSIONS[1]);
  const car = game.missions.state.active.vehicle;
  car.x = 4.86 * P;
  car.z = BOULEVARD + 3.2;
  car.heading = -Math.PI / 2;
  car.vx = -37;
  car.vz = 0;
  game.player.takeSeat(car);
  game.traffic.populate(26);
  game.pedestrians.populate(44);
  game.wanted.setStars(5, 120);
  const west = -Math.PI / 2;
  game.police.dispatch('cruiser', { x: car.x + 8, z: BOULEVARD - 2.4, heading: west, speed: 38 });
  game.police.dispatch('cruiser', { x: car.x + 14, z: BOULEVARD + 4.2, heading: west, speed: 38 });
  game.police.dispatch('cruiser', { x: car.x + 21, z: BOULEVARD - 5, heading: west, speed: 38 });
  game.police.dispatch('cruiser', { x: car.x + 28, z: BOULEVARD + 0.4, heading: west, speed: 38 });
  game.police.dispatch('tactical', { x: car.x + 37, z: BOULEVARD - 2.6, heading: west, speed: 36 });
  game.police.buildRoadblock(car.x + 84, BOULEVARD, true);
  game.helicopter.placeOnStation(Math.PI / 2 - 0.7);
  game.autopilot = { throttle: 0.35, steer: 0, handbrake: false };
  midMission(game, 'dita', 'Five stars?! Lose them before you come anywhere near my lock-up!');
  game.cameraRig.state.zoom = 1.0;
  game.cameraRig.state.pitch = 0.07;
  game.cameraRig.snap(Math.PI / 2 - 0.3);
  return 46;
}

/** On foot: the gunfight with Halcyon Crest's heavies on the avenue by Saffron Market. */
function stageShootout(game) {
  equip(game, 6420, 150, 2);
  game.city.daylight.setHour(11.3);
  game.player.state.health = 61;
  game.player.state.armor = 30;
  game.weapons.select('smg');
  game.player.placeAt(4 * P + 2.5, 4.5 * P + 21, Math.PI);
  game.traffic.populate(18);
  game.pedestrians.populate(44);
  game.missions.start(STORY_MISSIONS[2]);
  const guards = game.missions.state.active.targets;
  guards.forEach((guard, index) => {
    guard.x = 4 * P + [-3.5, 4.5, -0.5, 6, -6][index];
    guard.z = 4.5 * P + [12, 9, 3, -2, -8][index];
    guard.alert = true;
  });
  game.gunmen.hurt(guards[0], 999, { byPlayer: true, vx: -2, vz: -3 });
  game.wanted.commit('shooting');
  game.wanted.setStars(2, 60);
  game.police.dispatch('cruiser', { x: 4 * P - 3.5, z: 4.5 * P - 30, heading: 0, speed: 14 });
  game.fleet.spawn('boxwell', 4 * P + 4.5, 4.5 * P + 1, 0.5, { paint: 0x14a38b });
  for (const ped of game.pedestrians.list) game.pedestrians.frighten(ped, 4 * P, 4.5 * P, 12);
  midMission(game, 'mara', 'Tell Lasker the market is closed to him!');
  game.input.state.aim = true;
  game.input.state.fire = true;
  game.cameraRig.state.zoom = 1.25;
  game.cameraRig.state.pitch = 0.2;
  game.cameraRig.snap(Math.PI + 0.12);
  return 40;
}

/** After dark: the "Night Shift" street race along the boulevard, with the police joining in. */
function stageNightRace(game) {
  equip(game, 15900, 420, 3);
  game.missions.start(STORY_MISSIONS[3]);
  game.city.daylight.setHour(21.4);
  const car = game.missions.state.active.vehicle;
  car.x = 6.2 * P;
  car.z = BOULEVARD - 3.2;
  car.heading = -Math.PI / 2;
  car.vx = -40;
  game.player.takeSeat(car);
  game.traffic.populate(24);
  game.pedestrians.populate(30);
  game.wanted.setStars(3, 60);
  game.police.dispatch('cruiser', { x: car.x - 58, z: BOULEVARD + 3.5, heading: Math.PI / 2, speed: 20 });
  game.police.dispatch('cruiser', { x: car.x + 16, z: BOULEVARD + 3, heading: -Math.PI / 2, speed: 38 });
  game.helicopter.placeOnStation(-Math.PI / 2 + 0.2);
  game.autopilot = { throttle: 1, steer: 0, handbrake: false };
  game.weapons.select('pistol');
  midMission(game, 'sparks', 'Cops on a race night? Do not lift - they cannot hold your line!');
  game.cameraRig.state.pitch = 0.17;
  game.cameraRig.snap(-Math.PI / 2 + 0.12);
  return 40;
}

/** The title screen, with two real saves written to the slots first. */
function stageTitle(game) {
  equip(game, 2150, 150, 2);
  game.saves.save(1);
  equip(game, 31200, 660, 5);
  game.saves.save(0);
  game.missions.offerNext();
  game.city.daylight.setHour(17.9);
  game.player.placeAt(4.5 * P, BOULEVARD + 10, 0);
  game.traffic.populate(26);
  game.pedestrians.populate(44);
  game.mode = 'menu';
  game.startMenu.show();
  return 120;
}

/** Stage the named scene; returns the number of fixed steps to simulate before drawing. */
export function stageScreenshotScene(game, name) {
  if (name === 'chase') return stageChase(game);
  if (name === 'shootout') return stageShootout(game);
  if (name === 'night') return stageNightRace(game);
  return stageTitle(game);
}
