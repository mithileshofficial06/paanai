import type { MeDTO, RankId } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { dayNumber, today } from './time';

export const RANKS: { id: RankId; label: string; at: number }[] = [
  { id: 'apprentice', label: 'Apprentice', at: 0 },
  { id: 'journeyman', label: 'Journeyman', at: 3 },
  { id: 'artisan', label: 'Artisan', at: 30 },
  { id: 'master', label: 'Master Potter', at: 100 },
];

/** Rank points: each ranked throw 1, each star 1, each fired pot 1, each Codex discovery 5. */
export function rankPoints(u: Record<string, string>): number {
  const n = (k: string) => Number(u[k] ?? '0');
  return n('throws') + n('stars') + n('fired') + 5 * n('discoveries');
}

export async function journeymanThreshold(): Promise<number> {
  const v = await platform().settings.get('journeymanPoints');
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) && n > 0 ? n : (RANKS[1]?.at ?? 3);
}

export async function rankFor(points: number): Promise<{ id: RankId; label: string; next: number | null }> {
  const jm = await journeymanThreshold();
  const table = RANKS.map((r) => (r.id === 'journeyman' ? { ...r, at: jm } : r));
  let cur = table[0]!;
  let next: number | null = null;
  for (const r of table) {
    if (points >= r.at) cur = r;
    else {
      next = r.at;
      break;
    }
  }
  return { id: cur.id, label: cur.label, next };
}

const RANK_ORDER: RankId[] = ['apprentice', 'journeyman', 'artisan', 'master'];
export function rankAtLeast(r: RankId, min: RankId): boolean {
  return RANK_ORDER.indexOf(r) >= RANK_ORDER.indexOf(min);
}

export async function getUser(userId: string): Promise<Record<string, string>> {
  return platform().kv.hGetAll(K.user(userId));
}

/** Record a visit; maintains the low-key streak (days at the wheel). */
export async function touchUser(userId: string, username: string): Promise<Record<string, string>> {
  const kv = platform().kv;
  const u = await getUser(userId);
  const d = dayNumber(today());
  const last = Number(u.lastDay ?? '0');
  const updates: Record<string, string> = { username, lastSeen: String(platform().now()) };
  if (last !== d) {
    updates.lastDay = String(d);
    updates.streak = String(last === d - 1 ? Number(u.streak ?? '0') + 1 : 1);
  }
  await kv.hSet(K.user(userId), updates);
  await kv.expire(K.user(userId), TTL.user);
  return { ...u, ...updates };
}

export async function meDTO(userId: string, u: Record<string, string>): Promise<MeDTO> {
  const points = rankPoints(u);
  const rank = await rankFor(points);
  const minSetting = await platform().settings.get('minRankToCommission');
  // Default "apprentice": anyone can post a commission (one a day, own sound pot, reports auto-hide).
  const picked = Array.isArray(minSetting) ? minSetting[0] : minSetting;
  const minRank: RankId = picked === 'artisan' || picked === 'journeyman' ? picked : 'apprentice';
  void userId;
  return {
    username: u.username ?? 'potter',
    rank: rank.id,
    rankLabel: rank.label,
    rankPoints: points,
    nextRankAt: rank.next,
    throws: Number(u.throws ?? '0'),
    stars: Number(u.stars ?? '0'),
    potsFired: Number(u.fired ?? '0'),
    discoveries: Number(u.discoveries ?? '0'),
    streakDays: Number(u.streak ?? '0'),
    patron: Number(u.patron ?? '0'),
    hintsDone: (u.hints ?? '').split(',').filter(Boolean),
    onboarded: u.onboarded === '1',
    // Ends when the first fired pot is opened. Players with a few throws behind them skip it.
    firstRun: u.graduated !== '1' && Number(u.throws ?? '0') < 3,
    canCommission: rankAtLeast(rank.id, minRank),
  };
}

/** Update flair only when the rank label changes. Failures never break gameplay. */
export async function syncFlair(userId: string, username: string): Promise<void> {
  const kv = platform().kv;
  const u = await getUser(userId);
  const rank = await rankFor(rankPoints(u));
  if (u.flair === rank.label) return;
  try {
    await platform().reddit.setUserFlair(username, `${rank.label} · Paanai`);
    await kv.hSet(K.user(userId), { flair: rank.label });
  } catch (err) {
    console.error('flair sync failed', err);
  }
}
