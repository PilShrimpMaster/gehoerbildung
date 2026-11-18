// Übungsbereich Tonleitern: Tonleitern hören, lesen und singen.
import { buildInterval, midiOf, nameDe, randomNote } from '../theory.js';
import { playSequence, playMelodic } from '../audio.js';
import { VOICE_RANGES } from './intervals.js';

// Stufen als [Intervallzahl, Halbtöne] über dem Grundton, ohne Oktave
export const SCALES = [
  { id: 'dur', name: 'Dur (Ionisch)', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 11]] },
  { id: 'moll', name: 'natürliches Moll (Äolisch)', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  { id: 'hmoll', name: 'harmonisches Moll', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 8], [7, 11]] },
  { id: 'mmoll', name: 'melodisches Moll', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 11]] },
  { id: 'dor', name: 'Dorisch', steps: [[1, 0], [2, 2], [3, 3], [4, 5], [5, 7], [6, 9], [7, 10]] },
  { id: 'phr', name: 'Phrygisch', steps: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 7], [6, 8], [7, 10]] },
  { id: 'lyd', name: 'Lydisch', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 7], [6, 9], [7, 11]] },
  { id: 'mix', name: 'Mixolydisch', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 9], [7, 10]] },
  { id: 'lok', name: 'Lokrisch', steps: [[1, 0], [2, 1], [3, 3], [4, 5], [5, 6], [6, 8], [7, 10]] },
  { id: 'pdur', name: 'Dur-Pentatonik', steps: [[1, 0], [2, 2], [3, 4], [5, 7], [6, 9]] },
  { id: 'pmoll', name: 'Moll-Pentatonik', steps: [[1, 0], [3, 3], [4, 5], [5, 7], [7, 10]] },
  { id: 'blues', name: 'Blues-Tonleiter', steps: [[1, 0], [3, 3], [4, 5], [4, 6], [5, 7], [7, 10]] },
  { id: 'ganz', name: 'Ganztonleiter', steps: [[1, 0], [2, 2], [3, 4], [4, 6], [5, 8], [6, 10]] },
  { id: 'hdur', name: 'harmonisches Dur', steps: [[1, 0], [2, 2], [3, 4], [4, 5], [5, 7], [6, 8], [7, 11]] },
  { id: 'alt', name: 'Alteriert', steps: [[1, 0], [2, 1], [3, 3], [4, 4], [5, 6], [6, 8], [7, 10]] },
];
const BY_ID = Object.fromEntries(SCALES.map((s) => [s.id, s]));

const LEVELS = [
  { n: 1, name: 'Einsteiger', desc: 'Dur und natürliches Moll, aufwärts.', ids: ['dur', 'moll'], down: false },
  { n: 2, name: 'Grundlagen', desc: 'Dazu harmonisches und melodisches Moll.', ids: ['dur', 'moll', 'hmoll', 'mmoll'], down: false },
  { n: 3, name: 'Fortgeschritten', desc: 'Dazu Dorisch, Phrygisch, Lydisch und Mixolydisch. Auch abwärts.', ids: ['dur', 'moll', 'hmoll', 'mmoll', 'dor', 'phr', 'lyd', 'mix'], down: true },
  { n: 4, name: 'Sicher', desc: 'Alle Kirchentonarten inklusive Lokrisch, dazu Dur- und Moll-Pentatonik.', ids: ['dur', 'moll', 'hmoll', 'mmoll', 'dor', 'phr', 'lyd', 'mix', 'lok', 'pdur', 'pmoll'], down: true },
  { n: 5, name: 'Profi', desc: 'Dazu Blues, Ganzton, harmonisches Dur und Alteriert. Beliebige Grundtöne.', ids: SCALES.map((s) => s.id), down: true },
];

function buildScale(root, scale) {
  const notes = scale.steps.map(([num, semis]) => buildInterval(root, num, semis));
  notes.push({ ...root, o: root.o + 1 });
  return notes;
}

function rootFor(level, lo, hi) {
  const accs = level <= 1 ? [0] : level <= 3 ? [0, 0, 1, -1] : [0, 1, -1];
  for (let t = 0; t < 50; t++) {
    const r = randomNote({ accs, lo, hi });
    if (Math.abs(r.a) <= 1) return r;
  }
  return { l: 0, a: 0, o: 4 };
}

function seq(midis, gap = 0.32) {
  return playSequence(midis.map((m, i) => ({ midis: [m], at: i * gap, dur: i === midis.length - 1 ? 1.0 : gap + 0.1 })));
}

