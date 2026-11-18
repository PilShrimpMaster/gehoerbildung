// Übungsbereich Akkorde: Akkordart (und Umkehrung) hören, lesen und singen.
import { buildInterval, midiOf, nameDe, randomNote, pick, rand } from '../theory.js';
import { playMelodic, playHarmonic, playSequence } from '../audio.js';
import { VOICE_RANGES } from './intervals.js';

// Töne als [Intervallzahl, Halbtöne] über dem Grundton
export const CHORDS = [
  { id: 'dur', name: 'Dur', tones: [[1, 0], [3, 4], [5, 7]] },
  { id: 'moll', name: 'Moll', tones: [[1, 0], [3, 3], [5, 7]] },
  { id: 'verm', name: 'vermindert', tones: [[1, 0], [3, 3], [5, 6]] },
  { id: 'uebm', name: 'übermäßig', tones: [[1, 0], [3, 4], [5, 8]] },
  { id: 'sus4', name: 'Quartvorhalt (sus4)', tones: [[1, 0], [4, 5], [5, 7]] },
  { id: 'd7', name: 'Dominantseptakkord', tones: [[1, 0], [3, 4], [5, 7], [7, 10]] },
  { id: 'maj7', name: 'großer Durseptakkord', tones: [[1, 0], [3, 4], [5, 7], [7, 11]] },
  { id: 'm7', name: 'Mollseptakkord', tones: [[1, 0], [3, 3], [5, 7], [7, 10]] },
  { id: 'hv7', name: 'halbverminderter Septakkord', tones: [[1, 0], [3, 3], [5, 6], [7, 10]] },
  { id: 'v7', name: 'verminderter Septakkord', tones: [[1, 0], [3, 3], [5, 6], [7, 9]] },
  { id: 'mmaj7', name: 'Moll mit großer Septime', tones: [[1, 0], [3, 3], [5, 7], [7, 11]] },
];
const BY_ID = Object.fromEntries(CHORDS.map((c) => [c.id, c]));

const INV_TRIAD = ['Grundstellung', 'Sextakkord', 'Quartsextakkord'];
const INV_SEVENTH = ['Grundstellung', 'Quintsextakkord', 'Terzquartakkord', 'Sekundakkord'];

const LEVELS = [
  { n: 1, name: 'Einsteiger', desc: 'Dur und Moll in Grundstellung.', ids: ['dur', 'moll'], inv: false },
  { n: 2, name: 'Grundlagen', desc: 'Dur, Moll, vermindert und übermäßig in Grundstellung.', ids: ['dur', 'moll', 'verm', 'uebm'], inv: false },
  { n: 3, name: 'Fortgeschritten', desc: 'Dazu Quartvorhalt und die drei wichtigsten Septakkorde (D7, maj7, m7). Dreiklänge auch umgekehrt.', ids: ['dur', 'moll', 'verm', 'uebm', 'sus4', 'd7', 'maj7', 'm7'], inv: 'triad' },
  { n: 4, name: 'Sicher', desc: 'Alle Septakkorde inklusive halbvermindert und vermindert, alle Umkehrungen. Bass- und Violinschlüssel.', ids: CHORDS.map((c) => c.id).filter((x) => x !== 'mmaj7'), inv: 'all' },
  { n: 5, name: 'Profi', desc: 'Alle Akkorde, und du bestimmst zusätzlich die Umkehrung.', ids: CHORDS.map((c) => c.id), inv: 'all', askInv: true },
];

function invNames(chord) {
  return chord.tones.length === 4 ? INV_SEVENTH : INV_TRIAD;
}

// Baut den Akkord als Notenliste (tiefster Ton zuerst)
function buildChord(root, chord, inversion = 0) {
  const notes = chord.tones.map(([num, semis]) => buildInterval(root, num, semis));
  for (let i = 0; i < inversion; i++) {
    const n = notes.shift();
    notes.push({ ...n, o: n.o + 1 });
  }
  return notes;
}

