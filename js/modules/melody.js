// Übungsbereich Melodiediktat: Melodien hören und auf der Klaviatur aufschreiben,
// Abweichungen zwischen Notenbild und Klang finden und Melodien vom Blatt singen.
import { buildInterval, midiOf, nameDe, pick, rand, weightedPick, randomKey, keyName, spellInKey, MAJOR_STEPS, MINOR_STEPS } from '../theory.js';
import { playSequence } from '../audio.js';
import { VOICE_RANGES } from './intervals.js';

// Ein Melodieton ist { deg: Stufe ab Tonika (0 = Tonika, 7 = Oktave, -1 = Leitton darunter), alt: Alteration }
function semisOf(key, t) {
  const steps = key.minor ? MINOR_STEPS : MAJOR_STEPS;
  const oct = Math.floor(t.deg / 7);
  return steps[t.deg - 7 * oct] + 12 * oct + t.alt;
}
function noteOf(key, t, tonic) {
  const oct = Math.floor(t.deg / 7);
  const d = t.deg - 7 * oct;
  const steps = key.minor ? MINOR_STEPS : MAJOR_STEPS;
  const n = buildInterval(tonic, d + 1, steps[d] + t.alt);
  n.o += oct;
  return n;
}

// Moll: Leitton erhöhen, wenn er zur Tonika führt; die 6. Stufe davor ebenfalls (melodisch Moll aufwärts)
function minorAlts(tones) {
  const out = tones.map((t) => ({ ...t }));
  for (let i = 0; i < out.length; i++) {
    const t = out[i];
    const d = ((t.deg % 7) + 7) % 7;
    const nx = out[i + 1];
    if (d === 6 && t.alt === 0 && nx && nx.deg === t.deg + 1) t.alt = 1;
  }
  for (let i = 0; i < out.length - 1; i++) {
    const t = out[i];
    const d = ((t.deg % 7) + 7) % 7;
    const nx = out[i + 1];
    if (d === 5 && t.alt === 0 && nx.deg === t.deg + 1 && nx.alt === 1) t.alt = 1;
  }
  return out;
}

function genDegrees(lesson, len) {
  const [lo, hi] = lesson.range;
  const moves = Object.entries(lesson.moves).map(([k, w]) => ({ item: Number(k), w }));
  for (let t = 0; t < 400; t++) {
    const degs = [pick(lesson.start || [0, 2, 4].filter((d) => d >= lo && d <= hi))];
    let ok = true;
    for (let i = 1; i < len; i++) {
      const prev = degs[i - 1];
      const last = i === len - 1;
      const beforeLast = degs[i - 2];
      let cand;
      if (last) {
        // Schluss auf der Tonika (oder ihrer Oktave), erreicht durch einen erlaubten Schritt
        cand = [0, 7, -7].filter((d) => d >= lo && d <= hi && d !== prev && lesson.moves[Math.abs(d - prev)] !== undefined);
        if (!cand.length) { ok = false; break; }
        degs.push(pick(cand));
        break;
      }
      // Nach einem Sprung (ab Quarte) möglichst schrittweise in Gegenrichtung
      const leap = beforeLast !== undefined ? prev - beforeLast : 0;
      let next = null;
      for (let k = 0; k < 30 && next === null; k++) {
        let size = weightedPick(moves);
        let dir = Math.random() < 0.5 ? -1 : 1;
        if (Math.abs(leap) >= 3) { dir = -Math.sign(leap); size = 1; }
        const d = prev + dir * size;
        if (d < lo || d > hi) continue;
        if (size === 0 && (lesson.repeat || 0) < Math.random()) continue;
        if (d === prev && degs[i - 2] === prev) continue;
        next = d;
      }
      if (next === null) { ok = false; break; }
      degs.push(next);
    }
    if (!ok || degs.length !== len) continue;
    // Abwechslung: nicht nur auf und ab um denselben Ton
    if (new Set(degs).size < Math.min(3, len)) continue;
    return degs;
  }
  return Array.from({ length: len }, (_, i) => Math.min(hi, i));
}

