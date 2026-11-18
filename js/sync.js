// Abgleich des Fortschritts zwischen Geräten über einen privaten GitHub-Gist.
// Jedes Gerät braucht einmal einen GitHub-Token mit der Berechtigung "gist".
import * as store from './store.js';

const CFG_KEY = 'gbt-sync-v1';
const API = 'https://api.github.com';
const FILE = 'gehoerbildung-fortschritt.json';
const DESC = 'Gehörbildungstrainer: Fortschritt (automatisch synchronisiert)';

let cfg = loadCfg();
let busy = null;
let timer = null;
const listeners = new Set();
let status = { state: cfg.token ? 'idle' : 'off', message: '', at: cfg.lastSync || 0 };

function loadCfg() {
  try { return JSON.parse(localStorage.getItem(CFG_KEY)) || {}; } catch (e) { return {}; }
}
function saveCfg() {
  try { localStorage.setItem(CFG_KEY, JSON.stringify(cfg)); } catch (e) { /* ignorieren */ }
}
function setStatus(s) {
  status = { ...status, ...s };
  listeners.forEach((f) => f(status));
}

export function onStatus(f) {
  listeners.add(f);
  return () => listeners.delete(f);
}
export function getStatus() {
  return status;
}
export function isConnected() {
  return !!cfg.token;
}

async function gh(path, opts = {}) {
  const res = await fetch(API + path, {
    ...opts,
    cache: 'no-store',
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${cfg.token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(opts.body ? { 'Content-Type': 'application/json' } : {}),
    },
  });
  if (res.status === 401) throw Object.assign(new Error('auth'), { userMessage: 'Der Token ist ungültig oder abgelaufen. Bitte einen neuen Token eintragen.' });
  if (res.status === 403 || res.status === 404) {
    throw Object.assign(new Error('forbidden'), { userMessage: 'Der Token darf keine Gists lesen oder schreiben. Bitte beim Erstellen das Häkchen bei „gist" setzen.' });
  }
  if (!res.ok) throw Object.assign(new Error('http ' + res.status), { userMessage: `GitHub antwortet mit Fehler ${res.status}. Später nochmal versuchen.` });
  return res.status === 204 ? null : res.json();
}

async function findGist() {
  if (cfg.gistId) return cfg.gistId;
  for (let page = 1; page <= 5; page++) {
    const list = await gh(`/gists?per_page=100&page=${page}`);
    const hit = list.find((g) => g.files && g.files[FILE]);
    if (hit) return hit.id;
    if (list.length < 100) break;
  }
  return null;
}

async function readGist(id) {
  const g = await gh(`/gists/${id}`);
  const f = g.files && g.files[FILE];
  if (!f) return null;
  let text = f.content;
  if (f.truncated && f.raw_url) text = await (await fetch(f.raw_url, { cache: 'no-store' })).text();
  try { return JSON.parse(text); } catch (e) { return null; }
}

// Ein vollständiger Abgleich: herunterladen, zusammenführen, eigenen Teil hochladen
export function syncNow() {
  if (!cfg.token) return Promise.resolve(false);
  if (busy) return busy;
  busy = (async () => {
    setStatus({ state: 'syncing', message: '' });
    try {
      let id = await findGist();
      let doc = null;
      if (id) {
        try {
          doc = await readGist(id);
        } catch (e) {
          if (e.message === 'forbidden' && cfg.gistId) { cfg.gistId = null; id = await findGist(); doc = id ? await readGist(id) : null; } else throw e;
        }
      }
      if (doc && store.applyRemote(doc)) window.dispatchEvent(new Event('gbt-remote'));
      const out = JSON.stringify(store.buildRemote(doc));
      if (id) {
        await gh(`/gists/${id}`, { method: 'PATCH', body: JSON.stringify({ files: { [FILE]: { content: out } } }) });
      } else {
        const g = await gh('/gists', { method: 'POST', body: JSON.stringify({ description: DESC, public: false, files: { [FILE]: { content: out } } }) });
        id = g.id;
      }
      cfg.gistId = id;
      cfg.lastSync = Date.now();
      saveCfg();
      setStatus({ state: 'ok', message: '', at: cfg.lastSync });
      return true;
    } catch (e) {
      const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
      setStatus({ state: 'error', message: offline ? 'Keine Internetverbindung. Wird später nachgeholt.' : (e.userMessage || 'Abgleich fehlgeschlagen. Wird später erneut versucht.') });
      return false;
    } finally {
      busy = null;
    }
  })();
  return busy;
}

export async function connect(token) {
  cfg = { token: String(token || '').trim() };
  saveCfg();
  const ok = await syncNow();
  if (!ok && status.message && /Token/.test(status.message)) {
    cfg = {};
    saveCfg();
    setStatus({ state: 'off' });
    throw new Error(status.message);
  }
  return ok;
}

export function disconnect() {
  cfg = {};
  saveCfg();
  setStatus({ state: 'off', message: '', at: 0 });
}

// Nach Änderungen gesammelt hochladen
export function schedule(delay = 4000) {
  if (!cfg.token) return;
  clearTimeout(timer);
  timer = setTimeout(syncNow, delay);
}

export function init() {
  store.onChange(() => schedule());
  document.addEventListener('visibilitychange', () => {
    if (!cfg.token) return;
    if (document.visibilityState === 'visible') syncNow();
    else { clearTimeout(timer); syncNow(); }
  });
  window.addEventListener('online', () => syncNow());
  if (cfg.token) syncNow();
  setInterval(() => { if (cfg.token && document.visibilityState === 'visible') syncNow(); }, 5 * 60 * 1000);
}
