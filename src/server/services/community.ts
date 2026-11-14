import { EFFECT_BY_ID, type EffectId } from '../../shared/core/glazes';
import type { PotSummary } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ApiErr } from './errors';
import { getPot, loadSummaries, ratingOf } from './pots';
import { getDaily } from './daily';
import { today } from './time';

/** Rank key for "Top": Bayesian star average (two 3-star votes as a prior), then likes. */
function topKey(sum: number, n: number, likes: number): number {
  return Math.round(((sum + 6) * 1000) / (n + 2)) * 1000 + Math.min(999, Math.max(0, likes));
}

async function refreshTop(potId: string): Promise<void> {
  const kv = platform().kv;
  const h = await getPot(potId);
  if (h.showcased !== '1') return;
  await kv.zAdd(K.showcaseTop(), { member: potId, score: topKey(Number(h.ratingSum ?? '0'), Number(h.ratingN ?? '0'), Number(h.likes ?? '0')) });
}

/** The Showcase: pots their makers chose to put on show. Newest first, or top rated. */
export async function showcasePage(
  cursor: number,
  sort: 'new' | 'top',
  viewer: string | null,
  size = 24
): Promise<{ pots: PotSummary[]; next: number | null; total: number }> {
  const kv = platform().kv;
  const key = sort === 'top' ? K.showcaseTop() : K.showcase();
  const total = await kv.zCard(key);
  const ids = await kv.zRange(key, cursor, cursor + size - 1, { by: 'rank', reverse: true });
  let pots = await loadSummaries(ids.map((m) => m.member));
  const potOfWeek = await kv.get('p:potw');
  if (cursor === 0 && sort === 'new' && potOfWeek) {
    const pw = (await loadSummaries([potOfWeek]))[0];
    if (pw?.showcased) pots = [pw, ...pots.filter((p) => p.potId !== potOfWeek)];
  }
  if (viewer) {
    for (const p of pots) {
      p.myRating = (await kv.zScore(K.ratings(p.potId), viewer)) ?? 0;
      p.myLike = (await kv.zScore(K.likes(p.potId), viewer)) !== undefined;
    }
  }
  return { pots, next: cursor + size < total ? cursor + size : null, total };
}

/** Put your own pot on show (or take it down). */
export async function setShowcase(userId: string, potId: string, on: boolean): Promise<{ showcased: boolean }> {
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (!pot.potId) throw new ApiErr('not-found', 'That pot is gone.', 404);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'You can only show your own pots.', 403);
  if (pot.hidden === '1') throw new ApiErr('hidden', 'This pot was hidden after reports.', 409);
  if (on) {
    await kv.hSet(K.pot(potId), { showcased: '1' });
    await kv.zAdd(K.showcase(), { member: potId, score: platform().now() });
    await refreshTop(potId);
    for (const k of [K.showcase(), K.showcaseTop()]) {
      const n = await kv.zCard(k);
      if (n > 5000) await kv.zRemRangeByRank(k, 0, n - 5001);
    }
  } else {
    await kv.hDel(K.pot(potId), ['showcased']);
    await kv.zRem(K.showcase(), [potId]);
    await kv.zRem(K.showcaseTop(), [potId]);
  }
  return { showcased: on };
}

/** Rate someone else's pot in the Showcase, 1-5 stars. Re-rating replaces your old rating. */
export async function ratePot(userId: string, potId: string, stars: number): Promise<{ rating: number; ratings: number; myRating: number }> {
  if (!Number.isInteger(stars) || stars < 1 || stars > 5) throw new ApiErr('bad-rating', 'Rate from 1 to 5 stars.');
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (!pot.potId || pot.showcased !== '1') throw new ApiErr('not-found', 'That pot is not on show.', 404);
  if (pot.ownerId === userId) throw new ApiErr('own-pot', 'You cannot rate your own pot.', 403);
  const prev = await kv.zScore(K.ratings(potId), userId);
  await kv.zAdd(K.ratings(potId), { member: userId, score: stars });
  await kv.expire(K.ratings(potId), TTL.ratings);
  if (prev === undefined) await kv.hIncrBy(K.pot(potId), 'ratingN', 1);
  await kv.hIncrBy(K.pot(potId), 'ratingSum', stars - (prev ?? 0));
  await refreshTop(potId);
  const h = await getPot(potId);
  return { rating: ratingOf(h), ratings: Number(h.ratingN ?? '0'), myRating: stars };
}

export async function toggleLike(userId: string, potId: string): Promise<{ liked: boolean; likes: number }> {
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (!pot.potId) throw new ApiErr('not-found', 'That pot is gone.', 404);
  const has = await kv.zScore(K.likes(potId), userId);
  let likes: number;
  if (has !== undefined) {
    await kv.zRem(K.likes(potId), [userId]);
    likes = await kv.hIncrBy(K.pot(potId), 'likes', -1);
  } else {
    await kv.zAdd(K.likes(potId), { member: userId, score: platform().now() });
    await kv.expire(K.likes(potId), TTL.likes);
    likes = await kv.hIncrBy(K.pot(potId), 'likes', 1);
  }
  await refreshTop(potId);
  return { liked: has === undefined, likes: Math.max(0, likes) };
}