// Chromatische Durchgangstöne zwischen zwei Tönen im Ganztonabstand
function addChromatic(key, tones, count) {
  let out = tones.slice();
  for (let c = 0; c < count; c++) {
    const spots = [];
    for (let i = 0; i < out.length - 1; i++) {
      const a = out[i], b = out[i + 1];
      if (Math.abs(a.deg - b.deg) !== 1 || Math.abs(semisOf(key, a) - semisOf(key, b)) !== 2) continue;
      if (a.alt !== 0 || b.alt !== 0) continue;
      spots.push(i);
    }
    if (!spots.length) return null;
    const i = pick(spots);
    const a = out[i], b = out[i + 1];
    const pass = b.deg > a.deg ? { deg: a.deg, alt: 1 } : { deg: a.deg, alt: -1 };
    out = [...out.slice(0, i + 1), pass, ...out.slice(i + 1)];
  }
  return out;
}

function genMelody(lesson, key) {
  const len = pick(lesson.len);
  const chrom = lesson.chrom || 0;
  for (let t = 0; t < 60; t++) {
    let tones = genDegrees(lesson, len - chrom).map((deg) => ({ deg, alt: 0 }));
    if (key.minor) tones = minorAlts(tones);
    if (chrom) tones = addChromatic(key, tones, chrom);
    if (tones) return tones;
  }
  return genDegrees(lesson, len).map((deg) => ({ deg, alt: 0 }));
}

// Tonart und Lage so wählen, dass die Melodie in [lo, hi] liegt
function placeMelody(lesson, minor, lo, hi) {
  for (let t = 0; t < 80; t++) {
    const key = randomKey(minor, lesson.sig ?? 2);
    const tones = genMelody(lesson, key);
    const offs = tones.map((x) => semisOf(key, x));
    const base = midiOf(key.tonic);
    const opts = [];
    for (let o = -3; o <= 2; o++) {
      const ms = offs.map((s) => base + 12 * o + s);
      if (Math.min(...ms) >= lo && Math.max(...ms) <= hi) opts.push(o);
    }
    if (!opts.length) continue;
    const o = pick(opts);
    const tonic = { ...key.tonic, o: key.tonic.o + o };
    const k = { tonic, minor };
    const notes = tones.map((x) => noteOf(k, x, tonic));
    return { key: k, tones, notes, midis: notes.map(midiOf) };
  }
  const key = { tonic: { l: 0, a: 0, o: 4 }, minor: false };
  const notes = [0, 1, 2, 1, 0].map((deg) => noteOf(key, { deg, alt: 0 }, key.tonic));
  return { key, tones: [], notes, midis: notes.map(midiOf) };
}

const tempoOf = (n) => (n <= 4 ? 0.75 : n <= 7 ? 0.64 : 0.56);
function playMelody(midis) {
  const g = tempoOf(midis.length);
  return playSequence(midis.map((m, i) => ({ midis: [m], at: i * g, dur: i === midis.length - 1 ? 1.2 : g + 0.05 })), 0.85);
}
function tonicChord(key, near) {
  let r = midiOf(key.tonic);
  while (r > near + 2) r -= 12;
  while (r < near - 10) r += 12;
  return [r - 12, r, r + (key.minor ? 3 : 4), r + 7];
}
function playTonicThen(key, midis) {
  const ch = tonicChord(key, midis[0]);
  const g = tempoOf(midis.length);
  return playSequence([
    { midis: ch, at: 0, dur: 1.1 },
    ...midis.map((m, i) => ({ midis: [m], at: 1.6 + i * g, dur: i === midis.length - 1 ? 1.2 : g + 0.05 })),
  ], 0.8);
}

