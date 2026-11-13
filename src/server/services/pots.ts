import type { FiredResultDTO, GlazeChoice, PotSummary } from '../../shared/api/types';
import { type Decor, isEmptyDecor, sanitizeDecor } from '../../shared/core/decor';
import { ApiErr } from './errors';
import { platform } from '../platform';
import { K } from '../store/keys';

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
