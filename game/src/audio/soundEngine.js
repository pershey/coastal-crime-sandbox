// All sound effects, synthesised in the browser with Web Audio: engine note that follows
// the speedometer, tyre squeal, police sirens, gunshots, crashes, explosions, the
// helicopter's rotor, and short tones for pickups, checkpoints and finished jobs.
import { distance } from '../core/mathUtil.js';

export function createSoundEngine(game) {
  const state = { context: null, master: null, volume: 0.6, started: false };
  let engine = null, squeal = null, siren = null, rotor = null, noiseBuffer = null;

  function makeNoiseBuffer(context) {
    const buffer = context.createBuffer(1, context.sampleRate, context.sampleRate);
    const data = buffer.getChannelData(0);
    let seed = 22222;
    for (let i = 0; i < data.length; i += 1) {
      seed = (seed * 16807) % 2147483647;
      data[i] = (seed / 2147483647) * 2 - 1;
    }
    return buffer;
  }

  function loopingNoise(context, filterType, frequency) {
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    source.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.value = 0;
    source.connect(filter).connect(gain).connect(state.master);
    source.start();
    return { filter, gain };
  }

  /** Browsers only allow audio after a key or click, so this runs on the first one. */
  function start() {
    if (state.started) return;
    const Context = window.AudioContext ?? window.webkitAudioContext;
    if (!Context) return;
    state.started = true;
    const context = new Context();
    state.context = context;
    state.master = context.createGain();
    state.master.gain.value = state.volume;
    state.master.connect(context.destination);
    noiseBuffer = makeNoiseBuffer(context);

    const oscillator = context.createOscillator();
    oscillator.type = 'sawtooth';
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 500;
    const gain = context.createGain();
    gain.gain.value = 0;
    oscillator.connect(filter).connect(gain).connect(state.master);
    oscillator.start();
    engine = { oscillator, filter, gain };

    squeal = loopingNoise(context, 'bandpass', 1900);
    rotor = loopingNoise(context, 'lowpass', 160);
    const wail = context.createOscillator();
    wail.type = 'square';
    const wailGain = context.createGain();
    wailGain.gain.value = 0;
    const wailFilter = context.createBiquadFilter();
    wailFilter.type = 'lowpass';
    wailFilter.frequency.value = 1800;
    wail.connect(wailFilter).connect(wailGain).connect(state.master);
    wail.start();
    siren = { oscillator: wail, gain: wailGain };
    game.events.emit('audioStarted', { context, output: state.master });
  }

  /** A burst of filtered noise: gunshots, crashes, explosions. */
  function burst(seconds, frequency, volume, filterType = 'lowpass') {
    if (!state.context || volume <= 0.001) return;
    const context = state.context;
    const source = context.createBufferSource();
    source.buffer = noiseBuffer;
    const filter = context.createBiquadFilter();
    filter.type = filterType;
    filter.frequency.value = frequency;
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, context.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, context.currentTime + seconds);
    source.connect(filter).connect(gain).connect(state.master);
    source.start(context.currentTime, (context.currentTime * 7.31) % 0.7, seconds);
  }

  /** A short musical tone, optionally sliding to a second pitch. */
  function tone(frequency, seconds, volume = 0.2, type = 'triangle', slideTo = null, delay = 0) {
    if (!state.context) return;
    const context = state.context;
    const at = context.currentTime + delay;
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    oscillator.connect(gain).connect(state.master);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.02);
  }

  function loudnessAt(x, z, range) {
    const p = game.player.position();
    return Math.max(0, 1 - distance(x, z, p.x, p.z) / range);
  }

  function update() {
    if (!state.context) return;
    const now = state.context.currentTime;
    const vehicle = game.player.state.vehicle;
    const playing = game.mode === 'play';
    const speed = vehicle ? Math.abs(vehicle.speed) : 0;
    // Engine: pitch climbs through four "gears".
    const gear = (speed % 13) / 13;
    engine.oscillator.frequency.setTargetAtTime(vehicle ? 48 + gear * 70 + speed * 1.6 : 40, now, 0.06);
    engine.filter.frequency.setTargetAtTime(380 + speed * 22, now, 0.1);
    engine.gain.gain.setTargetAtTime(vehicle && playing ? 0.07 + Math.abs(vehicle.controls.throttle) * 0.05 : 0, now, 0.08);
    squeal.gain.gain.setTargetAtTime(vehicle && playing && vehicle.slip > 3.5 ? Math.min(0.12, vehicle.slip * 0.012) : 0, now, 0.05);
    let nearestSiren = 0;
    for (const other of game.fleet.vehicles) {
      if (other.sirenOn && !other.wrecked) nearestSiren = Math.max(nearestSiren, loudnessAt(other.x, other.z, 170));
    }
    siren.oscillator.frequency.setTargetAtTime(660 + Math.sin(game.time * 5.2) * 230, now, 0.03);
    siren.gain.gain.setTargetAtTime(playing ? nearestSiren * 0.05 : 0, now, 0.1);
    const heli = game.helicopter.state;
    const heliLoud = heli.active ? loudnessAt(heli.x, heli.z, 220) : 0;
    rotor.gain.gain.setTargetAtTime(playing ? heliLoud * (0.2 + 0.14 * Math.sin(game.time * 42)) : 0, now, 0.02);
  }

  function setVolume(volume) {
    state.volume = volume;
    if (state.master) state.master.gain.value = volume;
  }

  window.addEventListener('keydown', start, { once: false });
  window.addEventListener('mousedown', start, { once: false });
  game.events.on('gunshot', ({ x, z, weapon }) => {
    const loud = loudnessAt(x, z, 150);
    burst(weapon === 'shotgun' ? 0.3 : 0.14, weapon === 'shotgun' ? 900 : 2200, loud * 0.5);
    tone(150, 0.08, loud * 0.25, 'square', 50);
  });
  game.events.on('explosion', ({ x, z }) => {
    const loud = loudnessAt(x, z, 400);
    burst(1.4, 420, loud * 0.9);
    tone(80, 0.9, loud * 0.5, 'sine', 28);
  });
  game.events.on('carImpact', ({ vehicle, impact }) => burst(0.25, 700, loudnessAt(vehicle.x, vehicle.z, 90) * Math.min(0.6, impact * 0.04)));
  game.events.on('carCrash', ({ a, closing }) => burst(0.3, 900, loudnessAt(a.x, a.z, 90) * Math.min(0.6, closing * 0.05)));
  game.events.on('punch', ({ hit }) => burst(0.08, hit ? 500 : 1500, hit ? 0.4 : 0.1));
  game.events.on('pickup', () => { tone(880, 0.09, 0.18); tone(1320, 0.14, 0.18, 'triangle', null, 0.07); });
  game.events.on('purchase', () => { tone(660, 0.08, 0.18); tone(990, 0.16, 0.18, 'triangle', null, 0.08); });
  game.events.on('checkpoint', () => tone(1040, 0.2, 0.22, 'sine'));
  game.events.on('wantedChanged', ({ stars, before }) => { if (stars > before) tone(440, 0.25, 0.2, 'square', 880); });
  game.events.on('wantedCleared', () => { tone(660, 0.12, 0.2); tone(520, 0.3, 0.2, 'triangle', null, 0.12); });
  game.events.on('missionPassed', () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.35, 0.22, 'triangle', null, k * 0.13)));
  game.events.on('missionFailed', () => [392, 330, 262].forEach((f, k) => tone(f, 0.4, 0.2, 'sawtooth', null, k * 0.2)));
  game.events.on('enterVehicle', () => burst(0.12, 400, 0.3));
  game.events.on('dryFire', () => tone(1800, 0.03, 0.1, 'square'));

  return { state, start, update, tone, burst, setVolume };
}
