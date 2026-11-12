import { Mode, type Input, type ModeId } from '../core/shape';
import { StrokeRecorder } from '../core/strokes';
import type { StrokeLog } from '../core/shape';

/** One gesture of a scripted throw: hold (ring, mode, dr) for `ticks`, optionally drifting ring. */
export type Gesture = { ring: number; mode: ModeId; dr: number; ticks: number; toRing?: number; pause?: number };

export const g = {
  open: (): Gesture => ({ ring: 0, mode: Mode.OPEN, dr: 0, ticks: 1, pause: 6 }),
  push: (ring: number, dr: number, ticks: number, toRing?: number): Gesture => ({
    ring,
    mode: Mode.PUSH,
    dr,
    ticks,
    pause: 4,
    ...(toRing === undefined ? {} : { toRing }),
  }),
  thin: (ring: number, dr: number, ticks: number, toRing?: number): Gesture => ({
    ring,
    mode: Mode.THIN,
    dr,
    ticks,
    pause: 4,
    ...(toRing === undefined ? {} : { toRing }),
  }),
};

/** Turn a recipe into a stroke log exactly as a client would record it. */
export function recipeToLog(recipe: readonly Gesture[]): StrokeLog {
  const rec = new StrokeRecorder();
  for (const ge of recipe) {
    for (let t = 0; t < ge.ticks; t++) {
      const ring =
        ge.toRing === undefined ? ge.ring : ge.ring + Math.trunc(((ge.toRing - ge.ring) * t) / Math.max(1, ge.ticks - 1));
      const input: Input = { ring, mode: ge.mode, dr: ge.dr };
      rec.record(input);
    }
    rec.endStroke();
    for (let t = 0; t < (ge.pause ?? 0); t++) rec.record(null);
  }
  return rec.toLog();
}
