// The car radio: three stations of original music, composed by rule and played by a small
// step sequencer (kick, hat, bass and lead) through Web Audio. N changes station.
import { createRandom } from '../core/seededRandom.js';

export const STATIONS = [
  { name: 'RADIO GUAVA 98.1', style: 'tropical pop', tempo: 112, root: 57, scale: [0, 2, 4, 7, 9], lead: 'triangle', swing: 0.14,
    tracks: ['Mango Season', 'Salt on the Dash', 'Boulevard Baby', 'Hotel Coraline'] },
  { name: 'NEON 104.7', style: 'night-drive synth', tempo: 96, root: 52, scale: [0, 3, 5, 7, 10], lead: 'sawtooth', swing: 0,
    tracks: ['Afterglow Avenue', 'Glasswater Lights', 'Kestrel Run', 'Low Sun, Fast Car'] },
  { name: 'LOW TIDE FM 91.5', style: 'slow beats', tempo: 78, root: 50, scale: [0, 2, 3, 7, 9], lead: 'sine', swing: 0.2,
    tracks: ['Pelican Hours', 'Quay Fog', 'Sunday at Bo\'s', 'Tamarind Rain'] },
];

const midiToHz = (note) => 440 * Math.pow(2, (note - 69) / 12);

export function createRadio(game) {
  const state = { station: 0, track: 0, on: true, step: 0, nextTime: 0, bar: 0 };
  let context = null, output = null, noise = null, pattern = null;

  /** Write a new four-bar song for the current station and track: same seed, same song. */
  function compose() {
    const station = STATIONS[state.station];
    const random = createRandom(1000 + state.station * 97 + state.track * 13);
    const progression = [0, random.pick([3, 4]), random.pick([1, 2]), random.pick([3, 4])];
    const bass = [], lead = [], kick = [], hat = [];
    for (let bar = 0; bar < 4; bar += 1) {
      const chord = progression[bar];
      for (let s = 0; s < 16; s += 1) {
        kick.push(s % 8 === 0 || (s % 8 === 5 && random.chance(0.5)));
        hat.push(s % 2 === 0 || random.chance(0.2));
        bass.push(s % 4 === 0 || (s % 4 === 3 && random.chance(0.4)) ? station.scale[chord % station.scale.length] : null);
        lead.push(random.chance(s % 2 === 0 ? 0.42 : 0.16) ? station.scale[(chord + random.int(0, 4)) % station.scale.length] + (random.chance(0.3) ? 12 : 0) : null);
      }
    }
    pattern = { bass, lead, kick, hat };
  }

  function voice(type, frequency, at, seconds, volume, slideTo) {
    const oscillator = context.createOscillator();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, at);
    if (slideTo) oscillator.frequency.exponentialRampToValueAtTime(slideTo, at + seconds);
    const gain = context.createGain();
    gain.gain.setValueAtTime(volume, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + seconds);
    oscillator.connect(gain).connect(output);
    oscillator.start(at);
    oscillator.stop(at + seconds + 0.02);
  }

  function hatAt(at) {
    const source = context.createBufferSource();
    source.buffer = noise;
    const filter = context.createBiquadFilter();
    filter.type = 'highpass';
    filter.frequency.value = 7000;
    const gain = context.createGain();
    gain.gain.setValueAtTime(0.05, at);
    gain.gain.exponentialRampToValueAtTime(0.001, at + 0.05);
    source.connect(filter).connect(gain).connect(output);
    source.start(at, 0.1, 0.06);
  }

  function playStep(step, at) {
    const station = STATIONS[state.station];
    if (pattern.kick[step]) voice('sine', 140, at, 0.18, 0.3, 42);
    if (pattern.hat[step]) hatAt(at);
    if (pattern.bass[step] !== null) voice('triangle', midiToHz(station.root - 12 + pattern.bass[step]), at, 0.26, 0.2);
    if (pattern.lead[step] !== null) voice(station.lead, midiToHz(station.root + 12 + pattern.lead[step]), at, 0.3, station.lead === 'sawtooth' ? 0.045 : 0.09);
  }

  function nextStation() {
    state.station = (state.station + 1) % (STATIONS.length + 1);
    state.on = state.station < STATIONS.length;
    if (!state.on) return;
    state.track = game.random.int(0, STATIONS[state.station].tracks.length - 1);
    state.step = 0;
    compose();
  }

  /** Schedule the next few sixteenth-notes a little ahead of the clock. */
  function update() {
    if (game.input.wasPressed('KeyN') && game.player.state.vehicle) nextStation();
    if (!context || !pattern) return;
    const audible = state.on && game.mode === 'play' && game.player.state.vehicle !== null;
    output.gain.setTargetAtTime(audible ? 0.5 : 0, context.currentTime, 0.2);
    if (!audible) {
      state.nextTime = context.currentTime + 0.1;
      return;
    }
    const station = STATIONS[state.station];
    const stepLength = 60 / station.tempo / 4;
    while (state.nextTime < context.currentTime + 0.12) {
      const swing = state.step % 2 === 1 ? stepLength * station.swing : 0;
      playStep(state.step, Math.max(state.nextTime + swing, context.currentTime));
      state.nextTime += stepLength;
      state.step += 1;
      if (state.step >= 64) {
        state.step = 0;
        state.bar += 1;
        if (state.bar % 6 === 0) {
          state.track = (state.track + 1) % station.tracks.length;
          compose();
        }
      }
    }
  }

  /** "RADIO GUAVA 98.1 - Mango Season" for the HUD. */
  function label() {
    if (!state.on || state.station >= STATIONS.length) return 'RADIO OFF';
    const station = STATIONS[state.station];
    return '♪ ' + station.name + ' - ' + station.tracks[state.track];
  }

  game.events.on('audioStarted', (audio) => {
    context = audio.context;
    output = context.createGain();
    output.gain.value = 0;
    output.connect(audio.output);
    noise = context.createBuffer(1, context.sampleRate / 2, context.sampleRate);
    const data = noise.getChannelData(0);
    const random = createRandom(4242);
    for (let i = 0; i < data.length; i += 1) data[i] = random.next() * 2 - 1;
    state.nextTime = context.currentTime + 0.1;
  });
  compose();

  return { state, update, label, nextStation };
}