// ---------- Lernpfad ----------
const STEP = { 1: 1 };
const THIRDS = { 1: 3, 2: 2 };
const TRIAD = { 1: 3, 2: 2, 3: 1, 4: 1 };
const LEAPS = { 1: 3, 2: 2, 3: 1, 4: 1, 5: 0.5, 7: 0.4 };
const SECTIONS = [
  {
    title: 'Erste Schritte', desc: 'Kurze Melodien in Dur, Ton für Ton.',
    lessons: [
      { id: 'm1', title: 'Drei Töne, nur Schritte', items: ['dur'], len: [3], range: [0, 4], moves: STEP, start: [0], sig: 1 },
      { id: 'm2', title: 'Vier Töne, nur Schritte', items: ['dur'], len: [4], range: [0, 4], moves: STEP, start: [0, 2, 4], sig: 1 },
      { id: 'm3', title: 'Dazu: Terzen', items: ['dur'], len: [4], range: [0, 4], moves: THIRDS, start: [0, 2, 4], sig: 2 },
      { id: 'm4', title: 'Bis zur Oktave', items: ['dur'], len: [5], range: [0, 7], moves: THIRDS, sig: 2 },
    ],
  },
  {
    title: 'Sprünge', desc: 'Dreiklangstöne, Quarten, Quinten und mehr.',
    lessons: [
      { id: 'd1', title: 'Dreiklangssprünge', items: ['dur'], len: [5], range: [-3, 7], moves: TRIAD, sig: 2 },
      { id: 'd2', title: 'Große Sprünge', items: ['dur'], len: [6], range: [-4, 9], moves: LEAPS, sig: 3, repeat: 0.2 },
      { id: 'd3', title: 'Längere Melodien', items: ['dur'], len: [7, 8], range: [-4, 9], moves: { ...LEAPS, 0: 0.3 }, sig: 4, repeat: 0.3 },
    ],
  },
  {
    title: 'Moll', desc: 'Mit Leitton und melodischem Moll.',
    lessons: [
      { id: 'n1', title: 'Moll, nur Schritte', items: ['moll'], minor: 1, len: [4], range: [0, 4], moves: STEP, start: [0, 2, 4], sig: 1 },
      { id: 'n2', title: 'Moll mit Leitton', items: ['moll'], minor: 1, len: [5], range: [-2, 5], moves: THIRDS, sig: 2 },
      { id: 'n3', title: 'Moll mit Sprüngen', items: ['moll'], minor: 1, len: [6], range: [-4, 7], moves: TRIAD, sig: 2 },
      { id: 'n4', title: 'Dur und Moll gemischt', items: ['dur', 'moll'], len: [7], range: [-4, 9], moves: LEAPS, sig: 3, repeat: 0.2 },
    ],
  },
  {
    title: 'Profi', desc: 'Chromatik, lange Melodien und Bassschlüssel.',
    lessons: [
      { id: 'p1', title: 'Chromatische Durchgänge', items: ['cdur'], len: [7], range: [-3, 8], moves: TRIAD, chrom: 1, sig: 3 },
      { id: 'p2', title: 'Chromatik in Dur und Moll', items: ['cdur', 'cmoll'], len: [8], range: [-4, 9], moves: LEAPS, chrom: 2, sig: 4 },
      { id: 'p3', title: 'Meisterprüfung', items: ['dur', 'moll', 'cdur', 'cmoll'], len: [10], range: [-5, 10], moves: { ...LEAPS, 0: 0.3 }, chrom: 1, sig: 5, repeat: 0.2, bass: 0.35 },
    ],
  },
];
const ITEM = {
  dur: { label: 'Melodien in Dur', minor: false, chrom: false },
  moll: { label: 'Melodien in Moll', minor: true, chrom: false },
  cdur: { label: 'chromatisch, Dur', minor: false, chrom: true },
  cmoll: { label: 'chromatisch, Moll', minor: true, chrom: true },
};
for (const s of SECTIONS) for (const l of s.lessons) {
  if (!l.desc) {
    const lens = l.len.join(' oder ');
    const mode = l.items.some((x) => ITEM[x].minor) ? (l.items.some((x) => !ITEM[x].minor) ? 'Dur und Moll' : 'Moll') : 'Dur';
    l.desc = `${lens} Töne in ${mode}${l.chrom ? ', mit chromatischen Tönen' : ''}${l.bass ? ', auch im Bassschlüssel' : ''}.`;
  }
}
const LESSONS = SECTIONS.flatMap((s) => s.lessons);

