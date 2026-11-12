// Pointer -> core Input mapping (one finger or mouse).
//
// Design (decided): side 3/4 view of the wheel.
// - Ring = finger height projected onto the pot's current on-screen height (base..rim), 0..47.
// - PUSH (default): horizontal finger velocity moves the clay at that height. Toward the pot axis
//   narrows (negative dr), away widens (positive dr).
// - THIN: finger speed in any direction along the wall thins it at that height (dr >= 0).
// - Tap (short press, little movement) on the top/centre of an unopened lump = OPEN.
// The pointer is One-Euro filtered and sampled once per 30 Hz sim tick, then quantised to the
// integer Input the deterministic core consumes. Nothing here feeds floats back into the core.

import { RINGS, TICK_HZ } from '../../shared/core/fixed';
import { Mode, type Input, type ModeId } from '../../shared/core/shape';
import { OneEuroFilter } from './oneEuro';

export type ThrowToolId = 'push' | 'thin';

/** Where the pot sits on screen this tick, in CSS px relative to the canvas. */
export type PotScreenFrame = {
  /** Screen x of the pot axis. */
  axisX: number;
  /** Screen y of the base silhouette (bottom of the pot's side outline). */
  baseY: number;
  /** Screen y of the rim silhouette (top of the pot's side outline). */
  rimY: number;
  /** Screen y of the very top centre (lump apex / rim centre). */
  topY: number;
  /** CSS px per clay unit (0.1 mm), measured horizontally at the pot. */
  pxPerUnit: number;
  /** On-screen radius of the top of the pot (px). */
  topRadiusPx: number;
  /** Largest on-screen radius of the pot (px). */
  maxRadiusPx: number;
};

/** All the feel constants in one place. Units: CSS px, clay units (0.1 mm), ticks (1/30 s). */
export const INPUT_TUNING = {
  /** Clay units of radius change per (clay unit of horizontal finger travel per tick). */
  pushGain: 0.5,
  /** Same for thinning; thinning is gentler than pushing. */
  thinGain: 0.2,
  /** Speeds below this (clay units/tick, after gain) are ignored, so a resting finger never jitters the clay. */
  deadZone: 1.25,
  /** Movement (px) before a press turns into a shaping stroke. */
  slopPx: 6,
  /** A press shorter than this with less movement than tapMaxMovePx is a tap. */
  tapMaxMs: 320,
  tapMaxMovePx: 12,
  /** The push side only flips after crossing the axis by this fraction of the pot's on-screen radius. */
  sideHysteresis: 0.3,
  /** One-Euro filter on the pointer (px). */
  euro: { minCutoff: 1.6, beta: 0.006, dCutoff: 1.2 },
} as const;

export type MapperContext = { opened: boolean; slumped: boolean; tool: ThrowToolId; canRecord: boolean };

export type Contact = {
  ring: number;
  /** Which side of the axis the finger is on (screen space): -1 left, +1 right. */
  side: -1 | 1;
  mode: ModeId;
  /** 0..1, how hard the clay is being worked this tick (for glow/wheel feedback). */
  strength: number;
};

export type MapperSample = {
  input: Input | null;
  contact: Contact | null;
  /** The player tried to thin before opening (UI can pulse the open target). */
  needsOpen: boolean;
};

type Phase = 'idle' | 'pending' | 'shaping';

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);

export class PointerMapper {
  private readonly canvas: HTMLCanvasElement;
  private activeId: number | null = null;
  private phase: Phase = 'idle';
  private rect: DOMRect | null = null;
  private rawX = 0;
  private rawY = 0;
  private downX = 0;
  private downY = 0;
  private downT = 0;
  private readonly fx = new OneEuroFilter(INPUT_TUNING.euro);
  private readonly fy = new OneEuroFilter(INPUT_TUNING.euro);
  private prevX = 0;
  private prevY = 0;
  private havePrev = false;
  private side: -1 | 1 = 1;
  private sideLocked = false;
  private tap: { x: number; y: number } | null = null;
  private enabled = true;
  private openQueued = false;
  /** Filtered pointer position (CSS px) while pressed, for visuals. */
  readonly pointer = { x: 0, y: 0, down: false };

