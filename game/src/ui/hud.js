// The heads-up display. Every number on screen is read from the running game each frame:
// wanted stars, cash, rank, weapon and ammo, the police response, the mission objective,
// health and armour, the speedometer, the radio, prompts, dialogue and big messages.
import { districtAt, DISTRICTS } from '../city/cityLayout.js';
import { toMph } from '../vehicles/vehicleCatalog.js';
import { WEAPONS } from '../combat/weapons.js';
import { formatCash, formatClock } from '../core/mathUtil.js';
import { CAST, drawPortrait } from './characterPortraits.js';

export function createHud(game) {
  const el = (id) => document.getElementById(id);
  const root = el('hud');
  const shown = new Map();
  const state = { cashShown: 0, messageTime: 0, dialogueTime: 0, tickerTime: 0, flash: 0, promptOverride: '', dialogueQueue: [] };

  /** Write text or markup into an element only when it changed. */
  function put(id, value, asHtml = false) {
    if (shown.get(id) === value) return;
    shown.set(id, value);
    if (asHtml) el(id).innerHTML = value;
    else el(id).textContent = value;
  }

  function toggle(id, className, on) {
    const key = id + '.' + className;
    if (shown.get(key) === on) return;
    shown.set(key, on);
    el(id).classList.toggle(className, on);
  }

  /** The weapon rack: every weapon the player owns by its number key, the one in hand lit. */
  function weaponRack(heldKey) {
    let rack = '';
    for (const key of Object.keys(WEAPONS)) {
      if (!game.weapons.state.owned[key]) continue;
      const label = WEAPONS[key].name.split(' ')[0].toUpperCase();
      rack += '<span class="' + (key === heldKey ? 'held' : 'holstered') + '"><i>' + WEAPONS[key].slot + '</i>' + label + '</span>';
    }
    return rack;
  }

  /** A large centre-screen message: job done, knocked out, arrested. */
  function announce(title, detail = '', color = '#ffe14f', seconds = 4) {
    put('big-message-title', title);
    put('big-message-detail', detail);
    el('big-message-title').style.color = color;
    state.messageTime = seconds;
  }

  /** Queue a line of dialogue with the speaker's portrait. */
  function say(castKey, line, seconds = 4.5) {
    state.dialogueQueue.push({ castKey, line, seconds });
  }

  function clearDialogue() {
    state.dialogueQueue.length = 0;
    state.dialogueTime = 0;
  }

  function ticker(text, seconds = 3.5) {
    put('crime-ticker', text);
    state.tickerTime = seconds;
  }

  function policeResponse() {
    const wanted = game.wanted.state;
    if (wanted.stars === 0) return '';
    const s = game.police.summary();
    const lines = [wanted.seen ? '<span class="alert">IN PURSUIT</span>' : 'SEARCHING ' + Math.round(game.wanted.evadeProgress() * 100) + '%'];
    if (s.cruisers > 0) lines.push('CRUISERS x' + s.cruisers);
    if (s.officers > 0) lines.push('OFFICERS ON FOOT x' + s.officers);
    if (s.roadblocks > 0) lines.push('ROADBLOCK x' + s.roadblocks);
    if (s.tactical > 0) lines.push('TACTICAL VAN x' + s.tactical);
    if (s.helicopter) lines.push('AIR ONE OVERHEAD');
    return '<h4>TCPD RESPONSE</h4>' + lines.join('<br>');
  }

  function actionPrompt() {
    if (state.promptOverride) return state.promptOverride;
    const player = game.player.state;
    if (player.down) return '';
    if (player.vehicle) return Math.abs(player.vehicle.speed) < 1.5 ? '<kbd>F</kbd>Get out' : '';
    const vehicle = game.player.vehicleInReach();
    if (!vehicle) return '';
    const verb = vehicle.driver ? 'Carjack the ' : vehicle.role === 'abandoned' ? 'Get in the ' : 'Steal the ';
    return '<kbd>F</kbd>' + verb + vehicle.spec.name;
  }

  function update(dt) {
    const visible = game.mode === 'play';
    if (root.hidden === visible) root.hidden = !visible;
    if (!visible) return;
    const player = game.player.state;
    const wanted = game.wanted.state;

    let stars = '';
    for (let s = 1; s <= 5; s += 1) stars += s <= wanted.stars ? '<span class="lit">&#9733;</span>' : '&#9733;';
    put('wanted-stars', stars, true);
    toggle('wanted-stars', 'searching', wanted.stars > 0 && !wanted.seen);

    state.cashShown += (player.cash - state.cashShown) * Math.min(1, dt * 8);
    if (Math.abs(player.cash - state.cashShown) < 1) state.cashShown = player.cash;
    put('cash', formatCash(state.cashShown));
    put('reputation-rank', game.progress.rankLabel());
    const weaponKey = game.weapons.state.current;
    put('weapon-name', WEAPONS[weaponKey].name.toUpperCase());
    put('weapon-ammo', WEAPONS[weaponKey].melee ? '' : String(game.weapons.state.ammo[weaponKey]));
    put('weapon-rack', weaponRack(weaponKey), true);
    put('police-dispatch', policeResponse(), true);

    const p = game.player.position();
    put('district-name', DISTRICTS[districtAt(p.x, p.z)].name.toUpperCase());
    const hour = game.city.daylight.state.hour;
    put('city-clock', String(Math.floor(hour)).padStart(2, '0') + ':' + String(Math.floor((hour % 1) * 60)).padStart(2, '0'));
    el('health-bar').style.width = Math.max(0, (player.health / player.maxHealth) * 100) + '%';
    el('armor-bar').style.width = Math.min(100, player.armor) + '%';

    const mission = game.activities.hudState() ?? game.missions.hudState();
    put('mission-title', mission.title);
    put('objective-text', mission.objective);
    put('mission-timer', mission.timer === null ? '' : formatClock(mission.timer));

    const vehicle = player.vehicle;
    toggle('vehicle-panel', 'hidden', !vehicle);
    if (vehicle) {
      put('speed-value', String(toMph(vehicle.speed)));
      put('vehicle-name', vehicle.spec.name.toUpperCase() + ' - ' + vehicle.spec.kind.toUpperCase());
      el('vehicle-damage').style.width = Math.max(0, (vehicle.health / vehicle.spec.health) * 100) + '%';
      put('radio-station', game.radio.label());
    }
    put('action-prompt', actionPrompt(), true);
    toggle('crosshair', 'hidden', !(player.armed && !player.down && !player.vehicle));

    state.messageTime -= dt;
    toggle('big-message', 'visible', state.messageTime > 0);
    state.tickerTime -= dt;
    if (state.tickerTime <= 0) put('crime-ticker', '');
    state.flash = Math.max(0, state.flash - dt * 1.8);
    el('damage-flash').style.opacity = String(Math.min(1, state.flash));

    state.dialogueTime -= dt;
    if (state.dialogueTime <= 0 && state.dialogueQueue.length > 0) {
      const next = state.dialogueQueue.shift();
      state.dialogueTime = next.seconds;
      put('dialogue-speaker', CAST[next.castKey].name);
      put('dialogue-line', next.line);
      if (shown.get('portrait') !== next.castKey) {
        shown.set('portrait', next.castKey);
        drawPortrait(el('dialogue-portrait'), next.castKey);
      }
    }
    toggle('dialogue-box', 'hidden', state.dialogueTime <= 0);
    game.minimap.draw();
  }

  game.events.on('crime', ({ label }) => ticker(label.toUpperCase()));
  game.events.on('wantedCleared', () => ticker('YOU LOST THE POLICE', 4));
  game.events.on('playerHurt', ({ amount }) => { state.flash = Math.min(1, state.flash + amount / 30); });
  game.events.on('roadblock', () => ticker('ROADBLOCK AHEAD'));
  game.events.on('helicopterInbound', () => ticker('AIR ONE INBOUND'));

  return { state, update, announce, say, clearDialogue, ticker };
}
