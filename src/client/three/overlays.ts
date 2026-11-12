// Glowing guide overlays drawn in screen space with constant pixel width:
// - TargetOutline: the commission silhouette (both side curves + the rim ellipse), drawn twice:
//   bright where visible and dimmer where it passes behind the clay, so it always reads.
// - ContactMarker: a ring hugging the clay at the finger's height plus a hot spot at the contact.
// - OpenRing: pulsing target on the lump's top until the pot is opened.

import {
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  GreaterDepth,
  LessEqualDepth,
  Mesh,
  ShaderMaterial,
  Sprite,
  SpriteMaterial,
  Vector2,
  Vector3,
  type Texture,
} from 'three';
import { RINGS } from '../../shared/core/fixed';
import type { Profile } from '../../shared/core/profile';
import { CM_PER_UNIT, MonotoneCurve } from './displayProfile';

const LINE_VERT = /* glsl */ `
attribute vec3 aPrev;
attribute vec3 aNext;
attribute float aSide;
attribute float aFade;
uniform vec2 uResolution;
uniform float uWidth;
varying float vSide;
varying float vFade;
void main() {
  mat4 mvp = projectionMatrix * modelViewMatrix;
  vec4 c = mvp * vec4(position, 1.0);
  vec4 p = mvp * vec4(aPrev, 1.0);
  vec4 n = mvp * vec4(aNext, 1.0);
  vec2 half_ = uResolution * 0.5;
  vec2 sp = p.xy / p.w * half_;
  vec2 sn = n.xy / n.w * half_;
  vec2 dir = sn - sp;
  dir = length(dir) < 1e-5 ? vec2(1.0, 0.0) : normalize(dir);
  vec2 nrm = vec2(-dir.y, dir.x);
  c.xy += nrm * aSide * uWidth / half_ * c.w;
  gl_Position = c;
  vSide = aSide;
  vFade = aFade;
}
`;

const LINE_FRAG = /* glsl */ `
uniform vec3 uCore;
uniform vec3 uHalo;
uniform float uOpacity;
uniform float uCoreFrac;
varying float vSide;
varying float vFade;
void main() {
  float d = abs(vSide);
  float core = exp(-(d * d) / (uCoreFrac * uCoreFrac));
  float halo = exp(-(d * d) / 0.16) * (1.0 - d);
  vec3 col = uCore * core + uHalo * halo * 0.55;
  gl_FragColor = vec4(col * uOpacity * vFade, 1.0);
}
`;

export type GlowLineStyle = {
  core: [number, number, number];
  halo: [number, number, number];
  /** Total half-width in CSS px (halo included). */
  widthPx: number;
  /** Core width as a fraction of the half-width. */
  coreFrac: number;
  opacity: number;
};

/** A polyline rendered as a screen-space ribbon. Capacity is fixed; setPoints rewrites in place. */
export class GlowLine {
  readonly geometry = new BufferGeometry();
  readonly materials: ShaderMaterial[] = [];
  readonly meshes: Mesh[] = [];
  private readonly pos: BufferAttribute;
  private readonly prev: BufferAttribute;
  private readonly next: BufferAttribute;
  private readonly fade: BufferAttribute;
  private readonly capacity: number;

