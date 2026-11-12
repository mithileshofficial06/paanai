import { Mode, idle, step, type Input, type ModeId } from '../src/shared/core/shape';
import { StrokeRecorder } from '../src/shared/core/strokes';
import { createLump } from '../src/shared/core/profile';

/** Simulate a client session: a list of gestures, each a list of per-tick inputs (null = idle). */
export function simulate(gestures: (Input | null)[][]) {
  const rec = new StrokeRecorder();
  const p = createLump();
  for (const g of gestures) {
    for (const input of g) {
      rec.record(input);
      if (input) step(p, input);
      else idle(p);
    }
    rec.endStroke();
  }
  return { rec, p };
}

export function drag(ring: number, mode: ModeId, dr: number, ticks: number): Input[] {
  return Array.from({ length: ticks }, () => ({ ring, mode, dr }));
}

export const OPEN: Input = { ring: 0, mode: Mode.OPEN, dr: 0 };
export const idleTicks = (n: number): null[] => Array.from({ length: n }, () => null);

/** A decent "cylinder then belly" throw used by several tests. */
export function goodThrow(): (Input | null)[][] {
  return [
    [OPEN],
    idleTicks(5),
    drag(20, Mode.THIN, 8, 10),
    drag(32, Mode.THIN, 8, 10),
    drag(12, Mode.THIN, 6, 8),
    drag(40, Mode.PUSH, -10, 10),
    drag(18, Mode.PUSH, 6, 8),
    idleTicks(20),
  ];
}
