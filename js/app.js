import * as store from './store.js';
import * as sync from './sync.js';
import { renderPiano } from './piano.js';
import { MODULES, moduleById } from './modules/index.js';
import { renderNotes } from './notation.js';
import { unlock, blip, stopAll, preloadAll, playMelodic, primeAudio } from './audio.js';
import { startMic, stopMic, readPitch, getCalibration, setCalibration, calibrationCents, configure as configureMic, quietGate } from './pitch.js';
import { midiOfFreq, weightedPick } from './theory.js';
import { VOICE_RANGES } from './modules/intervals.js';

const $app = document.getElementById('app');
const $tabs = document.getElementById('tabs');
const SESSION_LEN = 10;

store.setTaskProvider(() => MODULES.filter((m) => m.available).flatMap((m) => m.tasks()));

// ---------- Hilfen ----------
const h = (strings, ...vals) => strings.reduce((s, str, i) => s + str + (i < vals.length ? vals[i] ?? '' : ''), '');
const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const ICONS = {
  home: '<path d="M3 11.5 12 4l9 7.5"/><path d="M5 10v10h5v-6h4v6h5V10"/>',
  piano: '<rect x="3" y="4" width="18" height="16" rx="2"/><path d="M8 4v16M13 4v16M18 4v16" opacity=".35"/><path d="M8 4v9M13 4v9M18 4v9" stroke-width="3.5"/>',
  practice: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  stats: '<path d="M4 20V10"/><path d="M10 20V4"/><path d="M16 20v-7"/><path d="M22 20H2"/>',
  settings: '<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.8-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1.1-1.5 1.7 1.7 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.8 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.5-1.1 1.7 1.7 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.8.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.5 1.7 1.7 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.8V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>',
  flame: '<path d="M12 2c1 3.5 5 6 5 11a5 5 0 0 1-10 0c0-2 1-3.5 2-4.5 0 2 1 3 2 3 0-3-1-6 1-9.5z"/>',
  play: '<path d="M7 4.5v15l13-7.5z" fill="currentColor" stroke="none"/>',
  replay: '<path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/>',
  close: '<path d="M6 6l12 12M18 6 6 18"/>',
  check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
  mic: '<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>',
  chevron: '<path d="m9 6 6 6-6 6"/>',
  ear: '<path d="M6 9a6 6 0 1 1 12 0c0 3-2 4-3 5.5S14 18 12 19.5 8 20 8 18"/><path d="M9.5 9.5a2.5 2.5 0 0 1 5 0c0 1.5-1.5 2-1.5 3.5"/>',
  note: '<path d="M9 18V5l10-2v12"/><circle cx="6" cy="18" r="3"/><circle cx="16" cy="15" r="3"/>',
  intervals: '<circle cx="7" cy="16" r="3"/><circle cx="17" cy="8" r="3"/><path d="M10 16h7V11"/>',
  chords: '<circle cx="12" cy="6" r="2.5"/><circle cx="12" cy="12" r="2.5"/><circle cx="12" cy="18" r="2.5"/>',
  scales: '<circle cx="4" cy="19" r="2"/><circle cx="10" cy="14" r="2"/><circle cx="16" cy="9" r="2"/><circle cx="21" cy="4" r="1.5"/>',
  cadence: '<path d="M4 18h4V6h4v8h4V9h4"/>',
  melody: '<path d="M3 15c3-6 5-6 7 0s4 6 7 0 3-4 4-4"/>',
  lock: '<rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  target: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1.5"/>',
};
const icon = (name, cls = '') => `<svg class="ic ${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name] || ''}</svg>`;

const MODE_ICON = { hear: 'ear', read: 'note', sing: 'mic' };

function pct(c, n) {
  return n ? Math.round((100 * c) / n) : 0;
}

