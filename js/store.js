// Speicherung von Fortschritt, Streak, Tagesaufgaben und Einstellungen.
// Jedes Gerät schreibt nur seinen eigenen Teil ("local"). Die Teile anderer Geräte kommen über die
// Synchronisation dazu ("others"). Gelesen wird immer die zusammengeführte Sicht ("view").
const KEY = 'gbt-state-v1';
const OTHERS_KEY = 'gbt-others-v1';

const DEFAULT = {
  version: 1,
  created: null,
  deviceId: null,
  deviceName: '',
  settings: { voice: 'mittel', dailyGoal: 20, tolerance: 40, autoplay: true },
  settingsAt: 0, // Zeitpunkt der letzten Änderung der Einstellungen (für den Abgleich)
  resetAt: 0, // Zeitpunkt des letzten "Alles zurücksetzen" (gilt für alle Geräte)
  updatedAt: 0,
  days: {}, // 'YYYY-MM-DD' -> { answered, correct, tasks: { id: progress } }
  stats: {}, // 'modul:modus:item' -> { n, c, recent: [] }
  levels: {},
  levelStats: {}, // 'modul:modus:lektion' -> { n, c, recent: [] }
  lessons: {}, // 'modul:modus:lektion' -> { best, stars, plays }
  lastMode: {}, // modul -> zuletzt gewählter Modus
  sessions: 0,
  bestStreak: 0,
};

const listeners = new Set();
let state = load();
let others = loadOthers(); // { deviceId: Teilzustand }
let view = merge();

function normalize(s) {
  const out = { ...structuredClone(DEFAULT), ...s, settings: { ...DEFAULT.settings, ...(s.settings || {}) } };
  if (!out.deviceId) out.deviceId = newId();
  if (!out.deviceName) out.deviceName = guessDeviceName();
  return out;
}

function newId() {
  try { return crypto.randomUUID(); } catch (e) { return 'd' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10); }
}

function guessDeviceName() {
  const ua = navigator.userAgent || '';
  if (/iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)) return 'iPad';
  if (/iPhone/.test(ua)) return 'iPhone';
  if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android-Handy' : 'Android-Tablet';
  if (/Windows/.test(ua)) return 'Windows-PC';
  if (/Macintosh/.test(ua)) return 'Mac';
  return 'Gerät';
}

function load() {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch (e) { /* ignorieren */ }
  const s = normalize({});
  s.created = todayKey();
  return s;
}

function loadOthers() {
  try {
    const raw = localStorage.getItem(OTHERS_KEY);
    if (raw) return JSON.parse(raw) || {};
  } catch (e) { /* ignorieren */ }
  return {};
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    localStorage.setItem(OTHERS_KEY, JSON.stringify(others));
  } catch (e) { /* Speicher voll oder gesperrt */ }
}

function save() {
  state.updatedAt = Date.now();
  persist();
  view = merge();
  listeners.forEach((f) => f(view));
}

export function onChange(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}

// ---------- Zusammenführen ----------
function mergeStat(a, b) {
  return { n: (a.n || 0) + (b.n || 0), c: (a.c || 0) + (b.c || 0), recent: [...(a.recent || []), ...(b.recent || [])].slice(-20) };
}

function merge() {
  const parts = [state, ...Object.values(others).filter((o) => o && (o.updatedAt || 0) >= (state.resetAt || 0))];
  const v = {
    ...state,
    days: {}, stats: {}, levelStats: {}, lessons: {},
    sessions: 0, bestStreak: 0,
  };
  for (const p of parts) {
    for (const [k, d] of Object.entries(p.days || {})) {
      const t = v.days[k] || (v.days[k] = { answered: 0, correct: 0, tasks: {} });
      t.answered += d.answered || 0;
      t.correct += d.correct || 0;
      for (const [tid, n] of Object.entries(d.tasks || {})) t.tasks[tid] = (t.tasks[tid] || 0) + n;
    }
    for (const [k, s] of Object.entries(p.stats || {})) v.stats[k] = mergeStat(v.stats[k] || {}, s);
    for (const [k, s] of Object.entries(p.levelStats || {})) v.levelStats[k] = mergeStat(v.levelStats[k] || {}, s);
    for (const [k, r] of Object.entries(p.lessons || {})) {
      const t = v.lessons[k] || (v.lessons[k] = { best: 0, stars: 0, plays: 0 });
      t.best = Math.max(t.best, r.best || 0);
      t.stars = Math.max(t.stars, r.stars || 0);
      t.plays += r.plays || 0;
    }
    v.sessions += p.sessions || 0;
    v.bestStreak = Math.max(v.bestStreak, p.bestStreak || 0);
  }
  return v;
}

