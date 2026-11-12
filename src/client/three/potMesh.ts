// The pot as ONE custom BufferGeometry with a fixed topology, rewritten in place whenever the
// displayed shape moves (never re-created per frame).
//
// A 2D profile polyline (r, y) is built from the display profile:
//   outer wall (base -> lip) -> rounded lip -> inner wall (lip -> floor) -> floor fillet -> floor (to axis)
// then revolved around the Y axis. Before opening, the "lip" is a domed cap and every inner/floor
// point collapses onto the apex (zero-area triangles), so the same topology morphs from a lump into
// an opened pot. Normals are computed per profile point from the polyline tangent (analytic, O(rows))
// and rotated, never with computeVertexNormals.

import { BufferAttribute, BufferGeometry, DynamicDrawUsage, Sphere, Vector3 } from 'three';
import type { DisplayProfile } from './displayProfile';

export const POT_SEGMENTS = 72;

const N_OUT = 97; // outer wall rows (96 display rings)
const N_RIM = 14; // lip / dome rows
const N_IN = 96; // inner wall rows
const N_FIL = 7; // floor fillet rows
const N_FLR = 9; // floor rows
export const PROFILE_POINTS = N_OUT + N_RIM + N_IN + N_FIL + N_FLR;

/** Surface kind per profile row: drives the shader (rings follow height on walls, radius on the floor). */
export const KIND = { OUTER: 0, RIM: 0.5, INNER: 1, FILLET: 1.5, FLOOR: 2 } as const;

const clamp = (x: number, lo: number, hi: number): number => (x < lo ? lo : x > hi ? hi : x);
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const smoothstep = (e0: number, e1: number, x: number): number => {
  const t = clamp((x - e0) / (e1 - e0), 0, 1);
  return t * t * (3 - 2 * t);
};

export type PotDeformOptions = {
  time: number;
  reducedMotion: boolean;
};

export class PotGeometry {
  readonly geometry = new BufferGeometry();
  readonly segments: number;
  private readonly cols: number;

  // Profile polyline (per row).
  readonly pr = new Float32Array(PROFILE_POINTS);
  readonly py = new Float32Array(PROFILE_POINTS);
  private readonly pnr = new Float32Array(PROFILE_POINTS);
  private readonly pny = new Float32Array(PROFILE_POINTS);
  private readonly pOcc = new Float32Array(PROFILE_POINTS);
  private readonly pDirect = new Float32Array(PROFILE_POINTS);
  private readonly pKind = new Float32Array(PROFILE_POINTS);

  // Angular tables (per column).
  private readonly cos1: Float32Array;
  private readonly sin1: Float32Array;
  private readonly cos2: Float32Array;
  private readonly sin2: Float32Array;
  private readonly cos3: Float32Array;
  private readonly sin3: Float32Array;

  private readonly position: BufferAttribute;
  private readonly normal: BufferAttribute;
  private readonly shade: BufferAttribute;

  /** Height of the lip apex and opening radius from the last build (cm), for overlays. */
  topY = 0;
  openingRadius = 0;
  baseRadius = 0;

