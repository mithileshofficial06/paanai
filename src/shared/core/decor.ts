// Painted decoration on a finished pot: a body colour, a rim colour, painted bands and rings of
// motifs. Shared by the client (drawing it onto the 3D pot) and the server (validating it).
// Decoration is painted on top of the glaze, like overglaze enamel, so the kiln never changes it.

export const DECOR_PALETTE = [
  { id: 'terracotta', name: 'Terracotta', hex: '#b5532e' },
  { id: 'ochre', name: 'Ochre', hex: '#d39a2b' },
  { id: 'saffron', name: 'Saffron', hex: '#f4b41a' },
  { id: 'kumkum', name: 'Kumkum red', hex: '#c8102e' },
  { id: 'indigo', name: 'Indigo', hex: '#253a8a' },
  { id: 'turquoise', name: 'Turquoise', hex: '#2aa7a1' },
  { id: 'leaf', name: 'Leaf green', hex: '#3f8a3a' },
  { id: 'chalk', name: 'Chalk white', hex: '#f1ebdd' },
  { id: 'soot', name: 'Soot black', hex: '#1d1a18' },
  { id: 'gold', name: 'Gold', hex: '#d4af37' },
  { id: 'rose', name: 'Rose', hex: '#e07a8f' },
  { id: 'sky', name: 'Sky', hex: '#7fb8e6' },
] as const;

export const MOTIFS = ['dots', 'waves', 'zigzag', 'leaves', 'flowers', 'stars', 'fish', 'stripes'] as const;
export type Motif = (typeof MOTIFS)[number];

export type DecorBand = { y: number; w: number; color: string };
export type DecorMotifs = { kind: Motif; y: number; size: number; count: number; color: string };
export type Decor = {
  /** Painted body colour over the whole outside, or null to keep the clay or glaze. */
  base: string | null;
  /** Painted rim, or null. */
  rim: string | null;
  bands: DecorBand[];
  motifs: DecorMotifs[];
};

export const MAX_BANDS = 6;
export const MAX_MOTIFS = 4;

export function emptyDecor(): Decor {
  return { base: null, rim: null, bands: [], motifs: [] };
}

export function isEmptyDecor(d: Decor | null | undefined): boolean {
  return !d || (!d.base && !d.rim && d.bands.length === 0 && d.motifs.length === 0);
}

const HEX = /^#[0-9a-f]{6}$/i;
const num = (v: unknown, lo: number, hi: number): number | null => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi ? Math.round(v * 1000) / 1000 : null);
const colour = (v: unknown): string | null => (typeof v === 'string' && HEX.test(v) ? v.toLowerCase() : null);

/** Strict copy of untrusted input, or null if it is not a valid decoration. */
export function sanitizeDecor(raw: unknown): Decor | null {
  if (!raw || typeof raw !== 'object') return null;
  const r = raw as Record<string, unknown>;
  if (!Array.isArray(r.bands) || !Array.isArray(r.motifs)) return null;
  if (r.bands.length > MAX_BANDS || r.motifs.length > MAX_MOTIFS) return null;
  const base = r.base === null ? null : colour(r.base);
  const rim = r.rim === null ? null : colour(r.rim);
  if ((r.base !== null && !base) || (r.rim !== null && !rim)) return null;
  const bands: DecorBand[] = [];
  for (const b of r.bands as unknown[]) {
    const o = (b ?? {}) as Record<string, unknown>;
    const y = num(o.y, 0, 1);
    const w = num(o.w, 0.01, 0.2);
    const c = colour(o.color);
    if (y === null || w === null || !c) return null;
    bands.push({ y, w, color: c });
  }
  const motifs: DecorMotifs[] = [];
  for (const m of r.motifs as unknown[]) {
    const o = (m ?? {}) as Record<string, unknown>;
    const y = num(o.y, 0, 1);
    const size = num(o.size, 0.04, 0.3);
    const count = num(o.count, 3, 16);
    const c = colour(o.color);
    if (y === null || size === null || count === null || !c || !MOTIFS.includes(o.kind as Motif)) return null;
    motifs.push({ kind: o.kind as Motif, y, size, count: Math.round(count), color: c });
  }
  return { base, rim, bands, motifs };
}

/** A short stable key (for render caches). */
export function decorKey(d: Decor | null | undefined): string {
  if (isEmptyDecor(d)) return '-';
  return JSON.stringify(d);
}
