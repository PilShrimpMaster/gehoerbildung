// Musiktheorie: Noten, Intervalle, deutsche Notennamen.
// Eine Note ist { l: Stammton 0..6 (C D E F G A H), a: Vorzeichen -2..2, o: Oktave (C4 = eingestrichenes c) }.

export const LETTER_SEMIS = [0, 2, 4, 5, 7, 9, 11];
const LETTERS_EN = ['c', 'd', 'e', 'f', 'g', 'a', 'b'];
const LETTERS_DE = ['C', 'D', 'E', 'F', 'G', 'A', 'H'];

export function midiOf(n) {
  return 12 * (n.o + 1) + LETTER_SEMIS[n.l] + n.a;
}

export function freqOfMidi(m) {
  return 440 * Math.pow(2, (m - 69) / 12);
}

export function midiOfFreq(f) {
  return 69 + 12 * Math.log2(f / 440);
}

// Deutscher Notenname, z. B. Cis, Es, B, H, Fisis, Heses.
export function nameDe(n, withOctave = false) {
  let s;
  if (n.l === 6 && n.a === -1) s = 'B';
  else if (n.l === 6 && n.a === -2) s = 'Heses';
  else {
    const base = LETTERS_DE[n.l];
    if (n.a > 0) s = base + 'is'.repeat(n.a);
    else if (n.a < 0) {
      // E und A ziehen das e zusammen: Es, As, Eses, Asas
      if (n.l === 2 || n.l === 5) s = base + 's' + (n.a === -2 ? (n.l === 2 ? 'es' : 'as') : '');
      else s = base + 'es'.repeat(-n.a);
    } else s = base;
  }
  if (!withOctave) return s;
  return s + octaveMark(n.o);
}

function octaveMark(o) {
  // Helmholtz-ähnlich, aber gut lesbar: c⁴ = c' -> wir schreiben z. B. "C4"
  return String(o);
}

// VexFlow-Schlüssel, z. B. "c#/4"
export function vexKey(n) {
  const acc = n.a === 0 ? '' : n.a > 0 ? '#'.repeat(n.a) : 'b'.repeat(-n.a);
  return `${LETTERS_EN[n.l]}${acc}/${n.o}`;
}

export function vexAcc(n) {
  if (n.a === 0) return null;
  return n.a > 0 ? '#'.repeat(n.a) : 'b'.repeat(-n.a);
}

// Diatonischer Index (für Abstände in Stammtönen)
export function diaIndex(n) {
  return n.o * 7 + n.l;
}

export function fromDia(d, a) {
  return { l: ((d % 7) + 7) % 7, o: Math.floor(d / 7), a };
}

// ---------- Intervalle ----------
// num: Intervallzahl (1 = Prime, 8 = Oktave, ...), semis: Halbtöne.
export const INTERVALS = [
  { id: 'r1', num: 1, semis: 0, name: 'Prime', short: 'P1' },
  { id: 'k2', num: 2, semis: 1, name: 'kleine Sekunde', short: 'k2' },
  { id: 'g2', num: 2, semis: 2, name: 'große Sekunde', short: 'g2' },
  { id: 'k3', num: 3, semis: 3, name: 'kleine Terz', short: 'k3' },
  { id: 'g3', num: 3, semis: 4, name: 'große Terz', short: 'g3' },
  { id: 'r4', num: 4, semis: 5, name: 'reine Quarte', short: 'r4' },
  { id: 'tt', num: 4, semis: 6, name: 'Tritonus', short: 'TT' },
  { id: 'r5', num: 5, semis: 7, name: 'reine Quinte', short: 'r5' },
  { id: 'k6', num: 6, semis: 8, name: 'kleine Sexte', short: 'k6' },
  { id: 'g6', num: 6, semis: 9, name: 'große Sexte', short: 'g6' },
  { id: 'k7', num: 7, semis: 10, name: 'kleine Septime', short: 'k7' },
  { id: 'g7', num: 7, semis: 11, name: 'große Septime', short: 'g7' },
  { id: 'r8', num: 8, semis: 12, name: 'Oktave', short: 'r8' },
  { id: 'k9', num: 9, semis: 13, name: 'kleine None', short: 'k9' },
  { id: 'g9', num: 9, semis: 14, name: 'große None', short: 'g9' },
  { id: 'k10', num: 10, semis: 15, name: 'kleine Dezime', short: 'k10' },
  { id: 'g10', num: 10, semis: 16, name: 'große Dezime', short: 'g10' },
  { id: 'r11', num: 11, semis: 17, name: 'Undezime', short: 'r11' },
  { id: 'r12', num: 12, semis: 19, name: 'Duodezime', short: 'r12' },
];
export const INTERVAL_BY_ID = Object.fromEntries(INTERVALS.map((i) => [i.id, i]));