function chooseInversion(L, chord) {
  if (!L.inv) return 0;
  if (L.inv === 'triad' && chord.tones.length === 4) return 0;
  if (Math.random() < 0.4) return 0;
  return 1 + rand(chord.tones.length - 1);
}

function fitRoot(lo, hi, span, accs) {
  return randomNote({ accs, lo, hi: Math.max(lo, hi - span) });
}

function spanOf(chord, inv) {
  const notes = buildChord({ l: 0, a: 0, o: 4 }, chord, inv);
  return midiOf(notes[notes.length - 1]) - midiOf({ l: 0, a: 0, o: 4 });
}

function describe(chord, notes, inv) {
  const root = notes[(notes.length - inv) % notes.length];
  return `${nameDe(root)}-${chord.name}${inv ? ` (${invNames(chord)[inv]})` : ''}: ${notes.map((n) => nameDe(n)).join(' – ')}`;
}

function answerSpec(L, chord, inv, labelOf) {
  if (L.askInv) {
    return {
      type: 'multi',
      parts: [
        { key: 'chord', label: 'Akkord', options: L.ids.map((x) => ({ id: x, label: BY_ID[x].name })) },
        { key: 'inv', label: 'Umkehrung', options: ['Grundstellung', '1. Umkehrung', '2. Umkehrung', '3. Umkehrung'].map((x, i) => ({ id: String(i), label: x })) },
      ],
      answer: { chord: chord.id, inv: String(inv) },
      labelFor: (sel) => `${BY_ID[sel.chord].name}, ${['Grundstellung', '1. Umkehrung', '2. Umkehrung', '3. Umkehrung'][Number(sel.inv)]}`,
    };
  }
  return { type: 'choice', options: L.ids.map((x) => ({ id: x, label: labelOf(x) })), answer: chord.id };
}

function makeHear(level, pickItem) {
  const L = LEVELS[level - 1];
  const chord = BY_ID[pickItem(L.ids)];
  const inv = chooseInversion(L, chord);
  let root, notes;
  for (let t = 0; t < 40; t++) {
    root = fitRoot(48, 76, spanOf(chord, inv), [0, 0, 1, -1]);
    notes = buildChord(root, chord, inv);
    if (notes.every((n) => Math.abs(n.a) <= 1)) break;
  }
  const midis = notes.map(midiOf);
  const arp = level <= 2 || Math.random() < 0.3;
  const play = () => (arp
    ? playSequence([...midis.map((m, i) => ({ midis: [m], at: i * 0.45, dur: 0.5 })), { midis, at: midis.length * 0.45 + 0.2, dur: 1.8 }])
    : playHarmonic(midis, 2));
  return {
    item: chord.id,
    prompt: L.askInv ? 'Welcher Akkord, welche Umkehrung?' : 'Welchen Akkord hörst du?',
    sub: arp ? 'erst gebrochen, dann zusammen' : 'zusammen angeschlagen',
    autoplay: true,
    play,
    ...answerSpec(L, chord, inv, (x) => BY_ID[x].name),
    reveal: { groups: [notes], text: describe(chord, notes, inv) },
    compare: (id) => {
      const c2 = BY_ID[id];
      if (!c2) return null;
      const n2 = buildChord(root, c2, 0).map(midiOf);
      return playHarmonic(n2, 2);
    },
  };
}

