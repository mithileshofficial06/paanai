import {
  FLOOR_RINGS,
  H_MAX,
  H_MIN,
  INNER_MIN,
  RINGS,
  R_MAX,
  R_MIN,
  WALL_ABS_MIN,
  WALL_OPEN,
  WOBBLE_LIMIT,
  clamp,
  iabs,
  rdiv,
} from './fixed';
import { type Profile, areaSum, cloneProfile, createLump } from './profile';

/** Shaping modes. PUSH moves the clay in/out at a height, THIN thins the wall, OPEN opens the centre. */
export const Mode = { PUSH: 0, THIN: 1, OPEN: 2 } as const;
export type ModeId = (typeof Mode)[keyof typeof Mode];

/** One 30 Hz tick of input. dr is in units per tick, -64..63. */
export type Input = { ring: number; mode: ModeId; dr: number };

/** Smooth falloff around the finger, x / 1024, for |offset| = 0..6 rings. */
export const KERNEL = [1024, 980, 862, 698, 520, 356, 224] as const;
const SPAN = KERNEL.length - 1;

/** Safe minimum wall: taller pots need thicker walls. 90 mm tall -> 3.6 mm, 200 mm -> 5 mm. */
export function safeWall(height: number): number {
  return 25 + rdiv(height, 80);
}

/** Is the current shape unstable? Thin walls or an overhang too steep for its thickness. */
export function isUnsafe(p: Profile): boolean {
  if (!p.opened) {
    // A solid column is only unsafe when it is very tall and thin.
    let minR = R_MAX;
    for (let i = 0; i < RINGS; i++) minR = Math.min(minR, p.outer[i] ?? 0);
    return p.height > minR * 9;
  }
  const minSafe = safeWall(p.height);
  for (let i = p.floorRings; i < RINGS; i++) {
    const w = p.wall[i] ?? 0;
    if (w < minSafe) return true;
    if (i + 1 < RINGS) {
      const dx = (p.outer[i + 1] ?? 0) - (p.outer[i] ?? 0);
      // Outward lean per ring must stay below wall/40 of the ring spacing.
      if (dx > 0 && dx * 40 * RINGS > p.height * w) return true;
    }
  }
  return false;
}

function settle(p: Profile): void {
  p.unsafe = isUnsafe(p);
}

/** Recompute height from the conserved clay. Returns false if out of bounds. */
function conserve(p: Profile): boolean {
  const s = areaSum(p);
  if (s <= 0) return false;
  const h = rdiv(p.clay, s);
  if (h < H_MIN || h > H_MAX) return false;
  p.height = h;
  return true;
}

/** Deterministic slump: the pot sags, widening toward the base and thickening. */
export function slump(p: Profile): void {
  for (let i = 0; i < RINGS; i++) {
    const o = p.outer[i] ?? 0;
    const grow = rdiv(o * (RINGS - i), RINGS * 3);
    const no = clamp(o + grow, R_MIN, R_MAX);
    if (p.opened && i >= p.floorRings) {
      const w = p.wall[i] ?? 0;
      p.wall[i] = clamp(w + rdiv(w * (RINGS - i), RINGS * 2), WALL_ABS_MIN, no - INNER_MIN);
    } else {
      p.wall[i] = no;
    }
    p.outer[i] = no;
  }
  const s = areaSum(p);
  p.height = clamp(rdiv(p.clay, s), H_MIN, H_MAX);
  p.slumped = true;
  p.wobble = 0;
  p.unsafe = false;
}

function advanceWobble(p: Profile): void {
  if (p.slumped) return;
  if (p.unsafe) {
    p.wobble += 1;
    if (p.wobble >= WOBBLE_LIMIT) slump(p);
  } else if (p.wobble > 0) {
    p.wobble = Math.max(0, p.wobble - 2);
  }
}

/** One tick with no input. */
export function idle(p: Profile): void {
  advanceWobble(p);
}

/** Run n idle ticks (fast path when stable). */
export function idleN(p: Profile, n: number): void {
  for (let k = 0; k < n; k++) {
    if (p.slumped || (!p.unsafe && p.wobble === 0)) return;
    advanceWobble(p);
  }
}

function open(p: Profile): void {
  if (p.opened) return;
  const W = WALL_OPEN;
  for (let i = FLOOR_RINGS; i < RINGS; i++) {
    const o = p.outer[i] ?? 0;
    // Keep the ring's clay: o'^2 - (o' - W)^2 = o^2  =>  o' = (o^2 + W^2) / 2W.
    const no = clamp(rdiv(o * o + W * W, 2 * W), R_MIN, R_MAX);
    p.outer[i] = no;
    p.wall[i] = Math.min(W, no - INNER_MIN);
  }
  p.opened = true;
  p.floorRings = FLOOR_RINGS;
}

/**
 * Apply one tick of input. Pure integer maths; the same inputs give the same pot on
 * every device. Returns true if the clay changed.
 */
export function step(p: Profile, input: Input): boolean {
  if (p.slumped) return false;
  const before = cloneProfile(p);
  let changed = false;

  if (input.mode === Mode.OPEN) {
    if (!p.opened) {
      open(p);
      changed = true;
    }
  } else {
    const c = input.ring;
    for (let k = -SPAN; k <= SPAN; k++) {
      const j = c + k;
      if (j < 0 || j >= RINGS) continue;
      const weight = KERNEL[iabs(k)] ?? 0;
      const o = p.outer[j] ?? 0;
      const w = p.wall[j] ?? 0;
      const solid = !p.opened || j < p.floorRings;
      if (input.mode === Mode.PUSH) {
        const d = rdiv(input.dr * weight, 1024);
        if (d === 0) continue;
        const no = clamp(o + d, R_MIN, R_MAX);
        p.outer[j] = no;
        p.wall[j] = solid ? no : clamp(w, WALL_ABS_MIN, no - INNER_MIN);
        changed = changed || no !== o;
      } else if (input.mode === Mode.THIN && !solid) {
        const d = rdiv(iabs(input.dr) * weight, 1024);
        if (d === 0) continue;
        const nw = clamp(w - d, WALL_ABS_MIN, o - INNER_MIN);
        p.wall[j] = nw;
        changed = changed || nw !== w;
      }
    }
  }

  if (changed && !conserve(p)) {
    // Out of bounds (too tall/short): reject this tick entirely.
    p.height = before.height;
    p.outer.set(before.outer);
    p.wall.set(before.wall);
    p.opened = before.opened;
    p.floorRings = before.floorRings;
    changed = false;
  }
  if (changed) settle(p);
  advanceWobble(p);
  return changed;
}

/** A logged input with the number of ticks since the previous logged input (>= 1). */
export type Entry = Input & { dt: number; start: boolean };

export type StrokeLog = {
  /** Total ticks in the throw timeline (>= tick of the last entry). */
  endTick: number;
  entries: Entry[];
};

/** Replay a whole stroke log from a fresh lump. This is what the server trusts. */
export function replay(log: StrokeLog): Profile {
  const p = createLump();
  let t = 0;
  for (const e of log.entries) {
    idleN(p, e.dt - 1);
    step(p, e);
    t += e.dt;
  }
  if (log.endTick > t) idleN(p, log.endTick - t);
  return p;
}

/** Number of separate strokes (finger-down gestures) in a log. */
export function strokeCount(log: StrokeLog): number {
  let n = 0;
  for (const e of log.entries) if (e.start) n++;
  return n;
}
