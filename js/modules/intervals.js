// Übungsbereich Intervalle mit geführtem Lernpfad: Hören, Notenschrift, Nachsingen.
import { buildInterval, midiOf, nameDe, randomNote, pick } from '../theory.js';
import { playMelodic, playHarmonic } from '../audio.js';

// Alle Intervalle, die im Lernpfad vorkommen (Qualität, Intervallzahl, Halbtöne)
export const IV = [
  { id: 'r1', q: 'rein', num: 1, semis: 0, name: 'reine Prime' },
  { id: 'ue1', q: 'übermäßig', num: 1, semis: 1, name: 'übermäßige Prime' },
  { id: 'k2', q: 'klein', num: 2, semis: 1, name: 'kleine Sekunde' },
  { id: 'g2', q: 'groß', num: 2, semis: 2, name: 'große Sekunde' },
  { id: 'ue2', q: 'übermäßig', num: 2, semis: 3, name: 'übermäßige Sekunde' },
  { id: 'v3', q: 'vermindert', num: 3, semis: 2, name: 'verminderte Terz' },
  { id: 'k3', q: 'klein', num: 3, semis: 3, name: 'kleine Terz' },
  { id: 'g3', q: 'groß', num: 3, semis: 4, name: 'große Terz' },
  { id: 'ue3', q: 'übermäßig', num: 3, semis: 5, name: 'übermäßige Terz' },
  { id: 'v4', q: 'vermindert', num: 4, semis: 4, name: 'verminderte Quarte' },
  { id: 'r4', q: 'rein', num: 4, semis: 5, name: 'reine Quarte' },
  { id: 'ue4', q: 'übermäßig', num: 4, semis: 6, name: 'übermäßige Quarte' },
  { id: 'v5', q: 'vermindert', num: 5, semis: 6, name: 'verminderte Quinte' },
  { id: 'r5', q: 'rein', num: 5, semis: 7, name: 'reine Quinte' },
  { id: 'ue5', q: 'übermäßig', num: 5, semis: 8, name: 'übermäßige Quinte' },
  { id: 'v6', q: 'vermindert', num: 6, semis: 7, name: 'verminderte Sexte' },
  { id: 'k6', q: 'klein', num: 6, semis: 8, name: 'kleine Sexte' },
  { id: 'g6', q: 'groß', num: 6, semis: 9, name: 'große Sexte' },
  { id: 'ue6', q: 'übermäßig', num: 6, semis: 10, name: 'übermäßige Sexte' },
  { id: 'v7', q: 'vermindert', num: 7, semis: 9, name: 'verminderte Septime' },
  { id: 'k7', q: 'klein', num: 7, semis: 10, name: 'kleine Septime' },
  { id: 'g7', q: 'groß', num: 7, semis: 11, name: 'große Septime' },
  { id: 'v8', q: 'vermindert', num: 8, semis: 11, name: 'verminderte Oktave' },
  { id: 'r8', q: 'rein', num: 8, semis: 12, name: 'reine Oktave' },
  { id: 'ue8', q: 'übermäßig', num: 8, semis: 13, name: 'übermäßige Oktave' },
  { id: 'k9', q: 'klein', num: 9, semis: 13, name: 'kleine None' },
  { id: 'g9', q: 'groß', num: 9, semis: 14, name: 'große None' },
  { id: 'k10', q: 'klein', num: 10, semis: 15, name: 'kleine Dezime' },
  { id: 'g10', q: 'groß', num: 10, semis: 16, name: 'große Dezime' },
  { id: 'r11', q: 'rein', num: 11, semis: 17, name: 'reine Undezime' },
  { id: 'r12', q: 'rein', num: 12, semis: 19, name: 'reine Duodezime' },
];
export const IV_BY_ID = Object.fromEntries(IV.map((i) => [i.id, i]));
const NUM_NAMES = { 1: 'Prime', 2: 'Sekunde', 3: 'Terz', 4: 'Quarte', 5: 'Quinte', 6: 'Sexte', 7: 'Septime', 8: 'Oktave', 9: 'None', 10: 'Dezime', 11: 'Undezime', 12: 'Duodezime' };
const Q_ORDER = ['vermindert', 'klein', 'rein', 'groß', 'übermäßig'];

export const VOICE_RANGES = {
  tief: { lo: 40, hi: 62, label: 'Tief (Bass, Bariton)' },
  mittel: { lo: 48, hi: 69, label: 'Mittel (Tenor, Alt)' },
  hoch: { lo: 55, hi: 76, label: 'Hoch (Sopran, Mezzo)' },
};