  constructor(capacity: number, style: GlowLineStyle, passes: { depth: 'test' | 'always' | 'hidden'; opacity: number }[]) {
    this.capacity = capacity;
    this.widthPx = style.widthPx;
    const n = capacity * 2;
    this.pos = new BufferAttribute(new Float32Array(n * 3), 3);
    this.prev = new BufferAttribute(new Float32Array(n * 3), 3);
    this.next = new BufferAttribute(new Float32Array(n * 3), 3);
    this.fade = new BufferAttribute(new Float32Array(n), 1);
    const side = new Float32Array(n);
    for (let i = 0; i < capacity; i++) {
      side[i * 2] = -1;
      side[i * 2 + 1] = 1;
    }
    const index: number[] = [];
    for (let i = 0; i < capacity - 1; i++) {
      const a = i * 2;
      index.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    this.geometry.setIndex(index);
    this.geometry.setAttribute('position', this.pos);
    this.geometry.setAttribute('aPrev', this.prev);
    this.geometry.setAttribute('aNext', this.next);
    this.geometry.setAttribute('aSide', new BufferAttribute(side, 1));
    this.geometry.setAttribute('aFade', this.fade);
    this.geometry.setDrawRange(0, 0);

    for (const pass of passes) {
      const mat = new ShaderMaterial({
        vertexShader: LINE_VERT,
        fragmentShader: LINE_FRAG,
        uniforms: {
          uResolution: { value: new Vector2(1, 1) },
          uWidth: { value: style.widthPx },
          uCore: { value: new Vector3(...style.core) },
          uHalo: { value: new Vector3(...style.halo) },
          uOpacity: { value: style.opacity * pass.opacity },
          uCoreFrac: { value: style.coreFrac },
        },
        transparent: true,
        depthWrite: false,
        depthTest: pass.depth !== 'always',
        depthFunc: pass.depth === 'hidden' ? GreaterDepth : LessEqualDepth,
        blending: AdditiveBlending,
        toneMapped: false,
      });
      const mesh = new Mesh(this.geometry, mat);
      mesh.frustumCulled = false;
      mesh.renderOrder = 20;
      this.materials.push(mat);
      this.meshes.push(mesh);
    }
  }

  /**
   * points: flat xyz of `count` points; fades: per point (optional). For a closed loop pass the
   * unique points only; the closing segment back to the first point is added here.
   */
  setPoints(points: ArrayLike<number>, count: number, closed: boolean, fades?: ArrayLike<number>): void {
    const unique = Math.max(0, Math.min(count, closed ? this.capacity - 1 : this.capacity));
    const total = closed && unique > 0 ? unique + 1 : unique;
    const P = this.pos.array as Float32Array;
    const Pr = this.prev.array as Float32Array;
    const Nx = this.next.array as Float32Array;
    const F = this.fade.array as Float32Array;
    for (let i = 0; i < total; i++) {
      const src = closed ? i % unique : i;
      const ip = closed ? (src - 1 + unique) % unique : Math.max(0, i - 1);
      const inx = closed ? (src + 1) % unique : Math.min(unique - 1, i + 1);
      for (let s = 0; s < 2; s++) {
        const v = (i * 2 + s) * 3;
        P[v] = points[src * 3] ?? 0;
        P[v + 1] = points[src * 3 + 1] ?? 0;
        P[v + 2] = points[src * 3 + 2] ?? 0;
        Pr[v] = points[ip * 3] ?? 0;
        Pr[v + 1] = points[ip * 3 + 1] ?? 0;
        Pr[v + 2] = points[ip * 3 + 2] ?? 0;
        Nx[v] = points[inx * 3] ?? 0;
        Nx[v + 1] = points[inx * 3 + 1] ?? 0;
        Nx[v + 2] = points[inx * 3 + 2] ?? 0;
        F[i * 2 + s] = fades ? (fades[src] ?? 1) : 1;
      }
    }
    this.pos.needsUpdate = true;
    this.prev.needsUpdate = true;
    this.next.needsUpdate = true;
    this.fade.needsUpdate = true;
    this.geometry.setDrawRange(0, Math.max(0, (total - 1) * 6));
  }

  private dpr = 1;
  private widthPx = 6;

  /** Drawing-buffer size in CSS px and the device pixel ratio in use. */
  setResolution(w: number, h: number, dpr: number): void {
    this.dpr = dpr;
    for (const m of this.materials) {
      (m.uniforms.uResolution!.value as Vector2).set(w * dpr, h * dpr);
      m.uniforms.uWidth!.value = this.widthPx * dpr;
    }
  }

  /** Half-width of the line in CSS px. */
  setWidth(px: number): void {
    this.widthPx = px;
    for (const m of this.materials) m.uniforms.uWidth!.value = px * this.dpr;
  }

  setOpacity(o: number, passOpacities: number[]): void {
    this.materials.forEach((m, i) => {
      m.uniforms.uOpacity!.value = o * (passOpacities[i] ?? 1);
    });
  }

  setVisible(v: boolean): void {
    for (const m of this.meshes) m.visible = v;
  }

  dispose(): void {
    this.geometry.dispose();
    for (const m of this.materials) m.dispose();
  }
}

const TARGET_STYLE: GlowLineStyle = {
  core: [1.0, 0.82, 0.62],
  halo: [1.0, 0.2, 0.08],
  widthPx: 7,
  coreFrac: 0.2,
  opacity: 0.9,
};
const TARGET_PASSES = [
  { depth: 'test' as const, opacity: 1 },
  { depth: 'hidden' as const, opacity: 0.38 },
];

/** Silhouette of the commission's target pot. */
export class TargetOutline {
  private readonly left: GlowLine;
  private readonly right: GlowLine;
  private readonly rim: GlowLine;
  private readonly curve = new MonotoneCurve(RINGS);
  private readonly radii = new Float32Array(RINGS);
  private target: Profile | null = null;
  height = 0;
  maxRadius = 0;
  private readonly passOpacity = TARGET_PASSES.map((p) => p.opacity);

