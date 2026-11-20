// Reiter "Klavier": spielbare Klaviatur mit Notenanzeige und Intervallbestimmung.
import { noteOn, unlock, preload } from './audio.js';
import { renderNotes } from './notation.js';

const SHARP = ['C', 'Cis', 'D', 'Dis', 'E', 'F', 'Fis', 'G', 'Gis', 'A', 'Ais', 'H'];
const FLAT = ['C', 'Des', 'D', 'Es', 'E', 'F', 'Ges', 'G', 'As', 'A', 'B', 'H'];
const WHITE = [0, 2, 4, 5, 7, 9, 11];
// Notenschrift: Stammton und Vorzeichen je Halbton
const SPELL_SHARP = [[0, 0], [0, 1], [1, 0], [1, 1], [2, 0], [3, 0], [3, 1], [4, 0], [4, 1], [5, 0], [5, 1], [6, 0]];
const SPELL_FLAT = [[0, 0], [1, -1], [1, 0], [2, -1], [2, 0], [3, 0], [4, -1], [4, 0], [5, -1], [5, 0], [6, -1], [6, 0]];
const IV_NAMES = ['Prime', 'kleine Sekunde', 'große Sekunde', 'kleine Terz', 'große Terz', 'reine Quarte', 'Tritonus', 'reine Quinte', 'kleine Sexte', 'große Sexte', 'kleine Septime', 'große Septime', 'Oktave'];
const LO = 36; // C2
const HI = 96; // C7
const PREF = 'gbt-piano-v1';

function prefs() {
  try { return { names: true, flat: false, ...(JSON.parse(localStorage.getItem(PREF)) || {}) }; } catch (e) { return { names: true, flat: false }; }
}
function savePrefs(p) {
  try { localStorage.setItem(PREF, JSON.stringify(p)); } catch (e) { /* ignorieren */ }
}

function noteName(m, flat) {
  return (flat ? FLAT : SHARP)[m % 12] + (Math.floor(m / 12) - 1);
}
function noteObj(m, flat) {
  const [l, a] = (flat ? SPELL_FLAT : SPELL_SHARP)[m % 12];
  return { l, a, o: Math.floor(m / 12) - 1 };
}
function intervalName(semis) {
  const oct = Math.floor(semis / 12);
  const rest = semis % 12;
  if (semis === 0) return 'Prime';
  if (rest === 0) return oct === 1 ? 'Oktave' : `${oct} Oktaven`;
  return oct ? `${IV_NAMES[rest]} + ${oct === 1 ? 'Oktave' : `${oct} Oktaven`}` : IV_NAMES[rest];
}

