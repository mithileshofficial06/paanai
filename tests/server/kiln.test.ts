import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { encodeLog } from '../../src/shared/core/strokes';
import { recipeToLog } from '../../src/shared/content/recipes';
import { OFFICIAL } from '../../src/shared/content/commissions';
import type { PotSummary, ThrowResponse, TodayResponse } from '../../src/shared/api/types';
import { firePot } from '../../src/server/services/kiln';

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
async function throwMaster(user: string, idem: string): Promise<string> {
  as(user);
  const today = (await call<TodayResponse>('GET', '/api/today')).json;
  const c = OFFICIAL.find((o) => o.id === today.commission.id)!;
  const r = await call<ThrowResponse>('POST', '/api/throw', { commissionId: c.id, strokeLog: encodeLog(recipeToLog(c.recipe)), idemKey: idem });
  return r.json.potId!;
}

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
});

describe('kiln', () => {
  it('glaze -> wait for 00:00 UTC -> fire on read == batch result; Codex credits the first discoverer once', async () => {
    const a = await throwMaster('alice', 'a1');
    const b = await throwMaster('bob', 'b1');
    as('alice');
    expect((await call('POST', '/api/glaze', { potId: a, glazes: ['copper'], application: 'dip' })).status).toBe(200);
    expect((await call('POST', '/api/glaze', { potId: a, glazes: ['iron'], application: 'dip' })).status).toBe(409);
    as('bob');
    expect((await call('POST', '/api/glaze', { potId: a, glazes: ['copper'], application: 'dip' })).status).toBe(403);
    await call('POST', '/api/glaze', { potId: b, glazes: ['copper'], application: 'dip' });

    // Not fired before midnight.
    expect(await firePot(a)).toBeNull();
    p.shiftDays(1);
    // Alice reads her kiln (fire on read); Bob's pot is fired by the batch.
    as('alice');
    const k = await call<{ items: (PotSummary & { opened: boolean })[] }>('GET', '/api/kiln');
    const mine = k.json.items.find((i) => i.potId === a)!;
    expect(mine.fired).not.toBeNull();
    const batch = await call<{ fired: number; remaining: number }>('POST', '/internal/cron/kiln-batch');
    expect(batch.json.remaining).toBe(0);
    // Re-firing gives the identical result.
    expect(await firePot(a)).toEqual(mine.fired);
    const codex = await call<{ effects: { id: string; discoverer: string | null }[]; discovered: number }>('GET', '/api/codex');
    const colour = mine.fired!.effects[0]!;
    expect(codex.json.effects.find((e) => e.id === colour)?.discoverer).toBe('alice');
    // Kiln report posts once.
    await call('POST', '/internal/cron/kiln-report');
    await call('POST', '/internal/cron/kiln-report');
    expect(p.comments.filter((c) => c.text?.startsWith('**Kiln Report')).length).toBe(1);
  });

  it("a player's first pot gets a quick test firing; later pots wait for 00:00 UTC", async () => {
    const a = await throwMaster('alice', 'q1');
    as('alice');
    const g = await call<{ quickAt: number | null }>('POST', '/api/glaze', { potId: a });
    expect(g.json.quickAt).toBeGreaterThan(p.now());
    expect(await firePot(a)).toBeNull();
    p.shiftDays(0.0011); // about 95 seconds, same day
    const k = await call<{ items: (PotSummary & { firesAt: number | null })[] }>('GET', '/api/kiln');
    expect(k.json.items.find((i) => i.potId === a)?.fired).not.toBeNull();
    const b = await throwMaster('alice', 'q2');
    as('alice');
    expect((await call<{ quickAt: number | null }>('POST', '/api/glaze', { potId: b })).json.quickAt).toBeNull();
    p.shiftDays(0.0011);
    expect(await firePot(b)).toBeNull();
  });

  it('showcase, likes, reports auto-hide at threshold, delete', async () => {
    const a = await throwMaster('alice', 'a1');
    as('alice');
    await call('POST', '/api/glaze', { potId: a, glazes: ['cobalt'], application: 'dip' });
    p.shiftDays(1);
    await call('POST', '/internal/cron/kiln-batch');
    // Fired pots stay private until their maker puts them on show.
    expect((await call<{ pots: PotSummary[] }>('GET', '/api/showcase')).json.pots).toHaveLength(0);
    await call('POST', '/api/showcase', { potId: a, on: true });
    const shelf = await call<{ pots: PotSummary[] }>('GET', '/api/showcase');
    expect(shelf.json.pots.map((x) => x.potId)).toContain(a);
    as('bob');
    expect((await call<{ liked: boolean; likes: number }>('POST', '/api/like', { potId: a })).json.likes).toBe(1);
    for (const u of ['bob', 'carol', 'dan']) {
      as(u);
      await call('POST', '/api/report', { targetId: a });
    }
    const after = await call<{ pots: PotSummary[] }>('GET', '/api/showcase');
    expect(after.json.pots.map((x) => x.potId)).not.toContain(a);
    as('alice');
    await call('POST', '/api/pot/delete', { potId: a });
    expect(p.kv.dump()[`p:pot:${a}`]).toBeUndefined();
  });

  it('share posts a comment as the user after an explicit request', async () => {
    const a = await throwMaster('alice', 'a1');
    await call('POST', '/internal/cron/daily-rollover');
    as('alice');
    const r = await call<{ commentId: string }>('POST', '/api/share', { potId: a, pngDataUrl: 'data:image/png;base64,iVBORw0KGgo=' });
    expect(r.status).toBe(200);
    expect(p.comments.at(-1)?.byUser).toBe(true);
    expect(p.comments.at(-1)?.imageUrl).toBeTruthy();
  });

  it('starter pot is a fired Copper Red', async () => {
    const s = await call<PotSummary>('GET', '/api/starter');
    expect(s.json.fired?.survived).toBe(true);
    expect(s.json.fired?.effects).toContain('copper-red');
  });
});
