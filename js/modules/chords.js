// Übungsbereich Akkorde mit geführtem Lernpfad.
import { buildInterval, midiOf, nameDe, randomNote, pick, rand } from '../theory.js';
import { playMelodic, playHarmonic, playSequence } from '../audio.js';
import { VOICE_RANGES } from './intervals.js';

// Töne als [Intervallzahl, Halbtöne] über dem Grundton
export const CHORDS = [
  { id: 'dur', name: 'Dur', tones: [[1, 0], [3, 4], [5, 7]], how: 'große Terz + kleine Terz' },
  { id: 'moll', name: 'Moll', tones: [[1, 0], [3, 3], [5, 7]], how: 'kleine Terz + große Terz' },
  { id: 'verm', name: 'vermindert', tones: [[1, 0], [3, 3], [5, 6]], how: 'zwei kleine Terzen' },
  { id: 'uebm', name: 'übermäßig', tones: [[1, 0], [3, 4], [5, 8]], how: 'zwei große Terzen' },
  { id: 'sus4', name: 'Quartvorhalt (sus4)', tones: [[1, 0], [4, 5], [5, 7]], how: 'Quarte statt Terz' },
  { id: 'd7', name: 'Dominantseptakkord', tones: [[1, 0], [3, 4], [5, 7], [7, 10]], how: 'Dur + kleine Septime' },
  { id: 'maj7', name: 'großer Durseptakkord', tones: [[1, 0], [3, 4], [5, 7], [7, 11]], how: 'Dur + große Septime' },
  { id: 'm7', name: 'Mollseptakkord', tones: [[1, 0], [3, 3], [5, 7], [7, 10]], how: 'Moll + kleine Septime' },
  { id: 'hv7', name: 'halbverminderter Septakkord', tones: [[1, 0], [3, 3], [5, 6], [7, 10]], how: 'vermindert + kleine Septime' },
  { id: 'v7', name: 'verminderter Septakkord', tones: [[1, 0], [3, 3], [5, 6], [7, 9]], how: 'drei kleine Terzen' },
  { id: 'mmaj7', name: 'Moll mit großer Septime', tones: [[1, 0], [3, 3], [5, 7], [7, 11]], how: 'Moll + große Septime' },
];
const BY_ID = Object.fromEntries(CHORDS.map((c) => [c.id, c]));

const INV_TRIAD = ['Grundstellung', 'Sextakkord', 'Quartsextakkord'];
const INV_SEVENTH = ['Grundstellung', 'Quintsextakkord', 'Terzquartakkord', 'Sekundakkord'];
const INV_GENERIC = ['Grundstellung', '1. Umkehrung', '2. Umkehrung', '3. Umkehrung'];
const invNames = (chord) => (chord.tones.length === 4 ? INV_SEVENTH : INV_TRIAD);
const invLabel = (chord, k) => (k === 0 ? 'Grundstellung' : `${invNames(chord)[k]} (${k}. Umkehrung)`);

const TRIADS = ['dur', 'moll', 'verm', 'uebm', 'sus4'];
const SEVENTHS = ['d7', 'maj7', 'm7', 'hv7', 'v7', 'mmaj7'];

