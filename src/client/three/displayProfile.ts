// Visual-only view of the core Profile. It eases toward the latest integer profile every frame so
// the clay moves smoothly at the display rate, and adds the cosmetic opening / wobble / slump
// animation state. It only ever READS the core profile; nothing here is written back.

import { RINGS, WOBBLE_LIMIT } from '../../shared/core/fixed';
import type { Profile } from '../../shared/core/profile';

/** 1 core unit = 0.1 mm = 0.01 cm. The scene is in centimetres. */
export const CM_PER_UNIT = 0.01;

const clamp01 = (x: number): number => (x < 0 ? 0 : x > 1 ? 1 : x);

/**
 * Monotone cubic (Fritsch-Carlson) interpolation over evenly spaced samples. Monotone so the
 * smoothed wall never overshoots the core values (no fake thin spots, no negative radii).
 */
export class MonotoneCurve {
  readonly y: Float32Array;
  readonly m: Float32Array;
  first = 0;
  last = 0;

  constructor(capacity: number) {
    this.y = new Float32Array(capacity);
    this.m = new Float32Array(capacity);
  }

  /** Rebuild tangents for samples src[first..last] (inclusive). */
  build(src: ArrayLike<number>, first: number, last: number): void {
    this.first = first;
    this.last = Math.max(first, last);
    const y = this.y;
    const m = this.m;
    for (let i = first; i <= this.last; i++) y[i] = src[i] ?? 0;
    const n = this.last - first + 1;
    if (n === 1) {
      m[first] = 0;
      return;
    }
    // Secant slopes and initial tangents.
    for (let i = first; i <= this.last; i++) {
      const dPrev = i > first ? y[i]! - y[i - 1]! : null;
      const dNext = i < this.last ? y[i + 1]! - y[i]! : null;
      if (dPrev === null) m[i] = dNext ?? 0;
      else if (dNext === null) m[i] = dPrev;
      else m[i] = dPrev * dNext <= 0 ? 0 : (dPrev + dNext) / 2;
    }
    // Fritsch-Carlson limiter.
    for (let i = first; i < this.last; i++) {
      const d = y[i + 1]! - y[i]!;
      if (d === 0) {
        m[i] = 0;
        m[i + 1] = 0;
        continue;
      }
      const a = m[i]! / d;
      const b = m[i + 1]! / d;
      const s = a * a + b * b;
      if (s > 9) {
        const t = 3 / Math.sqrt(s);
        m[i] = t * a * d;
        m[i + 1] = t * b * d;
      }
    }
  }

  /** Value at fractional sample index s (clamped to the valid range). */
  value(s: number): number {
    const f = this.first;
    const l = this.last;
    if (s <= f) return this.y[f]!;
    if (s >= l) return this.y[l]!;
    const k = Math.floor(s);
    const t = s - k;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * this.y[k]! +
      (t3 - 2 * t2 + t) * this.m[k]! +
      (-2 * t3 + 3 * t2) * this.y[k + 1]! +
      (t3 - t2) * this.m[k + 1]!
    );
  }
}

const easeOutCubic = (t: number): number => 1 - (1 - t) ** 3;

/** Smoothed, animated pot shape in centimetres. */
export class DisplayProfile {
  /** Current displayed outer radius per ring (cm). */
  readonly outer = new Float32Array(RINGS);
  /** Current displayed inner radius per ring (cm, 0 where solid). */
  readonly inner = new Float32Array(RINGS);
  height = 0;
  floorY = 0;
  floorRings = 4;
  opened = false;
  /** 0..1 progress of the cosmetic opening animation (1 = fully formed hole). */
  openT = 0;
  /** 0..1 smoothed wobble intensity. */
  wobble = 0;
  /** 0..~1.08 slump droop progress (cosmetic, overshoots for the "flop"). */
  slump = 0;
  slumped = false;
  /** Seconds since the slump began. */
  private slumpAge = 0;
  /** Fixed object-space direction the pot leans/wobbles toward (radians). */
  leanDir = 0.6;
  /** Seconds since the last discontinuous change (undo/reset), to use a slower morph. */
  private morphAge = 10;
  /** True if the displayed shape is still moving (geometry must be rewritten). */
  dirty = true;

  readonly outerCurve = new MonotoneCurve(RINGS);
  readonly innerCurve = new MonotoneCurve(RINGS);

  private readonly tOuter = new Float32Array(RINGS);
  private readonly tInner = new Float32Array(RINGS);
  private tHeight = 0;
  private tFloorY = 0;
  private tWobble = 0;
  private initialised = false;

  /** Read the latest core profile (call after every sim tick, or whenever it changes). */
  setTarget(p: Profile): void {
    for (let i = 0; i < RINGS; i++) {
      const o = (p.outer[i] ?? 0) * CM_PER_UNIT;
      this.tOuter[i] = o;
      const solid = !p.opened || i < p.floorRings;
      this.tInner[i] = solid ? 0 : Math.max(0, o - (p.wall[i] ?? 0) * CM_PER_UNIT);
    }
    this.tHeight = p.height * CM_PER_UNIT;
    this.floorRings = p.floorRings;
    this.tFloorY = p.opened ? (p.floorRings * this.tHeight) / RINGS : this.tHeight;
    this.tWobble = clamp01(p.wobble / WOBBLE_LIMIT);

    if (p.opened && !this.opened) this.openT = 0; // start the hole animation
    if (!p.opened) this.openT = 0;
    this.opened = p.opened;

    if (p.slumped && !this.slumped) {
      this.slumpAge = 0;
      this.leanDir = Math.random() * Math.PI * 2; // cosmetic only
    }
    if (!p.slumped) {
      this.slump = 0;
      this.slumpAge = 0;
    }
    this.slumped = p.slumped;

    if (!this.initialised) {
      this.snap();
      this.initialised = true;
    }
    this.dirty = true;
  }

