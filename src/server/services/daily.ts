import type { Format } from '../../shared/content/commissions';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { atmosphereFor, formatFor, officialFor, resolveCommission, type ResolvedCommission } from './commissions';
import { dayNumber, prettyDate, today } from './time';

export type DailyRecord = { date: string; commissionId: string; postId: string | null; format: Format };

/** Pick the commission for a date: Commission Day / Community use the top player commission when one exists. */
async function pickCommission(date: string, format: Format): Promise<string> {
  if (format === 'commission-day' || format === 'community') {
    const top = await platform().kv.zRange(K.commQueue(), 0, 0, { by: 'rank', reverse: true });
    const id = top[0]?.member;
    if (id) {
      const status = await platform().kv.hGet(K.comm(id), 'status');
      if (status === 'live') {
        await platform().kv.zRem(K.commQueue(), [id]);
        return id;
      }
    }
  }
  return officialFor(date).id;
}

export async function getDaily(date: string): Promise<DailyRecord | null> {
  const h = await platform().kv.hGetAll(K.daily(date));
  if (!h.commissionId) return null;
  return { date, commissionId: h.commissionId, postId: h.postId || null, format: (h.format as Format) ?? 'match' };
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Make sure today's daily exists (commission chosen, post created). Safe to run twice, even at the
 * same moment (the midnight jobs start together): the commission and the post are each claimed
 * with SET NX, so only one caller creates the post and the others wait for it.
 */
export async function ensureDaily(date: string, createPost: boolean): Promise<DailyRecord> {
  const kv = platform().kv;
  let rec = await getDaily(date);
  if (!rec) {
    const format = formatFor(date);
    const commissionId = await pickCommission(date, format);
    const claimed = await kv.set(`${K.daily(date)}:lock`, commissionId, { nx: true, expiration: new Date(platform().now() + 120_000) });
    if (claimed) {
      await kv.hSet(K.daily(date), { commissionId, format, atmosphere: atmosphereFor(date) });
      await kv.expire(K.daily(date), TTL.daily);
    }
    rec = (await getDaily(date)) ?? { date, commissionId, postId: null, format };
  }
  if (createPost && !rec.postId) {
    const lockKey = `${K.daily(date)}:postlock`;
    const mine = await kv.set(lockKey, '1', { nx: true, expiration: new Date(platform().now() + 120_000) });
    if (!mine) {
      // Another job is creating the post right now: wait for it instead of posting a second one.
      for (let i = 0; i < 20; i++) {
        await sleep(500);
        const r = await getDaily(date);
        if (r?.postId) return r;
      }
      return rec;
    }
    const again = await getDaily(date);
    if (again?.postId) return again;
    const c = await resolveCommission(rec.commissionId, rec.format);
    const title = `Day ${dayNumber(date)} · ${c.dto.title} · Beat ${c.dto.bar}`;
    let post: { id: string };
    try {
      post = await platform().reddit.submitPost({
        title,
        entry: 'default',
        postData: { date, commissionId: rec.commissionId, format: rec.format },
        textFallback: `Paanai daily pottery, ${prettyDate(date)}: throw a ${c.dto.title} on the wheel and beat ${c.dto.bar}. Open this post in the Reddit app or on new Reddit to play.`,
      });
    } catch (err) {
      await kv.del(lockKey); // let the next run try again
      throw err;
    }
    await kv.hSet(K.daily(date), { postId: post.id });
    await kv.hSet(K.post(post.id), { date, commissionId: rec.commissionId, kind: 'daily' });
    await kv.expire(K.post(post.id), TTL.post);
    rec = { ...rec, postId: post.id };
  }
  return rec;
}

/** Which commission does this post show? Daily posts map to their date; unknown posts show today. */
export async function commissionForPost(postId: string | undefined): Promise<{ resolved: ResolvedCommission; date: string }> {
  const kv = platform().kv;
  if (postId) {
    const p = await kv.hGetAll(K.post(postId));
    if (p.commissionId) {
      const date = p.date ?? today();
      const format = p.kind === 'daily' ? ((await getDaily(date))?.format ?? 'match') : 'commission-day';
      return { resolved: await resolveCommission(p.commissionId, format, postId), date };
    }
  }
  const date = today();
  const rec = await ensureDaily(date, false);
  return { resolved: await resolveCommission(rec.commissionId, rec.format, rec.postId), date };
}
