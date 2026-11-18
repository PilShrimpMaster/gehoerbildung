// Tonhöhenerkennung über das Mikrofon (YIN-Algorithmus).
import { getContext, setAudioSession } from './audio.js';

let stream = null;
let analyser = null;
let source = null;
let buf = null;
let sink = null;

// Wirft einen Fehler mit verständlicher deutscher Meldung (err.userMessage)
export async function startMic() {
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    throw withMsg(new Error('no-media'), 'Dieser Browser erlaubt keinen Mikrofonzugriff. Öffne die App bitte über https in Safari oder Chrome.');
  }
  // iOS: Audio-Sitzung muss Aufnahme erlauben, bevor das Mikrofon geöffnet wird
  setAudioSession('play-and-record');
  if (!stream) {
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: true },
      });
    } catch (e) {
      try {
        // Zweiter Versuch ohne besondere Wünsche an das Mikrofon
        stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      } catch (e2) {
        setAudioSession('playback');
        throw withMsg(e2, explain(e2));
      }
    }
  }
  const ctx = getContext();
  if (ctx.state !== 'running') {
    try { await ctx.resume(); } catch (e) { /* ignorieren */ }
  }
  if (!analyser) {
    source = ctx.createMediaStreamSource(stream);
    analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    analyser.smoothingTimeConstant = 0;
    source.connect(analyser);
    // Manche Browser verarbeiten den Mikrofon-Graphen nur, wenn er bis zum Ausgang führt (stumm geschaltet)
    sink = ctx.createGain();
    sink.gain.value = 0;
    analyser.connect(sink).connect(ctx.destination);
    buf = new Float32Array(analyser.fftSize);
  }
}

function withMsg(e, msg) {
  e.userMessage = msg;
  return e;
}

function explain(e) {
  const n = e && e.name;
  if (n === 'NotAllowedError' || n === 'SecurityError') {
    return 'Der Zugriff auf das Mikrofon wurde verweigert. Am iPad: Einstellungen › Apps › Safari › Mikrofon auf „Fragen" oder „Erlauben" stellen. Läuft die App über das Symbol auf dem Home-Bildschirm, öffne sie danach einmal komplett neu.';
  }
  if (n === 'NotFoundError' || n === 'OverconstrainedError') return 'Es wurde kein Mikrofon gefunden.';
  if (n === 'NotReadableError' || n === 'AbortError') return 'Das Mikrofon wird gerade von einer anderen App benutzt. Schließe sie und versuch es erneut.';
  return `Das Mikrofon konnte nicht gestartet werden (${n || 'unbekannter Fehler'}).`;
}

export function stopMic() {
  if (source) source.disconnect();
  if (analyser) analyser.disconnect();
  if (stream) stream.getTracks().forEach((t) => t.stop());
  stream = null;
  analyser = null;
  source = null;
  sink = null;
  setAudioSession('playback');
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
  let mean = 0;
  for (let i = 0; i < buf.length; i++) mean += buf[i];
  mean /= buf.length;
  for (let i = 0; i < buf.length; i++) {
    buf[i] -= mean;
    rms += buf[i] * buf[i];
  }
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.002) return { freq: 0, clarity: 0, rms };
  const res = yin(buf, sr, 0.2);
  return { freq: res.freq, clarity: res.clarity, rms };
}

function yin(data, sampleRate, threshold) {
  // Auf ca. 2048 Werte bei 48 kHz begrenzen, das genügt bis ~60 Hz und spart Rechenzeit
  const half = Math.min(Math.floor(data.length / 2), Math.round(sampleRate * 0.043));
  const minTau = Math.floor(sampleRate / 1200);
  const maxTau = Math.min(half, Math.floor(sampleRate / 60));
  const diff = new Float32Array(maxTau + 1);
  for (let tau = 1; tau <= maxTau; tau++) {
    let s = 0;
    for (let i = 0; i < half; i++) {
      const d = data[i] - data[i + tau];
      s += d * d;
    }
    diff[tau] = s;
  }
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
  if (tau === -1) {
    // Kein klares Minimum unter der Schwelle: bestes globales Minimum nehmen, mit geringer Sicherheit
    let best = Math.max(2, minTau);
    for (let t = best; t <= maxTau; t++) if (cmnd[t] < cmnd[best]) best = t;
    if (cmnd[best] > 0.45) return { freq: 0, clarity: 0 };
    tau = best;
  }
  let better = tau;
  if (tau > 1 && tau < maxTau) {
    const s0 = cmnd[tau - 1], s1 = cmnd[tau], s2 = cmnd[tau + 1];
    const denom = 2 * (2 * s1 - s2 - s0);
    if (denom !== 0) better = tau + (s2 - s0) / denom;
  }
  return { freq: sampleRate / better, clarity: 1 - cmnd[tau] };
}