export function renderPiano($app, { h, icon }) {
  const p = prefs();
  $app.innerHTML = h`
    <header class="page-head"><h1>Klavier</h1></header>
    <section class="card piano-info">
      <div class="staff piano-staff"></div>
      <div class="piano-read">
        <b id="pn-notes">Tippe auf eine Taste</b>
        <span class="muted" id="pn-iv">&nbsp;</span>
      </div>
    </section>
    <div class="piano-tools">
      <button class="btn ghost small-btn" id="oct-down" aria-label="Tiefer">${icon('chevron', 'flip')}</button>
      <button class="chip ${p.names ? 'on' : ''}" id="t-names">Namen</button>
      <div class="seg">
        <button class="${p.flat ? '' : 'on'}" id="t-sharp">♯</button>
        <button class="${p.flat ? 'on' : ''}" id="t-flat">♭</button>
      </div>
      <button class="btn ghost small-btn" id="oct-up" aria-label="Höher">${icon('chevron')}</button>
    </div>
    <div class="piano-wrap"><div class="piano ${p.names ? 'names' : ''}" id="piano"></div></div>
    <p class="muted small center">Mehrere Finger gleichzeitig spielen Akkorde. Wischen spielt ein Glissando.</p>
  `;
  const $piano = $app.querySelector('#piano');
  const $wrap = $app.querySelector('.piano-wrap');
  const $staff = $app.querySelector('.piano-staff');
  const $notes = $app.querySelector('#pn-notes');
  const $iv = $app.querySelector('#pn-iv');

  // Tasten bauen
  let whiteIdx = 0;
  const keys = [];
  for (let m = LO; m <= HI; m++) {
    const pc = m % 12;
    const isWhite = WHITE.includes(pc);
    const el = document.createElement('div');
    el.className = `key ${isWhite ? 'white' : 'black'}`;
    el.dataset.m = m;
    if (isWhite) {
      el.style.left = `calc(var(--kw) * ${whiteIdx})`;
      whiteIdx++;
    } else {
      el.style.left = `calc(var(--kw) * ${whiteIdx} - var(--bw) / 2)`;
    }
    el.innerHTML = `<span>${isWhite ? (pc === 0 ? `C${Math.floor(m / 12) - 1}` : SHARP[pc]) : ''}</span>`;
    keys.push(el);
    $piano.appendChild(el);
  }
  $piano.style.width = `calc(var(--kw) * ${whiteIdx})`;

  const held = new Map(); // pointerId -> { m, stop }
  const recent = []; // zuletzt gespielte Töne
  let preloaded = false;

  function show() {
    const now = [...new Set([...held.values()].map((x) => x.m))].sort((a, b) => a - b);
    const shown = now.length ? now : recent.slice(-1);
    const flat = p.flat;
    if (!shown.length) return;
    $notes.textContent = shown.map((m) => noteName(m, flat)).join(' – ');
    let iv = '';
    if (now.length >= 2) iv = intervalName(now[now.length - 1] - now[0]) + (now.length > 2 ? ` (äußere Töne, ${now.length} Töne)` : '');
    else if (recent.length >= 2) {
      const a = recent[recent.length - 2], b = recent[recent.length - 1];
      iv = `${intervalName(Math.abs(b - a))} ${b > a ? 'aufwärts' : b < a ? 'abwärts' : ''} zum vorigen Ton`;
    }
    $iv.textContent = iv || ' ';
    const groups = now.length >= 2 ? [now.map((m) => noteObj(m, flat))] : recent.slice(-2).map((m) => [noteObj(m, flat)]);
    renderNotes($staff, groups, { width: Math.min($staff.clientWidth || 300, 360), height: 105 });
  }

  async function press(id, m) {
    const k = keys[m - LO];
    k.classList.add('down');
    const entry = { m, stop: null };
    held.set(id, entry);
    recent.push(m);
    if (recent.length > 8) recent.shift();
    show();
    entry.stop = await noteOn(m);
    if (!held.has(id) || held.get(id) !== entry) entry.stop();
  }
  function release(id) {
    const e = held.get(id);
    if (!e) return;
    held.delete(id);
    if (![...held.values()].some((x) => x.m === e.m)) keys[e.m - LO].classList.remove('down');
    if (e.stop) e.stop();
    show();
  }
  function keyAt(x, y) {
    const el = document.elementFromPoint(x, y);
    const k = el && el.closest('.key');
    return k ? Number(k.dataset.m) : null;
  }

  $piano.addEventListener('pointerdown', async (ev) => {
    ev.preventDefault();
    if (!preloaded) { preloaded = true; unlock(); }
    const m = keyAt(ev.clientX, ev.clientY);
    if (m == null) return;
    try { $piano.setPointerCapture(ev.pointerId); } catch (e) { /* ignorieren */ }
    press(ev.pointerId, m);
  });
  $piano.addEventListener('pointermove', (ev) => {
    const e = held.get(ev.pointerId);
    if (!e) return;
    const m = keyAt(ev.clientX, ev.clientY);
    if (m != null && m !== e.m) { release(ev.pointerId); press(ev.pointerId, m); }
  });
  for (const t of ['pointerup', 'pointercancel', 'lostpointercapture']) $piano.addEventListener(t, (ev) => release(ev.pointerId));
  $piano.addEventListener('contextmenu', (e) => e.preventDefault());

  // Werkzeuge
  const scrollOct = (dir) => {
    const kw = $piano.querySelector('.key.white').getBoundingClientRect().width;
    $wrap.scrollBy({ left: dir * kw * 7, behavior: 'smooth' });
  };
  $app.querySelector('#oct-down').addEventListener('click', () => scrollOct(-1));
  $app.querySelector('#oct-up').addEventListener('click', () => scrollOct(1));
  $app.querySelector('#t-names').addEventListener('click', (e) => {
    p.names = !p.names; savePrefs(p);
    e.currentTarget.classList.toggle('on', p.names);
    $piano.classList.toggle('names', p.names);
  });
  const setFlat = (f) => {
    p.flat = f; savePrefs(p);
    $app.querySelector('#t-flat').classList.toggle('on', f);
    $app.querySelector('#t-sharp').classList.toggle('on', !f);
    show();
  };
  $app.querySelector('#t-sharp').addEventListener('click', () => setFlat(false));
  $app.querySelector('#t-flat').addEventListener('click', () => setFlat(true));

  // Startansicht: ab C3 (bei tiefer Stimmlage sinnvoll), bzw. so, dass C4 sichtbar ist
  requestAnimationFrame(() => {
    const c3 = keys[48 - LO];
    $wrap.scrollLeft = c3.offsetLeft - 4;
  });
  renderNotes($staff, [], { width: Math.min($staff.clientWidth || 300, 360), height: 105 });
  preload([48, 60, 72]);
  return () => { for (const id of [...held.keys()]) release(id); };
}