// ask: 'chord' (Akkordart), 'inv' (Umkehrung eines festen Akkords), 'both'
const SECTIONS = [
  {
    title: 'Dreiklänge', desc: 'Die Grundbausteine, in Grundstellung.',
    lessons: [
      { id: 'c1', title: 'Dur und Moll', items: ['dur', 'moll'], newItems: ['dur', 'moll'], ask: 'chord', invs: [0], accs: [0] },
      { id: 'c2', title: 'Dazu: vermindert', items: ['dur', 'moll', 'verm'], newItems: ['verm'], ask: 'chord', invs: [0], accs: [0] },
      { id: 'c3', title: 'Dazu: übermäßig', items: ['dur', 'moll', 'verm', 'uebm'], newItems: ['uebm'], ask: 'chord', invs: [0], accs: [0, 0, 1, -1] },
      { id: 'c4', title: 'Quartvorhalt', items: ['dur', 'moll', 'sus4'], newItems: ['sus4'], ask: 'chord', invs: [0], accs: [0, 0, 1, -1] },
      { id: 'c5', title: 'Alle Dreiklänge', items: TRIADS, ask: 'chord', invs: [0], accs: [0, 1, -1] },
    ],
  },
  {
    title: 'Umkehrungen', desc: 'Derselbe Akkord, ein anderer Ton unten.',
    lessons: [
      { id: 'u1', title: 'Dur umgekehrt', chord: 'dur', ask: 'inv', invs: [0, 1, 2], newInv: true, accs: [0] },
      { id: 'u2', title: 'Moll umgekehrt', chord: 'moll', ask: 'inv', invs: [0, 1, 2], accs: [0, 0, 1, -1] },
      { id: 'u3', title: 'Dur oder Moll, auch umgekehrt', items: ['dur', 'moll'], ask: 'chord', invs: [0, 1, 2], accs: [0, 1, -1] },
      { id: 'u4', title: 'Alle Dreiklänge, auch umgekehrt', items: ['dur', 'moll', 'verm', 'uebm'], ask: 'chord', invs: [0, 1, 2], accs: [0, 1, -1], clefs: ['treble', 'bass'] },
    ],
  },
  {
    title: 'Septakkorde', desc: 'Vierklänge mit Septime.',
    lessons: [
      { id: 's1', title: 'D7 und maj7', items: ['d7', 'maj7'], newItems: ['d7', 'maj7'], ask: 'chord', invs: [0], accs: [0] },
      { id: 's2', title: 'Dazu: Mollseptakkord', items: ['d7', 'maj7', 'm7'], newItems: ['m7'], ask: 'chord', invs: [0], accs: [0, 0, 1, -1] },
      { id: 's3', title: 'Halbvermindert und vermindert', items: ['m7', 'hv7', 'v7'], newItems: ['hv7', 'v7'], ask: 'chord', invs: [0], accs: [0, 0, 1, -1] },
      { id: 's4', title: 'Alle Septakkorde', items: SEVENTHS, newItems: ['mmaj7'], ask: 'chord', invs: [0], accs: [0, 1, -1] },
      { id: 's5', title: 'D7 umgekehrt', chord: 'd7', ask: 'inv', invs: [0, 1, 2, 3], newInv: true, accs: [0, 0, 1, -1] },
    ],
  },
  {
    title: 'Profi', desc: 'Alles gemischt.',
    lessons: [
      { id: 'x1', title: 'Alle Akkorde, auch umgekehrt', items: [...TRIADS, ...SEVENTHS], ask: 'chord', invs: [0, 1, 2, 3], accs: [0, 1, -1], clefs: ['treble', 'bass'] },
      { id: 'x2', title: 'Meisterprüfung: Akkord und Umkehrung', items: [...TRIADS.filter((x) => x !== 'sus4'), ...SEVENTHS], ask: 'both', invs: [0, 1, 2, 3], accs: [0, 1, -1], clefs: ['treble', 'bass'] },
    ],
  },
];
for (const s of SECTIONS) for (const l of s.lessons) {
  if (!l.desc) {
    l.desc = l.ask === 'inv'
      ? `${BY_ID[l.chord].name}: ${invNames(BY_ID[l.chord]).slice(0, l.invs.length).join(', ')}.`
      : l.items.map((x) => BY_ID[x].name).join(', ') + (l.invs.length > 1 ? ', in allen Lagen.' : '.');
  }
}
const LESSONS = SECTIONS.flatMap((s) => s.lessons);

function buildChord(root, chord, inversion = 0) {
  const notes = chord.tones.map(([num, semis]) => buildInterval(root, num, semis));
  for (let i = 0; i < inversion; i++) {
    const n = notes.shift();
    notes.push({ ...n, o: n.o + 1 });
  }
  return notes;
}

function spanOf(chord, inv) {
  const c4 = { l: 0, a: 0, o: 4 };
  const notes = buildChord(c4, chord, inv);
  return midiOf(notes[notes.length - 1]) - midiOf(c4);
}

function pickTask(lesson, pickItem) {
  if (lesson.ask === 'inv') {
    const chord = BY_ID[lesson.chord];
    const item = pickItem(lesson.invs.map((k) => `${chord.id}@${k}`));
    return { chord, inv: Number(item.split('@')[1]), item };
  }
  const chord = BY_ID[pickItem(lesson.items)];
  const allowed = lesson.invs.filter((k) => k < chord.tones.length);
  const inv = allowed.length > 1 && Math.random() < 0.6 ? pick(allowed.slice(1)) : 0;
  return { chord, inv, item: chord.id };
}

