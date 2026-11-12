import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { areaSum, createLump } from '../../src/shared/core/profile';
import { Mode, idle, step, type Input } from '../../src/shared/core/shape';
import { decodeLog, encodeLog } from '../../src/shared/core/strokes';
import { H_MAX, H_MIN, INNER_MIN, R_MAX, R_MIN, RINGS, WALL_ABS_MIN } from '../../src/shared/core/fixed';
import { scoreThrow } from '../../src/shared/core/score';

const input = fc.record({
  ring: fc.integer({ min: 0, max: RINGS - 1 }),
  mode: fc.constantFrom(Mode.PUSH, Mode.THIN, Mode.OPEN),
  dr: fc.integer({ min: -64, max: 63 }),
});
const tick = fc.option(input, { nil: null, freq: 4 });

describe('properties', () => {
  it('clay is conserved within rounding, and bounds hold, for any input sequence', () => {
    fc.assert(
      fc.property(fc.array(tick, { maxLength: 300 }), (ticks) => {
        const p = createLump();
        for (const t of ticks) {
          if (t) step(p, t as Input);
          else idle(p);
          if (!p.slumped) {
            const s = areaSum(p);
            expect(Math.abs(p.height * s - p.clay) * 2).toBeLessThanOrEqual(s);
          }
          expect(p.height).toBeGreaterThanOrEqual(H_MIN);
          expect(p.height).toBeLessThanOrEqual(H_MAX);
          for (let i = 0; i < RINGS; i++) {
            const o = p.outer[i]!;
            const w = p.wall[i]!;
            expect(o).toBeGreaterThanOrEqual(R_MIN);
            expect(o).toBeLessThanOrEqual(R_MAX);
            if (p.opened && i >= p.floorRings) {
              expect(w).toBeGreaterThanOrEqual(WALL_ABS_MIN);
              expect(o - w).toBeGreaterThanOrEqual(INNER_MIN);
            } else {
              expect(w).toBe(o);
            }
          }
        }
      }),
      { numRuns: 200 }
    );
  });

  it('codec round-trips any valid log', () => {
    const entry = fc.record({
      dt: fc.integer({ min: 1, max: 20 }),
      ring: fc.integer({ min: 0, max: RINGS - 1 }),
      mode: fc.constantFrom(Mode.PUSH, Mode.THIN, Mode.OPEN),
      dr: fc.integer({ min: -64, max: 63 }),
      start: fc.boolean(),
    });
    fc.assert(
      fc.property(fc.array(entry, { maxLength: 200 }), fc.integer({ min: 0, max: 50 }), (entries, extra) => {
        const t = entries.reduce((a, e) => a + e.dt, 0);
        const log = { endTick: t + extra, entries };
        const d = decodeLog(encodeLog(log));
        expect(d.ok).toBe(true);
        if (d.ok) expect(d.log).toEqual(log);
      })
    );
  });

  it('score is always 0..100 and identical profiles match fully', () => {
    fc.assert(
      fc.property(fc.array(input, { maxLength: 120 }), (inputs) => {
        const p = createLump();
        for (const i of inputs) step(p, i as Input);
        const s = scoreThrow(p, p, [], 5, 5);
        const expected = p.slumped && !p.opened ? 25 : p.slumped || !p.opened ? 50 : 100;
        expect(s.match).toBe(expected);
        expect(s.total).toBeGreaterThanOrEqual(0);
        expect(s.total).toBeLessThanOrEqual(100);
      }),
      { numRuns: 100 }
    );
  });
});
