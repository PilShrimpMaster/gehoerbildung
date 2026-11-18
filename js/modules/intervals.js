// Übungsbereich Intervalle: Hören, Notenschrift, Nachsingen.
import {
  INTERVALS, INTERVAL_BY_ID, ALTERED, NUM_NAMES, buildInterval, nameInterval, midiOf, nameDe,
  randomNote, pick, rand, qualityLabel,
} from '../theory.js';
import { playMelodic, playHarmonic } from '../audio.js';

const LEVELS = [
  { n: 1, name: 'Einsteiger', desc: 'Große Sekunde, große Terz, Quarte, Quinte, Oktave. Aufwärts.',
    ids: ['g2', 'g3', 'r4', 'r5', 'r8'], dirs: ['up'], harmonic: false },
  { n: 2, name: 'Grundlagen', desc: 'Dazu kleine Sekunde, kleine Terz und beide Sexten. Aufwärts.',
    ids: ['k2', 'g2', 'k3', 'g3', 'r4', 'r5', 'k6', 'g6', 'r8'], dirs: ['up'], harmonic: false },
  { n: 3, name: 'Fortgeschritten', desc: 'Alle Intervalle bis zur Oktave inklusive Tritonus und Septimen. Auf- und abwärts.',
    ids: ['r1', 'k2', 'g2', 'k3', 'g3', 'r4', 'tt', 'r5', 'k6', 'g6', 'k7', 'g7', 'r8'], dirs: ['up', 'down'], harmonic: false },
  { n: 4, name: 'Sicher', desc: 'Alle Intervalle bis zur Oktave, auch gleichzeitig angeschlagen. Bass- und Violinschlüssel.',
    ids: ['r1', 'k2', 'g2', 'k3', 'g3', 'r4', 'tt', 'r5', 'k6', 'g6', 'k7', 'g7', 'r8'], dirs: ['up', 'down'], harmonic: true },
  { n: 5, name: 'Profi', desc: 'Dazu None, Dezime, Undezime, Duodezime. In Noten auch übermäßige und verminderte Intervalle.',
    ids: INTERVALS.map((i) => i.id), dirs: ['up', 'down'], harmonic: true },
];

const VOICE_RANGES = {
  tief: { lo: 43, hi: 64, label: 'Tief (Bass, Bariton)' },
  mittel: { lo: 48, hi: 69, label: 'Mittel (Tenor, Alt)' },
  hoch: { lo: 55, hi: 76, label: 'Hoch (Sopran, Mezzo)' },
};
export { VOICE_RANGES };

function dirLabel(d) {
  return d === 'down' ? 'abwärts' : 'aufwärts';
}

function intervalLabel(id) {
  return INTERVAL_BY_ID[id].name;
}

// ---------- Hören ----------
function makeHear(level, pickItem) {
  const L = LEVELS[level - 1];
  const id = pickItem(L.ids);
  const iv = INTERVAL_BY_ID[id];
  const harmonic = L.harmonic && Math.random() < 0.4;
  const dir = harmonic ? 'up' : pick(L.dirs);
  const span = iv.semis;
  const lo = dir === 'up' ? 48 : 48 + span;
  const hi = dir === 'up' ? 79 - span : 79;
  const root = randomNote({ accs: [0, 0, 1, -1], lo: Math.max(lo, 45), hi: Math.min(hi, 84) });
  const num = iv.id === 'tt' ? (Math.random() < 0.5 ? 4 : 5) : iv.num;
  const other = buildInterval(root, num, iv.semis, dir === 'down');
  const a = midiOf(root), b = midiOf(other);
  const play = () => (harmonic ? playHarmonic([a, b]) : playMelodic([a, b]));
  return {
    type: 'choice',
    item: id,
    prompt: harmonic ? 'Welches Intervall klingt gleichzeitig?' : 'Welches Intervall hörst du?',
    sub: harmonic ? 'harmonisch' : `melodisch, ${dirLabel(dir)}`,
    autoplay: true,
    play,
    options: L.ids.map((x) => ({ id: x, label: intervalLabel(x) })),
    answer: id,
    reveal: { groups: harmonic ? [[root, other]] : [[root], [other]], text: `${nameDe(root)} – ${nameDe(other)}: ${iv.name} ${harmonic ? 'harmonisch' : dirLabel(dir)}` },
    compare: (optId) => {
      const o = INTERVAL_BY_ID[optId];
      const m2 = dir === 'down' ? a - o.semis : a + o.semis;
      return harmonic ? playHarmonic([a, m2]) : playMelodic([a, m2]);
    },
  };
}

