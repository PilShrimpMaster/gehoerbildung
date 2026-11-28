// Übungsbereich Kadenzen: Schlussarten und Funktionen (T, S, D …) hören, lesen und als Basslinie singen.
import { buildInterval, midiOf, nameDe, pick, randomKey, keyName, atMidi } from '../theory.js';
import { playSequence } from '../audio.js';
import { VOICE_RANGES } from './intervals.js';

const QUAL = {
  dur: [[1, 0], [3, 4], [5, 7]],
  moll: [[1, 0], [3, 3], [5, 7]],
  d7: [[1, 0], [3, 4], [5, 7], [7, 10]],
};

// deg: Stufe (0 = Tonika), rs: Halbtöne des Grundtons über der Tonika, bass: welcher Akkordton im Bass liegt
const FUNCS = {
  maj: {
    T: { deg: 0, rs: 0, q: 'dur', roman: 'I', name: 'Tonika' },
    S: { deg: 3, rs: 5, q: 'dur', roman: 'IV', name: 'Subdominante' },
    D: { deg: 4, rs: 7, q: 'dur', roman: 'V', name: 'Dominante' },
    D7: { deg: 4, rs: 7, q: 'd7', roman: 'V7', name: 'Dominantseptakkord' },
    Tp: { deg: 5, rs: 9, q: 'moll', roman: 'vi', name: 'Tonikaparallele' },
    Sp: { deg: 1, rs: 2, q: 'moll', roman: 'ii', name: 'Subdominantparallele' },
    Dp: { deg: 2, rs: 4, q: 'moll', roman: 'iii', name: 'Dominantparallele' },
    s: { deg: 3, rs: 5, q: 'moll', roman: 'iv', name: 'Moll-Subdominante' },
    DD: { deg: 1, rs: 2, q: 'd7', roman: 'V7/V', name: 'Doppeldominante' },
    sN: { deg: 1, rs: 1, q: 'dur', bass: 1, roman: '♭II⁶', name: 'Neapolitaner' },
    K64: { deg: 0, rs: 0, q: 'dur', bass: 2, roman: 'I⁶₄', name: 'Quartsextvorhalt', label: 'D⁶₄' },
  },
  min: {
    t: { deg: 0, rs: 0, q: 'moll', roman: 'i', name: 'Tonika' },
    s: { deg: 3, rs: 5, q: 'moll', roman: 'iv', name: 'Subdominante' },
    D: { deg: 4, rs: 7, q: 'dur', roman: 'V', name: 'Dominante' },
    D7: { deg: 4, rs: 7, q: 'd7', roman: 'V7', name: 'Dominantseptakkord' },
    tG: { deg: 5, rs: 8, q: 'dur', roman: 'VI', name: 'Tonikagegenklang' },
    tP: { deg: 2, rs: 3, q: 'dur', roman: 'III', name: 'Tonikaparallele' },
    DD: { deg: 1, rs: 2, q: 'd7', roman: 'V7/V', name: 'Doppeldominante' },
    sN: { deg: 1, rs: 1, q: 'dur', bass: 1, roman: '♭II⁶', name: 'Neapolitaner' },
    K64: { deg: 0, rs: 0, q: 'moll', bass: 2, roman: 'i⁶₄', name: 'Quartsextvorhalt', label: 'D⁶₄' },
  },
};
const fdef = (key, id) => FUNCS[key.minor ? 'min' : 'maj'][id];
const flabel = (id) => FUNCS.maj[id]?.label || FUNCS.min[id]?.label || id;
const fname = (id) => (FUNCS.maj[id] || FUNCS.min[id]).name;
const tonicOf = (key) => (key.minor ? 't' : 'T');

// Welche Funktion auf welche folgen darf (übliche Fortschreitungen)
const ROLE = { t: 'T', tG: 'Tp', tP: 'Dp' };
const NEXT = {
  T: ['S', 's', 'Sp', 'Tp', 'D', 'D7', 'Dp', 'DD', 'sN'],
  Tp: ['S', 's', 'Sp', 'D', 'D7', 'DD', 'sN'],
  Dp: ['Tp', 'S', 's'],
  Sp: ['D', 'D7', 'DD', 'K64'],
  S: ['D', 'D7', 'T', 'K64', 'Sp', 'DD'],
  s: ['D', 'D7', 'T', 'K64', 'DD', 'sN'],
  DD: ['D', 'D7', 'K64'],
  sN: ['D', 'D7', 'K64'],
  K64: ['D', 'D7'],
  D: ['T', 'Tp'],
  D7: ['T', 'Tp'],
};
const role = (id) => ROLE[id] || id;
const succ = (id, pool) => pool.filter((x) => NEXT[role(id)].includes(role(x)));