export function getState() {
  return view;
}

// ---------- Für die Synchronisation ----------
export function localPart() {
  return state;
}

export function deviceInfo() {
  return { id: state.deviceId, name: state.deviceName };
}

export function setDeviceName(name) {
  state.deviceName = String(name || '').slice(0, 40) || guessDeviceName();
  save();
}

export function otherDevices() {
  return Object.entries(others).map(([id, o]) => ({ id, name: o.deviceName || 'Gerät', updatedAt: o.updatedAt || 0 }));
}

// Übernimmt die Daten aller Geräte aus dem Abgleich. Gibt true zurück, wenn sich lokal etwas geändert hat.
export function applyRemote(doc) {
  let changed = false;
  const devices = (doc && doc.devices) || {};
  const shared = (doc && doc.shared) || {};
  if ((shared.resetAt || 0) > (state.resetAt || 0)) {
    // Auf einem anderen Gerät wurde alles zurückgesetzt
    const keep = { deviceId: state.deviceId, deviceName: state.deviceName, settings: state.settings, settingsAt: state.settingsAt };
    state = normalize({ ...keep, created: todayKey(), resetAt: shared.resetAt, updatedAt: Date.now() });
    changed = true;
  }
  if (shared.settings && (shared.settingsAt || 0) > (state.settingsAt || 0)) {
    state.settings = { ...DEFAULT.settings, ...shared.settings };
    state.settingsAt = shared.settingsAt;
    changed = true;
  }
  const next = {};
  for (const [id, part] of Object.entries(devices)) {
    if (id === state.deviceId) continue;
    next[id] = part;
  }
  if (JSON.stringify(next) !== JSON.stringify(others)) changed = true;
  others = next;
  cachedTasks = { key: null, tasks: [] };
  persist();
  view = merge();
  if (changed) listeners.forEach((f) => f(view));
  return changed;
}

// Baut das Dokument, das hochgeladen wird
export function buildRemote(doc) {
  const devices = { ...((doc && doc.devices) || {}) };
  const shared = { ...((doc && doc.shared) || {}) };
  if ((state.resetAt || 0) > (shared.resetAt || 0)) {
    shared.resetAt = state.resetAt;
    for (const id of Object.keys(devices)) if ((devices[id].updatedAt || 0) < state.resetAt) delete devices[id];
  }
  if ((state.settingsAt || 0) >= (shared.settingsAt || 0)) {
    shared.settings = state.settings;
    shared.settingsAt = state.settingsAt || 0;
  }
  const mine = { ...state };
  delete mine.settings;
  delete mine.levels;
  devices[state.deviceId] = mine;
  return { app: 'gehoerbildung', version: 1, shared, devices };
}

// ---------- Datum ----------
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

// Zusammengeführter Tag (nur lesen)
export function getDay(key = todayKey()) {
  return view.days[key] || { answered: 0, correct: 0, tasks: {} };
}

function localDay(key = todayKey()) {
  if (!state.days[key]) state.days[key] = { answered: 0, correct: 0, tasks: {} };
  return state.days[key];
}

export function settings() {
  return state.settings;
}

export function setSetting(k, v) {
  state.settings[k] = v;
  state.settingsAt = Date.now();
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
  return view.stats[`${moduleId}:${mode}:${item}`] || { n: 0, c: 0, recent: [] };
}

export function levelStat(moduleId, mode, lvl) {
  return view.levelStats[`${moduleId}:${mode}:${lvl}`] || { n: 0, c: 0, recent: [] };
}