  /** Called when the finger lifts (or the gesture is cancelled). */
  onRelease: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    // touch-action: none ONLY on this canvas (expanded view). Never on the root.
    canvas.style.touchAction = 'none';
    canvas.addEventListener('pointerdown', this.handleDown);
    canvas.addEventListener('pointermove', this.handleMove);
    canvas.addEventListener('pointerup', this.handleUp);
    canvas.addEventListener('pointercancel', this.handleCancel);
    canvas.addEventListener('lostpointercapture', this.handleCancel);
    canvas.addEventListener('contextmenu', this.handleContextMenu);
  }

  dispose(): void {
    const c = this.canvas;
    c.removeEventListener('pointerdown', this.handleDown);
    c.removeEventListener('pointermove', this.handleMove);
    c.removeEventListener('pointerup', this.handleUp);
    c.removeEventListener('pointercancel', this.handleCancel);
    c.removeEventListener('lostpointercapture', this.handleCancel);
    c.removeEventListener('contextmenu', this.handleContextMenu);
  }

  setEnabled(on: boolean): void {
    this.enabled = on;
    if (!on) {
      this.cancel();
      this.tap = null;
      this.openQueued = false;
    }
  }

  get isEnabled(): boolean {
    return this.enabled;
  }

  /** True while a finger is down on the canvas (pending or shaping). */
  get pressed(): boolean {
    return this.activeId !== null;
  }

  get shaping(): boolean {
    return this.phase === 'shaping';
  }

  /** Programmatic open (same as tapping the clay centre); consumed on the next tick. */
  queueOpen(): void {
    this.openQueued = true;
  }

  /** Abort the current gesture (undo/reset/disable). Fires onRelease if a finger was down. */
  cancel(): void {
    if (this.activeId === null) return;
    const id = this.activeId;
    this.activeId = null;
    this.phase = 'idle';
    this.pointer.down = false;
    try {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    } catch {
      /* pointer already gone */
    }
    this.onRelease?.();
  }

  /**
   * Sample once per 30 Hz sim tick. Returns the quantised Input for this tick (or null).
   * Must be called exactly once per tick so the filter runs at a fixed rate.
   */
  sample(frame: PotScreenFrame, ctx: MapperContext): MapperSample {
    const out: MapperSample = { input: null, contact: null, needsOpen: false };
    const T = INPUT_TUNING;
    const dt = 1 / TICK_HZ;

    // 1) Open: programmatic, or a qualifying tap on the lump's top.
    if (this.openQueued || this.tap) {
      const t = this.tap;
      const wantOpen = this.openQueued || (t !== null && hitsTop(t.x, t.y, frame));
      this.openQueued = false;
      this.tap = null;
      if (wantOpen && ctx.canRecord && !ctx.opened && !ctx.slumped) {
        out.input = { ring: 0, mode: Mode.OPEN, dr: 0 };
        return out;
      }
    }

    if (this.activeId === null) return out;

    // 2) Filter the finger at the fixed tick rate (also while pending, so the filter is warm).
    const x = this.fx.filter(this.rawX, dt);
    const y = this.fy.filter(this.rawY, dt);
    const vx = this.havePrev ? x - this.prevX : 0;
    const vy = this.havePrev ? y - this.prevY : 0;
    this.prevX = x;
    this.prevY = y;
    this.havePrev = true;
    this.pointer.x = x;
    this.pointer.y = y;

    if (this.phase !== 'shaping' || !this.enabled || !ctx.canRecord || ctx.slumped) return out;
    if (ctx.tool === 'thin' && !ctx.opened) {
      out.needsOpen = true;
      return out;
    }

    // 3) Ring from height: base..rim on screen -> 0..47.
    const span = frame.baseY - frame.rimY;
    const ring = span > 4 ? clamp(Math.floor(((frame.baseY - y) / span) * RINGS), 0, RINGS - 1) : 0;

    // 4) Which side of the axis (decides what "toward the axis" means), with hysteresis.
    const off = x - frame.axisX;
    if (!this.sideLocked) {
      this.side = off >= 0 ? 1 : -1;
      this.sideLocked = true;
    } else if (this.side * off < -T.sideHysteresis * Math.max(10, frame.maxRadiusPx)) {
      this.side = this.side === 1 ? -1 : 1;
    }

    // 5) Velocity -> clay units per tick -> dead zone -> integer dr.
    const ppu = Math.max(1e-4, frame.pxPerUnit);
    let mode: ModeId;
    let v: number;
    if (ctx.tool === 'push') {
      mode = Mode.PUSH;
      v = ((this.side * vx) / ppu) * T.pushGain;
    } else {
      mode = Mode.THIN;
      v = (Math.hypot(vx, vy) / ppu) * T.thinGain;
    }
    const mag = Math.abs(v) - T.deadZone;
    let dr = mag > 0 ? Math.round(Math.sign(v) * mag) : 0;
    dr = clamp(dr, -64, 63);
    if (mode === Mode.THIN) dr = Math.max(0, dr);
    // Normalise -0 so logs and hashes never see it.
    if (dr === 0) dr = 0;

    out.input = { ring, mode, dr };
    out.contact = { ring, side: this.side, mode, strength: clamp(Math.abs(dr) / 22, 0, 1) };
    return out;
  }

  // ---- DOM handlers -------------------------------------------------------------------------

  private localPos(e: PointerEvent): { x: number; y: number } {
    const r = this.rect ?? this.canvas.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  }

  private readonly handleDown = (e: PointerEvent): void => {
    if (!this.enabled || this.activeId !== null) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    this.rect = this.canvas.getBoundingClientRect();
    const p = this.localPos(e);
    this.activeId = e.pointerId;
    try {
      this.canvas.setPointerCapture(e.pointerId);
    } catch {
      /* synthetic or already-released pointer */
    }
    this.phase = 'pending';
    this.rawX = this.downX = p.x;
    this.rawY = this.downY = p.y;
    this.downT = e.timeStamp;
    this.fx.reset(p.x);
    this.fy.reset(p.y);
    this.prevX = p.x;
    this.prevY = p.y;
    this.havePrev = true;
    this.sideLocked = false;
    this.pointer.x = p.x;
    this.pointer.y = p.y;
    this.pointer.down = true;
  };

  private readonly handleMove = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    const p = this.localPos(e);
    this.rawX = p.x;
    this.rawY = p.y;
    if (this.phase === 'pending' && Math.hypot(p.x - this.downX, p.y - this.downY) > INPUT_TUNING.slopPx) {
      this.phase = 'shaping';
    }
  };

  private readonly handleUp = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    const p = this.localPos(e);
    const moved = Math.hypot(p.x - this.downX, p.y - this.downY);
    if (this.phase === 'pending' && e.timeStamp - this.downT <= INPUT_TUNING.tapMaxMs && moved <= INPUT_TUNING.tapMaxMovePx) {
      this.tap = { x: p.x, y: p.y };
    }
    this.finishGesture(e.pointerId);
  };

  private readonly handleCancel = (e: PointerEvent): void => {
    if (e.pointerId !== this.activeId) return;
    this.finishGesture(e.pointerId);
  };

  private readonly handleContextMenu = (e: Event): void => {
    // Long-press on Android opens a context menu; suppress it on this canvas only.
    e.preventDefault();
  };

  private finishGesture(id: number): void {
    this.activeId = null;
    this.phase = 'idle';
    this.pointer.down = false;
    try {
      if (this.canvas.hasPointerCapture(id)) this.canvas.releasePointerCapture(id);
    } catch {
      /* ignore */
    }
    this.onRelease?.();
  }
}

/** Generous hit area for the "tap the centre to open" gesture: the upper part of the lump and just above it. */
function hitsTop(x: number, y: number, f: PotScreenFrame): boolean {
  const rx = Math.max(f.topRadiusPx * 1.35, 34);
  if (Math.abs(x - f.axisX) > rx) return false;
  const top = f.topY - Math.max(36, f.topRadiusPx * 0.7);
  const bottom = f.rimY + (f.baseY - f.rimY) * 0.6;
  return y >= top && y <= bottom;
}