  /** Jump straight to the target (first frame, thumbnails). */
  snap(): void {
    this.outer.set(this.tOuter);
    this.inner.set(this.tInner);
    this.height = this.tHeight;
    this.floorY = this.tFloorY;
    this.wobble = this.tWobble;
    if (this.opened) this.openT = 1;
    if (this.slumped) this.slump = 1;
    this.buildCurves();
    this.dirty = true;
  }

  /** Undo/reset: morph a little slower so the change reads as a rewind, not a glitch. */
  markDiscontinuity(): void {
    this.morphAge = 0;
  }

  /** Advance animations by dt seconds. Returns true if the shape moved. */
  update(dt: number, reducedMotion: boolean): boolean {
    this.morphAge += dt;
    const opening = this.opened && this.openT < 1;
    if (opening) this.openT = Math.min(1, this.openT + dt / (reducedMotion ? 0.25 : 0.75));

    // Time constants (s): snappy while shaping, softer for opening and undo morphs.
    let tau = 0.05;
    if (this.morphAge < 0.5) tau = 0.11;
    if (opening) tau = Math.max(tau, 0.16);
    if (this.slumped) tau = 0.09;
    const k = 1 - Math.exp(-dt / tau);

    let moved = false;
    for (let i = 0; i < RINGS; i++) {
      const dO = this.tOuter[i]! - this.outer[i]!;
      const dI = this.tInner[i]! - this.inner[i]!;
      if (Math.abs(dO) > 1e-5 || Math.abs(dI) > 1e-5) {
        this.outer[i] = this.outer[i]! + dO * k;
        this.inner[i] = this.inner[i]! + dI * k;
        moved = true;
      } else {
        this.outer[i] = this.tOuter[i]!;
        this.inner[i] = this.tInner[i]!;
      }
    }
    const dH = this.tHeight - this.height;
    if (Math.abs(dH) > 1e-5) {
      this.height += dH * k;
      moved = true;
    } else this.height = this.tHeight;
    const dF = this.tFloorY - this.floorY;
    if (Math.abs(dF) > 1e-5) {
      this.floorY += dF * k;
      moved = true;
    } else this.floorY = this.tFloorY;

    // Wobble eases in/out (cosmetic).
    const kw = 1 - Math.exp(-dt / 0.18);
    const dW = this.tWobble - this.wobble;
    if (Math.abs(dW) > 1e-4) {
      this.wobble += dW * kw;
      moved = true;
    } else this.wobble = this.tWobble;

    // Slump: droop over ~0.6 s with a soft overshoot ("flop") that settles.
    if (this.slumped && this.slumpAge < 1.4) {
      this.slumpAge += dt;
      const t = clamp01(this.slumpAge / (reducedMotion ? 0.3 : 0.6));
      const settle = reducedMotion ? 0 : Math.sin(clamp01((this.slumpAge - 0.45) / 0.8) * Math.PI) * 0.09;
      this.slump = easeOutCubic(t) + settle * (1 - clamp01((this.slumpAge - 0.45) / 0.8));
      moved = true;
    }

    if (opening) moved = true;
    if (moved) this.buildCurves();
    this.dirty = this.dirty || moved;
    return moved;
  }

  private buildCurves(): void {
    this.outerCurve.build(this.outer, 0, RINGS - 1);
    const first = this.opened ? Math.min(this.floorRings, RINGS - 1) : RINGS - 1;
    this.innerCurve.build(this.inner, first, RINGS - 1);
  }

  /** Hole formation sub-progress, used by the mesh. */
  get holeRadiusT(): number {
    return this.opened ? easeOutCubic(this.openT) : 0;
  }
  get holeDepthT(): number {
    return this.opened ? easeOutCubic(clamp01((this.openT - 0.06) / 0.94)) : 0;
  }
  /** Cap (lump dome) -> lip morph. */
  get lipT(): number {
    if (!this.opened) return 0;
    const t = clamp01(this.openT / 0.45);
    return t * t * (3 - 2 * t);
  }

  /** Outer radius (cm) at height y (cm). */
  outerAt(y: number): number {
    const s = (y / Math.max(1e-4, this.height)) * RINGS - 0.5;
    return this.outerCurve.value(s);
  }

  /** Inner radius (cm) at height y (cm); only meaningful when opened. */
  innerAt(y: number): number {
    const s = (y / Math.max(1e-4, this.height)) * RINGS - 0.5;
    return this.innerCurve.value(s);
  }

  /** Largest displayed outer radius (cm). */
  maxOuter(): number {
    let m = 0;
    for (let i = 0; i < RINGS; i++) m = Math.max(m, this.outer[i]!);
    return m;
  }
}

/** Static shape of an arbitrary profile, for target outlines and thumbnails. */
export function displayFromProfile(p: Profile): DisplayProfile {
  const d = new DisplayProfile();
  d.setTarget(p);
  d.snap();
  d.leanDir = 0.6;
  return d;
}
