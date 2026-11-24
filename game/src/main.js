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
import { createHud } from './ui/hud.js';
import { createVehicleFleet } from './vehicles/vehicleFleet.js';
import { createPlayer } from './actors/player.js';
import { createTrafficSystem } from './vehicles/trafficSystem.js';
import { createPedestrians } from './actors/pedestrians.js';
import { createCrowdRenderer } from './actors/crowdRenderer.js';
import { createGunmen } from './combat/gunmen.js';
import { createWeapons } from './combat/weapons.js';
import { createBallistics } from './combat/ballistics.js';
import { createMinimap } from './ui/minimap.js';
import { createSaveGame } from './core/saveGame.js';
import { createShops } from './world/shops.js';
import { createPickups } from './world/pickups.js';
import { createMapMarkers } from './world/mapMarkers.js';
import { createStartMenu } from './ui/startMenu.js';
import { createPauseMap } from './ui/pauseMap.js';
import { createRadio } from './audio/radioStations.js';
import { createSoundEngine } from './audio/soundEngine.js';
import { createParticleEffects } from './effects/particleEffects.js';
import { createChaseCamera } from './core/chaseCamera.js';
import { createInput } from './core/input.js';
import { createEventBus } from './core/eventBus.js';
import { createRandom } from './core/seededRandom.js';
import { formatCash } from './core/mathUtil.js';
import { buildTamarindCoast } from './city/tamarindCoast.js';
import { nightGlow } from './city/skyAndDaylight.js';
import { PLACES } from './city/cityLayout.js';
import { stageScreenshotScene } from './shots/screenshotScenes.js';

/** One fixed step of the whole open world: player, traffic, police, pedestrians, missions. */
function simulateOpenWorld(dt) {
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
    respawnAfterKnockoutOrArrest(dt);
  }
  game.markers.update(dt);
  game.effects.update(dt);
}

/** Draw one frame: chase camera, city, crowd, HUD and audio, then the pause key. */
function drawFrame(dt) {
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
    if (game.mode === 'play') pauseToCityMap();
    else if (game.mode === 'paused') resumePlay();
  }
  game.input.endFrame();
}

/** Start the story from mission one in the chosen save slot. */
function startNewGame(slot) {
  game.saves.state.slot = slot;
  const player = game.player.state;
  player.cash = 300;
  player.armor = 0;
  game.weapons.removeAll();
  game.progress.state.rep = 0;
  game.progress.state.missionsDone = 0;
  game.missions.state.index = 0;
  game.city.daylight.setHour(9.5);
  placePlayerAtGarage();
  game.missions.offerNext();
  beginPlay();
  game.hud.say('mara', 'Another bright morning on the Tamarind Coast. Bo wants me at the garage.', 5);
}

/** Continue from one of the three save slots. */
function loadSavedGame(slot) {
  if (!game.saves.load(slot)) return;
  game.wanted.clear();
  game.cameraRig.snap(Math.PI);
  beginPlay();
}

/** After a knock-out or an arrest: a short pause, then back on your feet minus a fee. */
function respawnAfterKnockoutOrArrest(dt) {
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

/** Freeze the city and open the pause screen with the full city map. */
function pauseToCityMap() {
  if (game.mode !== 'play') return;
  game.mode = 'paused';
  game.input.releasePointer();
  game.shops.close();
  game.pauseMap.open();
}

function resumePlay() {
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

function beginPlay() {
  game.mode = 'play';
  game.startMenu.hide();
  game.pauseMap.close();
  game.input.capturePointer();
}

/** Put the player on the street in front of the garage with a clean slate. */
function placePlayerAtGarage() {
  const home = PLACES.garage;
  game.wanted.clear();
  game.player.placeAt(home.x - 12, home.z - 0.5, Math.PI / 2);
  game.player.state.health = game.player.state.maxHealth;
  game.cameraRig.snap(Math.PI / 2);
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

/** Fit the canvas to the window and scale the HUD and menus, which are laid out for 1280 x 800. */
function fitCanvasAndHud() {
  renderer.setSize(window.innerWidth, window.innerHeight, false);
  camera.aspect = window.innerWidth / window.innerHeight;
  camera.updateProjectionMatrix();
  const scale = Math.max(0.55, Math.min(window.innerWidth / 1280, window.innerHeight / 800, 1.6));
  for (const id of ['hud', 'start-menu', 'pause-map', 'shop-panel']) document.getElementById(id).style.zoom = String(scale);
}

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

// Every system hangs off one shared game object, created in dependency order.
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
game.startMenu = createStartMenu(game, { newGame: startNewGame, loadGame: loadSavedGame });
game.pauseMap = createPauseMap(game, { resume: resumePlay, quitToTitle });
window.__game = game;

window.addEventListener('resize', fitCanvasAndHud);
fitCanvasAndHud();

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

// Leaving pointer lock with Esc opens the pause map, like any desktop game.
document.addEventListener('pointerlockchange', () => {
  if (!document.pointerLockElement && game.mode === 'play' && !shotName && game.input.state.enabled && document.hasFocus() && game.time > 1) pauseToCityMap();
});

/** Run the simulation forward by a number of seconds at once (screenshot scenes and testing). */
game.advance = (seconds) => {
  for (let k = 0; k < Math.round(seconds / STEP); k += 1) {
    simulateOpenWorld(STEP);
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
    drawFrame(STEP);
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
        simulateOpenWorld(STEP);
        backlog -= STEP;
      }
    }
    drawFrame(elapsed);
    requestAnimationFrame(frame);
  };
  requestAnimationFrame(frame);
}
