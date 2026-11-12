import { capacityMl, decodeProfile, encodeProfile } from '../../shared/core/profile';
import { RINGS, rdiv } from '../../shared/core/fixed';
import { replay, strokeCount } from '../../shared/core/shape';
import { type Constraint, scoreThrow } from '../../shared/core/score';
import { decodeLog } from '../../shared/core/strokes';
import { survivesKiln } from '../../shared/core/survival';
import { isValidTitle } from '../../shared/content/words';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ApiErr } from './errors';
import { getPot } from './pots';
import { getUser, meDTO } from './users';
import { constraintLabel } from './commissions';
import { today } from './time';

export const CONSTRAINT_KINDS = ['capacity', 'rim', 'height', 'survive', 'maxStrokes'] as const;
export type ConstraintKind = (typeof CONSTRAINT_KINDS)[number];

/** Constraint parameters always come from the maker's own pot, so every commission is solvable. */
export function deriveConstraint(kind: ConstraintKind, p: ReturnType<typeof decodeProfile>, strokes: number): Constraint {
  switch (kind) {
    case 'capacity':
      return { kind, ml: Math.max(50, Math.round(capacityMl(p) / 50) * 50), tolPct: 12 };
    case 'rim':
      return { kind, rule: (p.outer[RINGS - 1] ?? 0) < (p.outer[0] ?? 0) ? 'narrower' : 'wider' };
    case 'height':
      return { kind, min: rdiv(p.height * 90, 100), max: rdiv(p.height * 110, 100) };
    case 'survive':
      return { kind };
    case 'maxStrokes':
      return { kind, n: strokes + 2 };
  }
}

export type CreateCommissionReq = { potId: string; adjective: string; vessel: string; constraints: string[] };

export async function createCommission(userId: string, username: string, req: CreateCommissionReq): Promise<{ id: string; postId: string; bar: number; url: string }> {
  const kv = platform().kv;
  const me = await meDTO(userId, await getUser(userId));
  if (!me.canCommission) throw new ApiErr('rank', 'Reach Journeyman to create commissions: keep throwing and firing pots.', 403);
  if (!isValidTitle(req.adjective, req.vessel)) throw new ApiErr('bad-title', 'Pick a title from the word list.');
  const kinds = [...new Set(req.constraints ?? [])];
  if (kinds.length > 2 || !kinds.every((k) => (CONSTRAINT_KINDS as readonly string[]).includes(k))) throw new ApiErr('bad-constraints', 'Choose up to two constraints.');
  const dayKey = `p:commday:${userId}:${today()}`;
  if (await kv.get(dayKey)) throw new ApiErr('daily-limit', 'One commission per day. Come back after the next kiln.', 429);

  const pot = await getPot(req.potId);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'Use one of your own pots as the reference.', 403);
  const decoded = decodeLog(pot.strokeLog ?? '');
  if (!decoded.ok) throw new ApiErr('no-log', 'That pot is too old to use as a reference. Throw a new one.');
  const profile = replay(decoded.log);
  if (!profile.opened || profile.slumped) throw new ApiErr('unsound', 'The reference pot must be open and standing.');
  if (!survivesKiln(profile)) throw new ApiErr('unsound', 'The reference pot would crack in the kiln. Commissions must be proven sound.');
  const strokes = strokeCount(decoded.log);
  const constraints = (kinds as ConstraintKind[]).map((k) => deriveConstraint(k, profile, strokes));
  const check = scoreThrow(profile, profile, constraints, strokes, strokes);
  if (check.results.some((r) => !r.pass)) throw new ApiErr('unsolvable', 'The reference pot does not meet those constraints.');

  const id = `c${(await kv.incrBy(K.seq(), 1)).toString(36)}${Math.floor(platform().now() / 1000).toString(36).slice(-3)}`;
  const title = `${req.adjective} ${req.vessel}`;
  const post = await platform().reddit.submitPost({
    title: `Commission by u/${username}: ${title} · Beat ${check.total}`,
    entry: 'default',
    postData: { commissionId: id, kind: 'commission' },
    textFallback: `u/${username} commissioned a ${title} in Paanai. Beat their score of ${check.total} on the wheel.`,
    runAsUser: true,
  });
  await kv.hSet(K.comm(id), {
    id,
    title,
    maker: username,
    makerId: userId,
    bar: String(check.total),
    barStrokes: String(strokes),
    constraints: JSON.stringify(constraints),
    target: JSON.stringify(encodeProfile(profile)),
    ghostLog: pot.strokeLog ?? '',
    postId: post.id,
    status: 'live',
    createdAt: String(platform().now()),
    completions: '0',
  });
  await kv.expire(K.comm(id), TTL.comm);
  await kv.hSet(K.post(post.id), { commissionId: id, kind: 'commission', date: today() });
  await kv.expire(K.post(post.id), TTL.post);
  await kv.zAdd(K.commQueue(), { member: id, score: 0 });
  await kv.zAdd('p:comms', { member: id, score: platform().now() });
  await kv.zAdd(K.commByUser(userId), { member: id, score: platform().now() });
  await kv.set(dayKey, '1', { expiration: new Date(platform().now() + 86_400_000) });
  return { id, postId: post.id, bar: check.total, url: post.url };
}

export async function listCommissions(limit = 20): Promise<{ id: string; title: string; maker: string; bar: number; completions: number; postId: string; constraintLabels: string[] }[]> {
  const kv = platform().kv;
  const ids = await kv.zRange('p:comms', 0, limit - 1, { by: 'rank', reverse: true });
  const out = [];
  for (const m of ids) {
    const h = await kv.hGetAll(K.comm(m.member));
    if (h.status !== 'live') continue;
    const constraints = JSON.parse(h.constraints ?? '[]') as Constraint[];
    out.push({
      id: m.member,
      title: h.title ?? '',
      maker: h.maker ?? '',
      bar: Number(h.bar ?? '0'),
      completions: Number(h.completions ?? '0'),
      postId: h.postId ?? '',
      constraintLabels: constraints.map(constraintLabel),
    });
  }
  return out;
}

/** Remove a commission (maker or moderator). The post is removed too. */
export async function removeCommission(id: string, byUserId: string | null, asMod: boolean): Promise<void> {
  const kv = platform().kv;
  const h = await kv.hGetAll(K.comm(id));
  if (!h.id) return;
  if (!asMod && h.makerId !== byUserId) throw new ApiErr('forbidden', 'Only the maker can delete this commission.', 403);
  await kv.hSet(K.comm(id), { status: 'removed', ghostLog: '' });
  await kv.zRem(K.commQueue(), [id]);
  await kv.zRem('p:comms', [id]);
  if (h.postId) {
    try {
      await platform().reddit.removePost(h.postId);
    } catch (err) {
      console.error('remove post failed', err);
    }
  }
}
