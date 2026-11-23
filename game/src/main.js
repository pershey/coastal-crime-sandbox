// Tamarind Coast: an open-world crime game. This entry point builds the city, creates every
// system (story missions, police and wanted level, vehicles and traffic, pedestrians,
// combat, HUD, menus, saving, audio) and runs the fixed-step simulation loop.
import * as THREE from '../vendor/three.module.min.js';
import { createMissionRunner } from './missions/missionRunner.js';
import { createSideActivities } from './missions/sideActivities.js';
import { createProgression } from './missions/progression.js';
import { createWantedLevel } from './police/wantedLevel.js';
import { createPoliceDispatch } from './police/policeDispatch.js';
import { createPoliceHelicopter } from './police/policeHelicopter.js';
import { createVehicleFleet } from './vehicles/vehicleFleet.js';
import { createTrafficSystem } from './vehicles/trafficSystem.js';
import { createPlayer } from './actors/player.js';
import { createPedestrians } from './actors/pedestrians.js';
import { createCrowdRenderer } from './actors/crowdRenderer.js';
import { createWeapons } from './combat/weapons.js';
import { createGunmen } from './combat/gunmen.js';
import { createBallistics } from './combat/ballistics.js';
import { buildTamarindCoast } from './city/tamarindCoast.js';
import { nightGlow } from './city/skyAndDaylight.js';
import { PLACES } from './city/cityLayout.js';
import { createMapMarkers } from './world/mapMarkers.js';
import { createPickups } from './world/pickups.js';
import { createShops } from './world/shops.js';
import { createHud } from './ui/hud.js';
import { createMinimap } from './ui/minimap.js';
import { createStartMenu } from './ui/startMenu.js';
import { createPauseMap } from './ui/pauseMap.js';
import { createSoundEngine } from './audio/soundEngine.js';
import { createRadio } from './audio/radioStations.js';
import { createParticleEffects } from './effects/particleEffects.js';
import { createChaseCamera } from './core/chaseCamera.js';
import { createSaveGame } from './core/saveGame.js';
import { createInput } from './core/input.js';
import { createEventBus } from './core/eventBus.js';
import { createRandom } from './core/seededRandom.js';
import { formatCash } from './core/mathUtil.js';
import { stageScreenshotScene } from './shots/screenshotScenes.js';

const STEP = 1 / 60;
/** One in-game day lasts 24 real minutes. */
const HOURS_PER_SECOND = 1 / 60;
const params = new URLSearchParams(location.search);
const shotName = params.get('shot');
const seed = Number(params.get('seed') ?? 7) || 7;

const canvas = document.getElementById('city-view');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, preserveDrawingBuffer: shotName !== null });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(58, 1, 0.5, 3200);

const game = {
  scene, camera, renderer, seed,
  random: createRandom(seed * 7919 + 13),
  events: createEventBus(),
  input: createInput(canvas),
  time: 0,
  nightGlow: 0,
  mode: 'menu',
  autopilot: null,
  respawn: null,
};
game.city = buildTamarindCoast(scene, renderer, seed);
game.crowd = createCrowdRenderer(scene);
game.effects = createParticleEffects(game);
game.markers = createMapMarkers(game);
game.fleet = createVehicleFleet(game);
game.player = createPlayer(game);
game.cameraRig = createChaseCamera(game);
game.traffic = createTrafficSystem(game);
game.pedestrians = createPedestrians(game);
game.gunmen = createGunmen(game);
game.ballistics = createBallistics(game);
game.weapons = createWeapons(game);
game.wanted = createWantedLevel(game);
game.police = createPoliceDispatch(game);
game.helicopter = createPoliceHelicopter(game);
game.pickups = createPickups(game);
game.progress = createProgression(game);
game.radio = createRadio(game);
game.sound = createSoundEngine(game);
game.minimap = createMinimap(game);
game.hud = createHud(game);
game.missions = createMissionRunner(game);
game.activities = createSideActivities(game);
game.shops = createShops(game);
game.saves = createSaveGame(game);
game.startMenu = createStartMenu(game, { newGame, loadGame });
game.pauseMap = createPauseMap(game, { resume, quitToTitle });
window.__game = game;

function resize() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', resize);
resize();

/** Put the player on the street in front of the garage with a clean slate. */
function resetWorld() {
  const home = PLACES.garage;
  game.wanted.clear();
  game.player.placeAt(home.x - 10, home.z - 0.5, Math.PI / 2);
  game.player.state.health = game.player.state.maxHealth;
  game.cameraRig.snap(Math.PI / 2);
}

function newGame(slot) {
  game.saves.state.slot = slot;
  const player = game.player.state;
  player.cash = 300;
  player.armor = 0;
  game.weapons.removeAll();
  game.progress.state.rep = 0;
  game.progress.state.missionsDone = 0;
  game.missions.state.index = 0;
  game.city.daylight.setHour(9.5);
  resetWorld();
  game.missions.offerNext();
  beginPlay();
  game.hud.say('mara', 'Another bright morning on the Tamarind Coast. Bo wants me at the garage.', 5);
}

function loadGame(slot) {
  if (!game.saves.load(slot)) return;
  game.wanted.clear();
  game.cameraRig.snap(Math.PI);
  beginPlay();
}

function beginPlay() {
  game.mode = 'play';
  game.startMenu.hide();
  game.pauseMap.close();
  game.input.capturePointer();
}

function pause() {
  if (game.mode !== 'play') return;
  game.mode = 'paused';
  game.input.releasePointer();
  game.shops.close();
  game.pauseMap.open();
}

