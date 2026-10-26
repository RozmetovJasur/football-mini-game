// js/audio.js
// All match sounds are synthesised with the Web Audio API — no asset files.
// The AudioContext must be created from a user gesture (initAudio on PLAY).

let ctx = null, master = null, crowdGain = null, noise = null;
let muted = false;
const VOLUME = 0.8;
const CROWD_BASE = 0.05;

export function initAudio() {
  if (ctx) { ctx.resume(); return; }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return;
  ctx = new AC();
  master = ctx.createGain();
  master.gain.value = muted ? 0 : VOLUME;
  master.connect(ctx.destination);
  noise = makeNoise(2);
  startCrowd();
}

export function isMuted() { return muted; }

export function toggleMute() {
  muted = !muted;
  if (master) master.gain.setTargetAtTime(muted ? 0 : VOLUME, ctx.currentTime, 0.05);
  return muted;
}

function makeNoise(seconds) {
  const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  return buf;
}

function noiseSource(loop = false) {
  const src = ctx.createBufferSource();
  src.buffer = noise;
  src.loop = loop;
  return src;
}

// constant stadium murmur with a slow random swell
function startCrowd() {
  const src = noiseSource(true);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass'; band.frequency.value = 700; band.Q.value = 0.5;
  const low = ctx.createBiquadFilter();
  low.type = 'lowpass'; low.frequency.value = 1800;
  crowdGain = ctx.createGain();
  crowdGain.gain.value = CROWD_BASE;
  const lfo = ctx.createOscillator();
  const lfoGain = ctx.createGain();
  lfo.frequency.value = 0.15; lfoGain.gain.value = 0.015;
  lfo.connect(lfoGain).connect(crowdGain.gain);
  src.connect(band).connect(low).connect(crowdGain).connect(master);
  src.start(); lfo.start();
}

// temporary rise of the crowd (shot "ooh", goal roar)
function crowdSwell(level, attack, hold, release) {
  if (!crowdGain) return;
  const t = ctx.currentTime, g = crowdGain.gain;
  g.cancelScheduledValues(t);
  g.setValueAtTime(g.value, t);
  g.linearRampToValueAtTime(level, t + attack);
  g.setValueAtTime(level, t + attack + hold);
  g.linearRampToValueAtTime(CROWD_BASE, t + attack + hold + release);
}

// thump of boot on ball; power 0..1
export function playKick(power = 0.6) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(160, t);
  osc.frequency.exponentialRampToValueAtTime(45, t + 0.12);
  g.gain.setValueAtTime(0.9 * power, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + 0.16);

  const src = noiseSource();
  const hp = ctx.createBiquadFilter();
  hp.type = 'highpass'; hp.frequency.value = 1500;
  const ng = ctx.createGain();
  ng.gain.setValueAtTime(0.25 * power, t);
  ng.gain.exponentialRampToValueAtTime(0.001, t + 0.04);
  src.connect(hp).connect(ng).connect(master);
  src.start(t); src.stop(t + 0.05);
}

// ball landing; impact = vertical speed
export function playBounce(impact) {
  if (!ctx) return;
  const t = ctx.currentTime;
  const vol = Math.min(0.5, impact / 20);
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.frequency.setValueAtTime(110, t);
  osc.frequency.exponentialRampToValueAtTime(40, t + 0.08);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.1);
  osc.connect(g).connect(master);
  osc.start(t); osc.stop(t + 0.11);
}

// referee whistle: blasts = list of durations in seconds
export function playWhistle(blasts = [0.35]) {
  if (!ctx) return;
  let t = ctx.currentTime + 0.05;
  for (const len of blasts) {
    const osc = ctx.createOscillator();
    const trill = ctx.createOscillator();
    const trillGain = ctx.createGain();
    const g = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = 2900;
    trill.frequency.value = 28;           // pea rattle
    trillGain.gain.value = 120;
    trill.connect(trillGain).connect(osc.frequency);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(0.18, t + 0.02);
    g.gain.setValueAtTime(0.18, t + len - 0.04);
    g.gain.linearRampToValueAtTime(0, t + len);
    osc.connect(g).connect(master);
    osc.start(t); trill.start(t);
    osc.stop(t + len); trill.stop(t + len);
    t += len + 0.12;
  }
}

export const playKickoffWhistle = () => playWhistle([0.45]);
export const playHalftimeWhistle = () => playWhistle([0.3, 0.6]);
export const playFulltimeWhistle = () => playWhistle([0.3, 0.3, 0.9]);

export function playShotOoh() { if (ctx) crowdSwell(0.14, 0.25, 0.3, 1.2); }

export function playGoalRoar() {
  if (!ctx) return;
  crowdSwell(0.4, 0.3, 2.5, 2.5);
  // horn-like cheer on top of the roar
  const t = ctx.currentTime;
  const src = noiseSource(true);
  const band = ctx.createBiquadFilter();
  band.type = 'bandpass'; band.frequency.value = 1100; band.Q.value = 1.2;
  const g = ctx.createGain();
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(0.25, t + 0.3);
  g.gain.linearRampToValueAtTime(0, t + 3.5);
  src.connect(band).connect(g).connect(master);
  src.start(t); src.stop(t + 3.6);
}