// ---------- Router ----------
let cleanup = null;
function route() {
  if (cleanup) { cleanup(); cleanup = null; }
  stopAll();
  const parts = (location.hash.replace(/^#\/?/, '') || 'heute').split('/');
  const [view, ...args] = parts;
  const inSession = view === 'runde';
  $tabs.hidden = inSession;
  document.body.classList.toggle('in-session', inSession);
  $tabs.querySelectorAll('a').forEach((a) => a.classList.toggle('active', a.dataset.view === (view === 'bereich' ? 'ueben' : view)));
  window.scrollTo(0, 0);
  if (view === 'ueben') return renderPractice();
  if (view === 'bereich') return renderModule(args[0]);
  if (view === 'runde') return renderSession(args[0], args[1], args[2]);
  if (view === 'klavier') { cleanup = renderPiano($app, { h, icon }); return; }
  if (view === 'statistik') return renderStats();
  if (view === 'einstellungen') return renderSettings();
  return renderToday();
}
window.addEventListener('hashchange', route);

function go(hash) {
  if (location.hash === hash) route();
  else location.hash = hash;
}

function lessonHref(moduleId, mode) {
  const m = moduleById(moduleId);
  const { lesson } = store.currentLesson(moduleId, mode, m.lessons);
  return `#/runde/${moduleId}/${mode}/${lesson.id}`;
}

function lessonNo(m, lessonId) {
  return m.lessons.findIndex((l) => l.id === lessonId) + 1;
}

const STAR = '<svg class="star" viewBox="0 0 24 24" aria-hidden="true"><path d="M12 2.8l2.8 5.9 6.4.8-4.7 4.4 1.2 6.4L12 17.2l-5.7 3.1 1.2-6.4L2.8 9.5l6.4-.8z"/></svg>';
function stars(n, total = 3) {
  return `<span class="stars" aria-label="${n} von ${total} Sternen">${Array.from({ length: total }, (_, i) => `<i class="${i < n ? 'on' : ''}">${STAR}</i>`).join('')}</span>`;
}

// ---------- Heute ----------
function greeting() {
  const hr = new Date().getHours();
  if (hr < 11) return 'Guten Morgen';
  if (hr < 18) return 'Hallo';
  return 'Guten Abend';
}

function renderToday() {
  const s = store.getState();
  const day = store.getDay();
  const goal = s.settings.dailyGoal;
  const st = store.streak();
  const week = store.lastDays(7);
  const tasks = store.dailyTasks();
  const done = tasks.filter((t) => store.taskProgress(t) >= t.target).length;
  const goalPct = Math.min(100, Math.round((100 * day.answered) / goal));
  const wd = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
  $app.innerHTML = h`
    <header class="page-head">
      <p class="eyebrow">${new Date().toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <h1>${greeting()}!</h1>
      ${sync.isConnected() ? `<a class="sync-pill ${sync.getStatus().state}" href="#/einstellungen">${sync.getStatus().state === 'error' ? 'Abgleich hakt' : `Synchronisiert · ${store.otherDevices().length + 1} ${store.otherDevices().length ? 'Geräte' : 'Gerät'}`}</a>` : ''}
    </header>
    <section class="hero card">
      <div class="streak ${store.goalMet(store.todayKey()) ? 'lit' : ''}">
        ${icon('flame', 'flame')}
        <div><strong>${st}</strong><span>${st === 1 ? 'Tag' : 'Tage'} in Folge</span></div>
      </div>
      <div class="week">
        ${week.map((d) => {
          const [y, m, dd] = d.key.split('-').map(Number);
          const wdn = wd[new Date(y, m - 1, dd).getDay()];
          return `<div class="wday ${d.met ? 'met' : ''} ${d.key === store.todayKey() ? 'today' : ''}"><span>${wdn}</span><i>${d.met ? icon('check') : ''}</i></div>`;
        }).join('')}
      </div>
      <div class="goal">
        <div class="goal-top"><span>Tagesziel</span><span>${Math.min(day.answered, goal)} / ${goal} Aufgaben</span></div>
        <div class="bar"><div style="width:${goalPct}%"></div></div>
        <p class="hint">${day.answered >= goal ? 'Geschafft! Dein Streak ist für heute gesichert.' : `Noch ${goal - day.answered} Aufgaben, dann zählt der Tag für deinen Streak.`}</p>
      </div>
    </section>
    <section>
      <div class="sec-head"><h2>Tagesaufgaben</h2><span class="pill">${done} / ${tasks.length}</span></div>
      <div class="tasks">
        ${tasks.map((t) => {
          const p = store.taskProgress(t);
          const ok = p >= t.target;
          const mod = moduleById(t.module);
          const mode = t.mode || store.getLastMode(t.module);
          return h`<a class="task card ${ok ? 'done' : ''}" href="${lessonHref(t.module, mode)}">
            <div class="task-ic">${ok ? icon('check') : icon(t.mode ? MODE_ICON[t.mode] : 'target')}</div>
            <div class="task-body">
              <p>${esc(t.title)}</p>
              <div class="bar small"><div style="width:${Math.round((100 * p) / t.target)}%"></div></div>
              <span class="muted">${mod ? mod.title : ''} · ${p} / ${t.target}</span>
            </div>
            ${ok ? '' : icon('chevron', 'chev')}
          </a>`;
        }).join('')}
      </div>
    </section>
    <section>
      <div class="sec-head"><h2>Schnell üben</h2></div>
      <div class="quick-list">
        ${MODULES.filter((m) => m.available).map((m) => `<div class="quick-mod card">
          <a class="qm-head" href="#/bereich/${m.id}">${icon(m.icon, 'mod-ic sm')}<b>${m.title}</b>${icon('chevron', 'chev')}</a>
          <div class="qm-modes">${m.modes.map((md) => {
            const { lesson, idx } = store.currentLesson(m.id, md.id, m.lessons);
            return `<a class="qm-btn" href="#/runde/${m.id}/${md.id}/${lesson.id}">${icon(MODE_ICON[md.id])}<span>${md.title}</span><em>Lektion ${idx + 1}: ${esc(lesson.title)}</em></a>`;
          }).join('')}</div>
        </div>`).join('')}
      </div>
    </section>
  `;
}

// ---------- Üben ----------
function renderPractice() {
  $app.innerHTML = h`
    <header class="page-head"><h1>Üben</h1><p class="lead">Wähle einen Bereich.</p></header>
    <div class="modules">
      ${MODULES.map((m) => {
        if (!m.available) {
          return `<div class="module card soon">${icon(m.icon, 'mod-ic')}<div><h3>${m.title}</h3><p>${m.blurb}</p></div><span class="pill">${icon('lock')} bald</span></div>`;
        }
        return `<a class="module card" href="#/bereich/${m.id}">${icon(m.icon, 'mod-ic')}<div><h3>${m.title}</h3><p>${m.blurb}</p></div>${icon('chevron', 'chev')}</a>`;
      }).join('')}
    </div>
  `;
}

function renderModule(id) {
  const m = moduleById(id);
  if (!m || !m.available) return go('#/ueben');
  let mode = store.getLastMode(m.id);
  if (!m.modes.find((x) => x.id === mode)) mode = m.modes[0].id;
  $app.innerHTML = h`
    <header class="page-head with-back">
      <a class="back" href="#/ueben" aria-label="Zurück">${icon('chevron')}</a>
      <div><h1>${m.title}</h1><p class="lead">${m.blurb}</p></div>
    </header>
    <div class="seg mode-seg" role="tablist">${m.modes.map((md) => `<button data-mode="${md.id}" class="${md.id === mode ? 'on' : ''}">${icon(MODE_ICON[md.id])} ${md.title}</button>`).join('')}</div>
    <div class="path"></div>
  `;
  const $path = $app.querySelector('.path');
  const draw = () => {
    const cur = store.currentLesson(m.id, mode, m.lessons).lesson.id;
    const passed = m.lessons.filter((l) => store.lessonResult(m.id, mode, l.id).stars > 0).length;
    let idx = 0;
    $path.innerHTML = h`
      <div class="path-progress card">
        <div class="goal-top"><span>${m.modes.find((x) => x.id === mode).desc}</span></div>
        <div class="bar"><div style="width:${Math.round((100 * passed) / m.lessons.length)}%"></div></div>
        <p class="hint">${passed} von ${m.lessons.length} Lektionen bestanden. Ab 80 % richtig ist eine Lektion bestanden und die nächste wird frei.</p>
      </div>
      ${m.sections.map((sec) => h`
        <section class="path-sec">
          <div class="sec-head"><div><h2>${sec.title}</h2><p class="muted small">${sec.desc}</p></div></div>
          <div class="lessons">
            ${sec.lessons.map((l) => {
              const i = idx++;
              const r = store.lessonResult(m.id, mode, l.id);
              const open = store.lessonUnlocked(m.id, mode, m.lessons, i);
              const cls = [r.stars ? 'passed' : '', l.id === cur ? 'current' : '', open ? '' : 'locked'].join(' ');
              return h`<a class="lesson card ${cls}" href="#/runde/${m.id}/${mode}/${l.id}">
                <span class="l-no">${r.stars ? icon('check') : open ? i + 1 : icon('lock')}</span>
                <div class="l-body"><b>${esc(l.title)}</b><p>${esc(l.desc)}</p></div>
                <div class="l-side">${r.plays ? stars(r.stars) : l.id === cur ? '<span class="pill now">Jetzt</span>' : ''}</div>
              </a>`;
            }).join('')}
          </div>
        </section>`).join('')}
    `;
    const curEl = $path.querySelector('.lesson.current');
    if (curEl && passed > 0) curEl.scrollIntoView({ block: 'center' });
  };
  $app.querySelectorAll('.mode-seg button').forEach((b) => b.addEventListener('click', () => {
    mode = b.dataset.mode;
    store.setLastMode(m.id, mode);
    $app.querySelectorAll('.mode-seg button').forEach((x) => x.classList.toggle('on', x === b));
    draw();
  }));
  draw();
}

// ---------- Übungsrunde ----------
function makePicker(moduleId, mode) {
  let last = null;
  return (ids) => {
    const items = ids.map((id) => {
      const s = store.itemStat(moduleId, mode, id);
      let w;
      if (s.recent.length < 3) w = 1.6;
      else {
        const acc = s.recent.reduce((a, b) => a + b, 0) / s.recent.length;
        w = 0.6 + 2.4 * (1 - acc);
      }
      if (id === last && ids.length > 2) w *= 0.25;
      return { item: id, w };
    });
    last = weightedPick(items);
    return last;
  };
}

function renderSession(moduleId, mode, lessonId) {
  const m = moduleById(moduleId);
  if (!m || !m.available || !m.modes.find((x) => x.id === mode)) return go('#/ueben');
  let lIdx = m.lessons.findIndex((l) => l.id === lessonId);
  if (lIdx < 0) lIdx = store.currentLesson(m.id, mode, m.lessons).idx;
  const lesson = m.lessons[lIdx];
  const level = lesson.id;
  const unlocked = store.lessonUnlocked(m.id, mode, m.lessons, lIdx);
  store.setLastMode(m.id, mode);
  const modeInfo = m.modes.find((x) => x.id === mode);
  const introCards = m.intro ? m.intro(lesson, mode) : [];
  const pickItem = makePicker(m.id, mode);
  const results = [];
  let idx = 0;
  let q = null;
  let alive = true;
  let singLoop = null;
  cleanup = () => {
    alive = false;
    if (singLoop) cancelAnimationFrame(singLoop);
    stopMic();
  };

  $app.innerHTML = h`
    <div class="session">
      <header class="sess-head">
        <a class="icon-btn" href="#/bereich/${m.id}" aria-label="Runde beenden">${icon('close')}</a>
        <div class="bar progress"><div style="width:0%"></div></div>
        <span class="pill">${icon(MODE_ICON[mode])} Lektion ${lIdx + 1}</span>
      </header>
      <main class="sess-body"></main>
    </div>
  `;
  const $body = $app.querySelector('.sess-body');
  const $prog = $app.querySelector('.progress > div');

  // Startbildschirm (sorgt auch für die nötige Nutzer-Geste für Audio und Mikrofon)
  const res = store.lessonResult(m.id, mode, lesson.id);
  $body.innerHTML = h`
    <div class="start card">
      ${icon(MODE_ICON[mode], 'big-ic')}
      <p class="muted">${m.title} · ${modeInfo.title} · Lektion ${lIdx + 1}</p>
      <h2>${esc(lesson.title)}</h2>
      <p>${esc(lesson.desc)}</p>
      ${res.plays ? `<p class="muted small">Bisher bestes Ergebnis: ${Math.round(res.best * 100)} % ${stars(res.stars)}</p>` : ''}
      ${unlocked ? '' : '<p class="hint warn">Diese Lektion ist noch gesperrt. Du kannst sie trotzdem probieren. Bestehst du sie, werden alle Lektionen davor mit freigeschaltet.</p>'}
      ${mode === 'sing' ? `<p class="hint">Beim Nachsingen fragt dein Gerät nach dem Mikrofon. Sing in ruhiger Umgebung, laut und deutlich. Du kannst den Ton in jeder Oktave singen.</p>` : ''}
      <p class="hint mic-err" hidden></p>
      <button class="btn primary big" id="go">${icon('play')} Los geht's</button>
      <p class="muted small">${SESSION_LEN} Aufgaben · ab 8 richtigen bestanden</p>
    </div>
    ${introCards.length ? h`<section class="intro">
      <div class="sec-head"><h2>Neu in dieser Lektion</h2><span class="muted small">Tippe zum Anhören</span></div>
      <div class="intro-list">${introCards.map((c, i) => `<button class="intro-card card ${c.groups.length > 3 ? 'col' : ''}" data-i="${i}"><div class="staff"></div><div class="ic-text"><b>${esc(c.title)}</b><span>${esc(c.text)}</span></div>${icon('play', 'ic-play')}</button>`).join('')}</div>
    </section>` : ''}`;
  $body.querySelectorAll('.intro-card').forEach((el) => {
    const c = introCards[Number(el.dataset.i)];
    const st = el.querySelector('.staff');
    renderNotes(st, c.groups, { duration: c.duration, width: Math.min(st.clientWidth || 260, c.groups.length > 3 ? 420 : 260), height: 110 });
    el.addEventListener('click', async () => { await unlock(); c.play(); });
  });
  $body.querySelector('#go').addEventListener('click', async () => {
    const btn = $body.querySelector('#go');
    btn.disabled = true;
    btn.innerHTML = 'Lade Klänge …';
    await unlock();
    if (mode === 'sing') {
      try {
        await startMic();
      } catch (e) {
        btn.disabled = false;
        btn.innerHTML = `${icon('mic')} Nochmal versuchen`;
        const $err = $body.querySelector('.mic-err');
        $err.hidden = false;
        $err.textContent = e.userMessage || `Das Mikrofon konnte nicht gestartet werden (${e.name || e.message}).`;
        return;
      }
    }
    next();
  });

  function next() {
    if (!alive) return;
    if (idx >= SESSION_LEN) return finish();
    q = m.makeQuestion(mode, lesson, pickItem, { settings: store.settings() });
    $prog.style.width = `${(100 * idx) / SESSION_LEN}%`;
    if (q.type === 'sing') return showSing();
    showQuestion();
  }

  function answered(correct) {
    results.push({ item: q.item, correct });
    store.recordAnswer({ module: m.id, mode, item: q.item, correct, level });
    blip(correct);
    idx++;
    $prog.style.width = `${(100 * idx) / SESSION_LEN}%`;
  }

  function questionShell(extra = '') {
    return h`
      <div class="q card">
        <p class="q-count muted">Aufgabe ${idx + 1} von ${SESSION_LEN}</p>
        <h2 class="q-prompt">${esc(q.prompt)}</h2>
        <p class="q-sub muted">${esc(q.sub || '')}</p>
        ${q.notation ? '<div class="staff"></div>' : ''}
        ${q.notation && mode !== 'sing' ? '' : `<button class="btn play" id="play">${icon('play')} <span>${mode === 'sing' ? 'Grundton hören' : 'Abspielen'}</span></button>`}
        ${extra}
      </div>
      <div class="answers"></div>
      <div class="feedback" hidden></div>`;
  }

  function drawStaff(groups, clef, colors) {
    const el = $body.querySelector('.staff');
    const wide = q.notation && q.notation.wide;
    if (el) renderNotes(el, groups, { clef, colors, duration: q.notation && q.notation.duration, width: Math.min(el.clientWidth || 320, wide ? 640 : 420), height: 125 });
  }
  function drawReveal(el) {
    const many = q.reveal.groups.length > 3;
    renderNotes(el, q.reveal.groups, { duration: q.reveal.duration, width: Math.min(el.clientWidth || 300, many ? 640 : 380), height: 130 });
  }

  function showQuestion() {
    $body.innerHTML = questionShell();
    if (q.notation) drawStaff(q.notation.groups, q.notation.clef);
    if (q.notation && q.notation.wide) $body.querySelector('.staff').classList.add('wide');
    const $play = $body.querySelector('#play');
    if ($play) $play.addEventListener('click', () => q.play());
    const $ans = $body.querySelector('.answers');
    if (q.type === 'choice') {
      $ans.className = `answers grid ${q.options.length > 9 ? 'dense' : ''}`;
      $ans.innerHTML = q.options.map((o) => `<button class="ans" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('');
      $ans.querySelectorAll('.ans').forEach((b) => b.addEventListener('click', () => {
        const id = b.dataset.id;
        const ok = q.accept ? q.accept(id) : id === q.answer;
        $ans.querySelectorAll('.ans').forEach((x) => {
          x.disabled = true;
          if (x.dataset.id === q.answer) x.classList.add('right');
        });
        if (!ok) b.classList.add('wrong');
        answered(ok);
        showFeedback(ok, ok ? null : id);
      }));
    } else if (q.type === 'multi') {
      // Mehrteilige Antwort, z. B. Qualität + Intervallzahl oder Akkordart + Umkehrung
      const sel = {};
      $ans.className = 'answers two-step';
      $ans.innerHTML = q.parts.map((p) => h`
        <p class="muted small">${esc(p.label)}</p>
        <div class="chips">${p.options.map((o) => `<button class="chip" data-part="${p.key}" data-id="${esc(o.id)}">${esc(o.label)}</button>`).join('')}</div>`).join('')
        + '<button class="btn primary" id="check" disabled>Prüfen</button>';
      const upd = () => { $ans.querySelector('#check').disabled = !q.parts.every((p) => sel[p.key] !== undefined); };
      $ans.querySelectorAll('.chip').forEach((b) => b.addEventListener('click', () => {
        const part = b.dataset.part;
        sel[part] = b.dataset.id;
        $ans.querySelectorAll(`.chip[data-part="${part}"]`).forEach((x) => x.classList.toggle('on', x === b));
        upd();
      }));
      $ans.querySelector('#check').addEventListener('click', () => {
        const ok = q.accept ? q.accept(sel) : q.parts.every((p) => String(sel[p.key]) === String(q.answer[p.key]));
        $ans.querySelectorAll('button').forEach((x) => { x.disabled = true; });
        for (const p of q.parts) {
          $ans.querySelector(`.chip[data-part="${p.key}"][data-id="${CSS.escape(String(q.answer[p.key]))}"]`)?.classList.add('right');
          if (!ok && String(sel[p.key]) !== String(q.answer[p.key])) $ans.querySelector(`.chip[data-part="${p.key}"][data-id="${CSS.escape(String(sel[p.key]))}"]`)?.classList.add('wrong');
        }
        answered(ok);
        showFeedback(ok, null, ok ? null : q.labelFor(sel));
      });
    }
    if (q.autoplay && store.settings().autoplay) setTimeout(() => alive && q.play(), 250);
  }

  function showFeedback(ok, wrongId, wrongLabel) {
    const $fb = $body.querySelector('.feedback');
    $fb.hidden = false;
    $fb.className = `feedback card ${ok ? 'ok' : 'bad'}`;
    const yourLabel = wrongLabel || (wrongId && q.options ? q.options.find((o) => o.id === wrongId)?.label : null);
    $fb.innerHTML = h`
      <div class="fb-head">${ok ? icon('check') : icon('close')}<div><strong>${ok ? pickPraise() : 'Nicht ganz.'}</strong><p>${esc(q.reveal.text)}</p>${yourLabel ? `<p class="muted small">Deine Antwort: ${esc(yourLabel)}</p>` : ''}${q.reveal.note ? `<p class="muted small">${esc(q.reveal.note)}</p>` : ''}</div></div>
      ${mode === 'hear' ? '<div class="staff reveal-staff"></div>' : ''}
      <div class="fb-actions">
        <button class="btn ghost" id="again">${icon('replay')} Nochmal hören</button>
        ${!ok && q.compare && wrongId ? `<button class="btn ghost" id="cmp">${icon('ear')} Deine Antwort hören</button>` : ''}
        <button class="btn primary" id="next">Weiter ${icon('chevron')}</button>
      </div>`;
    if (mode === 'hear') {
      const el = $fb.querySelector('.reveal-staff');
      drawReveal(el);
    }
    if (q.reveal.playOnReveal && !ok) q.play();
    $fb.querySelector('#again').addEventListener('click', () => q.play());
    $fb.querySelector('#cmp')?.addEventListener('click', () => q.compare(wrongId));
    $fb.querySelector('#next').addEventListener('click', next);
    $fb.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showSing() {
    const tol = store.settings().tolerance;
    $body.innerHTML = questionShell(h`
      <div class="tuner">
        <div class="tuner-note"><span id="sung">–</span><small id="cents">&nbsp;</small></div>
        <div class="level" title="Mikrofon-Pegel">${icon('mic')}<div class="bar small"><div id="lvl"></div></div></div>
        <div class="meter"><div class="zone" style="--tol:${tol}"></div><div class="needle" id="needle"></div><span class="lbl l">tiefer</span><span class="lbl r">höher</span></div>
        <div class="hold"><div id="hold"></div></div>
        ${(q.targets || []).length > 1 ? `<div class="steps">${q.targets.map((_, i) => `<i data-i="${i}"></i>`).join('')}</div>` : ''}
        <p class="muted small" id="sing-hint">${(q.targets || []).length > 1 ? `Sing die Töne nacheinander und halte jeden kurz. Ton 1 von ${q.targets.length}.` : 'Sing den Zielton und halte ihn kurz.'}</p>
      </div>`);
    drawStaff(q.notation.groups, q.notation.clef);
    const $ans = $body.querySelector('.answers');
    $ans.className = 'answers row';
    $ans.innerHTML = `<button class="btn ghost" id="giveup">Lösung anhören</button>`;
    let finished = false;
    let holdMs = 0;
    let last = performance.now();
    let playingUntil = 0;
    const $sung = $body.querySelector('#sung');
    const $cents = $body.querySelector('#cents');
    const $needle = $body.querySelector('#needle');
    const $hold = $body.querySelector('#hold');
    const $hint = $body.querySelector('#sing-hint');
    const $lvl = $body.querySelector('#lvl');
    let quietMs = 0;
    const recent = [];
    configureMic({ sensitivity: store.settings().micSens, voice: store.settings().voice });
    const targets = q.targets || [q.targetMidi];
    let ti = 0;
    const HOLD = targets.length > 1 ? 550 : 700;
    const markStep = () => $body.querySelectorAll('.steps i').forEach((el, i) => { el.classList.toggle('done', i < ti); el.classList.toggle('cur', i === ti); });
    markStep();
    const playRoot = () => {
      playingUntil = performance.now() + 1900;
      q.play();
    };
    $body.querySelector('#play').onclick = playRoot;
    const end = (ok) => {
      if (finished) return;
      finished = true;
      cancelAnimationFrame(singLoop);
      singLoop = null;
      answered(ok);
      $ans.innerHTML = '';
      showSingFeedback(ok);
    };
    $ans.querySelector('#giveup').addEventListener('click', () => end(false));
    const loop = (now) => {
      if (!alive || finished) return;
      const dt = Math.min(100, now - last);
      last = now;
      const p = readPitch();
      if (p) $lvl.style.width = `${Math.min(100, Math.round(Math.sqrt(p.rms) * 220))}%`;
      if (p && p.rms < quietGate()) quietMs += dt; else quietMs = 0;
      if (quietMs > 4000 && now > playingUntil) $hint.textContent = 'Ich höre nichts. Sing lauter oder prüfe, ob das richtige Mikrofon ausgewählt ist.';
      // Während der Grundton klingt, nicht auswerten (sonst "hört" das Mikrofon das Klavier)
      if (p && p.freq > 0 && p.clarity > 0.5 && now > playingUntil) {
        // Glätten: Median der letzten drei Messungen (gegen einzelne Ausreißer)
        recent.push(midiOfFreq(p.freq));
        if (recent.length > 3) recent.shift();
        const sm = recent.slice().sort((x, y) => x - y)[Math.floor(recent.length / 2)];
        const nearest = Math.round(sm);
        // Abweichung zum Zielton, Oktavlage egal
        let diff = (sm - targets[ti]) * 100;
        const octs = Math.round(diff / 1200);
        const folded = diff - octs * 1200;
        $sung.textContent = noteNameFromMidi(nearest);
        $cents.textContent = `${folded > 0 ? '+' : ''}${Math.round(folded)} Cent`;
        const clamp = Math.max(-200, Math.min(200, folded));
        $needle.style.left = `${50 + clamp / 4}%`;
        const inTune = Math.abs(folded) <= tol;
        $needle.classList.toggle('good', inTune);
        if (inTune) holdMs += dt; else holdMs = Math.max(0, holdMs - dt * 2);
        if (octs !== 0 && inTune) $hint.textContent = 'Richtiger Ton, andere Oktave. Das zählt auch.';
        else if (!inTune) $hint.textContent = folded < 0 ? 'Etwas zu tief.' : 'Etwas zu hoch.';
        else $hint.textContent = targets.length > 1 ? `Genau so, halten … (Ton ${ti + 1} von ${targets.length})` : 'Genau so, halten …';
      } else {
        holdMs = Math.max(0, holdMs - dt * 0.5);
        if (recent.length && p && p.rms < quietGate()) recent.length = 0;
        $needle.classList.remove('good');
      }
      $hold.style.width = `${Math.min(100, (100 * holdMs) / HOLD)}%`;
      if (holdMs >= HOLD) {
        if (ti + 1 >= targets.length) return end(true);
        ti++;
        holdMs = 0;
        markStep();
        $hint.textContent = `Gut! Jetzt Ton ${ti + 1} von ${targets.length}.`;
      }
      singLoop = requestAnimationFrame(loop);
    };
    setTimeout(() => {
      if (!alive) return;
      playRoot();
      singLoop = requestAnimationFrame(loop);
    }, 250);
  }

  function showSingFeedback(ok) {
    const $fb = $body.querySelector('.feedback');
    $fb.hidden = false;
    $fb.className = `feedback card ${ok ? 'ok' : 'bad'}`;
    $fb.innerHTML = h`
      <div class="fb-head">${ok ? icon('check') : icon('close')}<div><strong>${ok ? pickPraise() : 'So klingt es richtig:'}</strong><p>${esc(q.reveal.text)}</p></div></div>
      <div class="staff reveal-staff"></div>
      <div class="fb-actions">
        <button class="btn ghost" id="again">${icon('replay')} ${esc(q.targetLabel || 'Beide Töne hören')}</button>
        <button class="btn primary" id="next">Weiter ${icon('chevron')}</button>
      </div>`;
    const el = $fb.querySelector('.reveal-staff');
    drawReveal(el);
    if (!ok) setTimeout(() => alive && q.playTarget(), 300);
    $fb.querySelector('#again').addEventListener('click', () => q.playTarget());
    $fb.querySelector('#next').addEventListener('click', next);
  }

  function finish() {
    stopMic();
    const correct = results.filter((r) => r.correct).length;
    store.recordSession({ module: m.id, mode, correct, total: results.length });
    const p = pct(correct, results.length);
    const mistakes = {};
    results.filter((r) => !r.correct).forEach((r) => { mistakes[r.item] = (mistakes[r.item] || 0) + 1; });
    const score = results.length ? correct / results.length : 0;
    const before = store.lessonResult(m.id, mode, lesson.id).stars;
    const r = store.recordLesson(m.id, mode, lesson.id, score);
    const passedNow = store.starsFor(score) > 0;
    const nextLesson = m.lessons[lIdx + 1];
    const day = store.getDay();
    const goal = store.settings().dailyGoal;
    $prog.style.width = '100%';
    $body.innerHTML = h`
      <div class="summary card">
        <div class="score-ring ${passedNow ? 'pass' : ''}" style="--p:${p}"><span>${p} %</span></div>
        ${stars(store.starsFor(score))}
        <h2>${passedNow ? (before === 0 ? 'Lektion bestanden!' : p === 100 ? 'Perfekt!' : 'Wieder bestanden!') : p >= 60 ? 'Fast geschafft!' : 'Dranbleiben lohnt sich!'}</h2>
        <p>${correct} von ${results.length} richtig${passedNow ? '' : ' · ab 8 richtigen ist die Lektion bestanden'}</p>
        ${Object.keys(mistakes).length ? `<div class="mistakes"><p class="muted small">Daran kannst du noch arbeiten:</p>${Object.entries(mistakes).map(([id, n]) => `<span class="pill">${esc(m.itemLabel(id))}${n > 1 ? ` ×${n}` : ''}</span>`).join('')}</div>` : ''}
        <p class="muted">${day.answered >= goal ? `${icon('flame', 'flame inline')} Tagesziel erreicht, Streak: ${store.streak()} ${store.streak() === 1 ? 'Tag' : 'Tage'}` : `Tagesziel: ${day.answered} / ${goal}`}</p>
        ${passedNow && nextLesson ? h`<div class="levelup"><strong>${before === 0 ? 'Neu freigeschaltet' : 'Weiter geht es mit'}: Lektion ${lIdx + 2}</strong><p>${esc(nextLesson.title)}</p><a class="btn primary" href="#/runde/${m.id}/${mode}/${nextLesson.id}">Nächste Lektion ${icon('chevron')}</a></div>` : ''}
        ${passedNow && !nextLesson ? `<div class="levelup"><strong>Du hast den ganzen Lernpfad geschafft!</strong><p>Wiederhole Lektionen für mehr Sterne oder probiere einen anderen Modus.</p></div>` : ''}
        <div class="fb-actions">
          <a class="btn ghost" href="#/bereich/${m.id}">Zum Lernpfad</a>
          <button class="btn ${passedNow && nextLesson ? 'ghost' : 'primary'}" id="again">${icon('replay')} Nochmal</button>
        </div>
      </div>`;
    void r;
    $body.querySelector('#again').addEventListener('click', () => route());
  }
}

const PRAISE = ['Richtig!', 'Genau!', 'Super!', 'Stimmt!', 'Sehr gut!', 'Perfekt!'];
function pickPraise() {
  return PRAISE[Math.floor(Math.random() * PRAISE.length)];
}

const PC_NAMES = ['C', 'Cis', 'D', 'Es', 'E', 'F', 'Fis', 'G', 'As', 'A', 'B', 'H'];
function noteNameFromMidi(m) {
  return PC_NAMES[((m % 12) + 12) % 12];
}

// ---------- Statistik ----------
function renderStats() {
  const s = store.getState();
  const days = store.lastDays(35);
  const totalAnswered = Object.values(s.days).reduce((a, d) => a + d.answered, 0);
  const totalCorrect = Object.values(s.days).reduce((a, d) => a + d.correct, 0);
  $app.innerHTML = h`
    <header class="page-head"><h1>Statistik</h1></header>
    <section class="kpis">
      <div class="kpi card"><b>${store.streak()}</b><span>Streak</span></div>
      <div class="kpi card"><b>${s.bestStreak}</b><span>Bester Streak</span></div>
      <div class="kpi card"><b>${totalAnswered}</b><span>Aufgaben</span></div>
      <div class="kpi card"><b>${pct(totalCorrect, totalAnswered)} %</b><span>richtig</span></div>
    </section>
    <section class="card">
      <div class="sec-head"><h2>Letzte 5 Wochen</h2></div>
      <div class="cal">${days.map((d) => {
        const lvl = d.met ? 3 : d.answered > 0 ? 1 : 0;
        return `<i class="c${lvl}" title="${d.key}: ${d.answered} Aufgaben"></i>`;
      }).join('')}</div>
      <p class="muted small">Dunkel: Tagesziel erreicht. Hell: geübt, Ziel nicht erreicht.</p>
    </section>
    ${MODULES.filter((m) => m.available).map((m) => h`
      <section class="card">
        <div class="sec-head"><h2>${m.title}</h2></div>
        <div class="seg" role="tablist">${m.modes.map((md, i) => `<button class="${i === 0 ? 'on' : ''}" data-mode="${md.id}">${md.title}</button>`).join('')}</div>
        <div class="item-stats" data-module="${m.id}"></div>
      </section>`).join('')}
  `;
  $app.querySelectorAll('.seg').forEach((seg) => {
    const box = seg.nextElementSibling;
    const m = moduleById(box.dataset.module);
    const draw = (mode) => {
      const rows = m.allItems.map((id) => ({ id, s: store.itemStat(m.id, mode, id) })).filter((r) => r.s.n > 0);
      if (!rows.length) {
        box.innerHTML = '<p class="muted">Noch keine Daten. Starte eine Runde, dann siehst du hier, was dir leicht- und was dir schwerfällt.</p>';
        return;
      }
      box.innerHTML = rows.map((r) => {
        const acc = pct(r.s.recent.reduce((a, b) => a + b, 0), r.s.recent.length);
        return `<div class="srow"><span>${esc(m.itemLabel(r.id))}</span><div class="bar small ${acc < 60 ? 'warn' : ''}"><div style="width:${acc}%"></div></div><b>${acc} %</b></div>`;
      }).join('') + '<p class="muted small">Prozent der letzten 20 Antworten je Intervall.</p>';
    };
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', () => {
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
      draw(b.dataset.mode);
    }));
    draw(seg.querySelector('button').dataset.mode);
  });
}

// ---------- Einstellungen ----------
function renderSettings() {
  const st = store.settings();
  $app.innerHTML = h`
    <header class="page-head"><h1>Einstellungen</h1></header>
    <section class="card form">
      <h2>Üben</h2>
      <label>Tagesziel (Aufgaben pro Tag)
        <div class="seg" data-key="dailyGoal">${[10, 20, 30, 50].map((v) => `<button class="${st.dailyGoal === v ? 'on' : ''}" data-v="${v}">${v}</button>`).join('')}</div>
      </label>
      <label>Automatisch abspielen
        <div class="seg" data-key="autoplay">${[[true, 'An'], [false, 'Aus']].map(([v, l]) => `<button class="${st.autoplay === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      </label>
    </section>
    <section class="card form">
      <h2>Singen</h2>
      <label>Stimmlage
        <div class="seg vertical" data-key="voice">${Object.entries(VOICE_RANGES).map(([k, v]) => `<button class="${st.voice === k ? 'on' : ''}" data-v="${k}">${v.label}</button>`).join('')}</div>
      </label>
      <label>Mikrofon-Empfindlichkeit
        <div class="seg" data-key="micSens">${[['normal', 'Normal'], ['hoch', 'Hoch'], ['sehrhoch', 'Sehr hoch']].map(([v, l]) => `<button class="${(st.micSens || 'hoch') === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      </label>
      <p class="muted small">„Sehr hoch" hilft bei leisen oder tiefen Stimmen, reagiert aber auch eher auf Geräusche.</p>
      <label>Genauigkeit beim Singen
        <div class="seg" data-key="tolerance">${[[60, 'Locker'], [40, 'Normal'], [25, 'Streng']].map(([v, l]) => `<button class="${st.tolerance === v ? 'on' : ''}" data-v="${v}">${l}</button>`).join('')}</div>
      </label>
      <button class="btn ghost" id="mic-test">${icon('mic')} Mikrofon testen</button>
      <p class="muted small" id="mic-out"></p>
      <div class="calib">
        <b>Tonhöhe kalibrieren</b>
        <p class="muted small">Falls Töne zu hoch oder zu tief erkannt werden: Spiele mit einem anderen Gerät (Stimmgerät-App oder Tongenerator) den Kammerton a' mit 440 Hz und tippe dann auf „Kalibrieren".</p>
        <p class="small" id="calib-state">${calibrationCents() ? `Aktive Korrektur: ${calibrationCents() > 0 ? '+' : ''}${calibrationCents()} Cent` : 'Keine Korrektur aktiv.'}</p>
        <div class="row-btns"><button class="btn ghost" id="calib-go">Kalibrieren (440 Hz)</button><button class="btn ghost" id="calib-reset" ${calibrationCents() ? '' : 'hidden'}>Zurücksetzen</button></div>
      </div>
    </section>
    <section class="card form" id="sync-sec"></section>
    <section class="card form">
      <h2>Daten</h2>
      <p class="muted small">Eine Sicherungsdatei enthält den Fortschritt dieses Geräts.</p>
      <div class="row-btns">
        <button class="btn ghost" id="export">Sicherung speichern</button>
        <label class="btn ghost file">Sicherung laden<input type="file" accept="application/json,.json" id="import" hidden></label>
      </div>
      <button class="btn danger" id="reset">Alles zurücksetzen</button>
      <p class="muted small">Zurücksetzen löscht den Fortschritt auf allen synchronisierten Geräten.</p>
    </section>
    <section class="card">
      <h2>Über</h2>
      <p class="muted small">Gehörbildungstrainer, Version ${window.GBT_VERSION}. Klavierklang: Salamander Grand Piano von Alexander Holm (CC BY 3.0). Notensatz: VexFlow (MIT).</p>
    </section>
  `;
  renderSyncSection($app.querySelector('#sync-sec'));
  $app.querySelectorAll('.seg[data-key]').forEach((seg) => {
    const key = seg.dataset.key;
    seg.querySelectorAll('button').forEach((b) => b.addEventListener('click', (e) => {
      e.preventDefault();
      let v = b.dataset.v;
      if (key === 'dailyGoal' || key === 'tolerance') v = Number(v);
      if (key === 'autoplay') v = v === 'true';
      store.setSetting(key, v);
      configureMic({ sensitivity: store.settings().micSens, voice: store.settings().voice });
      seg.querySelectorAll('button').forEach((x) => x.classList.toggle('on', x === b));
    }));
  });
  let testing = null;
  $app.querySelector('#mic-test').addEventListener('click', async () => {
    const out = $app.querySelector('#mic-out');
    if (testing) { cancelAnimationFrame(testing); testing = null; stopMic(); out.textContent = ''; return; }
    configureMic({ sensitivity: store.settings().micSens, voice: store.settings().voice });
    try {
      await unlock();
      await startMic();
    } catch (e) {
      out.textContent = e.userMessage || `Kein Zugriff auf das Mikrofon (${e.name || e.message}).`;
      return;
    }
    const loop = () => {
      const p = readPitch();
      const lvl = p ? Math.min(100, Math.round(Math.sqrt(p.rms) * 220)) : 0;
      if (p && p.freq > 0 && p.clarity > 0.5) {
        const mm = midiOfFreq(p.freq);
        const c = Math.round((mm - Math.round(mm)) * 100);
        out.textContent = `Pegel ${lvl} %. Erkannt: ${noteNameFromMidi(Math.round(mm))} (${Math.round(p.freq)} Hz, ${c > 0 ? '+' : ''}${c} Cent). Tippe erneut zum Beenden.`;
      } else {
        out.textContent = `Pegel ${lvl} %. Sing einen Ton … ${lvl < 3 ? '(Ich höre fast nichts.)' : ''}`;
      }
      testing = requestAnimationFrame(loop);
    };
    out.textContent = 'Sing einen Ton …';
    loop();
  });
  $app.querySelector('#calib-reset').addEventListener('click', () => { setCalibration(1); route(); });
  $app.querySelector('#calib-go').addEventListener('click', async () => {
    const st = $app.querySelector('#calib-state');
    const btn = $app.querySelector('#calib-go');
    if (testing) { cancelAnimationFrame(testing); testing = null; }
    try { await unlock(); await startMic(); } catch (e) { st.textContent = e.userMessage || 'Kein Zugriff auf das Mikrofon.'; return; }
    btn.disabled = true;
    st.textContent = 'Höre zu … spiel jetzt 440 Hz ab.';
    const vals = [];
    const t0 = performance.now();
    const loop = () => {
      const p = readPitch();
      if (p && p.raw > 300 && p.raw < 600 && p.clarity > 0.8) vals.push(p.raw);
      if (performance.now() - t0 < 4000 && vals.length < 90) { testing = requestAnimationFrame(loop); return; }
      testing = null;
      btn.disabled = false;
      if (vals.length < 20) { st.textContent = 'Kein klarer Ton um 440 Hz gehört. Lauter abspielen und nochmal versuchen.'; return; }
      vals.sort((a, b) => a - b);
      const med = vals[Math.floor(vals.length / 2)];
      const f = 440 / med;
      if (Math.abs(1200 * Math.log2(f)) > 300) { st.textContent = `Gemessen: ${Math.round(med)} Hz. Das ist zu weit von 440 Hz weg, bitte prüfen, ob wirklich 440 Hz gespielt werden.`; return; }
      setCalibration(f);
      st.textContent = `Gemessen: ${med.toFixed(1)} Hz. Korrektur gespeichert: ${calibrationCents() > 0 ? '+' : ''}${calibrationCents()} Cent.`;
      $app.querySelector('#calib-reset').hidden = false;
    };
    loop();
  });
  const offSync = sync.onStatus(() => renderSyncSection($app.querySelector('#sync-sec')));
  cleanup = () => { if (testing) cancelAnimationFrame(testing); stopMic(); offSync(); };
  $app.querySelector('#export').addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `gehoerbildung-sicherung-${store.todayKey()}.json`;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000);
  });
  $app.querySelector('#import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      store.importData(await f.text());
      toast('Sicherung geladen.');
      route();
    } catch (err) {
      toast('Die Datei konnte nicht gelesen werden.');
    }
  });
  $app.querySelector('#reset').addEventListener('click', (e) => {
    const b = e.currentTarget;
    if (b.dataset.armed) {
      store.resetAll();
      toast('Alles zurückgesetzt.');
      route();
    } else {
      b.dataset.armed = '1';
      b.textContent = 'Wirklich? Nochmal tippen zum Löschen';
      setTimeout(() => { if (b.isConnected) { delete b.dataset.armed; b.textContent = 'Alles zurücksetzen'; } }, 4000);
    }
  });
}

function timeAgo(ts) {
  if (!ts) return 'noch nie';
  const d = new Date(ts);
  const same = store.todayKey(d) === store.todayKey();
  return (same ? 'heute' : d.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })) + ', ' + d.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' }) + ' Uhr';
}

const TOKEN_URL = 'https://github.com/settings/tokens/new?scopes=gist&description=Geh%C3%B6rbildungstrainer';

function renderSyncSection(el) {
  if (!el) return;
  const st = sync.getStatus();
  const me = store.deviceInfo();
  const devs = store.otherDevices();
  if (!sync.isConnected()) {
    el.innerHTML = h`
      <h2>Synchronisation</h2>
      <p class="muted small">Verbinde deine Geräte, dann landet dein Fortschritt auf Handy, iPad und PC an einem Ort. Gespeichert wird er in einem privaten Gist in deinem GitHub-Konto.</p>
      <ol class="steps-list small">
        <li><a href="${TOKEN_URL}" target="_blank" rel="noopener">Token bei GitHub erstellen</a>. Das Häkchen bei „gist" ist schon gesetzt. Unter „Expiration" kannst du „No expiration" wählen. Dann ganz unten auf „Generate token" tippen.</li>
        <li>Den Token (beginnt mit <code>ghp_</code>) kopieren und hier einfügen.</li>
        <li>Auf jedem Gerät denselben Token eintragen.</li>
      </ol>
      <label>Token<input type="password" id="sync-token" autocomplete="off" autocapitalize="off" spellcheck="false" placeholder="ghp_…"></label>
      <button class="btn primary" id="sync-connect">Verbinden</button>
      <p class="muted small" id="sync-msg">${esc(st.message || '')}</p>`;
    el.querySelector('#sync-connect').addEventListener('click', async () => {
      const t = el.querySelector('#sync-token').value.trim();
      const msg = el.querySelector('#sync-msg');
      if (!/^(ghp_|github_pat_|gho_)/.test(t)) { msg.textContent = 'Das sieht nicht nach einem GitHub-Token aus. Er beginnt mit ghp_ oder github_pat_.'; return; }
      el.querySelector('#sync-connect').disabled = true;
      msg.textContent = 'Verbinde …';
      try {
        await sync.connect(t);
        toast('Synchronisation eingerichtet.');
      } catch (e) {
        msg.textContent = e.message;
        el.querySelector('#sync-connect').disabled = false;
      }
    });
    return;
  }
  const stateText = { syncing: 'Gleiche ab …', ok: `Zuletzt abgeglichen: ${timeAgo(st.at)}`, error: st.message, idle: `Zuletzt abgeglichen: ${timeAgo(st.at)}` }[st.state] || '';
  el.innerHTML = h`
    <h2>Synchronisation</h2>
    <p class="sync-state ${st.state}">${esc(stateText)}</p>
    <div class="devices">
      <div class="dev"><b>${esc(me.name)}</b><span class="pill">dieses Gerät</span></div>
      ${devs.map((d) => `<div class="dev"><b>${esc(d.name)}</b><span class="muted small">zuletzt geübt: ${timeAgo(d.updatedAt)}</span></div>`).join('')}
    </div>
    ${devs.length ? '' : '<p class="muted small">Noch keine weiteren Geräte. Trage denselben Token auf deinem Handy, iPad oder PC ein.</p>'}
    <label>Name dieses Geräts<input type="text" id="dev-name" value="${esc(me.name)}" maxlength="40"></label>
    <div class="row-btns">
      <button class="btn primary" id="sync-now" ${st.state === 'syncing' ? 'disabled' : ''}>Jetzt abgleichen</button>
      <button class="btn ghost" id="sync-off">Trennen</button>
    </div>`;
  el.querySelector('#sync-now').addEventListener('click', () => sync.syncNow());
  el.querySelector('#dev-name').addEventListener('change', (e) => { store.setDeviceName(e.target.value); sync.schedule(500); });
  el.querySelector('#sync-off').addEventListener('click', () => { sync.disconnect(); toast('Synchronisation getrennt. Der Fortschritt bleibt auf diesem Gerät.'); });
}

function toast(msg) {
  const t = document.createElement('div');
  t.className = 'toast';
  t.textContent = msg;
  document.body.appendChild(t);
  setTimeout(() => t.classList.add('show'), 10);
  setTimeout(() => { t.classList.remove('show'); setTimeout(() => t.remove(), 300); }, 2500);
}

// ---------- Start ----------
$tabs.innerHTML = [
  ['heute', 'home', 'Heute'],
  ['ueben', 'practice', 'Üben'],
  ['klavier', 'piano', 'Klavier'],
  ['statistik', 'stats', 'Statistik'],
  ['einstellungen', 'settings', 'Einstellungen'],
].map(([v, ic, l]) => `<a href="#/${v}" data-view="${v}">${icon(ic)}<span>${l}</span></a>`).join('');

store.requestPersistence();
route();
sync.init();
// Neue Daten von einem anderen Gerät: Übersicht neu zeichnen (nicht mitten in einer Runde)
window.addEventListener('gbt-remote', () => {
  const v = location.hash;
  if (!v.startsWith('#/runde') && !v.startsWith('#/einstellungen')) route();
});

// Beim Tageswechsel (App bleibt offen) neu zeichnen
let lastKey = store.todayKey();
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && store.todayKey() !== lastKey) {
    lastKey = store.todayKey();
    if (!location.hash.startsWith('#/runde')) route();
  }
});

// Jede Berührung hält die Tonausgabe am Leben (iOS spielt nur nach einer Berührung Ton ab)
for (const t of ['touchend', 'click', 'keydown']) document.addEventListener(t, primeAudio, { capture: true, passive: true });

if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('sw.js').then((r) => r.update()).catch(() => {});
  // Neue Version: sofort neu laden, außer mitten in einer Runde
  let reloaded = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloaded) return;
    reloaded = true;
    if (location.hash.startsWith('#/runde')) window.addEventListener('hashchange', () => location.reload(), { once: true });
    else location.reload();
  });
}
// Klänge nach dem ersten Tippen im Hintergrund laden, damit sie auch offline da sind
window.addEventListener('pointerdown', () => { setTimeout(preloadAll, 1500); }, { once: true });
