// Klavier-Sampler auf Basis der Salamander-Grand-Piano-Samples (alle kleinen Terzen gesampelt).
const SAMPLE_NOTES = [];
{
  const names = { 0: 'C', 3: 'Ds', 6: 'Fs', 9: 'A' };
  for (let m = 33; m <= 96; m++) {
    const pc = m % 12;
    if (names[pc] !== undefined) SAMPLE_NOTES.push({ midi: m, file: `audio/${names[pc]}${Math.floor(m / 12) - 1}.mp3` });
  }
}

let ctx = null;
let master = null;
const buffers = new Map(); // midi -> AudioBuffer
const loading = new Map(); // midi -> Promise
const active = new Set();

export function getContext() {
  if (!ctx) {
    // Unter iOS sorgt "playback" dafür, dass auch bei Stummschalter Ton kommt (iOS 17+)
    try {
      if (navigator.audioSession) navigator.audioSession.type = 'playback';
    } catch (e) { /* ignorieren */ }
    const AC = window.AudioContext || window.webkitAudioContext;
    ctx = new AC({ latencyHint: 'interactive' });
    master = ctx.createGain();
    master.gain.value = 0.9;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -12;
    comp.ratio.value = 3;
    master.connect(comp).connect(ctx.destination);
  }
  return ctx;
}

export async function unlock() {
  const c = getContext();
  if (c.state !== 'running') {
    try { await c.resume(); } catch (e) { /* ignorieren */ }
  }
  // Ein kurzer stiller Puffer entsperrt Audio auf älteren iOS-Versionen
  const b = c.createBuffer(1, 1, 22050);
  const s = c.createBufferSource();
  s.buffer = b;
  s.connect(c.destination);
  s.start(0);
}

function nearestSample(midi) {
  let best = SAMPLE_NOTES[0];
  for (const s of SAMPLE_NOTES) if (Math.abs(s.midi - midi) < Math.abs(best.midi - midi)) best = s;
  return best;
}

async function loadSample(s) {
  if (buffers.has(s.midi)) return buffers.get(s.midi);
  if (loading.has(s.midi)) return loading.get(s.midi);
  const p = (async () => {
    const res = await fetch(s.file);
    const data = await res.arrayBuffer();
    const c = getContext();
    const buf = await new Promise((resolve, reject) => {
      const r = c.decodeAudioData(data, resolve, reject);
      if (r && r.then) r.then(resolve, reject);
    });
    buffers.set(s.midi, buf);
    return buf;
  })();
  loading.set(s.midi, p);
  try {
    return await p;
  } finally {
    loading.delete(s.midi);
  }
}

export async function preload(midis) {
  const set = new Set(midis.map((m) => nearestSample(m)));
  await Promise.all([...set].map((s) => loadSample(s).catch(() => null)));
}

// Alle Samples im Hintergrund laden (für Offline-Nutzung landen sie im Cache des Service Workers)
export function preloadAll() {
  return Promise.all(SAMPLE_NOTES.filter((s) => s.midi >= 36 && s.midi <= 96).map((s) => loadSample(s).catch(() => null)));
}

export function stopAll() {
  for (const v of active) {
    try {
      v.gain.gain.cancelScheduledValues(ctx.currentTime);
      v.gain.gain.setTargetAtTime(0, ctx.currentTime, 0.03);
      v.src.stop(ctx.currentTime + 0.2);
    } catch (e) { /* ignorieren */ }
  }
  active.clear();
}

// Spielt eine Note. when: Sekunden ab jetzt; dur: Klingdauer in Sekunden.
export async function playNote(midi, when = 0, dur = 1.2, vel = 0.8) {
  const c = getContext();
  const s = nearestSample(midi);
  const buf = await loadSample(s);
  const t0 = c.currentTime + Math.max(0, when);
  const src = c.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = Math.pow(2, (midi - s.midi) / 12);
  const g = c.createGain();
  g.gain.setValueAtTime(vel, t0);
  g.gain.setValueAtTime(vel, t0 + dur);
  g.gain.setTargetAtTime(0, t0 + dur, 0.12);
  src.connect(g).connect(master);
  src.start(t0);
  src.stop(t0 + dur + 1.0);
  const voice = { src, gain: g };
  active.add(voice);
  src.onended = () => active.delete(voice);
}

// Folge von Ereignissen: [{midis:[..], at: s, dur: s}]
export async function playSequence(events, vel = 0.8) {
  const midis = events.flatMap((e) => e.midis);
  await unlock();
  await preload(midis);
  stopAll();
  const start = 0.05;
  for (const e of events) for (const m of e.midis) playNote(m, start + e.at, e.dur, vel);
  const end = Math.max(...events.map((e) => e.at + e.dur));
  return new Promise((r) => setTimeout(r, (start + end) * 1000));
}

export function playMelodic(midis, gap = 0.8, dur = 1.0) {
  return playSequence(midis.map((m, i) => ({ midis: [m], at: i * gap, dur })));
}

export function playHarmonic(midis, dur = 1.8) {
  return playSequence([{ midis, at: 0, dur }]);
}

// Kurze Rückmeldetöne (synthetisch)
export function blip(ok) {
  const c = getContext();
  const t = c.currentTime;
  const o = c.createOscillator();
  const g = c.createGain();
  o.type = 'sine';
  o.frequency.setValueAtTime(ok ? 880 : 220, t);
  if (ok) o.frequency.setValueAtTime(1320, t + 0.08);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(0.12, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + (ok ? 0.25 : 0.3));
  o.connect(g).connect(c.destination);
  o.start(t);
  o.stop(t + 0.35);
}