function makeRead(level, pickItem) {
  const L = LEVELS[level - 1];
  const chord = BY_ID[pickItem(L.ids)];
  const inv = chooseInversion(L, chord);
  const useBass = level >= 4 && Math.random() < 0.4;
  const accs = level <= 1 ? [0] : level === 2 ? [0, 0, 1, -1] : [0, 1, -1];
  let notes;
  for (let t = 0; t < 60; t++) {
    const span = spanOf(chord, inv);
    const root = useBass ? fitRoot(41, 62, span, accs) : fitRoot(60, 79, span, accs);
    notes = buildChord(root, chord, inv);
    if (notes.every((n) => Math.abs(n.a) <= (level >= 4 ? 2 : 1))) break;
  }
  const midis = notes.map(midiOf);
  return {
    item: chord.id,
    prompt: L.askInv ? 'Welcher Akkord, welche Umkehrung?' : 'Welchen Akkord siehst du?',
    sub: L.inv ? 'Achtung, kann umgekehrt sein' : 'in Grundstellung',
    notation: { groups: [notes], clef: useBass ? 'bass' : 'treble' },
    play: () => playHarmonic(midis, 2),
    ...answerSpec(L, chord, inv, (x) => BY_ID[x].name),
    reveal: { groups: [notes], text: describe(chord, notes, inv), playOnReveal: true },
  };
}

function makeSing(level, pickItem, ctx) {
  const L = LEVELS[level - 1];
  const chord = BY_ID[pickItem(L.ids)];
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const span = spanOf(chord, 0) + (level >= 3 ? 12 : 0);
  let root, notes;
  for (let t = 0; t < 40; t++) {
    root = fitRoot(vr.lo, vr.hi, span, [0, 0, 1, -1]);
    notes = buildChord(root, chord, 0);
    if (notes.every((n) => Math.abs(n.a) <= 1)) break;
  }
  if (level >= 3) notes.push({ ...root, o: root.o + 1 }); // bis zur Oktave hinauf
  const targets = notes.map(midiOf);
  const r = midiOf(root);
  return {
    type: 'sing',
    item: chord.id,
    prompt: `Singe einen ${chord.name}-Akkord aufwärts`,
    sub: `Grundton ${nameDe(root)}, beginne mit dem Grundton${level >= 3 ? ', ende auf der Oktave' : ''}`,
    notation: { groups: [[root]], clef: r < 57 ? 'bass' : 'treble' },
    play: () => playMelodic([r], 0.8, 1.6),
    playTarget: () => playSequence([...targets.map((m, i) => ({ midis: [m], at: i * 0.55, dur: 0.6 })), { midis: targets.slice(0, chord.tones.length), at: targets.length * 0.55 + 0.2, dur: 1.6 }]),
    targetLabel: 'Akkord hören',
    targets,
    reveal: { groups: [notes], text: `${nameDe(root)}-${chord.name}: ${notes.map((n) => nameDe(n)).join(' – ')}` },
  };
}

export const chordsModule = {
  id: 'chords',
  title: 'Akkorde',
  icon: 'chords',
  available: true,
  blurb: 'Dur, Moll, Septakkorde und Umkehrungen.',
  levels: LEVELS,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Akkord vorspielen lassen und die Akkordart bestimmen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Akkord in Noten sehen und bestimmen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Grundton hören und den Akkord Ton für Ton aufwärts singen.' },
  ],
  makeQuestion(mode, level, pickItem, ctx) {
    if (mode === 'hear') return makeHear(level, pickItem);
    if (mode === 'read') return makeRead(level, pickItem);
    return makeSing(level, pickItem, ctx);
  },
  itemLabel: (id) => BY_ID[id]?.name || id,
  allItems: CHORDS.map((c) => c.id),
  tasks: () => [
    { id: 'ch-hear-10', group: 'ch-hear', kind: 'correct', module: 'chords', mode: 'hear', target: 10, title: '10 Akkorde richtig nach Gehör erkennen' },
    { id: 'ch-read-8', group: 'ch-read', kind: 'correct', module: 'chords', mode: 'read', target: 8, title: '8 Akkorde in Noten richtig bestimmen' },
    { id: 'ch-sing-4', group: 'ch-sing', kind: 'correct', module: 'chords', mode: 'sing', target: 4, title: '4 Akkorde sauber aufwärts singen' },
    { id: 'ch-sess-80', group: 'ch-sess', kind: 'session', module: 'chords', minScore: 0.8, target: 1, title: 'Eine Akkord-Runde mit mindestens 80 % schaffen' },
  ],
};