function makeMelody(lesson, pickItem, range) {
  const item = pickItem(lesson.items);
  const it = ITEM[item];
  const l2 = it.chrom ? lesson : { ...lesson, chrom: 0 };
  const bass = Math.random() < (lesson.bass || 0);
  const [lo, hi] = range || (bass ? [40, 64] : [57, 81]);
  const mel = placeMelody(l2, it.minor, lo, hi);
  const avg = mel.midis.reduce((a, b) => a + b, 0) / mel.midis.length;
  return { item, ...mel, clef: range ? (avg < 58 ? 'bass' : 'treble') : bass ? 'bass' : 'treble' };
}

const names = (notes) => notes.map((n) => nameDe(n)).join(' ');

// Klaviaturbereich: ganze Oktaven um den Tonraum der Lektion
function keyboardRange(lesson, mel) {
  const base = midiOf(mel.key.tonic);
  const lo = base + semisOf(mel.key, { deg: lesson.range[0], alt: 0 }) - 2;
  const hi = base + semisOf(mel.key, { deg: lesson.range[1], alt: 0 }) + 2;
  return [lo - (((lo % 12) + 12) % 12), hi + (11 - (((hi % 12) + 12) % 12))];
}

function makeDictation(lesson, pickItem) {
  const mel = makeMelody(lesson, pickItem);
  return {
    type: 'dictation',
    item: mel.item,
    prompt: 'Schreib die Melodie auf',
    sub: `${keyName(mel.key)} · ${mel.notes.length} Töne · der erste Ton ist vorgegeben`,
    notation: { groups: [], clef: mel.clef, wide: true },
    showPlay: true,
    playFull: () => playTonicThen(mel.key, mel.midis),
    play: () => playMelody(mel.midis),
    playTonic: () => playSequence([{ midis: tonicChord(mel.key, mel.midis[0]), at: 0, dur: 1.4 }], 0.75),
    notes: mel.notes,
    targets: mel.midis,
    given: 1,
    clef: mel.clef,
    spell: (m) => spellInKey(m, mel.key),
    keyboard: keyboardRange(lesson, mel),
    reveal: { groups: mel.notes.map((n) => [n]), clef: mel.clef, duration: 'q', text: `${keyName(mel.key)}: ${names(mel.notes)}` },
  };
}

// Notenschrift: Das Notenbild stimmt bis auf einen Ton mit dem Klang überein. Welcher Ton ist anders?
function makeSpot(lesson, pickItem) {
  const mel = makeMelody(lesson, pickItem);
  const n = mel.notes.length;
  let k = 1 + rand(n - 1);
  let played = null;
  for (let t = 0; t < 40 && !played; t++) {
    k = 1 + rand(n - 1);
    const sh = pick([-2, -1, 1, 2]);
    const m = mel.midis[k] + sh;
    if (m === mel.midis[k - 1] || m === mel.midis[k + 1]) continue;
    // Ohne Chromatik in der Lektion: nur leitereigene Töne (in Moll auch erhöhte 6. und 7. Stufe)
    const rel = (((m - midiOf(mel.key.tonic)) % 12) + 12) % 12;
    const inKey = (mel.key.minor ? [0, 2, 3, 5, 7, 8, 9, 10, 11] : MAJOR_STEPS).includes(rel);
    if (!ITEM[mel.item].chrom && !inKey) continue;
    played = spellInKey(m, mel.key);
  }
  if (!played) played = spellInKey(mel.midis[k] + 2, mel.key);
  const playedNotes = mel.notes.map((x, i) => (i === k ? played : x));
  const playedMidis = playedNotes.map(midiOf);
  const css = (v) => getComputedStyle(document.documentElement).getPropertyValue(v).trim() || '#d64545';
  return {
    type: 'choice',
    item: mel.item,
    prompt: 'Welcher Ton klingt anders als notiert?',
    sub: `${keyName(mel.key)}. Genau ein Ton weicht ab.`,
    notation: { groups: mel.notes.map((x) => [x]), clef: mel.clef, duration: 'q', wide: true },
    showPlay: true,
    autoplay: true,
    play: () => playMelody(playedMidis),
    options: Array.from({ length: n - 1 }, (_, i) => ({ id: String(i + 1), label: `Ton ${i + 2}` })),
    answer: String(k),
    reveal: {
      show: true,
      clef: mel.clef,
      groups: playedNotes.map((x) => [x]),
      colors: playedNotes.map((_, i) => (i === k ? css('--bad') : null)),
      duration: 'q',
      text: `Ton ${k + 1}: notiert ${nameDe(mel.notes[k])}, gespielt ${nameDe(played)}. Oben siehst du, was erklungen ist.`,
      alt: { label: 'Notierte Fassung hören', play: () => playMelody(mel.midis) },
    },
  };
}

