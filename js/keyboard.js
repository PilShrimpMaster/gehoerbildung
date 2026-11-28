// Kleine Klaviatur zur Eingabe von Tönen (z. B. im Melodiediktat).
import { noteOn } from './audio.js';

const WHITE = [0, 2, 4, 5, 7, 9, 11];
const NAMES = ['C', '', 'D', '', 'E', 'F', '', 'G', '', 'A', '', 'H'];

/**
 * Baut eine Klaviatur von lo bis hi (MIDI) in el.
 * onNote(midi) wird beim Anschlagen aufgerufen. Gibt { destroy, flash(midi) } zurück.
 */
export function createKeyboard(el, { lo, hi, onNote, names = true }) {
  el.innerHTML = '<div class="piano-wrap mini"><div class="piano mini"></div></div>';
  const $wrap = el.firstElementChild;
  const $piano = $wrap.firstElementChild;
  if (names) $piano.classList.add('names');
  const keys = new Map();
  let whiteIdx = 0;
  for (let m = lo; m <= hi; m++) {
    const pc = ((m % 12) + 12) % 12;
    const isWhite = WHITE.includes(pc);
    const k = document.createElement('div');
    k.className = `key ${isWhite ? 'white' : 'black'}`;
    k.dataset.m = m;
    if (isWhite) {
      k.style.left = `calc(var(--kw) * ${whiteIdx})`;
      whiteIdx++;
    } else {
      k.style.left = `calc(var(--kw) * ${whiteIdx} - var(--bw) / 2)`;
    }
    k.innerHTML = `<span>${isWhite ? (pc === 0 ? `C${Math.floor(m / 12) - 1}` : NAMES[pc]) : ''}</span>`;
    keys.set(m, k);
    $piano.appendChild(k);
  }
  // Tastenbreite an die verfügbare Breite anpassen (bei Bedarf seitlich scrollen)
  const fit = () => {
    const w = $wrap.clientWidth - 4;
    const kw = Math.max(30, Math.min(58, Math.floor(w / whiteIdx)));
    $piano.style.setProperty('--kw', `${kw}px`);
    $piano.style.setProperty('--bw', `${Math.round(kw * 0.62)}px`);
    $piano.style.width = `${kw * whiteIdx}px`;
  };
  fit();
  window.addEventListener('resize', fit);

  const held = new Map();
  const keyAt = (x, y) => {
    const t = document.elementFromPoint(x, y);
    const k = t && t.closest('.key');
    return k && $piano.contains(k) ? Number(k.dataset.m) : null;
  };
  const release = (id) => {
    const e = held.get(id);
    if (!e) return;
    held.delete(id);
    keys.get(e.m)?.classList.remove('down');
    if (e.stop) e.stop();
    else e.cancel = true;
  };
  $piano.addEventListener('pointerdown', async (ev) => {
    ev.preventDefault();
    const m = keyAt(ev.clientX, ev.clientY);
    if (m == null) return;
    keys.get(m).classList.add('down');
    const entry = { m, stop: null, cancel: false };
    held.set(ev.pointerId, entry);
    onNote(m);
    const stop = await noteOn(m);
    if (entry.cancel || !held.has(ev.pointerId)) setTimeout(stop, 250);
    else entry.stop = stop;
  });
  for (const t of ['pointerup', 'pointercancel', 'pointerleave']) $piano.addEventListener(t, (ev) => release(ev.pointerId));
  $piano.addEventListener('contextmenu', (e) => e.preventDefault());

  // Den Bereich um die Mitte sichtbar machen
  requestAnimationFrame(() => { $wrap.scrollLeft = ($piano.scrollWidth - $wrap.clientWidth) / 2; });

  return {
    destroy() {
      window.removeEventListener('resize', fit);
      for (const id of [...held.keys()]) release(id);
    },
    mark(midi, cls) {
      const k = keys.get(midi);
      if (!k) return;
      k.classList.add(cls);
      setTimeout(() => k.classList.remove(cls), 600);
    },
  };
}