// Alterierte Intervalle für Notenschrift auf Profi-Niveau
export const ALTERED = [
  { id: 'ue1', num: 1, semis: 1, name: 'übermäßige Prime' },
  { id: 'ue2', num: 2, semis: 3, name: 'übermäßige Sekunde' },
  { id: 'v3', num: 3, semis: 2, name: 'verminderte Terz' },
  { id: 'v4', num: 4, semis: 4, name: 'verminderte Quarte' },
  { id: 'ue4', num: 4, semis: 6, name: 'übermäßige Quarte' },
  { id: 'v5', num: 5, semis: 6, name: 'verminderte Quinte' },
  { id: 'ue5', num: 5, semis: 8, name: 'übermäßige Quinte' },
  { id: 'v6', num: 6, semis: 7, name: 'verminderte Sexte' },
  { id: 'ue6', num: 6, semis: 10, name: 'übermäßige Sexte' },
  { id: 'v7', num: 7, semis: 9, name: 'verminderte Septime' },
  { id: 'v8', num: 8, semis: 11, name: 'verminderte Oktave' },
];

export const NUM_NAMES = {
  1: 'Prime', 2: 'Sekunde', 3: 'Terz', 4: 'Quarte', 5: 'Quinte', 6: 'Sexte', 7: 'Septime', 8: 'Oktave',
  9: 'None', 10: 'Dezime', 11: 'Undezime', 12: 'Duodezime',
};

const PERFECT_NUMS = new Set([1, 4, 5, 8, 11, 12]);

// Grund-Halbtonzahl für "groß" bzw. "rein" pro Intervallzahl
function baseSemis(num) {
  const simple = ((num - 1) % 7) + 1;
  const oct = Math.floor((num - 1) / 7);
  const major = { 1: 0, 2: 2, 3: 4, 4: 5, 5: 7, 6: 9, 7: 11 }[simple];
  return major + 12 * oct;
}

// Benennt das Intervall zwischen zwei geschriebenen Noten (aufwärts gemessen).
export function nameInterval(low, high) {
  const num = diaIndex(high) - diaIndex(low) + 1;
  const semis = midiOf(high) - midiOf(low);
  const diff = semis - baseSemis(num);
  const simple = ((num - 1) % 7) + 1;
  const perfect = PERFECT_NUMS.has(simple);
  let quality;
  if (perfect) {
    quality = { '-2': 'doppelt vermindert', '-1': 'vermindert', 0: 'rein', 1: 'übermäßig', 2: 'doppelt übermäßig' }[diff];
  } else {
    quality = { '-3': 'doppelt vermindert', '-2': 'vermindert', '-1': 'klein', 0: 'groß', 1: 'übermäßig', 2: 'doppelt übermäßig' }[diff];
  }
  return { num, semis, quality: quality || '?', label: qualityLabel(quality, num) };
}

export function qualityLabel(quality, num) {
  const n = NUM_NAMES[num] || `${num}.`;
  if (num === 1 && quality === 'rein') return 'Prime';
  if (num === 8 && quality === 'rein') return 'Oktave';
  if (num === 11 && quality === 'rein') return 'Undezime';
  if (num === 12 && quality === 'rein') return 'Duodezime';
  const adj = {
    klein: 'kleine', groß: 'große', rein: 'reine', vermindert: 'verminderte', übermäßig: 'übermäßige',
    'doppelt vermindert': 'doppelt verminderte', 'doppelt übermäßig': 'doppelt übermäßige',
  }[quality];
  return `${adj} ${n}`;
}

// Baut die obere (oder untere) Note eines Intervalls mit korrekter Schreibweise.
export function buildInterval(root, num, semis, down = false) {
  const d = diaIndex(root) + (down ? -(num - 1) : num - 1);
  const target = midiOf(root) + (down ? -semis : semis);
  const n = fromDia(d, 0);
  n.a = target - midiOf(n);
  return n;
}

// ---------- Zufall ----------
export function rand(n) {
  return Math.floor(Math.random() * n);
}
export function pick(arr) {
  return arr[rand(arr.length)];
}
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = rand(i + 1);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
// Gewichtete Auswahl: items [{item, w}]
export function weightedPick(items) {
  const total = items.reduce((s, x) => s + x.w, 0);
  let r = Math.random() * total;
  for (const x of items) {
    r -= x.w;
    if (r <= 0) return x.item;
  }
  return items[items.length - 1].item;
}

// Zufällige Note mit Stammton aus Liste, Vorzeichen aus Liste, MIDI-Bereich [lo, hi]
export function randomNote({ accs = [0], lo = 55, hi = 72 } = {}) {
  for (let t = 0; t < 200; t++) {
    const n = { l: rand(7), a: pick(accs), o: 2 + rand(4) };
    // keine exotischen Töne wie Ces, Fes, Eis, His als Grundton
    if (n.a === -1 && (n.l === 0 || n.l === 3)) continue;
    if (n.a === 1 && (n.l === 2 || n.l === 6)) continue;
    const m = midiOf(n);
    if (m >= lo && m <= hi) return n;
  }
  return { l: 0, a: 0, o: 4 };
}

export function isReasonableSpelling(n) {
  return Math.abs(n.a) <= (n.a < 0 ? 2 : 2);
}
