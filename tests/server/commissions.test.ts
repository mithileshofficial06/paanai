import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { encodeLog } from '../../src/shared/core/strokes';
import { recipeToLog } from '../../src/shared/content/recipes';
import { OFFICIAL } from '../../src/shared/content/commissions';
import { listCommissions } from '../../src/server/services/playerCommissions';
import type { ThrowResponse, TodayResponse } from '../../src/shared/api/types';

let p: MemoryPlatform;
let app: ReturnType<typeof createApp>;
function as(user: string | null, postId = 't3_x') {
  p.setCtx({ userId: user ? `t2_${user}` : undefined, username: user ?? undefined, postId });
}
async function call<T>(method: string, path: string, body?: unknown): Promise<{ status: number; json: T }> {
  const res = await app.fetch(
    new Request(`http://x${path}`, { method, headers: { 'content-type': 'application/json' }, ...(body === undefined ? {} : { body: JSON.stringify(body) }) })
  );
  return { status: res.status, json: (await res.json()) as T };
}

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
  p.settingsValues.journeymanPoints = 1;
});

describe('player commissions', () => {
  it('a Journeyman turns a sound pot into a commission post; others play it and the maker earns patron points', async () => {
    as('maker');
    const moon = OFFICIAL.find((o) => o.id === 'moon-jar')!;
    const log = encodeLog(recipeToLog(moon.recipe));
    const t = await call<ThrowResponse>('POST', '/api/throw', { commissionId: moon.id, strokeLog: log, idemKey: 'm1' });
    const made = await call<{ id: string; postId: string; bar: number }>('POST', '/api/commission', {
      potId: t.json.potId,
      adjective: 'Moonlit',
      vessel: 'Jar',
      constraints: ['survive', 'capacity'],
    });
    expect(made.status).toBe(200);
    expect(p.posts.at(-1)?.byUser).toBe(true);
    expect(p.posts.at(-1)?.title).toContain('Moonlit Jar');
    // A second one the same day is refused.
    expect((await call('POST', '/api/commission', { potId: t.json.potId, adjective: 'Tall', vessel: 'Jar', constraints: [] })).status).toBe(429);

    // Bob opens the commission post: /api/today serves the commission with the maker as commissioner.
    as('bob', made.json.postId);
    const today = await call<TodayResponse>('GET', '/api/today');
    expect(today.json.commission.id).toBe(made.json.id);
    expect(today.json.commission.commissioner).toBe('maker');
    const ghost = await call<{ ghostLog: string }>('GET', `/api/commission/${made.json.id}`);
    expect(ghost.json.ghostLog).toBe(log);
    // Bob copies the ghost stroke for stroke: a perfect match beats the commissioner's standard.
    const bob = await call<ThrowResponse>('POST', '/api/throw', { commissionId: made.json.id, strokeLog: log, idemKey: 'b1' });
    expect(bob.json.score.match).toBe(100);
    expect(bob.json.beatBar).toBe(true);
    as('maker');
    expect((await call<TodayResponse>('GET', '/api/today')).json.me?.patron).toBe(1);
  });

  it('rejects free-text titles, too many constraints, and unranked makers', async () => {
    as('maker');
    const c = OFFICIAL[0]!;
    const t = await call<ThrowResponse>('POST', '/api/throw', { commissionId: c.id, strokeLog: encodeLog(recipeToLog(c.recipe)), idemKey: 'x' });
    expect((await call('POST', '/api/commission', { potId: t.json.potId, adjective: 'Rude', vessel: 'Jar', constraints: [] })).status).toBe(400);
    expect((await call('POST', '/api/commission', { potId: t.json.potId, adjective: 'Tall', vessel: 'Jar', constraints: ['survive', 'rim', 'height'] })).status).toBe(400);
    p.settingsValues.journeymanPoints = 50;
    p.settingsValues.minRankToCommission = ['journeyman'];
    expect((await call('POST', '/api/commission', { potId: t.json.potId, adjective: 'Tall', vessel: 'Jar', constraints: [] })).status).toBe(403);
  });

  it('moderators can remove a commission', async () => {
    as('maker');
    const c = OFFICIAL[0]!;
    const t = await call<ThrowResponse>('POST', '/api/throw', { commissionId: c.id, strokeLog: encodeLog(recipeToLog(c.recipe)), idemKey: 'x' });
    const made = await call<{ id: string; postId: string }>('POST', '/api/commission', { potId: t.json.potId, adjective: 'Tall', vessel: 'Cylinder', constraints: [] });
    as('mod', made.json.postId);
    await call('POST', '/internal/menu/remove-commission');
    expect((await listCommissions(20)).length).toBe(0);
    expect(p.posts.find((x) => x.id === made.json.postId)).toBeUndefined();
  });
});
