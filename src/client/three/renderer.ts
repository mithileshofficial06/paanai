// WebGL2 renderer setup and the adaptive quality scaler.

import { AgXToneMapping, SRGBColorSpace, WebGLRenderer } from 'three';

export const EDGE_COLOR = 0x07070a;

export function createRenderer(canvas: HTMLCanvasElement | OffscreenCanvas, opts: { antialias: boolean; preserve?: boolean }): WebGLRenderer {
  const renderer = new WebGLRenderer({
    canvas,
    antialias: opts.antialias,
    alpha: true,
    premultipliedAlpha: true,
    stencil: false,
    powerPreference: 'high-performance',
    preserveDrawingBuffer: opts.preserve ?? false,
  });
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.toneMapping = AgXToneMapping;
  renderer.toneMappingExposure = 1.0;
  renderer.setClearColor(EDGE_COLOR, 1);
  return renderer;
}

/**
 * Adaptive DPR: start at min(devicePixelRatio, 2), measure the first 2 s (after a short warm-up),
 * and step down to 1.5 then 1 while the frame rate stays under 50 fps.
 */
export class QualityScaler {
  readonly levels: number[];
  private level = 0;
  private elapsed = 0;
  private frames = 0;
  private warmup = 0.6;
  private settled = false;
  /** Called when the pixel ratio changes. */
  onChange: ((dpr: number) => void) | null = null;

  constructor(deviceDpr: number, forced?: number) {
    if (forced && forced > 0) {
      this.levels = [forced];
      this.settled = true;
      return;
    }
    const start = Math.min(Math.max(1, deviceDpr || 1), 2);
    this.levels = [start, 1.5, 1].filter((v, i, a) => (i === 0 ? true : v < a[0]!));
  }

  get dpr(): number {
    return this.levels[this.level] ?? 1;
  }

  /** Restart measuring (after a pause or resize the old samples are meaningless). */
  restart(): void {
    if (this.settled) return;
    this.elapsed = 0;
    this.frames = 0;
    this.warmup = 0.4;
  }

  /** Feed the real frame interval (s). */
  sample(dt: number): void {
    if (this.settled) return;
    if (this.warmup > 0) {
      this.warmup -= dt;
      return;
    }
    if (dt > 0.25) return; // a hitch (tab switch, GC) is not a measurement
    this.elapsed += dt;
    this.frames++;
    if (this.elapsed < 2) return;
    const fps = this.frames / this.elapsed;
    if (fps < 50 && this.level < this.levels.length - 1) {
      this.level++;
      this.onChange?.(this.dpr);
      this.elapsed = 0;
      this.frames = 0;
      this.warmup = 0.4;
    } else {
      this.settled = true;
    }
  }
}
