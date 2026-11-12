// Camera: a 3/4 side view slightly above the wheel so the opening and the rim read clearly.
// It frames the pot (and the target silhouette) with a critically damped spring, and holds still
// while a finger is down so the finger-to-ring mapping never shifts mid-gesture.

import { MathUtils, PerspectiveCamera, Vector3 } from 'three';
import type { PotScreenFrame } from '../input/pointerMapper';
import { CM_PER_UNIT, type DisplayProfile } from './displayProfile';

/** Framing constants (tune here). */
export const FRAMING = {
  fov: 30,
  /** Camera elevation above the horizontal (degrees). */
  elevationDeg: 21,
  /** Fraction of the viewport height the pot's projected height should fill. */
  fillHeight: 0.42,
  /** Fraction of the viewport width the pot's diameter may fill. */
  fillWidth: 0.7,
  /** Where the pot's centre sits vertically (0 top .. 1 bottom). */
  centerY: 0.53,
  /** Smallest box we frame (cm): keeps the lump from being shown huge. */
  minHeight: 10,
  minHalfWidth: 5.5,
  smoothTime: 0.55,
} as const;

/** Unity-style SmoothDamp (critically damped spring). */
function smoothDamp(cur: number, target: number, vel: { v: number }, smoothTime: number, dt: number): number {
  const st = Math.max(1e-4, smoothTime);
  const omega = 2 / st;
  const x = omega * dt;
  const exp = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - target;
  const temp = (vel.v + omega * change) * dt;
  vel.v = (vel.v - omega * temp) * exp;
  return target + (change + temp) * exp;
}

const tmp = new Vector3();
const tmp2 = new Vector3();

export class CameraRig {
  readonly camera = new PerspectiveCamera(FRAMING.fov, 1, 1, 3000);
  private width = 1;
  private height = 1;
  private dist = 60;
  private lookY = 5;
  private readonly vDist = { v: 0 };
  private readonly vLook = { v: 0 };
  private initialised = false;
  /** Small cosmetic shake (slump flop), decays by itself. */
  private shake = 0;

  setViewport(w: number, h: number): void {
    this.width = Math.max(1, w);
    this.height = Math.max(1, h);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
  }

  kick(amount: number): void {
    this.shake = Math.max(this.shake, amount);
  }

  /**
   * Frame a box of the given height and half-width (cm), standing on the wheel at y = 0.
   * hold = true keeps the current framing (finger down).
   */
  update(dt: number, boxHeight: number, boxHalfWidth: number, hold: boolean, snap: boolean, time: number): void {
    const el = MathUtils.degToRad(FRAMING.elevationDeg);
    const H = Math.max(FRAMING.minHeight, boxHeight);
    const W = Math.max(FRAMING.minHalfWidth, boxHalfWidth);
    const tanV = Math.tan(MathUtils.degToRad(FRAMING.fov) / 2);
    const tanH = tanV * this.camera.aspect;
    // Projected vertical extent of a cylinder seen from above: side height + the rim ellipse.
    const projH = H * Math.cos(el) + 2 * W * Math.sin(el);
    const dV = projH / (2 * FRAMING.fillHeight) / tanV + W;
    const dH = W / FRAMING.fillWidth / tanH + W;
    const targetDist = Math.max(dV, dH);
    // Put the pot centre at FRAMING.centerY of the screen.
    const ndcOffset = 2 * FRAMING.centerY - 1;
    const targetLook = H * 0.5 + (ndcOffset * targetDist * tanV) / Math.cos(el);

    if (!this.initialised || snap) {
      this.dist = targetDist;
      this.lookY = targetLook;
      this.vDist.v = 0;
      this.vLook.v = 0;
      this.initialised = true;
    } else if (!hold) {
      this.dist = smoothDamp(this.dist, targetDist, this.vDist, FRAMING.smoothTime, dt);
      this.lookY = smoothDamp(this.lookY, targetLook, this.vLook, FRAMING.smoothTime, dt);
    }

    this.shake *= Math.exp(-dt * 6);
    const sx = this.shake * Math.sin(time * 37.0) * 0.25;
    const sy = this.shake * Math.sin(time * 29.0 + 1.3) * 0.2;
    const c = this.camera;
    c.position.set(sx, this.lookY + Math.sin(el) * this.dist + sy, Math.cos(el) * this.dist);
    c.lookAt(sx * 0.5, this.lookY + sy * 0.5, 0);
    c.updateMatrixWorld();
  }

  /** Project a world point to CSS px. */
  toScreen(x: number, y: number, z: number, out: { x: number; y: number }): { x: number; y: number } {
    tmp.set(x, y, z).project(this.camera);
    out.x = (tmp.x * 0.5 + 0.5) * this.width;
    out.y = (-tmp.y * 0.5 + 0.5) * this.height;
    return out;
  }

  /** CSS px per cm at a world point, measured along the camera's right axis. */
  pxPerCmAt(x: number, y: number, z: number): number {
    tmp.set(x, y, z).project(this.camera);
    tmp2.set(x + 1, y, z).project(this.camera);
    return Math.abs(tmp2.x - tmp.x) * 0.5 * this.width;
  }

  /** Where the pot is on screen, for the input mapper. */
  potFrame(d: DisplayProfile, out: PotScreenFrame): PotScreenFrame {
    const H = Math.max(0.5, d.height);
    const rBase = d.outerAt(0);
    const rTop = d.outerAt(H);
    const p = { x: 0, y: 0 };
    this.toScreen(0, H * 0.5, 0, p);
    out.axisX = p.x;
    this.toScreen(rBase, 0, 0, p);
    out.baseY = p.y;
    this.toScreen(rTop, H, 0, p);
    out.rimY = p.y;
    this.toScreen(0, H, 0, p);
    out.topY = p.y;
    const pxPerCm = this.pxPerCmAt(0, H * 0.5, 0);
    out.pxPerUnit = pxPerCm * CM_PER_UNIT;
    out.topRadiusPx = rTop * pxPerCm;
    out.maxRadiusPx = d.maxOuter() * pxPerCm;
    return out;
  }
}
