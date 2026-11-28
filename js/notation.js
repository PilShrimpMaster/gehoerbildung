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
  if (opts.grand) return renderGrand(el, groups, opts);
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
  const avail = stave.getNoteEndX() - stave.getNoteStartX() - (groups.length > 1 ? 30 : 10);
  new Formatter().joinVoices([voice]).format([voice], Math.max(40, avail));
  voice.draw(ctx, stave);
  fitSvg(el, width, height);
}

function fitSvg(el, width, height) {
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

// Klaviersystem: in jeder Gruppe kommt der tiefste Ton ins Bass-System, die übrigen ins Violin-System.
function renderGrand(el, groups, opts) {
  const { Renderer, Stave, StaveNote, Accidental, Formatter, Voice, StaveConnector } = VF();
  el.innerHTML = '';
  const width = opts.width || Math.min(el.clientWidth || 320, 520);
  const height = opts.height || 230;
  const renderer = new Renderer(el, Renderer.Backends.SVG);
  renderer.resize(width, height);
  const ctx = renderer.getContext();
  ctx.setFillStyle('currentColor');
  ctx.setStrokeStyle('currentColor');
  const x = 22;
  const y0 = Math.max(0, (height - 210) / 2);
  const top = new Stave(x, y0, width - x - 8);
  const bot = new Stave(x, y0 + 95, width - x - 8);
  top.addClef('treble');
  bot.addClef('bass');
  top.setContext(ctx).draw();
  bot.setContext(ctx).draw();
  new StaveConnector(top, bot).setType('brace').setContext(ctx).draw();
  new StaveConnector(top, bot).setType('singleLeft').setContext(ctx).draw();
  new StaveConnector(top, bot).setType('singleRight').setContext(ctx).draw();
  if (!groups.length) return fitSvg(el, width, height);
  const mk = (notes, clef, gi) => {
    const sn = new StaveNote({ keys: notes.map(vexKey), duration: opts.duration || 'w', clef, align_center: groups.length === 1 });
    notes.forEach((n, i) => {
      const acc = vexAcc(n);
      if (acc) sn.addModifier(new Accidental(acc), i);
    });
    sn.setLedgerLineStyle({ strokeStyle: 'currentColor', fillStyle: 'currentColor', lineWidth: 1.4 });
    const color = opts.colors && opts.colors[gi];
    if (color) sn.setStyle({ fillStyle: color, strokeStyle: color });
    return sn;
  };
  const upper = [];
  const lower = [];
  groups.forEach((chord, gi) => {
    const sorted = chord.slice().sort((a, b) => midiOf(a) - midiOf(b));
    lower.push(mk([sorted[0]], 'bass', gi));
    upper.push(mk(sorted.slice(1).length ? sorted.slice(1) : [sorted[0]], 'treble', gi));
  });
  const v1 = new Voice({ num_beats: groups.length * 4, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(upper);
  const v2 = new Voice({ num_beats: groups.length * 4, beat_value: 4 }).setMode(Voice.Mode.SOFT).addTickables(lower);
  const avail = top.getNoteEndX() - top.getNoteStartX() - (groups.length > 1 ? 24 : 10);
  new Formatter().joinVoices([v1]).joinVoices([v2]).format([v1, v2], Math.max(40, avail));
  v1.draw(ctx, top);
  v2.draw(ctx, bot);
  fitSvg(el, width, height);
}