// ---------- Lernpfad ----------
const FAM = {
  1: ['r1', 'ue1'],
  2: ['k2', 'g2', 'ue2'],
  3: ['v3', 'k3', 'g3'],
  4: ['v4', 'r4', 'ue4'],
  5: ['v5', 'r5', 'ue5'],
  6: ['k6', 'g6', 'ue6'],
  7: ['v7', 'k7', 'g7'],
  8: ['v8', 'r8'],
};
const PLURAL = { 1: 'Primen', 2: 'Sekunden', 3: 'Terzen', 4: 'Quarten', 5: 'Quinten', 6: 'Sexten', 7: 'Septimen', 8: 'Oktaven' };
const upTo = (n) => Array.from({ length: n }, (_, i) => FAM[i + 1]).flat();
const names = (ids) => ids.map((x) => IV_BY_ID[x].name);

function buildPath() {
  const basics = [];
  for (let n = 1; n <= 8; n++) {
    basics.push({
      id: `f${n}`, title: PLURAL[n], items: FAM[n], newItems: FAM[n],
      desc: `${names(FAM[n]).join(', ')}.`, dirs: ['up'], harmonic: 0, accs: [0],
    });
    if (n >= 2) {
      basics.push({
        id: `m${n}`, title: `Gemischt: ${PLURAL[1]} bis ${PLURAL[n]}`, items: upTo(n),
        desc: `Alles von der Prime bis zur ${NUM_NAMES[n]} auseinanderhalten.`, dirs: ['up'], harmonic: 0, accs: [0, 0, 1, -1],
      });
    }
  }
  const down = [
    { id: 'd1', title: 'Abwärts: Primen bis Terzen', items: upTo(3) },
    { id: 'd2', title: 'Abwärts: Quarten und Quinten', items: [...FAM[4], ...FAM[5]] },
    { id: 'd3', title: 'Abwärts: Sexten bis Oktaven', items: [...FAM[6], ...FAM[7], ...FAM[8]] },
    { id: 'd4', title: 'Abwärts: alles bis zur Oktave', items: upTo(8) },
  ].map((l) => ({ ...l, desc: 'Der zweite Ton liegt jetzt unter dem ersten.', dirs: ['down'], harmonic: 0, accs: [0, 1, -1] }));
  const harm = [
    { id: 'h1', title: 'Zusammenklang: Primen bis Terzen', items: upTo(3) },
    { id: 'h2', title: 'Zusammenklang: Quarten und Quinten', items: [...FAM[4], ...FAM[5]] },
    { id: 'h3', title: 'Zusammenklang: Sexten bis Oktaven', items: [...FAM[6], ...FAM[7], ...FAM[8]] },
    { id: 'h4', title: 'Zusammenklang: alles bis zur Oktave', items: upTo(8) },
  ].map((l) => ({ ...l, desc: 'Beide Töne klingen gleichzeitig.', dirs: ['up'], harmonic: 1, accs: [0, 1, -1], clefs: ['treble', 'bass'] }));
  const pro = [
    { id: 'p1', title: 'Nonen und Dezimen', items: ['k9', 'g9', 'k10', 'g10'], newItems: ['k9', 'g9', 'k10', 'g10'], desc: 'Intervalle über die Oktave hinaus.', dirs: ['up'], harmonic: 0, accs: [0, 1, -1] },
    { id: 'p2', title: 'Undezime und Duodezime', items: ['k9', 'g9', 'k10', 'g10', 'r11', 'r12'], newItems: ['r11', 'r12'], desc: 'Dazu Undezime und Duodezime.', dirs: ['up'], harmonic: 0, accs: [0, 1, -1] },
    { id: 'p3', title: 'Meisterprüfung', items: IV.map((i) => i.id), desc: 'Alle Intervalle, auf- und abwärts, nacheinander und gleichzeitig, in beiden Schlüsseln.', dirs: ['up', 'down'], harmonic: 0.35, accs: [0, 1, -1], clefs: ['treble', 'bass'] },
  ];
  return [
    { title: 'Grundlagen', desc: 'Schritt für Schritt, aufwärts gespielt.', lessons: basics },
    { title: 'Abwärts', desc: 'Dieselben Intervalle, nach unten.', lessons: down },
    { title: 'Zusammenklang', desc: 'Beide Töne gleichzeitig.', lessons: harm },
    { title: 'Profi', desc: 'Große Intervalle und die Meisterprüfung.', lessons: pro },
  ];
}

const SECTIONS = buildPath();
const LESSONS = SECTIONS.flatMap((s) => s.lessons);

function dirLabel(d) {
  return d === 'down' ? 'abwärts' : 'aufwärts';
}

