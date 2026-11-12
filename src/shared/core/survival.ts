import { RINGS, rdiv, isqrt } from './fixed';
import { type Profile, floorThickness, minWall } from './profile';
import { safeWall } from './shape';

export type Defect = 'collapsed' | 'thin-crack' | 'uneven-crack' | 'base-split' | 'kiln-slump';

/** Wall statistics over the open part of the pot. */
export function wallStats(p: Profile): { mean: number; stddev: number; cvPct: number } {
  if (!p.opened) return { mean: 0, stddev: 0, cvPct: 100 };
  let n = 0;
  let sum = 0;
  for (let i = p.floorRings; i < RINGS; i++) {
    sum += p.wall[i] ?? 0;
    n++;
  }
  const mean = rdiv(sum, n);
  let v = 0;
  for (let i = p.floorRings; i < RINGS; i++) {
    const d = (p.wall[i] ?? 0) - mean;
    v += d * d;
  }
  const stddev = isqrt(rdiv(v, n));
  return { mean, stddev, cvPct: mean > 0 ? rdiv(stddev * 100, mean) : 100 };
}

/** Steepest outward lean relative to what the wall can hold, in percent of the limit. */
export function overhangLoadPct(p: Profile): number {
  if (!p.opened) return 0;
  let worst = 0;
  for (let i = p.floorRings; i + 1 < RINGS; i++) {
    const dx = (p.outer[i + 1] ?? 0) - (p.outer[i] ?? 0);
    const w = p.wall[i] ?? 1;
    if (dx <= 0) continue;
    // Limit used by isUnsafe: dx * 40 * RINGS <= height * w.
    const pct = rdiv(dx * 40 * RINGS * 100, Math.max(1, p.height * w));
    if (pct > worst) worst = pct;
  }
  return worst;
}

/**
 * Kiln survival. Skill-based and deterministic: firing is stricter than the wheel.
 * Returns the defects; the pot survives when the list is empty.
 */
export function kilnDefects(p: Profile): Defect[] {
  if (p.slumped) return ['collapsed'];
  if (!p.opened) return ['base-split'];
  const out: Defect[] = [];
  const mw = minWall(p);
  if (mw * 100 < safeWall(p.height) * 118) out.push('thin-crack');
  const { mean, cvPct } = wallStats(p);
  if (cvPct > 38) out.push('uneven-crack');
  if (floorThickness(p) > mean * 4 && floorThickness(p) > 220) out.push('base-split');
  if (overhangLoadPct(p) > 80) out.push('kiln-slump');
  return out;
}

export function survivesKiln(p: Profile): boolean {
  return kilnDefects(p).length === 0;
}
