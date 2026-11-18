// Notenanzeige mit VexFlow (lokal eingebunden, funktioniert offline).
import { vexKey, vexAcc, midiOf } from './theory.js';

const VF = () => window.Vex.Flow;

// Wählt den passenden Schlüssel für eine Menge von Noten
export function autoClef(notes) {
  const avg = notes.reduce((s, n) => s + midiOf(n), 0) / notes.length;
  return avg < 57 ? 'bass' : 'treble';
}

/**
 * Zeichnet Noten in ein Element.
 * groups: Array von Akkorden; jeder Akkord ist ein Array von Noten. [[n1],[n2]] = melodisch, [[n1,n2]] = harmonisch
 * opts: { clef, width, height, highlight: Index -> Farbe }
 */
export function renderNotes(el, groups, opts = {}) {
  const { Renderer, Stave, StaveNote, Accidental, Formatter, Voice } = VF();
  el.innerHTML = '';
  const all = groups.flat();
  const clef = opts.clef || autoClef(all.length ? all : [{ l: 0, a: 0, o: 4 }]);
  const width = opts.width || Math.min(el.clientWidth || 320, 520);
  const height = opts.height || 150;
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle('currentColor');
  ctx.setStrokeStyle('currentColor');
  const staveWidth = width - 20;
  const stave = new Stave(10, Math.max(0, (height - 110) / 2), staveWidth, { fill_style: 'currentColor' });
  stave.addClef(clef);
  stave.setContext(ctx).draw();
  if (!groups.length) return;

  const notes = groups.map((chord, gi) => {
    const sorted = chord.slice().sort((a, b) => midiOf(a) - midiOf(b));
    const sn = new StaveNote({ keys: sorted.map(vexKey), duration: opts.duration || 'w', clef, align_center: groups.length === 1 });
    sorted.forEach((n, i) => {
      const acc = vexAcc(n);
      if (acc) sn.addModifier(new Accidental(acc), i);
    });
    sn.setLedgerLineStyle({ strokeStyle: 'currentColor', fillStyle: 'currentColor', lineWidth: 1.4 });
    const color = opts.colors && opts.colors[gi];
    if (color) sn.setStyle({ fillStyle: color, strokeStyle: color });
    return sn;
  });
  const voice = new Voice({ num_beats: notes.length * 4, beat_value: 4 }).setMode(Voice.Mode.SOFT);
  voice.addTickables(notes);
  new Formatter().joinVoices([voice]).format([voice], staveWidth - 80);
  voice.draw(ctx, stave);
  const svg = el.querySelector('svg');
  if (svg) {
    svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
    svg.removeAttribute('width');
    svg.removeAttribute('height');
    svg.style.width = '100%';
    svg.style.maxWidth = width + 'px';
    svg.style.height = 'auto';
  }
}
