import { Hono } from 'hono';
import type { LeaderboardResponse, ThrowRequest, TodayResponse } from '../../shared/api/types';
import { platform } from '../platform';
import { K } from '../store/keys';
import { commissionForPost } from '../services/daily';
import { atmosphereFor, ghostLogString, resolveCommission } from '../services/commissions';
import { ApiErr, requireUser } from '../services/errors';
import { leaderboard, myThrow, submitThrow } from '../services/throws';
import { meDTO, touchUser } from '../services/users';
import { dayNumber, minuteBucket, nextKilnAt } from '../services/time';

export const api = new Hono();

/** Per-user, per-minute rate limit. */
export async function limit(route: string, perMinute: number): Promise<void> {
  const ctx = platform().ctx();
  const who = ctx.userId ?? 'anon';
  const key = K.rateLimit(route, who, minuteBucket());
  const n = await platform().kv.incrBy(key, 1);
  if (n === 1) await platform().kv.expire(key, 70);
  if (n > perMinute) throw new ApiErr('slow-down', 'Too many requests. Take a breath and try again in a minute.', 429);
}

api.get('/today', async (c) => {
  const ctx = platform().ctx();
  const { resolved, date } = await commissionForPost(ctx.postId);
  let me = null;
  let mine = null;
  if (ctx.userId && ctx.username) {
    const u = await touchUser(ctx.userId, ctx.username);
    me = await meDTO(ctx.userId, u);
    mine = await myThrow(resolved.dto.id, ctx.userId);
  }
  const lb = await leaderboard(resolved.dto.id, 3);
  const body: TodayResponse = {
    date,
    dayNumber: dayNumber(date),
    commission: resolved.dto,
    atmosphere: atmosphereFor(date),
    nextKilnAt: nextKilnAt(),
    me,
    myThrow: mine,
    throwsToday: lb.players,
    top: lb.rows,
    kilnWaiting: 0,
  };
  return c.json(body);
});

api.post('/throw', async (c) => {
  await limit('throw', 6);
  const body = await c.req.json<ThrowRequest>();
  return c.json(await submitThrow(body));
});

api.get('/leaderboard', async (c) => {
  const id = c.req.query('id');
  if (!id) throw new ApiErr('bad-request', 'Missing commission id.');
  const res: LeaderboardResponse = await leaderboard(id, 50);
  return c.json(res);
});

api.get('/commission/:id', async (c) => {
  const r = await resolveCommission(c.req.param('id'));
  return c.json({ commission: r.dto, ghostLog: ghostLogString(r) });
});

api.post('/me/hints', async (c) => {
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { hint, onboarded } = await c.req.json<{ hint?: string; onboarded?: boolean }>();
  const kv = platform().kv;
  if (hint && /^[a-z-]{1,24}$/.test(hint)) {
    const cur = ((await kv.hGet(K.user(userId), 'hints')) ?? '').split(',').filter(Boolean);
    if (!cur.includes(hint)) cur.push(hint);
    await kv.hSet(K.user(userId), { hints: cur.slice(0, 20).join(',') });
  }
  if (onboarded) await kv.hSet(K.user(userId), { onboarded: '1' });
  return c.json({ ok: true });
});
