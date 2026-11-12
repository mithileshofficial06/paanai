// Procedural textures generated once at startup (no network, no bundle bytes).
// All patterns are seeded so every device draws the same studio.

import {
  CanvasTexture,
  ClampToEdgeWrapping,
  LinearFilter,
  LinearMipmapLinearFilter,
  NoColorSpace,
  RepeatWrapping,
  SRGBColorSpace,
  type Texture,
} from 'three';

function makeCanvas(w: number, h: number): { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D } {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d', { willReadFrequently: false });
  if (!ctx) throw new Error('2D canvas unavailable');
  return { canvas, ctx };
}

/** Small seeded PRNG for texture layout (client-only, cosmetic). */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Tileable 2D value noise on a coarse lattice (periodic in both axes). */
function makeNoise2(seed: number, cellsX: number, cellsY: number): (u: number, v: number) => number {
  const r = rng(seed);
  const grid = new Float32Array(cellsX * cellsY);
  for (let i = 0; i < grid.length; i++) grid[i] = r();
  return (u: number, v: number): number => {
    const x = (((u % 1) + 1) % 1) * cellsX;
    const y = (((v % 1) + 1) % 1) * cellsY;
    const x0 = Math.floor(x);
    const y0 = Math.floor(y);
    const fx = x - x0;
    const fy = y - y0;
    const sx = fx * fx * (3 - 2 * fx);
    const sy = fy * fy * (3 - 2 * fy);
    const x1 = (x0 + 1) % cellsX;
    const y1 = (y0 + 1) % cellsY;
    const a = grid[y0 * cellsX + x0]!;
    const b = grid[y0 * cellsX + x1]!;
    const c = grid[y1 * cellsX + x0]!;
    const d = grid[y1 * cellsX + x1]!;
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
}

function finish(tex: Texture, srgb: boolean, wrapU: boolean, wrapV: boolean): Texture {
  tex.colorSpace = srgb ? SRGBColorSpace : NoColorSpace;
  tex.wrapS = wrapU ? RepeatWrapping : ClampToEdgeWrapping;
  tex.wrapT = wrapV ? RepeatWrapping : ClampToEdgeWrapping;
  tex.minFilter = LinearMipmapLinearFilter;
  tex.magFilter = LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

export type WheelTextures = { color: Texture; orm: Texture; aniso: Texture };

/**
 * Wheel head textures in LatheGeometry UV space: u = around (0..1), v = along the profile path,
 * which runs underside -> edge -> top -> axis, so the flat top is v in [vTopStart, 1] with
 * radius = topRadius * (1 - v) / (1 - vTopStart). Canvas row 0 is v = 1 (CanvasTexture flips Y).
 * Machining grooves vary with radius; wear and dried slip vary around the circumference.
 */
export function makeWheelTextures(vTopStart: number, topRadiusCm: number): WheelTextures {
  const W = 256;
  const Hh = 1024;
  const col = makeCanvas(W, Hh);
  const orm = makeCanvas(W, Hh);
  const ani = makeCanvas(W, Hh);
  const colImg = col.ctx.createImageData(W, Hh);
  const ormImg = orm.ctx.createImageData(W, Hh);
  const aniImg = ani.ctx.createImageData(W, Hh);
  const r = rng(1337);

  // Per-row groove roughness: fine lathe grooves plus broader machining passes.
  const groove = new Float32Array(Hh);
  let pass = 0.36;
  for (let y = 0; y < Hh; y++) {
    if (r() < 0.02) pass = 0.3 + r() * 0.12;
    const fine = (r() - 0.5) * 0.09 + (y % 3 === 0 ? 0.035 : 0);
    groove[y] = pass + fine;
  }
  const wear = makeNoise2(7, 6, 24);
  const wearFine = makeNoise2(11, 24, 96);
  const residue = makeNoise2(21, 10, 40);
  const resFine = makeNoise2(23, 48, 160);

  for (let y = 0; y < Hh; y++) {
    const v = 1 - y / (Hh - 1);
    const onTop = v >= vTopStart;
    const radiusCm = onTop ? ((1 - v) / Math.max(1e-6, 1 - vTopStart)) * topRadiusCm : topRadiusCm;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const i = (y * W + x) * 4;
      const w = wear(u, v) * 0.7 + wearFine(u, v) * 0.3;
      // Dried slip collects toward the rim of the head and in random smears.
      const edgeBias = onTop ? Math.max(0, (radiusCm - topRadiusCm * 0.55) / (topRadiusCm * 0.45)) : 0.6;
      const res = residue(u, v) * 0.75 + resFine(u, v) * 0.25;
      let dried = Math.max(0, Math.min(1, (res - (0.74 - edgeBias * 0.16)) * 7));
      if (!onTop) dried *= 0.5;
      let rough = (groove[y] ?? 0.36) + (w - 0.5) * 0.16;
      rough = rough * (1 - dried) + 0.82 * dried;
      const metal = 1 - dried;
      ormImg.data[i] = 255;
      ormImg.data[i + 1] = Math.max(0, Math.min(255, Math.round(rough * 255)));
      ormImg.data[i + 2] = Math.round(metal * 255);
      ormImg.data[i + 3] = 255;

      // Aluminium tint with faint oxidation, mixed with dried grey-brown slip.
      const ox = 0.94 + (w - 0.5) * 0.1;
      const mr = 182 * ox;
      const mg = 186 * ox;
      const mb = 191 * ox;
      const sr = 118 + res * 30;
      const sg = 96 + res * 22;
      const sb = 84 + res * 18;
      colImg.data[i] = Math.round(mr * (1 - dried) + sr * dried);
      colImg.data[i + 1] = Math.round(mg * (1 - dried) + sg * dried);
      colImg.data[i + 2] = Math.round(mb * (1 - dried) + sb * dried);
      colImg.data[i + 3] = 255;

      // Anisotropy: direction along +u (rotated in the material), strength fades on slip.
      aniImg.data[i] = 255;
      aniImg.data[i + 1] = 128;
      aniImg.data[i + 2] = Math.round((1 - dried) * (0.75 + 0.25 * w) * 255);
      aniImg.data[i + 3] = 255;
    }
  }
  col.ctx.putImageData(colImg, 0, 0);
  orm.ctx.putImageData(ormImg, 0, 0);
  ani.ctx.putImageData(aniImg, 0, 0);
  return {
    color: finish(new CanvasTexture(col.canvas), true, true, false),
    orm: finish(new CanvasTexture(orm.canvas), false, true, false),
    aniso: finish(new CanvasTexture(ani.canvas), false, true, false),
  };
}

/**
 * Splash pan colour in LatheGeometry UV space (u around, v along the profile path: outer skirt (0)
 * -> rolled rim (vRim) -> inner wall -> floor (vFloor) -> centre (1)). Canvas row 0 is v = 1.
 * Dark plastic with dried slip splatter and drips on the inner wall.
 */
export function makeSplashPanTexture(vFloor: number, vRim: number): { color: Texture; orm: Texture } {
  const W = 1024;
  const Hh = 256;
  const col = makeCanvas(W, Hh);
  const orm = makeCanvas(W, Hh);
  const r = rng(4242);
  const ctx = col.ctx;
  ctx.fillStyle = '#17171a';
  ctx.fillRect(0, 0, W, Hh);
  // Subtle plastic mottling.
  const mott = makeNoise2(5, 32, 8);
  const img = ctx.getImageData(0, 0, W, Hh);
  const ormImg = orm.ctx.createImageData(W, Hh);
  for (let y = 0; y < Hh; y++) {
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      const m = 0.9 + mott(x / W, y / Hh) * 0.2;
      img.data[i] = Math.round(img.data[i]! * m);
      img.data[i + 1] = Math.round(img.data[i + 1]! * m);
      img.data[i + 2] = Math.round(img.data[i + 2]! * m);
      ormImg.data[i] = 255;
      ormImg.data[i + 1] = Math.round((0.5 + mott(x / W + 0.37, y / Hh) * 0.16) * 255);
      ormImg.data[i + 2] = 0;
      ormImg.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  orm.ctx.putImageData(ormImg, 0, 0);

  // Dried slip splatter: thrown outward by the wheel, densest on the inner wall near the rim.
  const rowOf = (v: number): number => (1 - v) * (Hh - 1);
  const yRim = rowOf(vRim); // larger row index = lower v
  const yFloorEdge = rowOf(Math.min(1, vFloor + 0.08));
  const yWall0 = rowOf(vFloor);
  for (let k = 0; k < 900; k++) {
    const x = r() * W;
    const t = r();
    // From the rim (dense) down the wall and a little onto the floor.
    const y = yRim + (yFloorEdge - yRim) * Math.pow(t, 1.6);
    const s = 0.6 + Math.pow(r(), 3) * 5;
    const a = 0.1 + r() * 0.3;
    ctx.fillStyle = `rgba(${108 + r() * 30},${88 + r() * 20},${76 + r() * 16},${a})`;
    ctx.beginPath();
    ctx.ellipse(x, y, s * (1 + r() * 2.5), s, 0, 0, Math.PI * 2);
    ctx.fill();
    orm.ctx.fillStyle = `rgba(230,230,230,${a})`;
    orm.ctx.beginPath();
    orm.ctx.ellipse(x, y, s * (1 + r() * 2.5), s, 0, 0, Math.PI * 2);
    orm.ctx.fill();
  }
  // Drips running down the inner wall toward the floor (downhill = toward larger v = smaller row).
  for (let k = 0; k < 70; k++) {
    const x = r() * W;
    const y0 = yRim + r() * (yWall0 - yRim) * 0.3;
    const len = 6 + r() * 40;
    const g = ctx.createLinearGradient(x, y0, x, y0 - len);
    g.addColorStop(0, 'rgba(120,98,84,0.32)');
    g.addColorStop(1, 'rgba(120,98,84,0)');
    ctx.fillStyle = g;
    ctx.fillRect(x - 0.8 - r(), y0 - len, 1.6 + r() * 1.5, len);
  }
  return {
    color: finish(new CanvasTexture(col.canvas), true, true, false),
    orm: finish(new CanvasTexture(orm.canvas), false, true, false),
  };
}

/** Soft radial falloff (white centre -> transparent edge), for glows and contact shadows. */
export function makeRadialTexture(size: number, stops: [number, number][]): Texture {
  const { canvas, ctx } = makeCanvas(size, size);
  const g = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, a] of stops) g.addColorStop(o, `rgba(255,255,255,${a})`);
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, size, size);
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = NoColorSpace;
  tex.needsUpdate = true;
  return tex;
}
