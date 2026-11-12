import { EFFECT_BY_ID, type EffectId } from '../../shared/core/glazes';
import type { PotSummary } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ApiErr } from './errors';
import { getPot, loadSummaries } from './pots';
import { getDaily } from './daily';
import { today } from './time';

export async function shelfPage(cursor: number, size = 24): Promise<{ pots: PotSummary[]; next: number | null; total: number }> {
  const kv = platform().kv;
  const total = await kv.zCard(K.shelf());
  const ids = await kv.zRange(K.shelf(), cursor, cursor + size - 1, { by: 'rank', reverse: true });
  const pots = await loadSummaries(ids.map((m) => m.member));
  const potOfWeek = await kv.get('p:potw');
  if (cursor === 0 && potOfWeek) {
    const pw = await loadSummaries([potOfWeek]);
    if (pw[0]) {
      const rest = pots.filter((p) => p.potId !== potOfWeek);
      return { pots: [pw[0], ...rest], next: cursor + size < total ? cursor + size : null, total };
    }
  }
  return { pots, next: cursor + size < total ? cursor + size : null, total };
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
      await kv.zRem(K.shelf(), [targetId]);
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
  await kv.zRem(K.shelf(), [potId]);
  await kv.zRem(K.myPots(userId), [potId]);
  if (pot.kilnDate) await kv.zRem(K.kilnQueue(pot.kilnDate), [potId]);
  await kv.del(K.pot(potId), K.likes(potId));
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
    : `My ${pot.title} on the wheel. Throw score ${pot.score}. It goes into the next kiln.`;
  const img = await platform().media.uploadImage(pngDataUrl);
  const c = await platform().reddit.submitComment({ postId: targetPost, imageUrl: img.mediaUrl, caption, text: caption, runAsUser: true });
  await kv.hSet(K.pot(potId), { sharedComment: c.id });
  await kv.hIncrBy(K.stats(today()), 'shares', 1);
  void username;
  return { commentId: c.id };
}

/** Sunday tally: the most-liked pot of the last 7 days becomes Pot of the Week. */
export async function weeklyTally(): Promise<string | null> {
  const kv = platform().kv;
  const since = platform().now() - 7 * 86_400_000;
  const recent = await kv.zRange(K.shelf(), since, Number.MAX_SAFE_INTEGER, { by: 'score' });
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