// ---------- Notenschrift ----------
function makeRead(level, pickItem) {
  const L = LEVELS[level - 1];
  let num, semis, item;
  if (level >= 5 && Math.random() < 0.35) {
    const alt = pick(ALTERED);
    num = alt.num; semis = alt.semis; item = alt.id;
  } else {
    const id = pickItem(L.ids);
    const iv = INTERVAL_BY_ID[id];
    num = iv.id === 'tt' ? (Math.random() < 0.5 ? 4 : 5) : iv.num;
    semis = iv.semis; item = id;
  }
  const dir = pick(L.dirs);
  const accs = level <= 2 ? [0] : [0, 0, 1, -1];
  const useBass = level >= 4 && Math.random() < 0.4;
  let root, other;
  for (let t = 0; t < 100; t++) {
    const range = useBass ? { lo: 40 + (dir === 'down' ? semis : 0), hi: 62 - (dir === 'up' ? semis : 0) }
      : { lo: 57 + (dir === 'down' ? semis : 0), hi: 81 - (dir === 'up' ? semis : 0) };
    root = randomNote({ accs, lo: range.lo, hi: Math.max(range.lo, range.hi) });
    other = buildInterval(root, num, semis, dir === 'down');
    if (Math.abs(other.a) <= (level >= 5 ? 2 : 1)) break;
  }
  const low = dir === 'down' ? other : root;
  const high = dir === 'down' ? root : other;
  const named = nameInterval(low, high);
  const harmonic = L.harmonic && Math.random() < 0.4;
  const groups = harmonic ? [[root, other]] : [[root], [other]];
  const a = midiOf(root), b = midiOf(other);
  const base = {
    item,
    prompt: 'Welches Intervall siehst du?',
    sub: harmonic ? 'zusammenklingend' : `nacheinander, ${dirLabel(dir)}`,
    notation: { groups, clef: useBass ? 'bass' : 'treble' },
    play: () => (harmonic ? playHarmonic([a, b]) : playMelodic([a, b])),
    reveal: { groups, text: `${nameDe(root)} – ${nameDe(other)}: ${named.label}`, playOnReveal: true },
  };
  if (level >= 5) {
    // Zweistufige Antwort: Qualität und Intervallzahl
    return {
      ...base,
      type: 'multi',
      parts: [
        { key: 'quality', label: 'Qualität', options: ['vermindert', 'klein', 'rein', 'groß', 'übermäßig'].map((x) => ({ id: x, label: x })) },
        { key: 'num', label: 'Intervall', options: Object.keys(NUM_NAMES).map((n) => ({ id: n, label: NUM_NAMES[n] })) },
      ],
      answer: { quality: named.quality, num: String(named.num) },
      labelFor: (sel) => qualityLabel(sel.quality, Number(sel.num)),
    };
  }
  const ids = L.ids.flatMap((x) => (x === 'tt' ? ['ue4', 'v5'] : [x]));
  const options = ids.map((x) => {
    if (x === 'ue4') return { id: 'übermäßige Quarte', label: 'übermäßige Quarte' };
    if (x === 'v5') return { id: 'verminderte Quinte', label: 'verminderte Quinte' };
    return { id: INTERVAL_BY_ID[x].name, label: INTERVAL_BY_ID[x].name };
  });
  // Prime/Oktave haben in nameInterval die gleichen Bezeichnungen wie in der Liste
  return { ...base, type: 'choice', options, answer: named.label };
}