function makeChord(lesson, chord, inv, lo, hi, maxAcc) {
  let root, notes;
  for (let t = 0; t < 60; t++) {
    root = randomNote({ accs: lesson.accs, lo, hi: Math.max(lo, hi - spanOf(chord, inv)) });
    notes = buildChord(root, chord, inv);
    if (notes.every((n) => Math.abs(n.a) <= maxAcc)) break;
  }
  return { root, notes };
}

function describe(chord, root, notes, inv) {
  return `${nameDe(root)}-${chord.name}${inv ? `, ${invNames(chord)[inv]}` : ''}: ${notes.map((n) => nameDe(n)).join(' – ')}`;
}

function answerSpec(lesson, chord, inv) {
  if (lesson.ask === 'inv') {
    return {
      type: 'choice',
      options: lesson.invs.map((k) => ({ id: String(k), label: invLabel(chord, k) })),
      answer: String(inv),
    };
  }
  if (lesson.ask === 'both') {
    return {
      type: 'multi',
      parts: [
        { key: 'chord', label: 'Akkord', options: lesson.items.map((x) => ({ id: x, label: BY_ID[x].name })) },
        { key: 'inv', label: 'Lage', options: INV_GENERIC.map((x, i) => ({ id: String(i), label: x })) },
      ],
      answer: { chord: chord.id, inv: String(inv) },
      labelFor: (sel) => `${BY_ID[sel.chord].name}, ${INV_GENERIC[Number(sel.inv)]}`,
    };
  }
  return { type: 'choice', options: lesson.items.map((x) => ({ id: x, label: BY_ID[x].name })), answer: chord.id };
}

function prompt(lesson, verb) {
  if (lesson.ask === 'inv') return `In welcher Lage steht der ${BY_ID[lesson.chord].name}-Akkord?`;
  if (lesson.ask === 'both') return 'Welcher Akkord, welche Lage?';
  return `Welchen Akkord ${verb} du?`;
}

function makeHear(lesson, pickItem) {
  const { chord, inv, item } = pickTask(lesson, pickItem);
  const { root, notes } = makeChord(lesson, chord, inv, 48, 76, 1);
  const midis = notes.map(midiOf);
  const arp = lesson.ask !== 'both' && (lesson.id.startsWith('c') || lesson.id === 's1' || Math.random() < 0.3);
  const play = () => (arp
    ? playSequence([...midis.map((m, i) => ({ midis: [m], at: i * 0.45, dur: 0.5 })), { midis, at: midis.length * 0.45 + 0.2, dur: 1.8 }])
    : playHarmonic(midis, 2));
  return {
    item,
    prompt: prompt(lesson, 'hörst'),
    sub: arp ? 'erst Ton für Ton, dann zusammen' : 'zusammen angeschlagen',
    autoplay: true,
    play,
    ...answerSpec(lesson, chord, inv),
    reveal: { groups: [notes], text: describe(chord, root, notes, inv) },
    compare: (id) => {
      if (lesson.ask === 'inv') return playHarmonic(buildChord(root, chord, Number(id)).map(midiOf), 2);
      const c2 = BY_ID[id];
      return c2 ? playHarmonic(buildChord(root, c2, 0).map(midiOf), 2) : null;
    },
  };
}

function makeRead(lesson, pickItem) {
  const { chord, inv, item } = pickTask(lesson, pickItem);
  const clef = pick(lesson.clefs || ['treble']);
  const [lo, hi] = clef === 'bass' ? [41, 64] : [60, 81];
  const { root, notes } = makeChord(lesson, chord, inv, lo, hi, 2);
  const midis = notes.map(midiOf);
  return {
    item,
    prompt: prompt(lesson, 'siehst'),
    sub: lesson.invs.length > 1 ? 'Achtung, der tiefste Ton ist nicht immer der Grundton' : 'in Grundstellung',
    notation: { groups: [notes], clef },
    play: () => playHarmonic(midis, 2),
    ...answerSpec(lesson, chord, inv),
    reveal: { groups: [notes], text: describe(chord, root, notes, inv), playOnReveal: true },
  };
}

