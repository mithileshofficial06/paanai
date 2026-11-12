import { Hono } from 'hono';
import type { LeaderboardResponse, ThrowRequest, TodayResponse } from '../../shared/api/types';
import { platform } from '../platform';
import { K } from '../store/keys';
import { commissionForPost } from '../services/daily';
import { atmosphereFor, ghostLogString, resolveCommission } from '../services/commissions';
import { ApiErr, requireUser } from '../services/errors';
import { leaderboard, myThrow, submitThrow } from '../services/throws';
import { meDTO, touchUser } from '../services/users';
import { dayNumber, minuteBucket, nextKilnAt, today } from '../services/time';
import { codex, glazePot, kilnWaitingCount, markOpened, myKiln } from '../services/kiln';
import { deletePot, report, shelfPage, sharePot, toggleLike } from '../services/community';
import { loadSummaries } from '../services/pots';
import { starterPot } from '../services/starter';
import { createCommission, listCommissions, removeCommission, type CreateCommissionReq } from '../services/playerCommissions';

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
  let kilnWaiting = 0;
  if (ctx.userId && ctx.username) {
    const u = await touchUser(ctx.userId, ctx.username);
    me = await meDTO(ctx.userId, u);
    mine = await myThrow(resolved.dto.id, ctx.userId);
    kilnWaiting = await kilnWaitingCount(ctx.userId);
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
    kilnWaiting,
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

api.post('/glaze', async (c) => {
  await limit('glaze', 10);
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { potId, glazes, application } = await c.req.json<{ potId: string; glazes: string[]; application: string }>();
  return c.json(await glazePot(userId, String(potId), { glazes, application }));
});

api.get('/kiln', async (c) => {
  const ctx = platform().ctx();
  if (!ctx.userId) return c.json({ items: [], atmosphere: null });
  return c.json({ items: await myKiln(ctx.userId), today: today() });
});

api.post('/kiln/open', async (c) => {
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { potId } = await c.req.json<{ potId: string }>();
  await markOpened(userId, String(potId));
  return c.json({ ok: true });
});

api.get('/starter', async (c) => c.json(starterPot()));

api.get('/codex', async (c) => {
  const effects = await codex();
  return c.json({ effects, discovered: effects.filter((e) => e.discoverer).length, total: effects.length });
});

api.get('/shelf', async (c) => {
  const cursor = Math.max(0, Math.min(10_000, Number(c.req.query('cursor') ?? '0') || 0));
  return c.json(await shelfPage(cursor));
});

api.post('/like', async (c) => {
  await limit('like', 30);
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { potId } = await c.req.json<{ potId: string }>();
  return c.json(await toggleLike(userId, String(potId)));
});

api.post('/report', async (c) => {
  await limit('report', 10);
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { targetId } = await c.req.json<{ targetId: string }>();
  return c.json(await report(userId, String(targetId)));
});

api.post('/pot/delete', async (c) => {
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { potId } = await c.req.json<{ potId: string }>();
  await deletePot(userId, String(potId));
  return c.json({ ok: true });
});

api.post('/share', async (c) => {
  await limit('share', 3);
  const ctx = platform().ctx();
  const { userId, username } = requireUser(ctx.userId, ctx.username);
  const { potId, pngDataUrl } = await c.req.json<{ potId: string; pngDataUrl: string }>();
  return c.json(await sharePot(userId, username, String(potId), String(pngDataUrl)));
});

api.post('/commission', async (c) => {
  await limit('commission', 3);
  const ctx = platform().ctx();
  const { userId, username } = requireUser(ctx.userId, ctx.username);
  return c.json(await createCommission(userId, username, await c.req.json<CreateCommissionReq>()));
});

api.get('/commissions', async (c) => c.json({ commissions: await listCommissions(20) }));

api.post('/commission/delete', async (c) => {
  const ctx = platform().ctx();
  const { userId } = requireUser(ctx.userId, ctx.username);
  const { id } = await c.req.json<{ id: string }>();
  await removeCommission(String(id), userId, false);
  return c.json({ ok: true });
});

api.get('/mypots', async (c) => {
  const ctx = platform().ctx();
  if (!ctx.userId) return c.json({ pots: [] });
  const ids = await platform().kv.zRange(K.myPots(ctx.userId), 0, 29, { by: 'rank', reverse: true });
  return c.json({ pots: await loadSummaries(ids.map((m) => m.member)) });
});