// Grundton so wählen, dass beide Töne im Bereich liegen und nicht mehr als ein Doppelvorzeichen entsteht
function makePair(iv, dir, lo, hi, accs, maxAcc = 1) {
  let root, other;
  for (let t = 0; t < 120; t++) {
    const rlo = dir === 'up' ? lo : lo + iv.semis;
    const rhi = dir === 'up' ? hi - iv.semis : hi;
    root = randomNote({ accs, lo: rlo, hi: Math.max(rlo, rhi) });
    other = buildInterval(root, iv.num, iv.semis, dir === 'down');
    if (Math.abs(other.a) <= maxAcc) break;
  }
  return { root, other };
}

// Antwortoptionen: bis 9 Intervalle als Knöpfe, darüber zweistufig (Qualität + Intervall)
function answerSpec(lesson, iv, byEar) {
  const items = lesson.items.map((x) => IV_BY_ID[x]);
  const accept = (cand) => cand && (byEar ? cand.semis === iv.semis : cand.id === iv.id);
  if (byEar) {
    // Beim Hören: gleich klingende Intervalle teilen sich einen Knopf (z. B. übermäßige Prime / kleine Sekunde)
    const groups = new Map();
    for (const x of items) {
      if (!groups.has(x.semis)) groups.set(x.semis, []);
      groups.get(x.semis).push(x);
    }
    const order = [...groups.keys()].sort((a, b) => a - b);
    return {
      type: 'choice',
      options: order.map((st) => ({ id: `s${st}`, label: groups.get(st).map((x) => x.name).join(' / ') })),
      answer: `s${iv.semis}`,
      accept: (id) => id === `s${iv.semis}`,
    };
  }
  if (items.length <= 9) {
    return {
      type: 'choice',
      options: items.map((x) => ({ id: x.id, label: x.name })),
      answer: iv.id,
      accept: (id) => accept(IV_BY_ID[id]),
    };
  }
  const qs = Q_ORDER.filter((q) => items.some((x) => x.q === q));
  const nums = [...new Set(items.map((x) => x.num))].sort((a, b) => a - b);
  const find = (sel) => items.find((x) => x.q === sel.quality && String(x.num) === String(sel.num));
  return {
    type: 'multi',
    parts: [
      { key: 'quality', label: 'Qualität', options: qs.map((x) => ({ id: x, label: x })) },
      { key: 'num', label: 'Intervall', options: nums.map((n) => ({ id: String(n), label: NUM_NAMES[n] })) },
    ],
    answer: { quality: iv.q, num: String(iv.num) },
    accept: (sel) => accept(find(sel)),
    labelFor: (sel) => (find(sel) ? find(sel).name : `${{ vermindert: 'verminderte', klein: 'kleine', rein: 'reine', groß: 'große', übermäßig: 'übermäßige' }[sel.quality]} ${NUM_NAMES[sel.num]} (kommt hier nicht vor)`),
  };
}

function sameSound(iv, lesson) {
  return lesson.items.map((x) => IV_BY_ID[x]).filter((x) => x.id !== iv.id && x.semis === iv.semis);
}

function makeHear(lesson, pickItem) {
  const iv = IV_BY_ID[pickItem(lesson.items)];
  const harmonic = Math.random() < (lesson.harmonic || 0);
  const dir = harmonic ? 'up' : pick(lesson.dirs);
  const { root, other } = makePair(iv, dir, 48, 79, lesson.accs);
  const a = midiOf(root), b = midiOf(other);
  const play = () => (harmonic ? playHarmonic([a, b]) : playMelodic([a, b]));
  const twins = sameSound(iv, lesson);
  return {
    item: iv.id,
    prompt: harmonic ? 'Welches Intervall klingt gleichzeitig?' : 'Welches Intervall hörst du?',
    sub: harmonic ? 'zusammen angeschlagen' : `nacheinander, ${dirLabel(dir)}`,
    autoplay: true,
    play,
    ...answerSpec(lesson, iv, true),
    reveal: {
      groups: harmonic ? [[root, other]] : [[root], [other]],
      text: `${nameDe(root)} – ${nameDe(other)}: ${iv.name} ${harmonic ? 'zusammen' : dirLabel(dir)}`,
      note: twins.length ? `Klingt genauso wie: ${twins.map((x) => x.name).join(', ')}.` : '',
    },
    compare: (optId) => {
      const semis = optId && optId[0] === 's' ? Number(optId.slice(1)) : IV_BY_ID[optId]?.semis;
      if (semis === undefined || Number.isNaN(semis)) return null;
      const m2 = dir === 'down' ? a - semis : a + semis;
      return harmonic ? playHarmonic([a, m2]) : playMelodic([a, m2]);
    },
  };
}