// Zufallsweg durch die Funktionen: n Akkorde ab start, der letzte erfüllt lastOk
function walk(pool, start, n, lastOk) {
  for (let t = 0; t < 300; t++) {
    const p = [start];
    let ok = true;
    for (let i = 1; i < n; i++) {
      let c = succ(p[i - 1], pool);
      if (i === n - 1) c = c.filter(lastOk);
      if (!c.length) { ok = false; break; }
      p.push(pick(c));
    }
    if (ok && (n > 1 || lastOk(start))) return p;
  }
  return null;
}

// ---------- Schlussarten ----------
const CAD = {
  ganz: { name: 'Ganzschluss', short: 'Ganzschluss (D – T)', how: 'Die Dominante löst sich in die Tonika auf. Klingt abgeschlossen.' },
  halb: { name: 'Halbschluss', short: 'Halbschluss (endet auf D)', how: 'Die Phrase bleibt auf der Dominante stehen. Klingt wie ein Komma.' },
  plagal: { name: 'Plagalschluss', short: 'Plagalschluss (S – T)', how: 'Subdominante zur Tonika, das „Amen" im Kirchenlied.' },
  trug: { name: 'Trugschluss', short: 'Trugschluss (D – Tp)', how: 'Statt der Tonika kommt die Tonikaparallele (in Moll der Gegenklang). Klingt überraschend.' },
};

function cadTail(cad, key, pool) {
  const t = tonicOf(key);
  const dom = pool.includes('D7') && Math.random() < 0.4 ? 'D7' : 'D';
  if (cad === 'ganz') return [dom, t];
  if (cad === 'halb') return ['D'];
  if (cad === 'plagal') return [key.minor ? 's' : 'S', t];
  return [dom, key.minor ? 'tG' : 'Tp'];
}

function cadPhrase(cad, key, pool, len) {
  const tail = cadTail(cad, key, pool);
  // Nicht jede Länge ist mit jedem Akkordvorrat möglich, dann eine benachbarte Länge nehmen
  for (const L of [len, len + 1, len - 1, len + 2]) {
    if (L - tail.length < 1) continue;
    const pre = walk(pool, tonicOf(key), L - tail.length, (x) => NEXT[role(x)].includes(role(tail[0])));
    if (pre) return { prog: [...pre, ...tail], pre };
  }
  const pre = [tonicOf(key)];
  return { prog: [...pre, ...tail], pre };
}

// ---------- Akkorde setzen ----------
function chordTones(key, id) {
  const f = fdef(key, id);
  const root = buildInterval(key.tonic, f.deg + 1, f.rs);
  const tones = QUAL[f.q].map(([n, s]) => buildInterval(root, n, s));
  return { f, root, tones, bass: tones[f.bass || 0] };
}

// Nächstgelegene Lage eines Tons im Bereich [lo, hi]
function placeNear(n, lo, hi, near) {
  let best = null;
  for (let o = 1; o <= 6; o++) {
    const c = { ...n, o };
    const m = midiOf(c);
    if (m < lo || m > hi) continue;
    if (!best || Math.abs(m - near) < Math.abs(midiOf(best) - near)) best = c;
  }
  return best || atMidi(n, Math.max(lo, Math.min(hi, near)));
}

