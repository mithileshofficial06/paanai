import type { FiredResultDTO, GlazeChoice, PotSummary } from '../../shared/api/types';
import { type Decor, isEmptyDecor, sanitizeDecor } from '../../shared/core/decor';
import { ApiErr } from './errors';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';

export function potSummary(h: Record<string, string>): PotSummary | null {
  if (!h.potId || !h.profile) return null;
  return {
    potId: h.potId,
    owner: h.owner ?? 'potter',
    commissionId: h.commissionId ?? '',
    title: h.title ?? 'Pot',
    profile: JSON.parse(h.profile) as number[],
    score: Number(h.score ?? '0'),
    ranked: h.ranked === '1',
    glaze: h.glaze ? (JSON.parse(h.glaze) as GlazeChoice) : null,
    fired: h.fired ? (JSON.parse(h.fired) as FiredResultDTO) : null,
    decor: h.decor ? sanitizeDecor(JSON.parse(h.decor)) : null,
    likes: Number(h.likes ?? '0'),
    createdAt: Number(h.createdAt ?? '0'),
    showcased: h.showcased === '1',
    rating: ratingOf(h),
    ratings: Number(h.ratingN ?? '0'),
  };
}

export async function getPot(potId: string): Promise<Record<string, string>> {
  if (!/^pot[a-z0-9]{1,24}$/.test(potId)) return {};
  return platform().kv.hGetAll(K.pot(potId));
}

export async function loadSummaries(ids: string[]): Promise<PotSummary[]> {
  const out: PotSummary[] = [];
  for (const id of ids) {
    const h = await getPot(id);
    if (h.hidden === '1') continue;
    const s = potSummary(h);
    if (s) out.push(s);
  }
  return out;
}

/** Paint (or repaint) your own pot. Allowed until the kiln has fired it. */
export async function decoratePot(userId: string, potId: unknown, raw: unknown): Promise<{ decor: Decor | null }> {
  if (typeof potId !== 'string') throw new ApiErr('bad-request', 'Which pot?');
  const decor = sanitizeDecor(raw);
  if (!decor) throw new ApiErr('bad-decor', 'That decoration could not be read. Try again.');
  const pot = await getPot(potId);
  if (!pot.potId) throw new ApiErr('not-found', 'That pot is gone.', 404);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'You can only decorate your own pots.', 403);
  if (pot.fired) throw new ApiErr('already-fired', 'This pot has already been fired.', 409);
  const kv = platform().kv;
  if (isEmptyDecor(decor)) {
    await kv.hDel(K.pot(potId), ['decor']);
    return { decor: null };
  }
  await kv.hSet(K.pot(potId), { decor: JSON.stringify(decor) });
  return { decor };
}

/** Average stars x10 (35 = 3.5 stars), 0 when nobody has rated yet. */
export function ratingOf(h: Record<string, string>): number {
  const n = Number(h.ratingN ?? '0');
  return n > 0 ? Math.round((Number(h.ratingSum ?? '0') * 10) / n) : 0;
}

export async function nextId(prefix: string): Promise<string> {
  const n = await platform().kv.incrBy(K.seq(), 1);
  return `${prefix}${n.toString(36)}${Math.floor(platform().now() / 1000).toString(36).slice(-3)}`;
}

const MY_POTS_KEEP = 200;

/** Store a new pot for its owner and add it to their pots (oldest trimmed past 200). */
export async function createPot(userId: string, fields: Record<string, string>): Promise<string> {
  const kv = platform().kv;
  const potId = await nextId('pot');
  const now = platform().now();
  await kv.hSet(K.pot(potId), { ...fields, potId, ownerId: userId, createdAt: String(now) });
  await kv.expire(K.pot(potId), TTL.pot);
  await kv.zAdd(K.myPots(userId), { member: potId, score: now });
  await kv.expire(K.myPots(userId), TTL.pot);
  const n = await kv.zCard(K.myPots(userId));
  if (n > MY_POTS_KEEP) await kv.zRemRangeByRank(K.myPots(userId), 0, n - MY_POTS_KEEP - 1);
  return potId;
}