function makeHear(level, pickItem) {
  const L = LEVELS[level - 1];
  const scale = BY_ID[pickItem(L.ids)];
  let root, notes;
  for (let t = 0; t < 40; t++) {
    root = rootFor(level, 52, 66);
    notes = buildScale(root, scale);
    if (notes.every((n) => Math.abs(n.a) <= 1)) break;
  }
  const down = L.down && Math.random() < 0.35;
  const midis = notes.map(midiOf);
  const order = down ? midis.slice().reverse() : midis;
  return {
    type: 'choice',
    item: scale.id,
    prompt: 'Welche Tonleiter hörst du?',
    sub: down ? 'abwärts gespielt' : 'aufwärts gespielt',
    autoplay: true,
    play: () => seq(order),
    options: L.ids.map((x) => ({ id: x, label: BY_ID[x].name })),
    answer: scale.id,
    reveal: { groups: (down ? notes.slice().reverse() : notes).map((n) => [n]), text: `${nameDe(root)} ${scale.name}`, duration: 'q' },
    compare: (id) => {
      const m2 = buildScale(root, BY_ID[id]).map(midiOf);
      return seq(down ? m2.reverse() : m2);
    },
  };
}

function makeRead(level, pickItem) {
  const L = LEVELS[level - 1];
  const scale = BY_ID[pickItem(L.ids)];
  const useBass = level >= 4 && Math.random() < 0.35;
  let root, notes;
  for (let t = 0; t < 60; t++) {
    root = useBass ? rootFor(level, 43, 55) : rootFor(level, 60, 69);
    notes = buildScale(root, scale);
    if (notes.every((n) => Math.abs(n.a) <= (level >= 5 ? 2 : 1))) break;
  }
  const midis = notes.map(midiOf);
  return {
    type: 'choice',
    item: scale.id,
    prompt: 'Welche Tonleiter siehst du?',
    sub: `Grundton ${nameDe(root)}`,
    notation: { groups: notes.map((n) => [n]), clef: useBass ? 'bass' : 'treble', duration: 'q', wide: true },
    play: () => seq(midis),
    options: L.ids.map((x) => ({ id: x, label: BY_ID[x].name })),
    answer: scale.id,
    reveal: { groups: notes.map((n) => [n]), text: `${nameDe(root)} ${scale.name}: ${notes.map((n) => nameDe(n)).join(' ')}`, playOnReveal: true, duration: 'q' },
  };
}

function makeSing(level, pickItem, ctx) {
  const L = LEVELS[level - 1];
  const scale = BY_ID[pickItem(L.ids)];
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  let root, notes;
  for (let t = 0; t < 40; t++) {
    root = rootFor(level, vr.lo, vr.hi - 12);
    notes = buildScale(root, scale);
    if (notes.every((n) => Math.abs(n.a) <= 1)) break;
  }
  const targets = notes.map(midiOf);
  const r = targets[0];
  return {
    type: 'sing',
    item: scale.id,
    prompt: `Singe ${scale.name} aufwärts`,
    sub: `Grundton ${nameDe(root)}, ${notes.length} Töne bis zur Oktave`,
    notation: { groups: [[root]], clef: r < 57 ? 'bass' : 'treble' },
    play: () => playMelodic([r], 0.8, 1.6),
    playTarget: () => seq(targets, 0.45),
    targetLabel: 'Tonleiter hören',
    targets,
    reveal: { groups: notes.map((n) => [n]), text: `${nameDe(root)} ${scale.name}: ${notes.map((n) => nameDe(n)).join(' ')}`, duration: 'q' },
  };
}

export const scalesModule = {
  id: 'scales',
  title: 'Tonleitern',
  icon: 'scales',
  available: true,
  blurb: 'Dur, Moll, Kirchentonarten und mehr.',
  levels: LEVELS,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Tonleiter vorspielen lassen und benennen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Tonleiter in Noten sehen und benennen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Grundton hören und die Tonleiter aufwärts singen.' },
  ],
  makeQuestion(mode, level, pickItem, ctx) {
    if (mode === 'hear') return makeHear(level, pickItem);
    if (mode === 'read') return makeRead(level, pickItem);
    return makeSing(level, pickItem, ctx);
  },
  itemLabel: (id) => BY_ID[id]?.name || id,
  allItems: SCALES.map((s) => s.id),
  tasks: () => [
    { id: 'sc-hear-8', group: 'sc-hear', kind: 'correct', module: 'scales', mode: 'hear', target: 8, title: '8 Tonleitern richtig nach Gehör erkennen' },
    { id: 'sc-read-6', group: 'sc-read', kind: 'correct', module: 'scales', mode: 'read', target: 6, title: '6 Tonleitern in Noten richtig benennen' },
    { id: 'sc-sing-3', group: 'sc-sing', kind: 'correct', module: 'scales', mode: 'sing', target: 3, title: '3 Tonleitern sauber aufwärts singen' },
  ],
};
