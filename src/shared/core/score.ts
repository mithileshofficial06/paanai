import { RINGS, clamp, rdiv } from './fixed';
import { type Profile, capacityMl, maxOuter } from './profile';
import { wallStats, survivesKiln } from './survival';

export type Constraint =
  | { kind: 'capacity'; ml: number; tolPct: number }
  | { kind: 'rim'; rule: 'narrower' | 'wider' }
  | { kind: 'height'; min: number; max: number }
  | { kind: 'survive' }
  | { kind: 'maxStrokes'; n: number };

export type ConstraintResult = { constraint: Constraint; pass: boolean; detail: string };

export type ScoreBreakdown = {
  match: number;
  evenness: number;
  constraints: number;
  efficiency: number;
  total: number;
  stars: 0 | 1 | 2 | 3;
  results: ConstraintResult[];
};

const COLS = 64;
const ROWS = 96;

function insideAt(p: Profile, xNum: number, yNum: number, xDen: number, yDen: number): boolean {
  // Point (x, y) = (xNum / xDen, yNum / yDen) in units. Inside the half-silhouette?
  if (yNum >= p.height * yDen) return false;
  const ring = Math.min(RINGS - 1, Math.floor((yNum * RINGS) / (p.height * yDen)));
  return xNum <= (p.outer[ring] ?? 0) * xDen;
}

/** Silhouette intersection-over-union in percent (0..100). Integer raster, 64 x 96. */
export function silhouetteMatch(a: Profile, b: Profile): number {
  const maxR = Math.max(maxOuter(a), maxOuter(b));
  const maxH = Math.max(a.height, b.height);
  let inter = 0;
  let union = 0;
  for (let r = 0; r < ROWS; r++) {
    const yNum = (2 * r + 1) * maxH;
    const yDen = 2 * ROWS;
    for (let c = 0; c < COLS; c++) {
      const xNum = (2 * c + 1) * maxR;
      const xDen = 2 * COLS;
      const ia = insideAt(a, xNum, yNum, xDen, yDen);
      const ib = insideAt(b, xNum, yNum, xDen, yDen);
      if (ia && ib) inter++;
      if (ia || ib) union++;
    }
  }
  return union === 0 ? 0 : rdiv(inter * 100, union);
}

export function evennessScore(p: Profile): number {
  if (!p.opened) return 0;
  const { cvPct } = wallStats(p);
  return clamp(100 - cvPct * 2, 0, 100);
}

export function checkConstraint(p: Profile, c: Constraint, strokes: number): ConstraintResult {
  switch (c.kind) {
    case 'capacity': {
      const ml = capacityMl(p);
      const tol = rdiv(c.ml * c.tolPct, 100);
      return { constraint: c, pass: ml >= c.ml - tol && ml <= c.ml + tol, detail: `${ml} ml` };
    }
    case 'rim': {
      const rim = p.outer[RINGS - 1] ?? 0;
      const base = p.outer[0] ?? 0;
      const pass = c.rule === 'narrower' ? rim < base : rim > base;
      return { constraint: c, pass, detail: `rim ${rdiv(rim, 10)} mm, base ${rdiv(base, 10)} mm` };
    }
    case 'height': {
      const pass = p.height >= c.min && p.height <= c.max;
      return { constraint: c, pass, detail: `${rdiv(p.height, 10)} mm` };
    }
    case 'survive': {
      const pass = survivesKiln(p);
      return { constraint: c, pass, detail: pass ? 'sound walls' : 'would crack' };
    }
    case 'maxStrokes': {
      return { constraint: c, pass: strokes <= c.n, detail: `${strokes} strokes` };
    }
  }
}

export function starsFor(total: number): 0 | 1 | 2 | 3 {
  return total >= 95 ? 3 : total >= 85 ? 2 : total >= 70 ? 1 : 0;
}

/**
 * Throw score 0..100: 60% shape match, 20% wall evenness, 10% constraints, 10% efficiency.
 * barStrokes = the commissioner's stroke count (fewer or equal earns full efficiency).
 */
export function scoreThrow(
  p: Profile,
  target: Profile,
  constraints: readonly Constraint[],
  strokes: number,
  barStrokes: number
): ScoreBreakdown {
  let match = silhouetteMatch(p, target);
  if (p.slumped) match = rdiv(match, 2);
  if (!p.opened) match = rdiv(match, 2);
  const evenness = evennessScore(p);
  const results = constraints.map((c) => checkConstraint(p, c, strokes));
  const passed = results.filter((r) => r.pass).length;
  const cons = results.length === 0 ? 100 : rdiv(passed * 100, results.length);
  const bar = Math.max(1, barStrokes);
  const efficiency = strokes <= bar ? 100 : rdiv(bar * 100, strokes);
  const total = clamp(rdiv(60 * match + 20 * evenness + 10 * cons + 10 * efficiency, 100), 0, 100);
  return { match, evenness, constraints: cons, efficiency, total, stars: starsFor(total), results };
}

/** Shape match assumed for the commissioner's bar: nobody throws the same pot twice. */
export const BAR_MATCH = 85;

/**
 * The score to beat for a commission. A pot always matches itself 100%, so the bar uses the
 * commissioner's real evenness, constraints and efficiency with shape match fixed at BAR_MATCH.
 */
export function barFor(ref: Profile, constraints: readonly Constraint[], strokes: number): number {
  const s = scoreThrow(ref, ref, constraints, strokes, strokes);
  return clamp(rdiv(60 * BAR_MATCH + 20 * s.evenness + 10 * s.constraints + 10 * s.efficiency, 100), 0, 100);
}
