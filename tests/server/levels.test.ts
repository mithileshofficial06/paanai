import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../../src/server/app';
import { setPlatform } from '../../src/server/platform';
import { createMemoryPlatform, type MemoryPlatform } from '../../src/server/platform/memory';
import { encodeLog } from '../../src/shared/core/strokes';
import { levelData } from '../../src/shared/content/levels';
import type { LevelThrowResponse, LevelsResponse, ThrowResponse } from '../../src/shared/api/types';
import { simulate, OPEN } from '../helpers';

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
/** The Master's own throw for level n: always clears it. */
const masterLog = (n: number) => encodeLog(levelData(n).log);
/** Opened, then nothing: far below any pass mark. */
const poorLog = () => simulate([[OPEN]]).rec.toLog();

beforeEach(() => {
  p = createMemoryPlatform(Date.UTC(2026, 10, 16, 12));
  setPlatform(p);
  app = createApp();
  as('alice');
});

describe('levels', () => {
  it('starts with level 1 open and the tutorial not done', async () => {
    const { json } = await call<LevelsResponse>('GET', '/api/levels');
    expect(json).toMatchObject({ unlocked: 1, tutorialDone: false, saved: true });
    expect(json.best).toHaveLength(100);
  });

  it('clearing a level unlocks the next, and the best score is kept', async () => {
    const r = await call<LevelThrowResponse>('POST', '/api/level/throw', { level: 1, strokeLog: masterLog(1) });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ level: 1, passed: true, firstClear: true, unlocked: 2, saved: true });
    const again = await call<LevelThrowResponse>('POST', '/api/level/throw', { level: 1, strokeLog: encodeLog(poorLog()) });
    expect(again.json.passed).toBe(false);
    expect(again.json.unlocked).toBe(2);
    expect(again.json.best).toBe(r.json.best);
    const { json } = await call<LevelsResponse>('GET', '/api/levels');
    expect(json.unlocked).toBe(2);
    expect(json.best[0]).toBe(r.json.best);
  });

  it('refuses a locked level and a failed throw unlocks nothing', async () => {
    const locked = await call<{ error: { code: string } }>('POST', '/api/level/throw', { level: 5, strokeLog: masterLog(5) });
    expect(locked.status).toBe(403);
    expect(locked.json.error.code).toBe('locked');
    const fail = await call<LevelThrowResponse>('POST', '/api/level/throw', { level: 1, strokeLog: encodeLog(poorLog()) });
    expect(fail.json).toMatchObject({ passed: false, unlocked: 1 });
  });

  it('records the tutorial, and keeps players apart', async () => {
    await call('POST', '/api/tutorial/done', {});
    expect((await call<LevelsResponse>('GET', '/api/levels')).json.tutorialDone).toBe(true);
    as('bob');
    expect((await call<LevelsResponse>('GET', '/api/levels')).json).toMatchObject({ tutorialDone: false, unlocked: 1 });
  });

  it('scores logged-out players without saving, and keeps level ids off the daily endpoint', async () => {
    as(null);
    const r = await call<LevelThrowResponse>('POST', '/api/level/throw', { level: 1, strokeLog: masterLog(1) });
    expect(r.json).toMatchObject({ passed: true, saved: false, unlocked: 2 });
    as('alice');
    const daily = await call<ThrowResponse>('POST', '/api/throw', { commissionId: 'level-1', strokeLog: masterLog(1) });
    expect(daily.status).toBe(400);
  });
});
