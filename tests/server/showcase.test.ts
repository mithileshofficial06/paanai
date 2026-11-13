import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { kilnGlaze } from '../../src/server/services/kiln';
import { encodeLog } from '../../src/shared/core/strokes';
import { recipeToLog } from '../../src/shared/content/recipes';
import { levelData } from '../../src/shared/content/levels';
import { validGlazeSpec } from '../../src/shared/core/glazes';
import type { LevelThrowResponse, PotSummary, ThrowResponse, TodayResponse } from '../../src/shared/api/types';
import { simulate, goodThrow } from '../helpers';

let p: MemoryPlatform;
let app: ReturnType<typeof createApp>;
function as(user: string | null) {
  p.setCtx({ userId: user ? `t2_${user}` : undefined, username: user ?? undefined, postId: 't3_x' });
}
async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await app.fetch(
    new Request(`http://x${path}`, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  );
  return { status: res.status, json: (await res.json()) as T };
}
async function dailyPot(user: string): Promise<string> {
  as(user);
  const today = (await call<TodayResponse>('GET', '/api/today')).json;
  const log = encodeLog(simulate(goodThrow()).rec.toLog());
  const r = await call<ThrowResponse>('POST', '/api/throw', { commissionId: today.commission.id, strokeLog: log, idemKey: `${user}${Math.random()}` });
  return r.json.potId!;
}
const show = () => call<{ pots: PotSummary[] }>('GET', '/api/showcase');

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
});

describe('showcase', () => {
  it('only the maker can put a pot on show; others rate it once (re-rating replaces)', async () => {
    const a = await dailyPot('alice');
    as('bob');
    expect((await call('POST', '/api/showcase', { potId: a, on: true })).status).toBe(403);
    expect((await call('POST', '/api/rate', { potId: a, stars: 5 })).status).toBe(404); // not on show yet
    as('alice');
    expect((await call('POST', '/api/showcase', { potId: a, on: true })).status).toBe(200);
    expect((await call('POST', '/api/rate', { potId: a, stars: 5 })).status).toBe(403); // own pot
    as('bob');
    expect((await call('POST', '/api/rate', { potId: a, stars: 0 })).status).toBe(400);
    await call('POST', '/api/rate', { potId: a, stars: 2 });
    await call('POST', '/api/rate', { potId: a, stars: 4 }); // changes bob's rating
    as('carol');
    const r = await call<{ rating: number; ratings: number }>('POST', '/api/rate', { potId: a, stars: 5 });
    expect(r.json).toMatchObject({ rating: 45, ratings: 2 });
    const page = (await show()).json.pots;
    expect(page[0]).toMatchObject({ potId: a, showcased: true, rating: 45, ratings: 2, myRating: 5, myLike: false });
  });

  it('Top sorts by rating; taking a pot down removes it', async () => {
    const a = await dailyPot('alice');
    const b = await dailyPot('bob');
    as('alice');
    await call('POST', '/api/showcase', { potId: a, on: true });
    as('bob');
    await call('POST', '/api/showcase', { potId: b, on: true });
    as('carol');
    await call('POST', '/api/rate', { potId: a, stars: 5 });
    await call('POST', '/api/rate', { potId: b, stars: 1 });
    const top = await call<{ pots: PotSummary[] }>('GET', '/api/showcase?sort=top');
    expect(top.json.pots.map((x) => x.potId)).toEqual([a, b]);
    as('alice');
    await call('POST', '/api/showcase', { potId: a, on: false });
    expect((await show()).json.pots.map((x) => x.potId)).toEqual([b]);
  });

  it('level pots are kept so they can be painted, shown and shared', async () => {
    as('alice');
    const d = levelData(1);
    const r = await call<LevelThrowResponse>('POST', '/api/level/throw', { level: 1, strokeLog: encodeLog(recipeToLog(d.spec.recipe)) });
    expect(r.json.potId).toMatch(/^pot/);
    expect((await call('POST', '/api/showcase', { potId: r.json.potId, on: true })).status).toBe(200);
    expect((await call('POST', '/api/share', { potId: r.json.potId, pngDataUrl: 'data:image/png;base64,iVBORw0KGgo=' })).status).toBe(200);
    expect(p.comments.at(-1)?.text).toContain('Level 1');
  });

  it('the kiln glazes pots itself: no choice needed, always a valid recipe', async () => {
    for (let i = 0; i < 50; i++) expect(validGlazeSpec(kilnGlaze(`pot${i}`))).toBe(true);
    const a = await dailyPot('alice');
    expect((await call('POST', '/api/glaze', { potId: a })).status).toBe(200);
    const kiln = await call<{ items: PotSummary[] }>('GET', '/api/kiln');
    expect(kiln.json.items[0]?.glaze?.glazes.length).toBeGreaterThan(0);
  });
});
