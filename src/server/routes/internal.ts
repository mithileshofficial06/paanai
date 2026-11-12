import { Hono } from 'hono';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ensureDaily } from '../services/daily';
import { addDays, today } from '../services/time';
import { kilnBatch, kilnReportText } from '../services/kiln';
import { weeklyTally } from '../services/community';
import { removeCommission } from '../services/playerCommissions';

/** Routes Devvit itself calls: scheduler jobs, menu items, triggers, forms. */
export const internal = new Hono();

type UiResponse = { showToast?: string | { text: string; appearance?: 'neutral' | 'success' }; navigateTo?: string };

// ---- Scheduler ----

internal.post('/cron/daily-rollover', async (c) => {
  const date = today();
  const done = await platform().kv.get(K.job('rollover', date));
  if (done === 'done') return c.json({ status: 'skipped' });
  const rec = await ensureDaily(date, true);
  await platform().kv.set(K.job('rollover', date), 'done', { expiration: new Date(platform().now() + TTL.job * 1000) });
  return c.json({ status: 'ok', postId: rec.postId });
});

internal.post('/cron/kiln-batch', async (c) => {
  return c.json(await kilnBatch(400));
});

internal.post('/cron/kiln-report', async (c) => {
  const kv = platform().kv;
  const date = today();
  const kilnDate = addDays(date, -1);
  if ((await kv.get(K.job('kiln-report', date))) === 'done') return c.json({ status: 'skipped' });
  const left = await kilnBatch(400);
  if (left.remaining > 0) return c.json({ status: 'waiting', remaining: left.remaining });
  const text = await kilnReportText(kilnDate);
  const daily = await ensureDaily(date, true);
  if (text && daily.postId) await platform().reddit.submitComment({ postId: daily.postId, text });
  await kv.set(K.job('kiln-report', date), 'done', { expiration: new Date(platform().now() + TTL.job * 1000) });
  return c.json({ status: 'ok', posted: !!text });
});

internal.post('/cron/weekly-tally', async (c) => {
  return c.json({ potOfWeek: await weeklyTally() });
});

// ---- Menu (moderators) ----

internal.post('/menu/kiln-now', async (c) => {
  const r = await kilnBatch(400);
  const res: UiResponse = { showToast: `Kiln: fired ${r.fired} pots from ${r.date}; ${r.remaining} left.` };
  return c.json(res);
});

internal.post('/menu/post-today', async (c) => {
  const rec = await ensureDaily(today(), true);
  const ctx = platform().ctx();
  const res: UiResponse = rec.postId
    ? { navigateTo: `https://reddit.com/r/${ctx.subredditName}/comments/${rec.postId.replace(/^t3_/, '')}` }
    : { showToast: 'Could not create the daily post.' };
  return c.json(res);
});

internal.post('/menu/stats', async (c) => {
  const s = await platform().kv.hGetAll(K.stats(today()));
  const res: UiResponse = {
    showToast: `Today: ${s.throws ?? 0} ranked throws, ${s.practice ?? 0} practice, ${s.glazes ?? 0} glazed, ${s.shares ?? 0} shared`,
  };
  return c.json(res);
});

internal.post('/menu/remove-commission', async (c) => {
  const ctx = platform().ctx();
  const id = ctx.postId ? await platform().kv.hGet(K.post(ctx.postId), 'commissionId') : undefined;
  if (!id || !id.startsWith('c')) return c.json({ showToast: 'This post is not a player commission.' } satisfies UiResponse);
  await removeCommission(id, null, true);
  return c.json({ showToast: 'Commission removed.' } satisfies UiResponse);
});

// ---- Triggers ----

internal.post('/triggers/install', async (c) => {
  try {
    await ensureDaily(today(), true);
    return c.json({ status: 'success', message: 'Paanai installed; today\'s commission posted.' });
  } catch (err) {
    console.error('install trigger failed', err);
    return c.json({ status: 'error', message: 'Failed to create the daily post.' }, 400);
  }
});

internal.post('/triggers/upgrade', async (c) => c.json({ status: 'success', message: 'upgraded' }));
