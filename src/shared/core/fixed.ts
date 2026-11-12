// Deterministic integer helpers and the game's physical constants.
// RULE: everything in src/shared/core uses integers only. No Math.exp/sin/cos/pow/log/atan,
// no Date, no Math.random. Division always goes through rdiv()/fdiv().

/** Profile resolution, base (0) to rim (RINGS - 1). */
export const RINGS = 48;
/** Simulation rate. Client and server both step the clay at exactly this rate. */
export const TICK_HZ = 30;
/** Hard caps for a stroke log (3 minutes; 4,000 shaping ticks). */
export const MAX_TICKS = 5400;
export const MAX_ENTRIES = 4000;

// Lengths are in units of 0.1 mm.
export const R_MIN = 120;
export const R_MAX = 1400;
export const H_MIN = 300;
export const H_MAX = 3200;
/** Starting lump of clay: 90 mm tall, 40 mm radius (about 0.9 kg). */
export const LUMP_RADIUS = 400;
export const LUMP_HEIGHT = 900;
/** Wall thickness right after opening. */
export const WALL_OPEN = 180;
/** No wall can ever be thinner than this. */
export const WALL_ABS_MIN = 25;
/** The hole inside must stay at least this wide (radius). */
export const INNER_MIN = 60;
/** Rings that stay solid as the floor after opening. */
export const FLOOR_RINGS = 4;
/** Wobble ticks before a pot slumps (0.5 s at 30 Hz). */
export const WOBBLE_LIMIT = 15;

export const PI_NUM = 355;
export const PI_DEN = 113;

/** Integer division rounded half up. b must be > 0. */
export function rdiv(a: number, b: number): number {
  return Math.floor((2 * a + b) / (2 * b));
}

/** Integer division rounded down. b must be > 0. */
export function fdiv(a: number, b: number): number {
  return Math.floor(a / b);
}

export function clamp(x: number, lo: number, hi: number): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function iabs(x: number): number {
  return x < 0 ? -x : x;
}

/** Integer square root (floor), exact for 0 <= n < 2^52. */
export function isqrt(n: number): number {
  if (n <= 0) return 0;
  let r = Math.floor(Math.sqrt(n));
  while (r * r > n) r--;
  while ((r + 1) * (r + 1) <= n) r++;
  return r;
}
