import { intervalsModule } from './intervals.js';
import { chordsModule } from './chords.js';
import { scalesModule } from './scales.js';
import { cadencesModule } from './cadences.js';
import { melodyModule } from './melody.js';

export const MODULES = [
  intervalsModule,
  chordsModule,
  scalesModule,
  cadencesModule,
  melodyModule,
];

export function moduleById(id) {
  return MODULES.find((m) => m.id === id);
}
