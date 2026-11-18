// Übungsbereich Tonleitern: Tonleitern hören, lesen und singen.
import { buildInterval, midiOf, nameDe, randomNote, pick } from '../theory.js';
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

const SECTIONS = [
  {
    title: 'Dur und Moll', desc: 'Die wichtigsten Tonleitern.',
    lessons: [
      { id: 'l1', title: 'Dur und Moll', items: ['dur', 'moll'], newItems: ['dur', 'moll'], down: 0, accs: [0] },
      { id: 'l2', title: 'Harmonisches Moll', items: ['moll', 'hmoll'], newItems: ['hmoll'], down: 0, accs: [0] },
      { id: 'l3', title: 'Melodisches Moll', items: ['moll', 'hmoll', 'mmoll'], newItems: ['mmoll'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'l4', title: 'Dur und alle Moll-Formen', items: ['dur', 'moll', 'hmoll', 'mmoll'], down: 0, accs: [0, 1, -1] },
      { id: 'l5', title: 'Dur und Moll, auch abwärts', items: ['dur', 'moll', 'hmoll', 'mmoll'], down: 0.5, accs: [0, 1, -1] },
    ],
  },
  {
    title: 'Kirchentonarten', desc: 'Jede im Vergleich zu Dur oder Moll.',
    lessons: [
      { id: 'k1', title: 'Mixolydisch', items: ['dur', 'mix'], newItems: ['mix'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'k2', title: 'Lydisch', items: ['dur', 'lyd', 'mix'], newItems: ['lyd'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'k3', title: 'Dorisch', items: ['moll', 'dor'], newItems: ['dor'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'k4', title: 'Phrygisch', items: ['moll', 'dor', 'phr'], newItems: ['phr'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'k5', title: 'Lokrisch', items: ['phr', 'lok'], newItems: ['lok'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'k6', title: 'Alle Kirchentonarten', items: ['dur', 'dor', 'phr', 'lyd', 'mix', 'moll', 'lok'], down: 0.3, accs: [0, 1, -1] },
    ],
  },
  {
    title: 'Weitere Skalen', desc: 'Pentatonik, Blues und Besonderes.',
    lessons: [
      { id: 'w1', title: 'Pentatonik', items: ['pdur', 'pmoll'], newItems: ['pdur', 'pmoll'], down: 0, accs: [0, 0, 1, -1] },
      { id: 'w2', title: 'Blues und Ganzton', items: ['pmoll', 'blues', 'ganz'], newItems: ['blues', 'ganz'], down: 0, accs: [0, 1, -1] },
      { id: 'w3', title: 'Harmonisch Dur und Alteriert', items: ['dur', 'hdur', 'alt', 'lok'], newItems: ['hdur', 'alt'], down: 0, accs: [0, 1, -1] },
      { id: 'w4', title: 'Meisterprüfung', items: SCALES.map((x) => x.id), down: 0.35, accs: [0, 1, -1], clefs: ['treble', 'bass'] },
    ],
  },
];
const HOW = {
  dur: 'Ganz-Ganz-Halb-Ganz-Ganz-Ganz-Halb', moll: 'wie Dur, aber mit kleiner Terz, Sexte und Septime',
  hmoll: 'natürliches Moll mit großer Septime', mmoll: 'natürliches Moll mit großer Sexte und Septime',
  mix: 'Dur mit kleiner Septime', lyd: 'Dur mit übermäßiger Quarte', dor: 'Moll mit großer Sexte',
  phr: 'Moll mit kleiner Sekunde', lok: 'Phrygisch mit verminderter Quinte', pdur: 'Dur ohne 4. und 7. Stufe',
  pmoll: 'Moll ohne 2. und 6. Stufe', blues: 'Moll-Pentatonik plus verminderte Quinte', ganz: 'nur Ganztonschritte',
  hdur: 'Dur mit kleiner Sexte', alt: 'jede Stufe außer dem Grundton erniedrigt',
};
for (const s of SECTIONS) for (const l of s.lessons) {
  if (!l.desc) l.desc = l.items.map((x) => BY_ID[x].name).join(', ') + (l.down ? '. Auf- und abwärts.' : '.');
}
const LESSONS = SECTIONS.flatMap((s) => s.lessons);

function buildScale(root, scale) {
  const notes = scale.steps.map(([num, semis]) => buildInterval(root, num, semis));
  notes.push({ ...root, o: root.o + 1 });
  return notes;
}

function makeScale(accs, scale, lo, hi, maxAcc) {
  let root, notes;
  for (let t = 0; t < 60; t++) {
    root = randomNote({ accs, lo, hi });
    if (Math.abs(root.a) > 1) continue;
    notes = buildScale(root, scale);
    if (notes.every((n) => Math.abs(n.a) <= maxAcc)) break;
  }
  return { root, notes };
}

function seq(midis, gap = 0.32) {
  return playSequence(midis.map((m, i) => ({ midis: [m], at: i * gap, dur: i === midis.length - 1 ? 1.0 : gap + 0.1 })));
}

function makeHear(lesson, pickItem) {
  const scale = BY_ID[pickItem(lesson.items)];
  const { root, notes } = makeScale(lesson.accs, scale, 52, 66, 1);
  const down = Math.random() < (lesson.down || 0);
  const midis = notes.map(midiOf);
  const order = down ? midis.slice().reverse() : midis;
  return {
    type: 'choice',
    item: scale.id,
    prompt: 'Welche Tonleiter hörst du?',
    sub: down ? 'abwärts gespielt' : 'aufwärts gespielt',
    autoplay: true,
    play: () => seq(order),
    options: lesson.items.map((x) => ({ id: x, label: BY_ID[x].name })),
    answer: scale.id,
    reveal: { groups: (down ? notes.slice().reverse() : notes).map((n) => [n]), text: `${nameDe(root)} ${scale.name}`, note: HOW[scale.id] ? `Merkmal: ${HOW[scale.id]}.` : '', duration: 'q' },
    compare: (id) => {
      const m2 = buildScale(root, BY_ID[id]).map(midiOf);
      return seq(down ? m2.reverse() : m2);
    },
  };
}

function makeRead(lesson, pickItem) {
  const scale = BY_ID[pickItem(lesson.items)];
  const clef = pick(lesson.clefs || ['treble']);
  const { root, notes } = clef === 'bass' ? makeScale(lesson.accs, scale, 43, 55, 2) : makeScale(lesson.accs, scale, 60, 69, 2);
  const midis = notes.map(midiOf);
  return {
    type: 'choice',
    item: scale.id,
    prompt: 'Welche Tonleiter siehst du?',
    sub: `Grundton ${nameDe(root)}`,
    notation: { groups: notes.map((n) => [n]), clef, duration: 'q', wide: true },
    play: () => seq(midis),
    options: lesson.items.map((x) => ({ id: x, label: BY_ID[x].name })),
    answer: scale.id,
    reveal: { groups: notes.map((n) => [n]), text: `${nameDe(root)} ${scale.name}: ${notes.map((n) => nameDe(n)).join(' ')}`, note: HOW[scale.id] ? `Merkmal: ${HOW[scale.id]}.` : '', playOnReveal: true, duration: 'q' },
  };
}

function makeSing(lesson, pickItem, ctx) {
  const scale = BY_ID[pickItem(lesson.items)];
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const { root, notes } = makeScale([0, 0, 1, -1], scale, vr.lo, vr.hi - 12, 1);
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

function intro(lesson) {
  return (lesson.newItems || []).map((id) => {
    const scale = BY_ID[id];
    const root = { l: 0, a: 0, o: 4 };
    const notes = buildScale(root, scale);
    return {
      title: scale.name,
      text: `${HOW[id] || ''} · ${notes.map((n) => nameDe(n)).join(' ')}`,
      groups: notes.map((n) => [n]),
      duration: 'q',
      play: () => seq(notes.map(midiOf)),
    };
  });
}

export const scalesModule = {
  id: 'scales',
  title: 'Tonleitern',
  icon: 'scales',
  available: true,
  blurb: 'Dur, Moll, Kirchentonarten und mehr.',
  sections: SECTIONS,
  lessons: LESSONS,
  intro,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Tonleiter vorspielen lassen und benennen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Tonleiter in Noten sehen und benennen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Grundton hören und die Tonleiter aufwärts singen.' },
  ],
  makeQuestion(mode, lesson, pickItem, ctx) {
    if (mode === 'hear') return makeHear(lesson, pickItem);
    if (mode === 'read') return makeRead(lesson, pickItem);
    return makeSing(lesson, pickItem, ctx);
  },
  itemLabel: (id) => BY_ID[id]?.name || id,
  allItems: SCALES.map((s) => s.id),
  tasks: () => [
    { id: 'sc-hear-8', group: 'sc-hear', kind: 'correct', module: 'scales', mode: 'hear', target: 8, title: '8 Tonleitern richtig nach Gehör erkennen' },
    { id: 'sc-read-6', group: 'sc-read', kind: 'correct', module: 'scales', mode: 'read', target: 6, title: '6 Tonleitern in Noten richtig benennen' },
    { id: 'sc-sing-3', group: 'sc-sing', kind: 'correct', module: 'scales', mode: 'sing', target: 3, title: '3 Tonleitern sauber aufwärts singen' },
  ],
};
