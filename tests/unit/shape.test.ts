import { describe, expect, it } from 'vitest';
import { createLump, areaSum, capacityMl, profileHash } from '../../src/shared/core/profile';
import { Mode, replay, step, strokeCount } from '../../src/shared/core/shape';
import { decodeLog, encodeLog, StrokeRecorder } from '../../src/shared/core/strokes';
import { H_MAX, H_MIN } from '../../src/shared/core/fixed';
import { OPEN, drag, goodThrow, idleTicks, simulate } from '../helpers';

describe('lump', () => {
  it('starts solid, unopened and stable', () => {
    const p = createLump();
    expect(p.opened).toBe(false);
    expect(p.height).toBe(900);
    expect(p.clay).toBe(900 * areaSum(p));
    expect(capacityMl(p)).toBe(0);
  });
});

describe('step', () => {
  it('opening keeps the clay and creates capacity', () => {
    const p = createLump();
    step(p, OPEN);
    expect(p.opened).toBe(true);
    expect(capacityMl(p)).toBeGreaterThan(50);
    expect(Math.abs(p.height * areaSum(p) - p.clay)).toBeLessThan(areaSum(p));
  });

  it('pushing inward makes the pot taller (clay moves up)', () => {
    const p = createLump();
    step(p, OPEN);
    const h0 = p.height;
    for (let k = 0; k < 10; k++) step(p, { ring: 24, mode: Mode.PUSH, dr: -10 });
    expect(p.height).toBeGreaterThan(h0);
  });

  it('pushing outward makes the pot shorter', () => {
    const p = createLump();
    step(p, OPEN);
    const h0 = p.height;
    for (let k = 0; k < 10; k++) step(p, { ring: 24, mode: Mode.PUSH, dr: 10 });
    expect(p.height).toBeLessThan(h0);
  });

  it('thinning walls raises the pot', () => {
    const p = createLump();
    step(p, OPEN);
    const h0 = p.height;
    for (let k = 0; k < 10; k++) step(p, { ring: 24, mode: Mode.THIN, dr: 8 });
    expect(p.height).toBeGreaterThan(h0);
  });

  it('thin does nothing before opening', () => {
    const p = createLump();
    const h = profileHash(p);
    step(p, { ring: 24, mode: Mode.THIN, dr: 20 });
    expect(profileHash(p)).toBe(h);
  });

  it('over-thinning wobbles then slumps', () => {
    const { p } = simulate([[OPEN], drag(24, Mode.THIN, 40, 40), idleTicks(30)]);
    expect(p.slumped).toBe(true);
  });

  it('a sensible throw does not slump', () => {
    const { p } = simulate(goodThrow());
    expect(p.slumped).toBe(false);
    expect(p.height).toBeGreaterThanOrEqual(H_MIN);
    expect(p.height).toBeLessThanOrEqual(H_MAX);
  });
});

describe('replay', () => {
  it('replaying the recorded log reproduces the live pot exactly', () => {
    const { rec, p } = simulate(goodThrow());
    const decoded = decodeLog(encodeLog(rec.toLog()));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const q = replay(decoded.log);
    expect(profileHash(q)).toBe(profileHash(p));
    expect(strokeCount(decoded.log)).toBe(6);
  });

  it('replay includes trailing idle ticks (a wobbling pot left alone slumps)', () => {
    const rec = new StrokeRecorder();
    rec.record(OPEN);
    rec.endStroke();
    for (let k = 0; k < 6; k++) rec.record({ ring: 30, mode: Mode.THIN, dr: 40 });
    for (let k = 0; k < 40; k++) rec.record(null);
    expect(replay(rec.toLog()).slumped).toBe(true);
  });

  it('undo rewinds to before the last stroke', () => {
    const rec = new StrokeRecorder();
    rec.record(OPEN);
    rec.endStroke();
    const afterOpen = profileHash(replay(rec.toLog()));
    for (let k = 0; k < 8; k++) rec.record({ ring: 10, mode: Mode.PUSH, dr: 12 });
    rec.endStroke();
    expect(profileHash(replay(rec.toLog()))).not.toBe(afterOpen);
    expect(rec.undo()).toBe(true);
    expect(profileHash(replay(rec.toLog()))).toBe(afterOpen);
  });
});

describe('codec validation', () => {
  it('rejects garbage', () => {
    expect(decodeLog('!!!').ok).toBe(false);
    expect(decodeLog('').ok).toBe(false);
  });
  it('rejects logs longer than 3 minutes', () => {
    expect(decodeLog(encodeLog({ endTick: 6000, entries: [] })).ok).toBe(false);
  });
  it('rejects entries past the end tick', () => {
    const s = encodeLog({ endTick: 1, entries: [{ dt: 5, ring: 1, mode: 0, dr: 1, start: true }] });
    expect(decodeLog(s).ok).toBe(false);
  });
});
