import type { KV, Platform, RequestContext, Tx, ZMember, ZRangeOpts } from './types';

type Entry = { kind: 'str'; v: string } | { kind: 'hash'; v: Map<string, string> } | { kind: 'zset'; v: Map<string, number> };

/** In-memory Redis subset with TTLs and optimistic transactions. Single process only. */
export class MemoryKV implements KV {
  private data = new Map<string, Entry>();
  private ttl = new Map<string, number>();
  private versions = new Map<string, number>();
  constructor(private clock: () => number) {}

  private alive(key: string): Entry | undefined {
    const t = this.ttl.get(key);
    if (t !== undefined && t <= this.clock()) {
      this.data.delete(key);
      this.ttl.delete(key);
    }
    return this.data.get(key);
  }
  private touch(key: string): void {
    this.versions.set(key, (this.versions.get(key) ?? 0) + 1);
  }
  private hash(key: string): Map<string, string> {
    const e = this.alive(key);
    if (e?.kind === 'hash') return e.v;
    const m = new Map<string, string>();
    this.data.set(key, { kind: 'hash', v: m });
    return m;
  }
  private zset(key: string): Map<string, number> {
    const e = this.alive(key);
    if (e?.kind === 'zset') return e.v;
    const m = new Map<string, number>();
    this.data.set(key, { kind: 'zset', v: m });
    return m;
  }
  private sorted(key: string): ZMember[] {
    const e = this.alive(key);
    if (e?.kind !== 'zset') return [];
    return [...e.v.entries()]
      .map(([member, score]) => ({ member, score }))
      .sort((a, b) => a.score - b.score || (a.member < b.member ? -1 : a.member > b.member ? 1 : 0));
  }

  version(key: string): number {
    return this.versions.get(key) ?? 0;
  }
  dump(): Record<string, unknown> {
    const out: Record<string, unknown> = {};
    for (const k of this.data.keys()) {
      const e = this.alive(k);
      if (!e) continue;
      out[k] = e.kind === 'str' ? e.v : Object.fromEntries(e.v);
    }
    return out;
  }
  size(): number {
    return this.data.size;
  }

  async get(key: string) {
    const e = this.alive(key);
    return e?.kind === 'str' ? e.v : undefined;
  }
  async set(key: string, value: string, opts?: { nx?: boolean; expiration?: Date }) {
    if (opts?.nx && this.alive(key)) return '';
    this.data.set(key, { kind: 'str', v: value });
    if (opts?.expiration) this.ttl.set(key, opts.expiration.getTime());
    else this.ttl.delete(key);
    this.touch(key);
    return 'OK';
  }
  async del(...keys: string[]) {
    for (const k of keys) {
      this.data.delete(k);
      this.ttl.delete(k);
      this.touch(k);
    }
  }
  async exists(...keys: string[]) {
    return keys.filter((k) => this.alive(k)).length;
  }
  async incrBy(key: string, by: number) {
    const v = Number((await this.get(key)) ?? '0') + by;
    const t = this.ttl.get(key);
    this.data.set(key, { kind: 'str', v: String(v) });
    if (t !== undefined) this.ttl.set(key, t);
    this.touch(key);
    return v;
  }
  async expire(key: string, seconds: number) {
    if (this.alive(key)) this.ttl.set(key, this.clock() + seconds * 1000);
  }
  async hGet(key: string, field: string) {
    const e = this.alive(key);
    return e?.kind === 'hash' ? e.v.get(field) : undefined;
  }
  async hMGet(key: string, fields: string[]) {
    const e = this.alive(key);
    return fields.map((f) => (e?.kind === 'hash' ? (e.v.get(f) ?? null) : null));
  }
  async hGetAll(key: string) {
    const e = this.alive(key);
    return e?.kind === 'hash' ? Object.fromEntries(e.v) : {};
  }
  async hSet(key: string, values: Record<string, string>) {
    const h = this.hash(key);
    let added = 0;
    for (const [f, v] of Object.entries(values)) {
      if (!h.has(f)) added++;
      h.set(f, v);
    }
    this.touch(key);
    return added;
  }
  async hIncrBy(key: string, field: string, by: number) {
    const h = this.hash(key);
    const v = Number(h.get(field) ?? '0') + by;
    h.set(field, String(v));
    this.touch(key);
    return v;
  }
  async hDel(key: string, fields: string[]) {
    const h = this.hash(key);
    let n = 0;
    for (const f of fields) if (h.delete(f)) n++;
    this.touch(key);
    return n;
  }
  async zAdd(key: string, ...members: ZMember[]) {
    const z = this.zset(key);
    let added = 0;
    for (const m of members) {
      if (!z.has(m.member)) added++;
      z.set(m.member, m.score);
    }
    this.touch(key);
    return added;
  }
  async zRange(key: string, start: number, stop: number, opts?: ZRangeOpts) {
    let list = this.sorted(key);
    if (opts?.by === 'score') {
      list = list.filter((m) => m.score >= start && m.score <= stop);
      if (opts.reverse) list.reverse();
      if (opts.limit) list = list.slice(opts.limit.offset, opts.limit.offset + opts.limit.count);
      return list;
    }
    if (opts?.reverse) list.reverse();
    const n = list.length;
    const s = start < 0 ? Math.max(0, n + start) : start;
    const e = stop < 0 ? n + stop : Math.min(stop, n - 1);
    return e < s ? [] : list.slice(s, e + 1);
  }
  async zRem(key: string, members: string[]) {
    const z = this.zset(key);
    let n = 0;
    for (const m of members) if (z.delete(m)) n++;
    this.touch(key);
    return n;
  }
  async zScore(key: string, member: string) {
    const e = this.alive(key);
    return e?.kind === 'zset' ? e.v.get(member) : undefined;
  }
  async zRank(key: string, member: string) {
    const i = this.sorted(key).findIndex((m) => m.member === member);
    return i < 0 ? undefined : i;
  }
  async zCard(key: string) {
    const e = this.alive(key);
    return e?.kind === 'zset' ? e.v.size : 0;
  }
  async zIncrBy(key: string, member: string, by: number) {
    const z = this.zset(key);
    const v = (z.get(member) ?? 0) + by;
    z.set(member, v);
    this.touch(key);
    return v;
  }
  async zRemRangeByRank(key: string, start: number, stop: number) {
    const victims = await this.zRange(key, start, stop);
    return this.zRem(
      key,
      victims.map((m) => m.member)
    );
  }
  async watch(...keys: string[]): Promise<Tx> {
    const seen = new Map(keys.map((k) => [k, this.version(k)]));
    const ops: (() => Promise<unknown>)[] = [];
    // eslint-disable-next-line @typescript-eslint/no-this-alias
    const kv = this;
    return {
      async multi() {},
      async hSet(key, values) {
        ops.push(() => kv.hSet(key, values));
      },
      async zAdd(key, ...members) {
        ops.push(() => kv.zAdd(key, ...members));
      },
      async exec() {
        for (const [k, v] of seen) if (kv.version(k) !== v) return null;
        const out: unknown[] = [];
        for (const op of ops) out.push(await op());
        return out;
      },
      async unwatch() {},
      async discard() {
        ops.length = 0;
      },
    };
  }
}

