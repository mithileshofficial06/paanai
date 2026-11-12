import { Hono } from 'hono';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ensureDaily } from '../services/daily';
import { today } from '../services/time';

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

// ---- Menu (moderators) ----

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
