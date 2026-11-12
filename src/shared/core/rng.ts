// Exact-integer PRNG and hashing. Used ONLY for cosmetic placement (crack paths, speckles).

/** FNV-1a 32-bit hash of a string (UTF-16 code units). */
export function hash32(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/** FNV-1a over a list of integers (each folded as 32-bit). */
export function hashInts(values: ArrayLike<number>, seed = 0x811c9dc5): number {
  let h = seed >>> 0;
  for (let i = 0; i < values.length; i++) {
    const v = (values[i] ?? 0) | 0;
    for (let b = 0; b < 4; b++) {
      h ^= (v >>> (b * 8)) & 0xff;
      h = Math.imul(h, 0x01000193);
    }
  }
  return h >>> 0;
}

/** mulberry32: returns a function producing uint32 values. */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return (t ^ (t >>> 14)) >>> 0;
  };
}

/** Uniform integer in [0, n) from a uint32 source. */
export function randInt(next: () => number, n: number): number {
  return next() % n;
}