function makeSing(lesson, pickItem, ctx) {
  const { chord, inv, item } = pickTask(lesson, pickItem);
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const { root, notes } = makeChord({ accs: [0, 0, 1, -1] }, chord, inv, vr.lo, vr.hi, 1);
  const targets = notes.map(midiOf);
  const start = notes[0];
  const s = targets[0];
  const what = inv ? `${chord.name}-${invNames(chord)[inv]}` : `${chord.name}-Akkord`;
  return {
    type: 'sing',
    item,
    prompt: `Singe einen ${what} aufwärts`,
    sub: `Beginne mit dem tiefsten Ton: ${nameDe(start)}`,
    notation: { groups: [[start]], clef: s < 57 ? 'bass' : 'treble' },
    play: () => playMelodic([s], 0.8, 1.6),
    playTarget: () => playSequence([...targets.map((m, i) => ({ midis: [m], at: i * 0.55, dur: 0.6 })), { midis: targets, at: targets.length * 0.55 + 0.2, dur: 1.6 }]),
    targetLabel: 'Akkord hören',
    targets,
    reveal: { groups: [notes], text: describe(chord, root, notes, inv) },
  };
}

function intro(lesson) {
  const c4 = { l: 0, a: 0, o: 4 };
  if (lesson.ask === 'inv' && lesson.newInv) {
    const chord = BY_ID[lesson.chord];
    return lesson.invs.map((k) => {
      const notes = buildChord(c4, chord, k);
      return {
        title: invLabel(chord, k),
        text: `${['Grundton', 'Terz', 'Quinte', 'Septime'][k]} liegt unten · ${notes.map((n) => nameDe(n)).join(' – ')}`,
        groups: [notes],
        play: () => playHarmonic(notes.map(midiOf), 2),
      };
    });
  }
  return (lesson.newItems || []).map((id) => {
    const chord = BY_ID[id];
    const notes = buildChord(c4, chord, 0);
    const midis = notes.map(midiOf);
    return {
      title: chord.name,
      text: `${chord.how} · z. B. ${notes.map((n) => nameDe(n)).join(' – ')}`,
      groups: [notes],
      play: () => playSequence([...midis.map((m, i) => ({ midis: [m], at: i * 0.45, dur: 0.5 })), { midis, at: midis.length * 0.45 + 0.2, dur: 1.8 }]),
    };
  });
}

export const chordsModule = {
  id: 'chords',
  title: 'Akkorde',
  icon: 'chords',
  available: true,
  blurb: 'Dur, Moll, Septakkorde und Umkehrungen.',
  sections: SECTIONS,
  lessons: LESSONS,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Akkord vorspielen lassen und bestimmen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Akkord in Noten sehen und bestimmen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Den Akkord Ton für Ton aufwärts singen.' },
  ],
  makeQuestion(mode, lesson, pickItem, ctx) {
    if (mode === 'hear') return makeHear(lesson, pickItem);
    if (mode === 'read') return makeRead(lesson, pickItem);
    return makeSing(lesson, pickItem, ctx);
  },
  intro,
  itemLabel: (id) => {
    if (id.includes('@')) {
      const [c, k] = id.split('@');
      return `${BY_ID[c].name}: ${invNames(BY_ID[c])[Number(k)]}`;
    }
    return BY_ID[id]?.name || id;
  },
  allItems: [...CHORDS.map((c) => c.id), ...[0, 1, 2].map((k) => `dur@${k}`), ...[0, 1, 2].map((k) => `moll@${k}`), ...[0, 1, 2, 3].map((k) => `d7@${k}`)],
  tasks: () => [
    { id: 'ch-hear-10', group: 'ch-hear', kind: 'correct', module: 'chords', mode: 'hear', target: 10, title: '10 Akkorde richtig nach Gehör erkennen' },
    { id: 'ch-read-8', group: 'ch-read', kind: 'correct', module: 'chords', mode: 'read', target: 8, title: '8 Akkorde in Noten richtig bestimmen' },
    { id: 'ch-sing-4', group: 'ch-sing', kind: 'correct', module: 'chords', mode: 'sing', target: 4, title: '4 Akkorde sauber aufwärts singen' },
    { id: 'ch-sess-80', group: 'ch-sess', kind: 'session', module: 'chords', minScore: 0.8, target: 1, title: 'Eine Akkord-Lektion bestehen (mindestens 80 %)' },
  ],
};