// ---------- Lernpfad ----------
export const PASS = 0.8;

export function lessonResult(moduleId, mode, lessonId) {
  return view.lessons[`${moduleId}:${mode}:${lessonId}`] || { best: 0, stars: 0, plays: 0 };
}

export function starsFor(score) {
  if (score >= 1) return 3;
  if (score >= 0.9) return 2;
  if (score >= PASS) return 1;
  return 0;
}

export function recordLesson(moduleId, mode, lessonId, score) {
  const k = `${moduleId}:${mode}:${lessonId}`;
  const r = state.lessons[k] || { best: 0, stars: 0, plays: 0 };
  r.plays++;
  r.best = Math.max(r.best, score);
  r.stars = Math.max(r.stars, starsFor(score));
  state.lessons[k] = r;
  save();
  return lessonResult(moduleId, mode, lessonId);
}

// Eine Lektion ist frei, wenn die vorige bestanden ist oder eine spätere schon bestanden wurde
export function lessonUnlocked(moduleId, mode, lessons, idx) {
  if (idx === 0) return true;
  if (lessonResult(moduleId, mode, lessons[idx - 1].id).stars > 0) return true;
  for (let i = idx; i < lessons.length; i++) if (lessonResult(moduleId, mode, lessons[i].id).stars > 0) return true;
  return false;
}

// Erste noch nicht bestandene Lektion nach der letzten bestandenen (sonst die letzte)
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
  state.lastMode[moduleId] = mode;
  save();
}

// Ergebnis einer einzelnen Aufgabe speichern
export function recordAnswer({ module, mode, item, correct, level }) {
  bump(state.stats, `${module}:${mode}:${item}`, correct);
  bump(state.levelStats, `${module}:${mode}:${level}`, correct);
  const day = localDay();
  day.answered++;
  if (correct) day.correct++;
  for (const t of dailyTasks()) {
    if (t.kind === 'correct' && correct && t.module === module && (!t.mode || t.mode === mode)) {
      day.tasks[t.id] = (day.tasks[t.id] || 0) + 1;
    }
  }
  save();
  const st = streak();
  if (st > state.bestStreak) { state.bestStreak = st; save(); }
}

export function recordSession({ module, correct, total }) {
  state.sessions++;
  const day = localDay();
  for (const t of dailyTasks()) {
    if (t.kind === 'session' && t.module === module && total > 0 && correct / total >= t.minScore) {
      day.tasks[t.id] = (day.tasks[t.id] || 0) + 1;
    }
  }
  save();
}

export function goalMet(key) {
  const d = view.days[key];
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
    out.unshift({ key, met: goalMet(key), answered: view.days[key]?.answered || 0 });
    key = addDays(key, -1);
  }
  return out;
}

// ---------- Tagesaufgaben ----------
// Werden aus dem Datum erzeugt, damit sie über den Tag hinweg (und auf allen Geräten) gleich sind.
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
  const pool2 = taskProvider(view).slice();
  const chosen = [];
  const used = new Set();
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
  return Math.min(t.target, getDay().tasks[t.id] || 0);
}

// ---------- Sicherung ----------
export function exportData() {
  return JSON.stringify(state, null, 2);
}

export function importData(json) {
  const s = JSON.parse(json);
  if (!s || s.version !== 1) throw new Error('Unbekanntes Format');
  const keep = { deviceId: state.deviceId, deviceName: state.deviceName };
  state = normalize({ ...s, ...keep });
  cachedTasks = { key: null, tasks: [] };
  save();
}

// Setzt den Fortschritt auf allen Geräten zurück (beim nächsten Abgleich)
export function resetAll() {
  const keep = { deviceId: state.deviceId, deviceName: state.deviceName, settings: state.settings, settingsAt: state.settingsAt };
  state = normalize({ ...keep, created: todayKey(), resetAt: Date.now() });
  others = {};
  cachedTasks = { key: null, tasks: [] };
  save();
}

export async function requestPersistence() {
  try {
    if (navigator.storage && navigator.storage.persist) await navigator.storage.persist();
  } catch (e) { /* ignorieren */ }
}
