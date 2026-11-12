import {
  FLOOR_RINGS,
  LUMP_HEIGHT,
  LUMP_RADIUS,
  PI_DEN,
  PI_NUM,
  RINGS,
  fdiv,
  rdiv,
} from './fixed';
import { hashInts } from './rng';

/**
 * A pot is a profile of RINGS rings from base to rim. Ring i sits at height
 * (i + 0.5) * height / RINGS. Each ring has an outer radius and a wall thickness.
 * A solid ring has wall === outer. All values are integers in 0.1 mm units.
 */
export type Profile = {
  height: number;
  outer: Int32Array;
  wall: Int32Array;
  /** Rings that are solid floor (only meaningful once opened). */
  floorRings: number;
  opened: boolean;
  slumped: boolean;
  /** Ticks of accumulated instability; reaching WOBBLE_LIMIT slumps the pot. */
  wobble: number;
  /** Cached: is the current shape unsafe (thin wall or overhang)? */
  unsafe: boolean;
  /** Conserved clay quantity: height * areaSum. Never changes after creation. */
  clay: number;
};

/** Dome taper for the top rings of the starting lump (x / 1024). */
const DOME = [1024, 1018, 1006, 988, 960];

export function createLump(): Profile {
  const outer = new Int32Array(RINGS);
  const wall = new Int32Array(RINGS);
  for (let i = 0; i < RINGS; i++) {
    const fromTop = RINGS - 1 - i;
    const taper = fromTop < DOME.length ? (DOME[DOME.length - 1 - fromTop] ?? 1024) : 1024;
    const r = rdiv(LUMP_RADIUS * taper, 1024);
    outer[i] = r;
    wall[i] = r;
  }
  const p: Profile = {
    height: LUMP_HEIGHT,
    outer,
    wall,
    floorRings: FLOOR_RINGS,
    opened: false,
    slumped: false,
    wobble: 0,
    unsafe: false,
    clay: 0,
  };
  p.clay = LUMP_HEIGHT * areaSum(p);
  return p;
}

export function cloneProfile(p: Profile): Profile {
  return {
    ...p,
    outer: new Int32Array(p.outer),
    wall: new Int32Array(p.wall),
  };
}

/** Annulus area of ring i without the pi factor: outer^2 - inner^2 = w(2o - w). */
export function ringArea(p: Profile, i: number): number {
  const o = p.outer[i] ?? 0;
  const w = p.wall[i] ?? 0;
  return w * (2 * o - w);
}

export function areaSum(p: Profile): number {
  let s = 0;
  for (let i = 0; i < RINGS; i++) s += ringArea(p, i);
  return s;
}

export function innerRadius(p: Profile, i: number): number {
  return (p.outer[i] ?? 0) - (p.wall[i] ?? 0);
}

export function isSolidRing(p: Profile, i: number): boolean {
  return !p.opened || i < p.floorRings;
}

/** Interior capacity in millilitres (integer). */
export function capacityMl(p: Profile): number {
  if (!p.opened) return 0;
  let s = 0;
  for (let i = p.floorRings; i < RINGS; i++) {
    const r = innerRadius(p, i);
    s += r * r;
  }
  // s * (height / RINGS) units^3 * pi; 1 ml = 1e6 (0.1 mm)^3 = 10^6 units^3... 1 cm^3 = 100^3 units^3.
  return rdiv(s * p.height * PI_NUM, RINGS * PI_DEN * 1_000_000);
}

/** Floor thickness in units. */
export function floorThickness(p: Profile): number {
  return p.opened ? fdiv(p.floorRings * p.height, RINGS) : p.height;
}

export function maxOuter(p: Profile): number {
  let m = 0;
  for (let i = 0; i < RINGS; i++) m = Math.max(m, p.outer[i] ?? 0);
  return m;
}

export function minWall(p: Profile): number {
  if (!p.opened) return p.wall[0] ?? 0;
  let m = Number.MAX_SAFE_INTEGER;
  for (let i = p.floorRings; i < RINGS; i++) m = Math.min(m, p.wall[i] ?? 0);
  return m;
}

/** Stable hash of the full profile state (golden tests, cross-engine checks). */
export function profileHash(p: Profile): number {
  const flags = (p.opened ? 1 : 0) | (p.slumped ? 2 : 0) | (p.unsafe ? 4 : 0);
  return hashInts([p.height, p.floorRings, flags, p.wobble, p.clay % 0x7fffffff, ...p.outer, ...p.wall]);
}

/** Compact encoding: height, flags, floorRings, then outer/wall as uint16 each. */
export function encodeProfile(p: Profile): number[] {
  const flags = (p.opened ? 1 : 0) | (p.slumped ? 2 : 0);
  const out = [p.height, flags, p.floorRings];
  for (let i = 0; i < RINGS; i++) out.push(p.outer[i] ?? 0, p.wall[i] ?? 0);
  return out;
}

export function decodeProfile(data: readonly number[]): Profile {
  const outer = new Int32Array(RINGS);
  const wall = new Int32Array(RINGS);
  for (let i = 0; i < RINGS; i++) {
    outer[i] = data[3 + i * 2] ?? 0;
    wall[i] = data[4 + i * 2] ?? 0;
  }
  const flags = data[1] ?? 0;
  const p: Profile = {
    height: data[0] ?? 0,
    outer,
    wall,
    floorRings: data[2] ?? FLOOR_RINGS,
    opened: (flags & 1) !== 0,
    slumped: (flags & 2) !== 0,
    wobble: 0,
    unsafe: false,
    clay: 0,
  };
  p.clay = p.height * areaSum(p);
  return p;
}
