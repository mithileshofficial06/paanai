import { MAX_ENTRIES, MAX_TICKS, RINGS } from './fixed';
import { type Entry, Mode, type ModeId, type StrokeLog } from './shape';

const VERSION = 1;
const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

function pushVarint(out: number[], v: number): void {
  let x = v >>> 0;
  while (x >= 0x80) {
    out.push((x & 0x7f) | 0x80);
    x >>>= 7;
  }
  out.push(x);
}

export function bytesToB64url(bytes: ArrayLike<number>): string {
  let s = '';
  let i = 0;
  for (; i + 2 < bytes.length; i += 3) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8) | (bytes[i + 2] ?? 0);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]! + B64[n & 63]!;
  }
  const rest = bytes.length - i;
  if (rest === 1) {
    const n = (bytes[i] ?? 0) << 16;
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!;
  } else if (rest === 2) {
    const n = ((bytes[i] ?? 0) << 16) | ((bytes[i + 1] ?? 0) << 8);
    s += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]! + B64[(n >> 6) & 63]!;
  }
  return s;
}

export function b64urlToBytes(s: string): number[] | null {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (let i = 0; i < s.length; i++) {
    const v = B64.indexOf(s[i] ?? '');
    if (v < 0) return null;
    buf = (buf << 6) | v;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >> bits) & 0xff);
    }
  }
  return out;
}

/** Encode: [version][varint endTick][varint count] then per entry [varint dt][u16 packed]. */
export function encodeLog(log: StrokeLog): string {
  const out: number[] = [VERSION];
  pushVarint(out, log.endTick);
  pushVarint(out, log.entries.length);
  for (const e of log.entries) {
    pushVarint(out, e.dt);
    const packed = (e.ring & 63) | ((e.mode & 3) << 6) | (((e.dr + 64) & 127) << 8) | (e.start ? 0x8000 : 0);
    out.push(packed & 0xff, (packed >> 8) & 0xff);
  }
  return bytesToB64url(out);
}

export type DecodeResult = { ok: true; log: StrokeLog } | { ok: false; error: string };

/** Decode and validate against the hard caps. Anything invalid is rejected, never repaired. */
export function decodeLog(s: string): DecodeResult {
  if (s.length > 40_000) return { ok: false, error: 'log too large' };
  const bytes = b64urlToBytes(s);
  if (!bytes || bytes.length < 3) return { ok: false, error: 'bad encoding' };
  let pos = 0;
  const readVarint = (): number | null => {
    let result = 0;
    let shift = 0;
    for (let k = 0; k < 5; k++) {
      const b = bytes[pos++];
      if (b === undefined) return null;
      result += (b & 0x7f) * 2 ** shift;
      if ((b & 0x80) === 0) return result;
      shift += 7;
    }
    return null;
  };
  if (bytes[pos++] !== VERSION) return { ok: false, error: 'bad version' };
  const endTick = readVarint();
  const count = readVarint();
  if (endTick === null || count === null) return { ok: false, error: 'bad header' };
  if (endTick > MAX_TICKS) return { ok: false, error: 'throw too long' };
  if (count > MAX_ENTRIES) return { ok: false, error: 'too many entries' };
  const entries: Entry[] = [];
  let t = 0;
  for (let k = 0; k < count; k++) {
    const dt = readVarint();
    const lo = bytes[pos++];
    const hi = bytes[pos++];
    if (dt === null || lo === undefined || hi === undefined) return { ok: false, error: 'truncated' };
    if (dt < 1) return { ok: false, error: 'bad dt' };
    const packed = lo | (hi << 8);
    const ring = packed & 63;
    const mode = (packed >> 6) & 3;
    const dr = ((packed >> 8) & 127) - 64;
    if (ring >= RINGS) return { ok: false, error: 'bad ring' };
    if (mode > Mode.OPEN) return { ok: false, error: 'bad mode' };
    t += dt;
    if (t > endTick) return { ok: false, error: 'entry after end' };
    entries.push({ dt, ring, mode: mode as ModeId, dr, start: (packed & 0x8000) !== 0 });
  }
  if (pos !== bytes.length) return { ok: false, error: 'trailing bytes' };
  return { ok: true, log: { endTick, entries } };
}

/**
 * Incremental recorder used by the client. Undo rewinds the timeline to the start of
 * the last stroke so that the replayed result always equals what the player saw.
 */
export class StrokeRecorder {
  entries: Entry[] = [];
  tick = 0;
  private lastEntryTick = 0;
  private strokeOpen = false;

  /** Call once per simulation tick. Returns the entry if one was recorded. */
  record(input: { ring: number; mode: ModeId; dr: number } | null): Entry | null {
    this.tick++;
    if (!input) {
      this.strokeOpen = false;
      return null;
    }
    const e: Entry = {
      dt: this.tick - this.lastEntryTick,
      ring: input.ring,
      mode: input.mode,
      dr: Math.max(-64, Math.min(63, Math.round(input.dr))),
      start: !this.strokeOpen,
    };
    this.strokeOpen = input.mode !== Mode.OPEN;
    this.lastEntryTick = this.tick;
    this.entries.push(e);
    return e;
  }

  /** Mark the end of the current finger gesture. */
  endStroke(): void {
    this.strokeOpen = false;
  }

  /** Remove the last stroke; returns false if nothing to undo. */
  undo(): boolean {
    let k = this.entries.length - 1;
    while (k >= 0 && !this.entries[k]!.start) k--;
    if (k < 0) return false;
    this.entries.length = k;
    let t = 0;
    for (const e of this.entries) t += e.dt;
    this.tick = t;
    this.lastEntryTick = t;
    this.strokeOpen = false;
    return true;
  }

  get full(): boolean {
    return this.tick >= 5400 || this.entries.length >= 4000;
  }

  toLog(): StrokeLog {
    return { endTick: this.tick, entries: this.entries.slice() };
  }
}