  constructor() {
    this.left = new GlowLine(80, TARGET_STYLE, TARGET_PASSES);
    this.right = new GlowLine(80, TARGET_STYLE, TARGET_PASSES);
    this.rim = new GlowLine(97, { ...TARGET_STYLE, widthPx: 6 }, TARGET_PASSES);
  }

  get meshes(): Mesh[] {
    return [...this.left.meshes, ...this.right.meshes, ...this.rim.meshes];
  }

  get active(): boolean {
    return this.target !== null;
  }

  setTarget(p: Profile | null): void {
    this.target = p;
    const vis = p !== null;
    this.left.setVisible(vis);
    this.right.setVisible(vis);
    this.rim.setVisible(vis);
    if (!p) {
      this.height = 0;
      this.maxRadius = 0;
      return;
    }
    for (let i = 0; i < RINGS; i++) this.radii[i] = (p.outer[i] ?? 0) * CM_PER_UNIT;
    this.curve.build(this.radii, 0, RINGS - 1);
    const H = p.height * CM_PER_UNIT;
    this.height = H;
    let maxR = 0;
    for (let i = 0; i < RINGS; i++) maxR = Math.max(maxR, this.radii[i]!);
    this.maxRadius = maxR;

    const N = 80;
    const L = new Float32Array(N * 3);
    const R = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      const y = (H * i) / (N - 1);
      const r = this.curve.value((y / H) * RINGS - 0.5);
      L[i * 3] = -r;
      L[i * 3 + 1] = y;
      R[i * 3] = r;
      R[i * 3 + 1] = y;
    }
    this.left.setPoints(L, N, false);
    this.right.setPoints(R, N, false);
    const rTop = this.curve.value(RINGS - 0.5);
    const M = 96;
    const C = new Float32Array(M * 3);
    const F = new Float32Array(M);
    for (let i = 0; i < M; i++) {
      const a = (i / M) * Math.PI * 2;
      C[i * 3] = Math.cos(a) * rTop;
      C[i * 3 + 1] = H;
      C[i * 3 + 2] = Math.sin(a) * rTop;
      F[i] = 0.55 + 0.45 * Math.max(0, Math.sin(a));
    }
    this.rim.setPoints(C, M, true, F);
  }

