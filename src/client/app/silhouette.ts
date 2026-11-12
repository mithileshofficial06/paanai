// Build an SVG path for a pot silhouette from an encoded profile (encodeProfile()).
// Coordinates: viewBox "0 0 100 100", pot centred, base at the bottom, scaled to fit.

export type SilhouetteOpts = { pad?: number; maxR?: number; maxH?: number };

export function decodeOutline(encoded: readonly number[]): { height: number; outer: number[]; wall: number[]; opened: boolean } {
  const height = encoded[0] ?? 1;
  const opened = ((encoded[1] ?? 0) & 1) !== 0;
  const outer: number[] = [];
  const wall: number[] = [];
  for (let i = 0; i < 48; i++) {
    outer.push(encoded[3 + i * 2] ?? 0);
    wall.push(encoded[4 + i * 2] ?? 0);
  }
  return { height, outer, wall, opened };
}

/** Smooth closed path of the full (mirrored) outer silhouette. */
export function silhouettePath(encoded: readonly number[], o: SilhouetteOpts = {}): string {
  const { height, outer } = decodeOutline(encoded);
  const pad = o.pad ?? 6;
  const maxR = o.maxR ?? Math.max(...outer, 1);
  const maxH = o.maxH ?? height;
  const scale = Math.min((100 - pad * 2) / (maxR * 2), (100 - pad * 2) / maxH);
  const cx = 50;
  const base = 100 - pad;
  const pts = outer.map((r, i) => ({ x: r * scale, y: base - ((i + 0.5) / 48) * height * scale }));
  const top = base - height * scale;
  const right = pts.map((p) => `${(cx + p.x).toFixed(2)},${p.y.toFixed(2)}`);
  const left = [...pts].reverse().map((p) => `${(cx - p.x).toFixed(2)},${p.y.toFixed(2)}`);
  const first = pts[0]!;
  const last = pts[pts.length - 1]!;
  return [
    `M${(cx - first.x).toFixed(2)},${base.toFixed(2)}`,
    `L${(cx + first.x).toFixed(2)},${base.toFixed(2)}`,
    `L${right.join(' L')}`,
    `L${(cx + last.x).toFixed(2)},${top.toFixed(2)}`,
    `L${(cx - last.x).toFixed(2)},${top.toFixed(2)}`,
    `L${left.join(' L')}`,
    'Z',
  ].join(' ');
}