// Vierstimmiger Satz: Bass plus drei Oberstimmen in enger Lage, möglichst kleine Bewegungen
function voiceProg(key, prog) {
  let prevUp = null;
  let prevBass = 48;
  return prog.map((id) => {
    const { tones, bass } = chordTones(key, id);
    const b = placeNear(bass, 40, 55, prevBass);
    prevBass = midiOf(b);
    const up = tones.length === 4 ? [tones[0], tones[1], tones[3]] : tones.slice(0, 3);
    const cands = [];
    for (let r = 0; r < 3; r++) {
      const order = [up[r], up[(r + 1) % 3], up[(r + 2) % 3]];
      for (let o = 3; o <= 5; o++) {
        const v = [{ ...order[0], o }];
        for (let i = 1; i < 3; i++) {
          const n = { ...order[i], o: v[i - 1].o };
          while (midiOf(n) <= midiOf(v[i - 1])) n.o++;
          v.push(n);
        }
        const ms = v.map(midiOf);
        if (ms[0] < 57 || ms[2] > 79 || ms[0] <= prevBass) continue;
        const cost = prevUp ? ms.reduce((s, m, i) => s + Math.abs(m - prevUp[i]), 0) : Math.abs(ms[2] - 72);
        cands.push({ v, ms, cost: cost + Math.random() * 0.5 });
      }
    }
    cands.sort((x, y) => x.cost - y.cost);
    const c = cands[0];
    prevUp = c.ms;
    return [b, ...c.v];
  });
}

function playVoiced(voiced, gap = 1.05) {
  const ev = voiced.map((ch, i) => ({ midis: ch.map(midiOf), at: i * gap, dur: i === voiced.length - 1 ? 2 : gap }));
  return playSequence(ev, 0.62);
}

function pickKey(lesson) {
  const minor = Math.random() < (lesson.minor || 0);
  return randomKey(minor, lesson.sig ?? 2);
}

const poolFor = (lesson, key) => (key.minor ? lesson.poolMin : lesson.pool);

// ---------- Lernpfad ----------
const SECTIONS = [
  {
    title: 'Schlüsse', desc: 'Wie endet die Phrase?',
    lessons: [
      { id: 'e1', kind: 'end', title: 'Ganzschluss und Halbschluss', items: ['ganz', 'halb'], newItems: ['ganz', 'halb'], pool: ['T', 'S', 'D'], len: [4], sig: 1 },
      { id: 'e2', kind: 'end', title: 'Dazu: Plagalschluss', items: ['ganz', 'halb', 'plagal'], newItems: ['plagal'], pool: ['T', 'S', 'D'], len: [4, 5], sig: 2 },
      { id: 'e3', kind: 'end', title: 'Dazu: Trugschluss', items: ['ganz', 'halb', 'plagal', 'trug'], newItems: ['trug'], pool: ['T', 'S', 'D', 'Tp'], len: [4, 5], sig: 2 },
      { id: 'e4', kind: 'end', title: 'Schlüsse in Moll', items: ['ganz', 'halb', 'plagal', 'trug'], minor: 1, poolMin: ['t', 's', 'D', 'tG'], len: [4, 5], sig: 2 },
      { id: 'e5', kind: 'end', title: 'Schlüsse in Dur und Moll', items: ['ganz', 'halb', 'plagal', 'trug'], minor: 0.5, pool: ['T', 'S', 'Sp', 'D', 'D7', 'Tp'], poolMin: ['t', 's', 'D', 'D7', 'tG'], len: [5], sig: 4 },
    ],
  },
  {
    title: 'Funktionen', desc: 'Jeden Akkord der Kadenz bestimmen.',
    lessons: [
      { id: 'f1', kind: 'func', title: 'Tonika, Subdominante, Dominante', newItems: ['T', 'S', 'D'], pool: ['T', 'S', 'D'], len: [4], sig: 1 },
      { id: 'f2', kind: 'func', title: 'Dazu: Dominantseptakkord', newItems: ['D7'], pool: ['T', 'S', 'D', 'D7'], len: [4], sig: 2 },
      { id: 'f3', kind: 'func', title: 'Dazu: Tonikaparallele', newItems: ['Tp'], pool: ['T', 'S', 'D', 'D7', 'Tp'], len: [4, 5], sig: 2 },
      { id: 'f4', kind: 'func', title: 'Dazu: Subdominantparallele', newItems: ['Sp'], pool: ['T', 'S', 'Sp', 'D', 'D7', 'Tp'], len: [5], sig: 3 },
      { id: 'f5', kind: 'func', title: 'Moll: t, s und D', newItems: ['t', 's'], minor: 1, poolMin: ['t', 's', 'D', 'D7'], len: [4], sig: 2 },
      { id: 'f6', kind: 'func', title: 'Moll: Gegenklang und Parallele', newItems: ['tG', 'tP'], minor: 1, poolMin: ['t', 's', 'D', 'D7', 'tG', 'tP'], len: [5], sig: 3 },
    ],
  },
  {
    title: 'Profi', desc: 'Vorhalte, Zwischendominanten und Neapolitaner.',
    lessons: [
      { id: 'p1', kind: 'func', title: 'Quartsextvorhalt', newItems: ['K64'], pool: ['T', 'S', 'Sp', 'D', 'D7', 'Tp', 'K64'], len: [5], sig: 3 },
      { id: 'p2', kind: 'func', title: 'Doppeldominante', newItems: ['DD'], pool: ['T', 'S', 'Sp', 'D', 'D7', 'Tp', 'K64', 'DD'], len: [5], sig: 3 },
      { id: 'p3', kind: 'func', title: 'Dominantparallele und Moll-Subdominante', newItems: ['Dp', 's'], pool: ['T', 'S', 's', 'Sp', 'Dp', 'D', 'D7', 'Tp', 'DD'], len: [5, 6], sig: 4 },
      { id: 'p4', kind: 'func', title: 'Neapolitaner', newItems: ['sN'], minor: 0.5, pool: ['T', 'S', 'Sp', 'D', 'D7', 'Tp', 'K64', 'sN'], poolMin: ['t', 's', 'D', 'D7', 'tG', 'K64', 'sN'], len: [5], sig: 4 },
      { id: 'p5', kind: 'func', title: 'Meisterprüfung', minor: 0.5, pool: ['T', 'S', 's', 'Sp', 'Dp', 'D', 'D7', 'Tp', 'DD', 'K64', 'sN'], poolMin: ['t', 's', 'D', 'D7', 'tG', 'tP', 'DD', 'K64', 'sN'], len: [6], sig: 5 },
    ],
  },
];
for (const s of SECTIONS) for (const l of s.lessons) {
  l.pool = l.pool || [];
  l.poolMin = l.poolMin || [];
  if (l.kind === 'func' && !l.items) l.items = [...new Set([...l.pool, ...l.poolMin])].filter((x) => x !== 'T' && x !== 't');
  if (!l.desc) {
    const mode = l.minor === 1 ? 'in Moll' : l.minor ? 'in Dur und Moll' : 'in Dur';
    l.desc = l.kind === 'end'
      ? `${l.items.map((x) => CAD[x].name).join(', ')} ${mode}.`
      : `${[...new Set([...l.pool, ...l.poolMin])].map(flabel).join(', ')} ${mode}.`;
  }
}
const LESSONS = SECTIONS.flatMap((s) => s.lessons);

