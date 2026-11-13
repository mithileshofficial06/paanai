// Paints a Decor onto a canvas that wraps once around the pot: x = angle around the axis,
// y = height (top row = rim). The glaze shader samples it and lays the paint over the glaze.
import { CanvasTexture, LinearFilter, RepeatWrapping, SRGBColorSpace } from 'three';
import type { Decor, DecorMotifs } from '../../shared/core/decor';

const W = 1024;
const H = 512;

/**
 * aspect = circumference / height of the pot (both in cm), so motifs come out round on the
 * pot instead of stretched around it.
 */
export function paintDecor(ctx: CanvasRenderingContext2D, d: Decor, aspect: number): void {
  ctx.clearRect(0, 0, W, H);
  const yPx = (frac: number) => (1 - frac) * H;
  // Horizontal pixels per vertical pixel of the same physical length.
  const sx = W / H / Math.max(0.3, aspect);
  if (d.base) {
    ctx.fillStyle = d.base;
    ctx.fillRect(0, 0, W, H);
  }
  for (const b of d.bands) {
    ctx.fillStyle = b.color;
    ctx.fillRect(0, yPx(b.y + b.w / 2), W, b.w * H);
    // A thin darker edge, like a brush line.
    ctx.fillStyle = 'rgba(0,0,0,0.18)';
    ctx.fillRect(0, yPx(b.y - b.w / 2) - 2, W, 2);
  }
  for (const m of d.motifs) drawMotifs(ctx, m, sx);
  if (d.rim) {
    ctx.fillStyle = d.rim;
    ctx.fillRect(0, 0, W, 0.07 * H);
  }
}

function drawMotifs(ctx: CanvasRenderingContext2D, m: DecorMotifs, sx: number): void {
  const cy = (1 - m.y) * H;
  const s = m.size * H; // motif height in px
  const step = W / m.count;
  ctx.fillStyle = m.color;
  ctx.strokeStyle = m.color;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (m.kind === 'waves' || m.kind === 'zigzag') {
    ctx.lineWidth = Math.max(3, s * 0.18);
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const t = (x / step) * Math.PI * 2;
      const y = m.kind === 'waves' ? Math.sin(t) : (2 / Math.PI) * Math.asin(Math.sin(t));
      if (x === 0) ctx.moveTo(x, cy + y * s * 0.4);
      else ctx.lineTo(x, cy + y * s * 0.4);
    }
    ctx.stroke();
    return;
  }
  if (m.kind === 'stripes') {
    // Vertical stripes from the foot to just under the rim.
    const w = Math.max(4, step * 0.22);
    for (let i = 0; i < m.count; i++) ctx.fillRect(i * step + step / 2 - w / 2, H * 0.08, w, H * 0.86);
    return;
  }
  // Repeated motifs, drawn twice across the seam so they wrap cleanly.
  for (let i = 0; i < m.count; i++) {
    const cx = i * step + step / 2;
    for (const off of [0, -W, W]) {
      ctx.save();
      ctx.translate(cx + off, cy);
      ctx.scale(sx, 1);
      motif(ctx, m.kind, s);
      ctx.restore();
    }
  }
}

function motif(ctx: CanvasRenderingContext2D, kind: DecorMotifs['kind'], s: number): void {
  const r = s / 2;
  ctx.beginPath();
  switch (kind) {
    case 'dots':
      ctx.arc(0, 0, r * 0.45, 0, Math.PI * 2);
      ctx.fill();
      break;
    case 'leaves':
      for (const a of [-0.6, 0.6]) {
        ctx.save();
        ctx.rotate(a);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.45, r * 0.22, r * 0.55, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.lineWidth = Math.max(2, r * 0.08);
      ctx.beginPath();
      ctx.moveTo(0, r * 0.1);
      ctx.lineTo(0, r * 0.9);
      ctx.stroke();
      break;
    case 'flowers':
      for (let k = 0; k < 5; k++) {
        ctx.save();
        ctx.rotate((k / 5) * Math.PI * 2);
        ctx.beginPath();
        ctx.ellipse(0, -r * 0.5, r * 0.22, r * 0.42, 0, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(0, 0, r * 0.16, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    case 'stars':
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
        const rr = k % 2 === 0 ? r * 0.9 : r * 0.38;
        if (k === 0) ctx.moveTo(Math.cos(a) * rr, Math.sin(a) * rr);
        else ctx.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
      }
      ctx.closePath();
      ctx.fill();
      break;
    case 'fish':
      ctx.ellipse(-r * 0.1, 0, r * 0.55, r * 0.28, 0, 0, Math.PI * 2);
      ctx.fill();
      ctx.beginPath();
      ctx.moveTo(r * 0.35, 0);
      ctx.lineTo(r * 0.85, -r * 0.3);
      ctx.lineTo(r * 0.85, r * 0.3);
      ctx.closePath();
      ctx.fill();
      ctx.save();
      ctx.globalCompositeOperation = 'destination-out';
      ctx.beginPath();
      ctx.arc(-r * 0.4, -r * 0.05, r * 0.06, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      break;
    default:
      break;
  }
}

/** A wrap-around texture for the glaze shader. */
export function decorTexture(d: Decor, aspect: number): CanvasTexture | null {
  if (typeof document === 'undefined') return null;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  paintDecor(ctx, d, aspect);
  const t = new CanvasTexture(canvas);
  t.wrapS = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
  // No mipmaps: the angle jumps from +pi to -pi at the seam, and a mip lookup there draws a line.
  t.generateMipmaps = false;
  t.minFilter = LinearFilter;
  return t;
}