  constructor(segments = POT_SEGMENTS) {
    this.segments = segments;
    this.cols = segments + 1;
    const cols = this.cols;
    this.cos1 = new Float32Array(cols);
    this.sin1 = new Float32Array(cols);
    this.cos2 = new Float32Array(cols);
    this.sin2 = new Float32Array(cols);
    this.cos3 = new Float32Array(cols);
    this.sin3 = new Float32Array(cols);
    for (let j = 0; j < cols; j++) {
      const a = (j / segments) * Math.PI * 2;
      this.cos1[j] = Math.cos(a);
      this.sin1[j] = Math.sin(a);
      this.cos2[j] = Math.cos(2 * a);
      this.sin2[j] = Math.sin(2 * a);
      this.cos3[j] = Math.cos(3 * a);
      this.sin3[j] = Math.sin(3 * a);
    }

    const verts = PROFILE_POINTS * cols;
    this.position = new BufferAttribute(new Float32Array(verts * 3), 3);
    this.normal = new BufferAttribute(new Float32Array(verts * 3), 3);
    this.shade = new BufferAttribute(new Float32Array(verts * 2), 2);
    this.position.setUsage(DynamicDrawUsage);
    this.normal.setUsage(DynamicDrawUsage);
    this.shade.setUsage(DynamicDrawUsage);

    // Static per-vertex: surface kind + angle (u around, for the shader's seamless noise).
    const kind = new Float32Array(verts);
    const kindRows = new Float32Array(PROFILE_POINTS);
    let k = 0;
    for (let i = 0; i < N_OUT; i++) kindRows[k++] = KIND.OUTER;
    for (let i = 0; i < N_RIM; i++) kindRows[k++] = KIND.RIM;
    for (let i = 0; i < N_IN; i++) kindRows[k++] = KIND.INNER;
    for (let i = 0; i < N_FIL; i++) kindRows[k++] = KIND.FILLET;
    for (let i = 0; i < N_FLR; i++) kindRows[k++] = KIND.FLOOR;
    this.pKind.set(kindRows);
    for (let row = 0; row < PROFILE_POINTS; row++) {
      for (let j = 0; j < cols; j++) kind[row * cols + j] = kindRows[row]!;
    }

    const index: number[] = [];
    for (let row = 0; row < PROFILE_POINTS - 1; row++) {
      for (let j = 0; j < segments; j++) {
        const a = row * cols + j;
        const b = a + 1;
        const c = a + cols;
        const d = c + 1;
        // Winding gives outward normals for a profile traversed base -> lip -> inside -> axis.
        index.push(a, c, b, b, c, d);
      }
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', this.position);
    this.geometry.setAttribute('normal', this.normal);
    this.geometry.setAttribute('aShade', this.shade);
    this.geometry.setAttribute('aKind', new BufferAttribute(kind, 1));
    this.geometry.boundingSphere = new Sphere(new Vector3(0, 5, 0), 40);
  }

  dispose(): void {
    this.geometry.dispose();
  }

  /** Rebuild the profile from the display shape and rewrite all vertices in place. */
  update(d: DisplayProfile, o: PotDeformOptions): void {
    this.buildProfile(d);
    this.computeProfileNormals();
    this.revolve(d, o);
  }

  // ---------------------------------------------------------------------------------------------

  private buildProfile(d: DisplayProfile): void {
    const pr = this.pr;
    const py = this.py;
    const occ = this.pOcc;
    const dir = this.pDirect;
    const H = Math.max(0.05, d.height);
    const opened = d.opened;
    const g = d.lipT; // cap -> lip morph
    const radT = d.holeRadiusT;
    const depthT = d.holeDepthT;
    const rO = (y: number): number => Math.max(0.01, d.outerAt(y));
    const rI = (y: number): number => (opened ? Math.max(0, d.innerAt(y)) : 0);

    // Lip / dome dimensions.
    const capB = clamp(0.2 * rO(H), 0.25, 0.85);
    const rOt = rO(H);
    const rIt = rI(H) * radT;
    const lipB = Math.max(0.03, ((rOt - rIt) / 2) * 0.92);
    const b = lerp(capB, lipB, g);
    const yO = H - b; // the outer wall ends here, the lip apex sits at H
    const rOend = rO(yO);
    const rIend = rI(yO) * radT;
    const cR = lerp(0, (rOend + rIend) / 2, g);
    const a = lerp(rOend, Math.max(0.02, (rOend - rIend) / 2), g);
    const thEnd = lerp(Math.PI / 2, Math.PI, g);

    let k = 0;
    // Outer wall: base -> yO.
    for (let i = 0; i < N_OUT; i++) {
      const y = (yO * i) / (N_OUT - 1);
      pr[k] = rO(y);
      py[k] = y;
      // Contact darkening where the clay meets the wheel head.
      occ[k] = 1 - 0.5 * Math.exp(-y / 0.35);
      dir[k] = 1;
      k++;
    }
    // Lip (or dome before opening).
    for (let i = 1; i <= N_RIM; i++) {
      const th = (thEnd * i) / N_RIM;
      pr[k] = Math.max(0, cR + a * Math.cos(th));
      py[k] = yO + b * Math.sin(th);
      occ[k] = 1;
      dir[k] = 1;
      k++;
    }
    const rEnd = Math.max(0, cR + a * Math.cos(thEnd));
    const yEnd = yO + b * Math.sin(thEnd);
    const offset = rEnd - rIend; // keeps the inner wall attached to the lip during the morph

    // Floor and fillet geometry (final positions).
    const floorY = Math.min(d.floorY, yO - 0.05);
    const rFloorWall = rI(floorY + 0.3) * radT;
    const fil = Math.max(0, Math.min(0.45 * rFloorWall, 0.65, 0.3 * Math.max(0, yO - floorY)));
    const yBottomFinal = floorY + fil;
    const yBottom = lerp(yEnd, yBottomFinal, depthT);
    const opening = Math.max(0.25, rEnd);
    const depthOcc = (yy: number): number => {
      const ratio = Math.max(0, yEnd - yy) / opening;
      return 1 - 0.88 * smoothstep(0.1, 2.3, ratio);
    };

    // Inner wall: lip -> fillet start.
    for (let i = 1; i <= N_IN; i++) {
      const s = i / N_IN;
      const y = lerp(yEnd, yBottom, s);
      const yLook = lerp(yO, yBottomFinal, s);
      pr[k] = Math.max(0, rI(yLook) * radT + offset);
      py[k] = y;
      const o = depthOcc(y);
      occ[k] = o;
      dir[k] = o * o;
      k++;
    }
    const rWB = pr[k - 1]!;
    const filR = fil * depthT;
    // Fillet: quarter circle from the wall into the floor.
    for (let i = 1; i <= N_FIL; i++) {
      const th = ((Math.PI / 2) * i) / N_FIL;
      pr[k] = Math.max(0, rWB - filR + filR * Math.cos(th));
      py[k] = yBottom - filR * Math.sin(th);
      const o = depthOcc(py[k]!) * (0.78 + 0.22 * (1 - Math.sin(th)));
      occ[k] = o;
      dir[k] = o * o;
      k++;
    }
    const rF = Math.max(0, rWB - filR);
    const yF = yBottom - filR;
    // Floor: fillet -> axis (slightly brighter toward the centre).
    for (let i = 1; i <= N_FLR; i++) {
      const s = i / N_FLR;
      pr[k] = rF * (1 - s);
      py[k] = yF;
      const o = depthOcc(yF) * (0.78 + 0.22 * smoothstep(0, 0.7, s));
      occ[k] = o;
      dir[k] = o * o;
      k++;
    }

    this.topY = H;
    this.openingRadius = rEnd;
    this.baseRadius = rO(0);
  }

  private computeProfileNormals(): void {
    const pr = this.pr;
    const py = this.py;
    let lastNr = 1;
    let lastNy = 0;
    for (let k = 0; k < PROFILE_POINTS; k++) {
      let tx = 0;
      let ty = 0;
      if (k > 0) {
        const dx = pr[k]! - pr[k - 1]!;
        const dy = py[k]! - py[k - 1]!;
        const l = Math.hypot(dx, dy);
        if (l > 1e-6) {
          tx += dx / l;
          ty += dy / l;
        }
      }
      if (k < PROFILE_POINTS - 1) {
        const dx = pr[k + 1]! - pr[k]!;
        const dy = py[k + 1]! - py[k]!;
        const l = Math.hypot(dx, dy);
        if (l > 1e-6) {
          tx += dx / l;
          ty += dy / l;
        }
      }
      const l = Math.hypot(tx, ty);
      if (l > 1e-6) {
        // Normal = tangent rotated -90 degrees in the (r, y) plane.
        lastNr = ty / l;
        lastNy = -tx / l;
      } else if (pr[k]! < 1e-4) {
        lastNr = 0;
        lastNy = 1;
      }
      this.pnr[k] = lastNr;
      this.pny[k] = lastNy;
    }
  }

  private revolve(d: DisplayProfile, o: PotDeformOptions): void {
    const cols = this.cols;
    const pos = this.position.array as Float32Array;
    const nrm = this.normal.array as Float32Array;
    const shd = this.shade.array as Float32Array;
    const H = Math.max(0.05, d.height);

    // Cosmetic deformations (never fed back into the core).
    const wob = d.wobble;
    const shake = o.reducedMotion ? 0.5 : 1 + 0.35 * Math.sin(o.time * 21.0) * wob;
    const wobLean = wob * 0.05 * H * shake;
    const wobLobe = wob * 0.035;
    const sl = d.slump;
    const slLean = sl * 0.13 * H;
    const slLobe = sl * 0.085;
    const slDrop = sl * 0.075 * H;
    const lean = d.leanDir;
    const lx = Math.cos(lean);
    const lz = Math.sin(lean);
    const c2 = Math.cos(lean * 2 + 1.1);
    const s2 = Math.sin(lean * 2 + 1.1);
    const c3 = Math.cos(lean * 3 + 0.4);
    const s3 = Math.sin(lean * 3 + 0.4);
    const deform = wob > 1e-3 || sl > 1e-3;

    let maxR = 0;
    let v = 0;
    for (let k = 0; k < PROFILE_POINTS; k++) {
      const r = this.pr[k]!;
      const y = this.py[k]!;
      const nr = this.pnr[k]!;
      const ny = this.pny[k]!;
      const occ = this.pOcc[k]!;
      const dl = this.pDirect[k]!;
      if (r > maxR) maxR = r;
      const h = clamp(y / H, 0, 1.3);
      const h2 = h * h;
      const offX = deform ? (wobLean + slLean) * h2 * lx : 0;
      const offZ = deform ? (wobLean + slLean) * h2 * lz : 0;
      for (let j = 0; j < cols; j++) {
        const c = this.cos1[j]!;
        const s = this.sin1[j]!;
        let rr = r;
        let yy = y;
        if (deform) {
          const lobe2 = this.cos2[j]! * c2 + this.sin2[j]! * s2;
          const lobe3 = this.cos3[j]! * c3 + this.sin3[j]! * s3;
          rr = r * (1 + wobLobe * h2 * lobe2 + slLobe * h2 * h * lobe3);
          yy = y - slDrop * h2 * (0.7 + 0.3 * lobe3);
        }
        const i3 = v * 3;
        pos[i3] = rr * c + offX;
        pos[i3 + 1] = yy;
        pos[i3 + 2] = rr * s + offZ;
        nrm[i3] = nr * c;
        nrm[i3 + 1] = ny;
        nrm[i3 + 2] = nr * s;
        const i2 = v * 2;
        shd[i2] = occ;
        shd[i2 + 1] = dl;
        v++;
      }
    }
    this.position.needsUpdate = true;
    this.normal.needsUpdate = true;
    this.shade.needsUpdate = true;
    const bs = this.geometry.boundingSphere!;
    bs.center.set(0, H * 0.5, 0);
    bs.radius = Math.hypot(maxR * 1.2, H * 0.6) + slLean + wobLean + 1;
  }
}
