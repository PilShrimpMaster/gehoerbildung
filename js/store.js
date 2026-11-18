// Speicherung von Fortschritt, Streak, Tagesaufgaben und Einstellungen (lokal im Gerät).
const KEY = 'gbt-state-v1';

const DEFAULT = {
  version: 1,
  created: null,
  settings: { voice: 'mittel', dailyGoal: 20, tolerance: 40, autoplay: true },
  days: {}, // 'YYYY-MM-DD' -> { answered, correct, tasks: { id: progress } }
  stats: {}, // 'modul:modus:item' -> { n, c, recent: [] }
  levels: {}, // 'modul:modus' -> Stufe
  levelStats: {}, // 'modul:modus:lektion' -> { n, c, recent: [] }
  lessons: {}, // 'modul:modus:lektion' -> { best, stars, plays }
  lastMode: {}, // modul -> zuletzt gewählter Modus
  sessions: 0,
  bestStreak: 0,
};

let state = load();
const listeners = new Set();

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) {
      const s = JSON.parse(raw);
      return { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
    }
  } catch (e) { /* ignorieren */ }
  const s = structuredClone(DEFAULT);
  s.created = todayKey();
  return s;
}

function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch (e) { /* Speicher voll oder gesperrt */ }
  listeners.forEach((f) => f(state));
}

export function onChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

export function getState() {
  return state;
}

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(key, delta) {
  const [y, m, d] = key.split('-').map(Number);
  const dt = new Date(y, m - 1, d + delta);
  return todayKey(dt);
}

export function getDay(key = todayKey()) {
  if (!state.days[key]) state.days[key] = { answered: 0, correct: 0, tasks: {} };
  return state.days[key];
}

export function settings() {
  return state.settings;
}

export function setSetting(k, v) {
  state.settings[k] = v;
  save();
}

export function getLevel(moduleId, mode) {
  return state.levels[`${moduleId}:${mode}`] || 1;
}

export function setLevel(moduleId, mode, lvl) {
  state.levels[`${moduleId}:${mode}`] = lvl;
  save();
}

function bump(map, key, correct) {
  const s = map[key] || (map[key] = { n: 0, c: 0, recent: [] });
  s.n++;
  if (correct) s.c++;
  s.recent.push(correct ? 1 : 0);
  if (s.recent.length > 20) s.recent.shift();
  return s;
}

export function itemStat(moduleId, mode, item) {
  return state.stats[`${moduleId}:${mode}:${item}`] || { n: 0, c: 0, recent: [] };
}

export function levelStat(moduleId, mode, lvl) {
  return state.levelStats[`${moduleId}:${mode}:${lvl}`] || { n: 0, c: 0, recent: [] };
}

// ---------- Lernpfad ----------
export const PASS = 0.8;

export function lessonResult(moduleId, mode, lessonId) {
  return (state.lessons || {})[`${moduleId}:${mode}:${lessonId}`] || { best: 0, stars: 0, plays: 0 };
}

export function starsFor(score) {
  if (score >= 1) return 3;
  if (score >= 0.9) return 2;
  if (score >= PASS) return 1;
  return 0;
}

// Speichert eine Lektionsrunde; gibt die neue Sternzahl zurück
export function recordLesson(moduleId, mode, lessonId, score) {
  if (!state.lessons) state.lessons = {};
  const k = `${moduleId}:${mode}:${lessonId}`;
  const r = state.lessons[k] || { best: 0, stars: 0, plays: 0 };
  r.plays++;
  r.best = Math.max(r.best, score);
  r.stars = Math.max(r.stars, starsFor(score));
  state.lessons[k] = r;
  save();
  return r;
}

// Eine Lektion ist frei, wenn die vorige bestanden ist oder eine spätere schon bestanden wurde
export function lessonUnlocked(moduleId, mode, lessons, idx) {
  if (idx === 0) return true;
  if (lessonResult(moduleId, mode, lessons[idx - 1].id).stars > 0) return true;
  for (let i = idx; i < lessons.length; i++) if (lessonResult(moduleId, mode, lessons[i].id).stars > 0) return true;
  return false;
}