// ---------- Aufgaben ----------
function makeTask(lesson, pickItem) {
  const len = pick(lesson.len);
  if (lesson.kind === 'end') {
    const cad = pickItem(lesson.items);
    let key = pickKey(lesson);
    let pool = poolFor(lesson, key);
    if (!pool.length) { key = randomKey(!key.minor, lesson.sig ?? 2); pool = poolFor(lesson, key); }
    const { prog, pre } = cadPhrase(cad, key, pool, len);
    return { key, prog, pre, pool, item: cad, cad };
  }
  // Funktionen: Fokus-Akkord wählen, dann passende Tonart und Kadenz
  const focus = pickItem(lesson.items);
  const inMaj = lesson.pool.includes(focus);
  const inMin = lesson.poolMin.includes(focus);
  let minor = inMaj && inMin ? Math.random() < (lesson.minor || 0) : inMin;
  if (!lesson.pool.length) minor = true;
  const key = randomKey(minor, lesson.sig ?? 2);
  const pool = poolFor(lesson, key);
  const t = tonicOf(key);
  let prog = null;
  for (let i = 0; i < 40 && !prog; i++) {
    const p = walk(pool, t, len - 1, (x) => NEXT[role(x)].includes(role(t)));
    if (p && (p.includes(focus) || i > 30)) prog = [...p, t];
  }
  return { key, prog: prog || [t, pool.includes('D') ? 'D' : pool[1], t], pool, item: focus };
}

function progText(key, prog) {
  return `${keyName(key)}: ${prog.map(flabel).join(' – ')}`;
}