export type MemoryPlatform = Platform & {
  kv: MemoryKV;
  setCtx(c: Partial<RequestContext>): void;
  shiftDays(n: number): void;
  posts: { id: string; title: string; postData?: Record<string, unknown> | undefined; byUser: boolean }[];
  comments: { id: string; postId: string; text?: string | undefined; imageUrl?: string | undefined; byUser: boolean }[];
  flairs: Map<string, string>;
  settingsValues: Record<string, unknown>;
};

export function createMemoryPlatform(startMs = Date.now()): MemoryPlatform {
  let offset = 0;
  const now = () => startMs + offset + (Date.now() - startMs);
  let ctx: RequestContext = { userId: undefined, username: undefined, postId: undefined, subredditName: 'paanai_dev' };
  let nextId = 1;
  const p: MemoryPlatform = {
    kv: new MemoryKV(() => now()),
    now,
    ctx: () => ctx,
    setCtx(c) {
      ctx = { ...ctx, ...c };
    },
    shiftDays(n) {
      offset += n * 86_400_000;
    },
    posts: [],
    comments: [],
    flairs: new Map(),
    settingsValues: {},
    reddit: {
      async submitPost(o) {
        const id = `t3_mem${nextId++}`;
        p.posts.push({ id, title: o.title, postData: o.postData, byUser: !!o.runAsUser });
        return { id, url: `https://reddit.com/r/${ctx.subredditName}/comments/${id.slice(3)}` };
      },
      async submitComment(o) {
        const id = `t1_mem${nextId++}`;
        p.comments.push({ id, postId: o.postId, text: o.text ?? o.caption, imageUrl: o.imageUrl, byUser: !!o.runAsUser });
        return { id };
      },
      async setUserFlair(username, text) {
        p.flairs.set(username, text);
      },
      async getSnoovatarUrl() {
        return undefined;
      },
      async removePost(postId) {
        p.posts = p.posts.filter((x) => x.id !== postId);
      },
    },
    media: {
      async uploadImage(dataUrl) {
        const id = `media${nextId++}`;
        return { mediaId: id, mediaUrl: dataUrl.slice(0, 64) };
      },
    },
    settings: {
      async get(name) {
        return p.settingsValues[name];
      },
    },
  };
  return p;
}