// Erste noch nicht bestandene, aber freie Lektion (sonst die letzte)
export function currentLesson(moduleId, mode, lessons) {
  let lastPassed = -1;
  lessons.forEach((l, i) => { if (lessonResult(moduleId, mode, l.id).stars > 0) lastPassed = i; });
  for (let i = lastPassed + 1; i < lessons.length; i++) {
    if (lessonResult(moduleId, mode, lessons[i].id).stars === 0) return { lesson: lessons[i], idx: i };
  }
  return { lesson: lessons[lessons.length - 1], idx: lessons.length - 1 };
}

export function getLastMode(moduleId) {
  return (state.lastMode || {})[moduleId] || 'hear';
}

export function setLastMode(moduleId, mode) {
  if (!state.lastMode) state.lastMode = {};
  state.lastMode[moduleId] = mode;
  save();
}

// Ergebnis einer einzelnen Aufgabe speichern
export function recordAnswer({ module, mode, item, correct, level }) {
  bump(state.stats, `${module}:${mode}:${item}`, correct);
  bump(state.levelStats, `${module}:${mode}:${level}`, correct);
  const day = getDay();
  day.answered++;
  if (correct) day.correct++;
  for (const t of dailyTasks()) {
    if (t.kind === 'correct' && correct && t.module === module && (!t.mode || t.mode === mode)) {
      day.tasks[t.id] = Math.min(t.target, (day.tasks[t.id] || 0) + 1);
    }
  }
  const st = streak();
  if (st > state.bestStreak) state.bestStreak = st;
  save();
}

export function recordSession({ module, mode, correct, total }) {
  state.sessions++;
  const day = getDay();
  for (const t of dailyTasks()) {
    if (t.kind === 'session' && t.module === module && total > 0 && correct / total >= t.minScore) {
      day.tasks[t.id] = Math.min(t.target, (day.tasks[t.id] || 0) + 1);
    }
  }
  save();
}

export function goalMet(key) {
  const d = state.days[key];
  return !!d && d.answered >= state.settings.dailyGoal;
}

// Tage in Folge, an denen das Tagesziel erreicht wurde (heute zählt mit, sobald erreicht)
export function streak() {
  let key = todayKey();
  let n = 0;
  if (!goalMet(key)) key = addDays(key, -1);
  while (goalMet(key)) {
    n++;
    key = addDays(key, -1);
  }
  return n;
}

export function lastDays(count) {
  const out = [];
  let key = todayKey();
  for (let i = 0; i < count; i++) {
    out.unshift({ key, met: goalMet(key), answered: state.days[key]?.answered || 0 });
    key = addDays(key, -1);
  }
  return out;
}

// ---------- Tagesaufgaben ----------
// Werden aus dem Datum erzeugt, damit sie über den Tag hinweg gleich bleiben.
let taskProvider = () => [];
export function setTaskProvider(f) {
  taskProvider = f;
}

function seeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

let cachedTasks = { key: null, tasks: [] };
export function dailyTasks() {
  const key = todayKey();
  if (cachedTasks.key === key) return cachedTasks.tasks;
  const seed = Number(key.replace(/-/g, ''));
  const rnd = seeded(seed);
  const pool = taskProvider(state);
  const chosen = [];
  const used = new Set();
  const pool2 = pool.slice();
  while (chosen.length < 3 && pool2.length) {
    const i = Math.floor(rnd() * pool2.length);
    const t = pool2.splice(i, 1)[0];
    if (used.has(t.group)) continue;
    used.add(t.group);
    chosen.push(t);
  }
  cachedTasks = { key, tasks: chosen };
  return chosen;
}

export function taskProgress(t) {
  return getDay().tasks[t.id] || 0;
}

// ---------- Sicherung ----------
export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const s = JSON.parse(json);
  if (!s || s.version !== 1) throw new Error('Unbekanntes Format');
  state = { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
  cachedTasks = { key: null, tasks: [] };
  save();
}

export function resetAll() {
  state = structuredClone(DEFAULT);
  state.created = todayKey();
  cachedTasks = { key: null, tasks: [] };
  save();
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) { /* ignorieren */ }
}