async function reportsThreshold(): Promise<number> {
  const v = await platform().settings.get('reportsToHide');
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : 3;
}

/** Report a pot or commission. Auto-hides at the subreddit's threshold; mods see the queue. */
export async function report(userId: string, targetId: string): Promise<{ hidden: boolean }> {
  const kv = platform().kv;
  const isPot = targetId.startsWith('pot');
  const exists = isPot ? (await getPot(targetId)).potId : await kv.hGet(K.comm(targetId), 'id');
  if (!exists) throw new ApiErr('not-found', 'Nothing to report.', 404);
  await kv.zAdd(K.reports(targetId), { member: userId, score: platform().now() });
  await kv.expire(K.reports(targetId), TTL.reports);
  const n = await kv.zCard(K.reports(targetId));
  await kv.zAdd(K.modQueue(), { member: targetId, score: n });
  if (n >= (await reportsThreshold())) {
    if (isPot) {
      await kv.hSet(K.pot(targetId), { hidden: '1' });
      await kv.zRem(K.showcase(), [targetId]);
      await kv.zRem(K.showcaseTop(), [targetId]);
    } else {
      await kv.hSet(K.comm(targetId), { status: 'hidden' });
      await kv.zRem(K.commQueue(), [targetId]);
    }
    return { hidden: true };
  }
  return { hidden: false };
}

/** Delete your own pot. Nothing is kept. */
export async function deletePot(userId: string, potId: string): Promise<void> {
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (!pot.potId) return;
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'You can only delete your own pots.', 403);
  await kv.zRem(K.showcase(), [potId]);
  await kv.zRem(K.showcaseTop(), [potId]);
  await kv.zRem(K.myPots(userId), [potId]);
  if (pot.kilnDate) await kv.zRem(K.kilnQueue(pot.kilnDate), [potId]);
  await kv.del(K.pot(potId), K.likes(potId), K.ratings(potId));
}

/** Share a pot photo to the comments as the player (explicit tap only). */
export async function sharePot(userId: string, username: string, potId: string, pngDataUrl: string): Promise<{ commentId: string }> {
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'You can only share your own pots.', 403);
  if (typeof pngDataUrl !== 'string' || !pngDataUrl.startsWith('data:image/png;base64,') || pngDataUrl.length > 3_000_000) {
    throw new ApiErr('bad-image', 'The pot photo could not be prepared.');
  }
  const daily = await getDaily(today());
  const targetPost = (await kv.hGet(K.comm(pot.commissionId ?? ''), 'postId')) ?? daily?.postId ?? platform().ctx().postId;
  if (!targetPost) throw new ApiErr('no-post', 'There is no post to share to yet.');
  const fired = pot.fired ? (JSON.parse(pot.fired) as { effects: EffectId[]; survived: boolean }) : null;
  const fx = fired?.effects.map((e) => EFFECT_BY_ID.get(e)?.name ?? e) ?? [];
  const caption = fired
    ? `My ${pot.title} out of the kiln: ${fired.survived ? 'it survived' : 'it cracked'}${fx.length ? `, ${fx.join(', ')}` : ''}. Throw score ${pot.score}.`
    : pot.commissionId?.startsWith('level-')
      ? `My ${pot.title}, thrown on the wheel in Paanai. Shape match ${pot.score}%.`
      : `My ${pot.title} on the wheel. Throw score ${pot.score}.`;
  const appCaption = `u/${username} shared their pot. ${caption.replace(/^My /, 'Their ')}`;
  let c: { id: string };
  try {
    const img = await platform().media.uploadImage(pngDataUrl);
    c = await platform().reddit.submitComment({ postId: targetPost, imageUrl: img.mediaUrl, caption, appCaption, text: caption, runAsUser: true });
  } catch (err) {
    console.error('share failed', String(err).slice(0, 200));
    throw new ApiErr('share-failed', 'Reddit did not take the comment just now. Try again in a minute.', 500);
  }
  await kv.hSet(K.pot(potId), { sharedComment: c.id });
  await kv.hIncrBy(K.stats(today()), 'shares', 1);
  return { commentId: c.id };
}

/** Sunday tally: the most-liked pot of the last 7 days becomes Pot of the Week. */
export async function weeklyTally(): Promise<string | null> {
  const kv = platform().kv;
  const since = platform().now() - 7 * 86_400_000;
  const recent = await kv.zRange(K.showcase(), since, Number.MAX_SAFE_INTEGER, { by: 'score' });
  let best: { id: string; likes: number } | null = null;
  for (const m of recent) {
    const likes = Number((await kv.hGet(K.pot(m.member), 'likes')) ?? '0');
    if (!best || likes > best.likes) best = { id: m.member, likes };
  }
  if (best && best.likes > 0) {
    await kv.set('p:potw', best.id);
    return best.id;
  }
  return null;
}