  setResolution(w: number, h: number, dpr: number): void {
    this.left.setResolution(w, h, dpr);
    this.right.setResolution(w, h, dpr);
    this.rim.setResolution(w, h, dpr);
    this.left.setWidth(TARGET_STYLE.widthPx);
    this.right.setWidth(TARGET_STYLE.widthPx);
    this.rim.setWidth(6);
  }

  /** Brighten slightly as the match improves (0..100), so closing in on the shape feels good. */
  setIntensity(match: number | null): void {
    const m = match === null ? 0 : Math.max(0, Math.min(1, (match - 60) / 40));
    const o = TARGET_STYLE.opacity * (0.85 + 0.35 * m);
    this.left.setOpacity(o, this.passOpacity);
    this.right.setOpacity(o, this.passOpacity);
    this.rim.setOpacity(o, this.passOpacity);
  }

  dispose(): void {
    this.left.dispose();
    this.right.dispose();
    this.rim.dispose();
  }
}

const CONTACT_STYLE: GlowLineStyle = {
  core: [1.0, 0.86, 0.66],
  halo: [1.0, 0.32, 0.1],
  widthPx: 6,
  coreFrac: 0.22,
  opacity: 0.85,
};

/** Glowing ring around the clay where the finger works it, plus a hot spot at the finger. */
export class ContactMarker {
  private readonly outerRing: GlowLine;
  private readonly innerRing: GlowLine;
  readonly spot: Sprite;
  private readonly spotMat: SpriteMaterial;
  private readonly pts = new Float32Array(97 * 3);
  private readonly fades = new Float32Array(97);
  private alpha = 0;

  constructor(glow: Texture) {
    this.outerRing = new GlowLine(97, CONTACT_STYLE, [{ depth: 'test', opacity: 1 }]);
    this.innerRing = new GlowLine(97, { ...CONTACT_STYLE, widthPx: 5 }, [{ depth: 'test', opacity: 0.8 }]);
    this.spotMat = new SpriteMaterial({
      map: glow,
      color: 0xff7a3a,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      opacity: 0,
    });
    this.spot = new Sprite(this.spotMat);
    this.spot.renderOrder = 25;
  }

  get meshes(): (Mesh | Sprite)[] {
    return [...this.outerRing.meshes, ...this.innerRing.meshes, this.spot];
  }

  setResolution(w: number, h: number, dpr: number): void {
    this.outerRing.setResolution(w, h, dpr);
    this.innerRing.setResolution(w, h, dpr);
    this.outerRing.setWidth(CONTACT_STYLE.widthPx);
    this.innerRing.setWidth(5);
  }

  /**
   * active: finger is shaping. y: height (cm); rOuter/rInner: clay radii there (cm);
   * side: -1/+1 screen side of the finger; strength 0..1; thin: show the inner ring too.
   */
  update(
    dt: number,
    active: boolean,
    y: number,
    rOuter: number,
    rInner: number,
    side: number,
    strength: number,
    thin: boolean,
    pxPerCm: number
  ): void {
    const target = active ? 0.55 + 0.45 * strength : 0;
    this.alpha += (target - this.alpha) * (1 - Math.exp(-dt / (active ? 0.05 : 0.18)));
    const vis = this.alpha > 0.01;
    this.outerRing.setVisible(vis);
    this.innerRing.setVisible(vis && thin && rInner > 0.2);
    this.spot.visible = vis;
    if (!vis) return;
    const M = 96;
    const ro = rOuter + 0.06;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2;
      this.pts[i * 3] = Math.cos(a) * ro;
      this.pts[i * 3 + 1] = y;
      this.pts[i * 3 + 2] = Math.sin(a) * ro;
      this.fades[i] = 0.35 + 0.65 * Math.max(0, Math.sin(a));
    }
    this.outerRing.setPoints(this.pts, M, true, this.fades);
    this.outerRing.setOpacity(this.alpha, [1]);
    if (thin && rInner > 0.2) {
      const ri = Math.max(0.05, rInner - 0.05);
      for (let i = 0; i <= M; i++) {
        const a = (i / M) * Math.PI * 2;
        this.pts[i * 3] = Math.cos(a) * ri;
        this.pts[i * 3 + 1] = y;
        this.pts[i * 3 + 2] = Math.sin(a) * ri;
      }
      this.innerRing.setPoints(this.pts, M, true);
      this.innerRing.setOpacity(this.alpha, [0.8]);
    }
    // Hot spot on the silhouette where the finger meets the clay.
    this.spot.position.set(side * (rOuter + 0.1), y, 0.2);
    const s = (34 + 26 * strength) / Math.max(1e-3, pxPerCm);
    this.spot.scale.set(s, s, 1);
    this.spotMat.opacity = this.alpha * (0.5 + 0.5 * strength);
  }

  dispose(): void {
    this.outerRing.dispose();
    this.innerRing.dispose();
    this.spotMat.dispose();
  }
}

