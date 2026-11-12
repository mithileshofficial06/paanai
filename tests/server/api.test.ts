import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { encodeLog } from '../../src/shared/core/strokes';
import { recipeToLog } from '../../src/shared/content/recipes';
import { OFFICIAL } from '../../src/shared/content/commissions';
import type { ThrowResponse, TodayResponse } from '../../src/shared/api/types';
import { simulate, goodThrow } from '../helpers';

let p: MemoryPlatform;
let app: ReturnType<typeof createApp>;

function as(user: string | null) {
  p.setCtx({ userId: user ? `t2_${user}` : undefined, username: user ?? undefined, postId: 't3_x' });
}
async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await app.fetch(
    new Request(`http://x${path}`, {
      method,
      headers: { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    })
  );
  return { status: res.status, json: (await res.json()) as T };
}

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
  as('alice');
});

describe('today', () => {
  it('returns the daily commission with a bar, target and atmosphere', async () => {
    const { status, json } = await call<TodayResponse>('GET', '/api/today');
    expect(status).toBe(200);
    expect(json.commission.bar).toBeGreaterThan(50);
    expect(json.commission.target.length).toBe(3 + 96);
    expect(['oxidation', 'reduction']).toContain(json.atmosphere);
    expect(json.me?.username).toBe('alice');
    expect(json.myThrow).toBeNull();
  });
});

describe('throw', () => {
  it('replays the log server-side; first throw is ranked, second is practice', async () => {
    const today = (await call<TodayResponse>('GET', '/api/today')).json;
    const { rec } = simulate(goodThrow());
    const log = encodeLog(rec.toLog());
    const a = await call<ThrowResponse>('POST', '/api/throw', { commissionId: today.commission.id, strokeLog: log, idemKey: 'k1' });
    expect(a.status).toBe(200);
    expect(a.json.ranked).toBe(true);
    expect(a.json.rank).toBe(1);
    const again = await call<ThrowResponse>('POST', '/api/throw', { commissionId: today.commission.id, strokeLog: log, idemKey: 'k1' });
    expect(again.json.potId).toBe(a.json.potId);
    const b = await call<ThrowResponse>('POST', '/api/throw', { commissionId: today.commission.id, strokeLog: log, idemKey: 'k2' });
    expect(b.json.ranked).toBe(false);
    expect(b.json.practiceReason).toBe('already-ranked');
    const t2 = (await call<TodayResponse>('GET', '/api/today')).json;
    expect(t2.myThrow?.potId).toBe(a.json.potId);
    expect(t2.me?.throws).toBe(1);
  });

  it("the Master's own throw scores exactly the bar", async () => {
    const today = (await call<TodayResponse>('GET', '/api/today')).json;
    const c = OFFICIAL.find((o) => o.id === today.commission.id)!;
    const r = await call<ThrowResponse>('POST', '/api/throw', {
      commissionId: c.id,
      strokeLog: encodeLog(recipeToLog(c.recipe)),
      idemKey: 'm',
    });
    expect(r.json.score.total).toBe(today.commission.bar);
    expect(r.json.beatBar).toBe(false);
  });

  it('rejects an unopened lump and garbage logs', async () => {
    const id = OFFICIAL[0]!.id;
    const unopened = encodeLog({ endTick: 10, entries: [] });
    expect((await call('POST', '/api/throw', { commissionId: id, strokeLog: unopened, idemKey: 'a' })).status).toBe(400);
    expect((await call('POST', '/api/throw', { commissionId: id, strokeLog: '%%%', idemKey: 'b' })).status).toBe(400);
  });

  it('logged-out throws are scored but not stored', async () => {
    as(null);
    const { rec } = simulate(goodThrow());
    const r = await call<ThrowResponse>('POST', '/api/throw', {
      commissionId: OFFICIAL[0]!.id,
      strokeLog: encodeLog(rec.toLog()),
      idemKey: 'z',
    });
    expect(r.json.ranked).toBe(false);
    expect(r.json.practiceReason).toBe('logged-out');
    expect(r.json.potId).toBeNull();
  });

  it('rate-limits bursts', async () => {
    const { rec } = simulate(goodThrow());
    const log = encodeLog(rec.toLog());
    let last = 200;
    for (let i = 0; i < 8; i++) {
      last = (await call('POST', '/api/throw', { commissionId: OFFICIAL[0]!.id, strokeLog: log, idemKey: `r${i}` })).status;
    }
    expect(last).toBe(429);
  });
});

describe('rollover', () => {
  it('creates exactly one daily post even if run twice', async () => {
    await call('POST', '/internal/cron/daily-rollover');
    await call('POST', '/internal/cron/daily-rollover');
    expect(p.posts.length).toBe(1);
    expect(p.posts[0]!.title).toMatch(/^Day \d+ · .+ · Beat \d+$/);
  });
});