function makeSing(lesson, pickItem, ctx) {
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const mel = makeMelody(lesson, pickItem, [vr.lo, vr.hi]);
  const ch = tonicChord(mel.key, mel.midis[0]);
  return {
    type: 'sing',
    item: mel.item,
    prompt: 'Singe die Melodie vom Blatt',
    playLabel: 'Tonika und Anfangston',
    sub: `${keyName(mel.key)}. Erst klingt die Tonika, dann dein Anfangston.`,
    notation: { groups: mel.notes.map((x) => [x]), clef: mel.clef, duration: 'q', wide: true },
    play: () => playSequence([{ midis: ch, at: 0, dur: 0.85 }, { midis: [mel.midis[0]], at: 0.95, dur: 0.85 }], 0.75),
    playTarget: () => playMelody(mel.midis),
    targetLabel: 'Melodie hören',
    targets: mel.midis,
    reveal: { groups: mel.notes.map((x) => [x]), clef: mel.clef, duration: 'q', text: `${keyName(mel.key)}: ${names(mel.notes)}` },
  };
}

export const melodyModule = {
  id: 'melody',
  title: 'Melodiediktat',
  icon: 'melody',
  available: true,
  blurb: 'Melodien hören, aufschreiben und vom Blatt singen.',
  sections: SECTIONS,
  lessons: LESSONS,
  modes: [
    { id: 'hear', title: 'Diktat', desc: 'Melodie hören und auf der Klaviatur aufschreiben.' },
    { id: 'read', title: 'Notenschrift', desc: 'Noten mitlesen und den abweichenden Ton finden.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Die Melodie vom Blatt singen.' },
  ],
  makeQuestion(mode, lesson, pickItem, ctx) {
    if (mode === 'hear') return makeDictation(lesson, pickItem);
    if (mode === 'read') return makeSpot(lesson, pickItem);
    return makeSing(lesson, pickItem, ctx);
  },
  itemLabel: (id) => ITEM[id]?.label || id,
  allItems: Object.keys(ITEM),
  tasks: () => [
    { id: 'mel-hear-5', group: 'mel-hear', kind: 'correct', module: 'melody', mode: 'hear', target: 5, title: '5 Melodien fehlerfrei aufschreiben' },
    { id: 'mel-read-6', group: 'mel-read', kind: 'correct', module: 'melody', mode: 'read', target: 6, title: '6 abweichende Töne im Notenbild finden' },
    { id: 'mel-sing-3', group: 'mel-sing', kind: 'correct', module: 'melody', mode: 'sing', target: 3, title: '3 Melodien sauber vom Blatt singen' },
    { id: 'mel-sess-80', group: 'mel-sess', kind: 'session', module: 'melody', minScore: 0.8, target: 1, title: 'Eine Melodiediktat-Lektion bestehen (mindestens 80 %)' },
  ],
};