function answerSpec(lesson, task) {
  if (lesson.kind === 'end') {
    return {
      type: 'choice',
      options: lesson.items.map((x) => ({ id: x, label: (task.key.minor && x === 'trug' ? 'Trugschluss (D – tG)' : CAD[x].short).replace(/ – /g, '\u00a0–\u00a0').replace(/\(endet auf/, '(endet\u00a0auf') })),
      answer: task.cad,
    };
  }
  const opts = task.pool.map((x) => ({ id: x, label: flabel(x), sub: fdef(task.key, x).roman }));
  return {
    type: 'sequence',
    given: [flabel(task.prog[0])],
    slots: task.prog.length - 1,
    options: opts,
    answer: task.prog.slice(1),
    labelFor: (ids) => ids.map(flabel).join(' – '),
  };
}

function revealNote(lesson, task) {
  if (lesson.kind === 'end') return CAD[task.cad].how;
  const odd = [...new Set(task.prog)].filter((x) => !['T', 't', 'S', 's', 'D'].includes(x));
  return odd.length ? odd.map((x) => `${flabel(x)} = ${fname(x)} (${fdef(task.key, x).roman})`).join(' · ') : '';
}

function makeHear(lesson, pickItem) {
  const task = makeTask(lesson, pickItem);
  const voiced = voiceProg(task.key, task.prog);
  return {
    item: task.item,
    prompt: lesson.kind === 'end' ? 'Welcher Schluss ist das?' : 'Welche Funktionen hörst du?',
    sub: lesson.kind === 'end' ? `${keyName(task.key)}, ${task.prog.length} Akkorde` : `${keyName(task.key)}. Der erste Akkord ist die Tonika.`,
    autoplay: true,
    play: () => playVoiced(voiced),
    ...answerSpec(lesson, task),
    reveal: { groups: voiced, grand: true, text: progText(task.key, task.prog), note: revealNote(lesson, task) },
    compare: lesson.kind === 'end'
      ? (id) => playVoiced(voiceProg(task.key, [...task.pre, ...cadTail(id, task.key, task.pool)]))
      : null,
  };
}

function makeRead(lesson, pickItem) {
  const task = makeTask(lesson, pickItem);
  const voiced = voiceProg(task.key, task.prog);
  return {
    item: task.item,
    prompt: lesson.kind === 'end' ? 'Welcher Schluss steht hier?' : 'Welche Funktionen siehst du?',
    sub: `${keyName(task.key)}. ${lesson.kind === 'end' ? 'Achte auf die letzten beiden Akkorde.' : 'Der erste Akkord ist die Tonika.'}`,
    notation: { groups: voiced, grand: true, wide: true },
    play: () => playVoiced(voiced),
    ...answerSpec(lesson, task),
    reveal: { groups: voiced, grand: true, text: progText(task.key, task.prog), note: revealNote(lesson, task), playOnReveal: true },
  };
}

function makeSing(lesson, pickItem, ctx) {
  const task = makeTask(lesson, pickItem);
  const vr = VOICE_RANGES[ctx.settings.voice] || VOICE_RANGES.mittel;
  const voiced = voiceProg(task.key, task.prog);
  // Basslinie in die Stimmlage legen, Ton für Ton möglichst nah am vorigen
  let near = (vr.lo + vr.hi) / 2 - 3;
  const line = voiced.map((ch) => {
    const n = placeNear(ch[0], vr.lo, vr.hi, near);
    near = midiOf(n);
    return n;
  });
  const targets = line.map(midiOf);
  const tonic = placeNear(task.key.tonic, vr.lo, vr.hi, targets[0]);
  const tm = midiOf(tonic);
  const third = midiOf(buildInterval(tonic, 3, task.key.minor ? 3 : 4));
  const what = lesson.kind === 'end' ? ` (${CAD[task.cad].name})` : '';
  return {
    type: 'sing',
    item: task.item,
    prompt: 'Singe die Basstöne der Kadenz',
    playLabel: 'Tonika hören',
    sub: `${progText(task.key, task.prog)}${what}`,
    notation: { groups: [[line[0]]], clef: targets[0] < 57 ? 'bass' : 'treble' },
    play: () => playSequence([{ midis: [tm, third, tm + 7], at: 0, dur: 1.5 }], 0.7),
    playTarget: () => playSequence(voiced.map((ch, i) => ({ midis: [...ch.slice(1).map(midiOf), targets[i]], at: i * 1.05, dur: 1.05 })), 0.6),
    targetLabel: 'Kadenz hören',
    targets,
    reveal: { groups: line.map((n) => [n]), duration: 'q', text: `Basstöne: ${line.map((n) => nameDe(n)).join(' – ')}` },
  };
}

function intro(lesson) {
  const cMaj = { tonic: { l: 0, a: 0, o: 4 }, minor: false };
  const aMin = { tonic: { l: 5, a: 0, o: 4 }, minor: true };
  if (lesson.kind === 'end') {
    return (lesson.newItems || []).map((cad) => {
      const key = cMaj;
      const tail = cadTail(cad, key, ['D']);
      const pre = { ganz: ['T', 'S'], halb: ['T', 'S'], plagal: ['T', 'D', 'T'], trug: ['T', 'S'] }[cad];
      const prog = [...pre, ...tail];
      const voiced = voiceProg(key, prog);
      return { title: CAD[cad].name, text: `${CAD[cad].how} · ${prog.map(flabel).join(' – ')}`, groups: voiced, grand: true, play: () => playVoiced(voiced) };
    });
  }
  return (lesson.newItems || []).map((id) => {
    const key = FUNCS.maj[id] && !(lesson.minor === 1) ? cMaj : aMin;
    const t = tonicOf(key);
    const prog = id === t ? [t] : id === 'K64' ? [t, 'K64', 'D', t] : [t, id];
    const voiced = voiceProg(key, prog);
    const f = fdef(key, id);
    const names = chordTones(key, id).tones.map((n) => nameDe(n)).join(' – ');
    return {
      title: `${flabel(id)} · ${fname(id)}`,
      text: `Stufe ${f.roman} · in ${keyName(key)}: ${names}${prog.length > 1 ? ` · zu hören nach der Tonika` : ''}`,
      groups: [voiced[prog.indexOf(id)]],
      grand: true,
      play: () => playVoiced(voiced, 0.9),
    };
  });
}

export const cadencesModule = {
  id: 'cadences',
  title: 'Kadenzen',
  icon: 'cadence',
  available: true,
  blurb: 'Schlüsse und Funktionen von T – S – D bis zum Neapolitaner.',
  sections: SECTIONS,
  lessons: LESSONS,
  intro,
  modes: [
    { id: 'hear', title: 'Hören', desc: 'Kadenz vorspielen lassen und bestimmen.' },
    { id: 'read', title: 'Notenschrift', desc: 'Kadenz im Klaviersatz lesen und bestimmen.' },
    { id: 'sing', title: 'Nachsingen', desc: 'Die Basstöne einer Kadenz singen.' },
  ],
  makeQuestion(mode, lesson, pickItem, ctx) {
    if (mode === 'hear') return makeHear(lesson, pickItem);
    if (mode === 'read') return makeRead(lesson, pickItem);
    return makeSing(lesson, pickItem, ctx);
  },
  itemLabel: (id) => (CAD[id] ? CAD[id].name : `${flabel(id)} (${fname(id)})`),
  allItems: [...Object.keys(CAD), 'S', 'D', 'D7', 'Tp', 'Sp', 'Dp', 's', 'tG', 'tP', 'K64', 'DD', 'sN'],
  tasks: () => [
    { id: 'cad-hear-8', group: 'cad-hear', kind: 'correct', module: 'cadences', mode: 'hear', target: 8, title: '8 Kadenzen richtig nach Gehör bestimmen' },
    { id: 'cad-read-6', group: 'cad-read', kind: 'correct', module: 'cadences', mode: 'read', target: 6, title: '6 Kadenzen in Noten richtig bestimmen' },
    { id: 'cad-sing-3', group: 'cad-sing', kind: 'correct', module: 'cadences', mode: 'sing', target: 3, title: '3 Basslinien von Kadenzen sauber singen' },
    { id: 'cad-sess-80', group: 'cad-sess', kind: 'session', module: 'cadences', minScore: 0.8, target: 1, title: 'Eine Kadenz-Lektion bestehen (mindestens 80 %)' },
  ],
};
