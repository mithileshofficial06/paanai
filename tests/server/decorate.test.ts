import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { firePot } from '../../src/server/services/kiln';
import { encodeLog } from '../../src/shared/core/strokes';
import { type Decor, sanitizeDecor } from '../../src/shared/core/decor';
import type { PotSummary, ThrowResponse, TodayResponse } from '../../src/shared/api/types';
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
async function throwPot(): Promise<string> {
  const today = (await call<TodayResponse>('GET', '/api/today')).json;
  const log = encodeLog(simulate(goodThrow()).rec.toLog());
  const r = await call<ThrowResponse>('POST', '/api/throw', { commissionId: today.commission.id, strokeLog: log, idemKey: `d${Math.random()}` });
  return r.json.potId!;
}
const DECOR: Decor = {
  base: '#f1ebdd',
  rim: '#253a8a',
  bands: [{ y: 0.3, w: 0.05, color: '#253a8a' }],
  motifs: [{ kind: 'flowers', y: 0.55, size: 0.13, count: 8, color: '#c8102e' }],
};

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
  as('alice');
});

describe('decor validation', () => {
  it('keeps a good decoration and rejects bad colours, kinds and sizes', () => {
    expect(sanitizeDecor(DECOR)).toEqual(DECOR);
    expect(sanitizeDecor({ ...DECOR, base: 'red' })).toBeNull();
    expect(sanitizeDecor({ ...DECOR, motifs: [{ ...DECOR.motifs[0], kind: 'skulls' }] })).toBeNull();
    expect(sanitizeDecor({ ...DECOR, bands: [{ y: 2, w: 0.05, color: '#000000' }] })).toBeNull();
    expect(sanitizeDecor({ ...DECOR, bands: Array.from({ length: 7 }, () => DECOR.bands[0]) })).toBeNull();
    expect(sanitizeDecor('<script>')).toBeNull();
  });
});

describe('decorate', () => {
  it('saves paint on your own pot and shows it in the kiln', async () => {
    const potId = await throwPot();
    const r = await call<{ decor: Decor }>('POST', '/api/decorate', { potId, decor: DECOR });
    expect(r.status).toBe(200);
    await call('POST', '/api/glaze', { potId, glazes: ['copper'], application: 'dip' });
    const kiln = await call<{ items: PotSummary[] }>('GET', '/api/kiln');
    expect(kiln.json.items.find((i) => i.potId === potId)?.decor).toEqual(DECOR);
  });

  it('refuses other people’s pots, fired pots and junk', async () => {
    const potId = await throwPot();
    expect((await call('POST', '/api/decorate', { potId, decor: { ...DECOR, rim: 'javascript:' } })).status).toBe(400);
    as('bob');
    expect((await call('POST', '/api/decorate', { potId, decor: DECOR })).status).toBe(403);
    as('alice');
    await call('POST', '/api/glaze', { potId, glazes: ['copper'], application: 'dip' });
    p.shiftDays(1);
    await firePot(potId);
    expect((await call('POST', '/api/decorate', { potId, decor: DECOR })).status).toBe(409);
  });

  it('clearing all paint removes it', async () => {
    const potId = await throwPot();
    await call('POST', '/api/decorate', { potId, decor: DECOR });
    const r = await call<{ decor: Decor | null }>('POST', '/api/decorate', { potId, decor: { base: null, rim: null, bands: [], motifs: [] } });
    expect(r.json.decor).toBeNull();
  });
});