function resume() {
  if (game.mode !== 'paused') return;
  game.pauseMap.close();
  game.mode = 'play';
  game.input.capturePointer();
}

function quitToTitle() {
  game.pauseMap.close();
  if (game.missions.state.active) game.missions.fail('Left the job');
  game.mode = 'menu';
  game.startMenu.show();
}

// Going down or getting arrested: a short pause, then back on your feet minus some cash.
game.events.on('playerDown', () => {
  game.hud.announce('KNOCKED OUT', 'Coast Clinic patched you up', '#ff5a5a', 4.5);
  game.progress.state.stats.knockedOut += 1;
  game.respawn = { at: PLACES.clinic, timer: 3.6, fee: Math.min(500, Math.round(game.player.state.cash * 0.1)), keepWeapons: true };
});
game.events.on('playerBusted', () => {
  if (game.respawn) return;
  game.hud.announce('ARRESTED', 'TCPD kept your guns', '#3d8bff', 4.5);
  game.progress.state.stats.arrested += 1;
  game.player.state.down = true;
  game.respawn = { at: PLACES.policeHq, timer: 3.6, fee: Math.min(800, Math.round(game.player.state.cash * 0.15)), keepWeapons: false };
});

function updateRespawn(dt) {
  const respawn = game.respawn;
  if (!respawn) return;
  respawn.timer -= dt;
  if (respawn.timer > 0) return;
  game.respawn = null;
  game.wanted.clear();
  game.player.placeAt(respawn.at.x, respawn.at.z, respawn.at.facing ?? 0);
  game.player.state.health = game.player.state.maxHealth;
  game.player.state.pose = 'stand';
  game.player.addCash(-respawn.fee);
  if (!respawn.keepWeapons) game.weapons.removeAll();
  if (respawn.fee > 0) game.hud.ticker('PAID ' + formatCash(respawn.fee), 4);
  game.cameraRig.snap();
}

/** One fixed step of the whole simulation. */
function simulate(dt) {
  game.time += dt;
  if (game.mode === 'play') game.city.daylight.setHour(game.city.daylight.state.hour + dt * HOURS_PER_SECOND);
  if (game.mode === 'play') {
    game.player.update(dt);
    game.weapons.update(dt);
  }
  game.traffic.update(dt);
  game.police.update(dt);
  game.helicopter.update(dt);
  game.fleet.update(dt);
  game.pedestrians.update(dt);
  game.gunmen.update(dt);
  game.wanted.update(dt);
  game.pickups.update(dt);
  if (game.mode === 'play') {
    game.missions.update(dt);
    game.activities.update(dt);
    game.shops.update(dt);
    updateRespawn(dt);
  }
  game.markers.update(dt);
  game.effects.update(dt);
}

/** The title screen's camera: a slow circle above Sunrow Boulevard. */
function flyTitleCamera() {
  const p = game.player.position();
  const angle = game.time * 0.05 + 0.9;
  camera.position.set(p.x + Math.sin(angle) * 95, 34, p.z + Math.cos(angle) * 95 + 30);
  camera.lookAt(p.x, 12, p.z - 20);
  if (camera.fov !== 50) {
    camera.fov = 50;
    camera.updateProjectionMatrix();
  }
}

function draw(dt) {
  if (game.mode === 'menu') flyTitleCamera();
  else game.cameraRig.update(dt);
  game.nightGlow = nightGlow(game.city.daylight.state.night);
  game.city.update(game.time, game.player.position(), camera.position);
  game.crowd.begin();
  if (game.mode !== 'menu') game.player.draw(game.crowd);
  game.pedestrians.draw(game.crowd);
  game.gunmen.draw(game.crowd);
  game.crowd.end();
  game.hud.update(dt);
  game.sound.update();
  game.radio.update();
  renderer.render(scene, camera);
  if ((game.input.wasPressed('Escape') || game.input.wasPressed('KeyM') || game.input.wasPressed('KeyP')) && !shotName) {
    if (game.mode === 'play') pause();
    else if (game.mode === 'paused') resume();
  }
  game.input.endFrame();
}

// Leaving pointer lock with Esc opens the pause map, like any desktop game.
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.mode === 'play' && !shotName && game.input.state.enabled && document.hasFocus() && game.time > 1) pause();
});

/** Run the simulation forward by a number of seconds at once (screenshot scenes and testing). */
game.advance = (seconds) => {
  for (let k = 0; k < Math.round(seconds / STEP); k += 1) {
    simulate(STEP);
    game.input.endFrame();
  }
};

game.pickups.placeHiddenStock();
game.missions.offerNext();

if (shotName) {
  // Screenshot mode: stage a named scene from the seed, play it forward a fixed number of
  // steps, draw it, and tell the capture tool the frame is ready.
  game.input.state.enabled = false;
  game.advance(stageScreenshotScene(game, shotName) * STEP);
  let frames = 0;
  const present = () => {
    draw(STEP);
    frames += 1;
    if (frames >= 3) window.__shotReady = true;
    else requestAnimationFrame(present);
  };
  requestAnimationFrame(present);
} else {
  // Start on the title screen, standing the camera's anchor on the boulevard.
  game.player.placeAt(PLACES.boulevard.x, PLACES.boulevard.z + 10, 0);
  game.traffic.populate();
  game.pedestrians.populate();
  game.startMenu.show();
  let last = performance.now();
  let backlog = 0;
  const frame = (now) => {
    const elapsed = Math.min(0.1, (now - last) / 1000);
    last = now;
    if (game.mode !== 'paused') {
      backlog += elapsed;
      while (backlog >= STEP) {
        simulate(STEP);
        backlog -= STEP;
      }
    }
    draw(elapsed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
