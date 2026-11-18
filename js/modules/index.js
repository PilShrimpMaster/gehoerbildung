import { intervalsModule } from './intervals.js';
import { chordsModule } from './chords.js';
import { scalesModule } from './scales.js';

const soon = (id, title, icon, blurb) => ({ id, title, icon, blurb, available: false, modes: [], levels: [], tasks: () => [] });

export const MODULES = [
  intervalsModule,
  chordsModule,
  scalesModule,
  soon('cadences', 'Kadenzen', 'cadence', 'Stufen und Funktionen in Kadenzen erkennen.'),
  soon('melody', 'Melodiediktat', 'melody', 'Melodien hören und aufschreiben.'),
];

export function moduleById(id) {
  return MODULES.find((m) => m.id === id);
}