function makeRead(lesson, pickItem) {
  const iv = IV_BY_ID[pickItem(lesson.items)];
  const dir = pick(lesson.dirs);
  const clef = pick(lesson.clefs || ['treble']);
  const range = clef === 'bass' ? [40, 64] : [57, 84];
  // Auch der erste Ton darf Vorzeichen haben (von Anfang an)
  const { root, other } = makePair(iv, dir, range[0], range[1], [0, 0, 1, -1], 2);
  const harmonic = Math.random() < (lesson.harmonic || 0);
  const groups = harmonic ? [[root, other]] : [[root], [other]];
  const a = midiOf(root), b = midiOf(other);
  return {
    item: iv.id,
    prompt: 'Welches Intervall siehst du?',
    sub: harmonic ? 'zusammenklingend' : `nacheinander, ${dirLabel(dir)}`,
    notation: { groups, clef },
    play: () => (harmonic ? playHarmonic([a, b]) : playMelodic([a, b])),
    ...answerSpec(lesson, iv, false),
    reveal: { groups, text: `${nameDe(root)} – ${nameDe(other)}: ${iv.name}`, playOnReveal: true },
  };
}

function makeSing(lesson, pickItem, ctx) {
  const iv = IV_BY_ID[pickItem(lesson.items)];
  const dir = pick(lesson.dirs);
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const { root, other } = makePair(iv, dir, vr.lo, vr.hi, [0, 0, 1, -1]);
  const a = midiOf(root), b = midiOf(other);
  return {
    type: 'sing',
    item: iv.id,
    prompt: iv.semis === 0 ? 'Singe denselben Ton (reine Prime)' : `Singe eine ${iv.name} ${dirLabel(dir)}`,
    sub: `Grundton: ${nameDe(root)}`,
    notation: { groups: [[root]], clef: a < 57 ? 'bass' : 'treble' },
    play: () => playMelodic([a], 0.8, 1.6),
    playTarget: () => playMelodic([a, b]),
    targets: [b],
    reveal: { groups: [[root], [other]], text: `${nameDe(root)} – ${nameDe(other)}: ${iv.name} ${dirLabel(dir)}` },
  };
}

// Kennenlernen: Beispiele für neue Intervalle auf C bzw. passendem Grundton
function intro(lesson) {
  return (lesson.newItems || []).map((id) => {
    const iv = IV_BY_ID[id];
    const root = { l: 0, a: 0, o: 4 };
    const other = buildInterval(root, iv.num, iv.semis);
    const a = midiOf(root), b = midiOf(other);
    return {
      title: iv.name,
      text: `${iv.semis} ${iv.semis === 1 ? 'Halbton' : 'Halbtöne'} · z. B. ${nameDe(root)} – ${nameDe(other)}`,
      groups: [[root], [other]],
      play: () => playMelodic([a, b]),
    };
  });
}

export const intervalsModule = {
  id: 'intervals',
  title: 'Intervalle',
  icon: 'intervals',
  available: true,
  blurb: 'Abstände zwischen zwei Tönen erkennen, lesen und singen.',
  sections: SECTIONS,
  lessons: LESSONS,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Intervall vorspielen lassen und benennen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Intervall in Noten sehen und benennen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Grundton hören und das Intervall singen.' },
  ],
  makeQuestion(mode, lesson, pickItem, ctx) {
    if (mode === 'hear') return makeHear(lesson, pickItem);
    if (mode === 'read') return makeRead(lesson, pickItem);
    return makeSing(lesson, pickItem, ctx);
  },
  intro,
  itemLabel: (id) => IV_BY_ID[id]?.name || id,
  allItems: IV.map((i) => i.id),
  tasks: () => [
    { id: 'int-hear-10', group: 'int-hear', kind: 'correct', module: 'intervals', mode: 'hear', target: 10, title: '10 Intervalle richtig nach Gehör erkennen' },
    { id: 'int-hear-15', group: 'int-hear', kind: 'correct', module: 'intervals', mode: 'hear', target: 15, title: '15 Intervalle richtig nach Gehör erkennen' },
    { id: 'int-read-8', group: 'int-read', kind: 'correct', module: 'intervals', mode: 'read', target: 8, title: '8 Intervalle in Noten richtig benennen' },
    { id: 'int-read-12', group: 'int-read', kind: 'correct', module: 'intervals', mode: 'read', target: 12, title: '12 Intervalle in Noten richtig benennen' },
    { id: 'int-sing-5', group: 'int-sing', kind: 'correct', module: 'intervals', mode: 'sing', target: 5, title: '5 Intervalle sauber nachsingen' },
    { id: 'int-sess-80', group: 'int-sess', kind: 'session', module: 'intervals', minScore: 0.8, target: 1, title: 'Eine Intervall-Lektion bestehen (mindestens 80 %)' },
    { id: 'int-sess-90', group: 'int-sess', kind: 'session', module: 'intervals', minScore: 0.9, target: 1, title: 'Eine Intervall-Lektion mit 2 Sternen (90 %) schaffen' },
  ],
};
