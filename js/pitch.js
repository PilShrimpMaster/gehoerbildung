// Tonhöhenerkennung über das Mikrofon (YIN-Algorithmus).
import { getContext } from './audio.js';

let stream = null;
let analyser = null;
let source = null;
let buf = null;

export async function startMic() {
  const ctx = getContext();
  if (ctx.state !== 'running') await ctx.resume();
  if (!stream) {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
    });
  }
  if (!analyser) {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    source.connect(analyser);
    buf = new Float32Array(analyser.fftSize);
  }
}

export function stopMic() {
  if (source) source.disconnect();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  analyser = null;
  source = null;
}

export function micActive() {
  return !!analyser;
}

// Liefert { freq, clarity, rms } oder null
export function readPitch() {
  if (!analyser) return null;
  analyser.getFloatTimeDomainData(buf);
  const sr = getContext().sampleRate;
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.01) return { freq: 0, clarity: 0, rms };
  const res = yin(buf, sr, 0.15);
  return { freq: res.freq, clarity: res.clarity, rms };
}

function yin(data, sampleRate, threshold) {
  const half = Math.floor(data.length / 2);
  const minTau = Math.floor(sampleRate / 1200); // höchster Ton ~1200 Hz
  const maxTau = Math.min(half, Math.floor(sampleRate / 60)); // tiefster Ton ~60 Hz
  const diff = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const d = data[i] - data[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }
  // kumulative mittlere normierte Differenz
  const cmnd = new Float32Array(maxTau + 1);
  cmnd[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= maxTau; tau++) {
    running += diff[tau];
    cmnd[tau] = running === 0 ? 1 : (diff[tau] * tau) / running;
  }
  let tau = -1;
  for (let t = Math.max(2, minTau); t <= maxTau; t++) {
    if (cmnd[t] < threshold) {
      while (t + 1 <= maxTau && cmnd[t + 1] < cmnd[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau === -1) return { freq: 0, clarity: 0 };
  // parabolische Interpolation
  let better = tau;
  if (tau > 1 && tau < maxTau) {
    const s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}