/** Pulsing "tap here to open" ring on the top of the lump. */
export class OpenRing {
  private readonly ring: GlowLine;
  private readonly dot: Sprite;
  private readonly dotMat: SpriteMaterial;
  private readonly pts = new Float32Array(97 * 3);
  private readonly fades = new Float32Array(97);
  private alpha = 0;
  private urgency = 0;

  constructor(glow: Texture) {
    this.ring = new GlowLine(97, { core: [1.0, 0.8, 0.55], halo: [1.0, 0.28, 0.08], widthPx: 6, coreFrac: 0.24, opacity: 1 }, [
      { depth: 'always', opacity: 1 },
    ]);
    this.dotMat = new SpriteMaterial({
      map: glow,
      color: 0xffa060,
      blending: AdditiveBlending,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      toneMapped: false,
      opacity: 0,
    });
    this.dot = new Sprite(this.dotMat);
    this.dot.renderOrder = 25;
  }

  get meshes(): (Mesh | Sprite)[] {
    return [...this.ring.meshes, this.dot];
  }

  setResolution(w: number, h: number, dpr: number): void {
    this.ring.setResolution(w, h, dpr);
    this.ring.setWidth(6);
  }

  /** Make the ring pulse harder (player tried to thin before opening). */
  nudge(): void {
    this.urgency = 1;
  }

  update(dt: number, time: number, show: boolean, topY: number, topR: number, pxPerCm: number, reducedMotion: boolean): void {
    this.alpha += ((show ? 1 : 0) - this.alpha) * (1 - Math.exp(-dt / 0.2));
    this.urgency *= Math.exp(-dt * 1.5);
    const vis = this.alpha > 0.01;
    this.ring.setVisible(vis);
    this.dot.visible = vis;
    if (!vis) return;
    const pulse = reducedMotion ? 0.5 : 0.5 + 0.5 * Math.sin(time * (3.2 + this.urgency * 4));
    const r = Math.max(0.6, topR * (0.42 + 0.1 * pulse));
    const M = 96;
    for (let i = 0; i <= M; i++) {
      const a = (i / M) * Math.PI * 2;
      this.pts[i * 3] = Math.cos(a) * r;
      this.pts[i * 3 + 1] = topY + 0.05;
      this.pts[i * 3 + 2] = Math.sin(a) * r;
      this.fades[i] = 0.55 + 0.45 * Math.max(0, Math.sin(a));
    }
    this.ring.setPoints(this.pts, M, true, this.fades);
    this.ring.setOpacity(this.alpha * (0.55 + 0.45 * pulse + this.urgency * 0.4), [1]);
    this.dot.position.set(0, topY + 0.08, 0);
    const s = (26 + 10 * pulse) / Math.max(1e-3, pxPerCm);
    this.dot.scale.set(s, s, 1);
    this.dotMat.opacity = this.alpha * (0.35 + 0.35 * pulse);
  }

  dispose(): void {
    this.ring.dispose();
    this.dotMat.dispose();
  }
}
