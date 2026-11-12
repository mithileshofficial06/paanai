import type { FiredResultDTO, GlazeChoice, PotSummary } from '../../shared/api/types';
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
