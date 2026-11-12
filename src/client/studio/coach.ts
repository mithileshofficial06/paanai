// Live coach for the wheel: compares the pot with the target and says the one most useful
// thing to do next, plus where to do it (a height fraction and a drag direction for the
// on-canvas arrows). Pure function; cheap enough to run on every HUD update.
import type { Profile } from '../../shared/core/profile';

export type CoachDir = 'up' | 'in' | 'out';
export type Coach = { text: string; tone: 'info' | 'good' | 'warn'; arrow: { frac: number; dir: CoachDir; radius: number } | null };

const RINGS_MINUS_1 = 47;

function radiusAt(p: Profile, frac: number): number {
  const x = Math.max(0, Math.min(1, frac)) * RINGS_MINUS_1;
  const i = Math.floor(x);
  const j = Math.min(RINGS_MINUS_1, i + 1);
  const t = x - i;
  return (p.outer[i] ?? 0) * (1 - t) + (p.outer[j] ?? 0) * t;
}

function region(f: number): string {
  if (f < 0.2) return 'base';
  if (f < 0.5) return 'belly';
  if (f < 0.75) return 'shoulder';
  if (f < 0.9) return 'neck';
  return 'rim';
}

export function coach(cur: Profile, tgt: Profile, wetness: number, match: number | null): Coach {
  if (cur.slumped) return { text: 'It collapsed. Undo the last stroke, or start again.', tone: 'warn', arrow: null };
  if (!cur.opened) return { text: 'Tap Open to press a hollow into the clay.', tone: 'info', arrow: null };

  const hRatio = cur.height / Math.max(1, tgt.height);
  if (hRatio < 0.88) {
    const mm = Math.round((tgt.height - cur.height) / 10);
    return { text: `Pull up: drag up along the wall. ${mm} mm to go.`, tone: 'info', arrow: { frac: 0.12, dir: 'up', radius: radiusAt(cur, 0.12) } };
  }

  let maxT = 0;
  for (let i = 0; i <= RINGS_MINUS_1; i++) maxT = Math.max(maxT, tgt.outer[i] ?? 0);
  const tol = Math.max(30, maxT * 0.07);
  let best = 0;
  let bestF = 0.5;
  for (let k = 1; k <= 12; k++) {
    const f = 0.04 + (k / 12) * 0.92;
    const d = radiusAt(cur, f) - radiusAt(tgt, f);
    if (Math.abs(d) > Math.abs(best)) {
      best = d;
      bestF = f;
    }
  }
  if (Math.abs(best) > tol) {
    const r = region(bestF);
    return best > 0
      ? { text: `Squeeze the ${r} in: drag inward on the wall there.`, tone: 'info', arrow: { frac: bestF, dir: 'in', radius: radiusAt(cur, bestF) } }
      : { text: `Swell the ${r} out: drag outward from the wall there.`, tone: 'info', arrow: { frac: bestF, dir: 'out', radius: radiusAt(cur, bestF) } };
  }
  if (hRatio > 1.15) return { text: 'Taller than the target. Undo a pull, or shape the rest to match.', tone: 'info', arrow: null };
  if (wetness < 0.35) return { text: 'The clay is drying and drags. Tap Water.', tone: 'warn', arrow: null };
  if (match !== null && match >= 80) return { text: 'That matches well. Tap Done when you are happy.', tone: 'good', arrow: null };
  return { text: 'Close. Small sideways drags will tidy the curve.', tone: 'info', arrow: null };
}