// ---------- Nachsingen ----------
function makeSing(level, pickItem, ctx) {
  const L = LEVELS[level - 1];
  const id = pickItem(L.ids);
  const iv = INTERVAL_BY_ID[id];
  const dir = pick(L.dirs);
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const lo = dir === 'up' ? vr.lo : vr.lo + iv.semis;
  const hi = dir === 'up' ? vr.hi - iv.semis : vr.hi;
  const root = randomNote({ accs: [0, 0, 1, -1], lo, hi: Math.max(lo, hi) });
  const num = iv.id === 'tt' ? (dir === 'up' ? 4 : 5) : iv.num;
  const target = buildInterval(root, num, iv.semis, dir === 'down');
  const a = midiOf(root), b = midiOf(target);
  return {
    type: 'sing',
    item: id,
    prompt: `Singe ${iv.id === 'r1' ? 'die Prime (denselben Ton)' : (iv.id === 'r8' ? 'eine Oktave' : 'eine ' + iv.name)} ${iv.id === 'r1' ? '' : dirLabel(dir)}`,
    sub: `Grundton: ${nameDe(root)}`,
    notation: { groups: [[root]], clef: a < 57 ? 'bass' : 'treble' },
    play: () => playMelodic([a], 0.8, 1.6),
    playTarget: () => playMelodic([a, b]),
    targetMidi: b,
    targetName: nameDe(target),
    reveal: { groups: [[root], [target]], text: `${nameDe(root)} – ${nameDe(target)}: ${iv.name} ${dirLabel(dir)}` },
  };
}

export const intervalsModule = {
  id: 'intervals',
  title: 'Intervalle',
  icon: 'intervals',
  available: true,
  blurb: 'Abstände zwischen zwei Tönen erkennen, lesen und singen.',
  levels: LEVELS,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Intervall vorspielen lassen und benennen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Intervall in Noten sehen und benennen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Grundton hören und das Intervall singen. Braucht das Mikrofon.' },
  ],
  makeQuestion(mode, level, pickItem, ctx) {
    if (mode === 'hear') return makeHear(level, pickItem);
    if (mode === 'read') return makeRead(level, pickItem);
    return makeSing(level, pickItem, ctx);
  },
  itemLabel: (id) => INTERVAL_BY_ID[id]?.name || ALTERED.find((a) => a.id === id)?.name || id,
  items: (level) => LEVELS[level - 1].ids,
  allItems: INTERVALS.map((i) => i.id),
  tasks: () => [
    { id: 'int-hear-10', group: 'int-hear', kind: 'correct', module: 'intervals', mode: 'hear', target: 10, title: '10 Intervalle richtig nach Gehör erkennen' },
    { id: 'int-hear-15', group: 'int-hear', kind: 'correct', module: 'intervals', mode: 'hear', target: 15, title: '15 Intervalle richtig nach Gehör erkennen' },
    { id: 'int-read-8', group: 'int-read', kind: 'correct', module: 'intervals', mode: 'read', target: 8, title: '8 Intervalle in Noten richtig benennen' },
    { id: 'int-read-12', group: 'int-read', kind: 'correct', module: 'intervals', mode: 'read', target: 12, title: '12 Intervalle in Noten richtig benennen' },
    { id: 'int-sing-5', group: 'int-sing', kind: 'correct', module: 'intervals', mode: 'sing', target: 5, title: '5 Intervalle sauber nachsingen' },
    { id: 'int-sing-8', group: 'int-sing', kind: 'correct', module: 'intervals', mode: 'sing', target: 8, title: '8 Intervalle sauber nachsingen' },
    { id: 'int-sess-80', group: 'int-sess', kind: 'session', module: 'intervals', minScore: 0.8, target: 1, title: 'Eine Intervall-Runde mit mindestens 80 % schaffen' },
    { id: 'int-sess-90', group: 'int-sess', kind: 'session', module: 'intervals', minScore: 0.9, target: 1, title: 'Eine Intervall-Runde mit mindestens 90 % schaffen' },
  ],
};
