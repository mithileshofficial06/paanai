import { encodeProfile } from '../../shared/core/profile';
import { replay, strokeCount } from '../../shared/core/shape';
import { type ScoreBreakdown, scoreThrow } from '../../shared/core/score';
import { decodeLog } from '../../shared/core/strokes';
import type { LeaderRow, LeaderboardResponse, MyThrowDTO, ThrowRequest, ThrowResponse } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { resolveCommission } from './commissions';
import { ApiErr } from './errors';
import { syncFlair } from './users';
import { today } from './time';

/** Leaderboard sort key: higher score first, then fewer strokes. */
export function lbScore(total: number, strokes: number): number {
  return total * 1000 + (999 - Math.min(strokes, 999));
}
export function lbTotal(key: number): number {
  return Math.floor(key / 1000);
}

async function nextId(prefix: string): Promise<string> {
  const n = await platform().kv.incrBy(K.seq(), 1);
  return `${prefix}${n.toString(36)}${Math.floor(platform().now() / 1000).toString(36).slice(-3)}`;
}

/**
 * The server never trusts a client score: it replays the stroke log with the shared
 * deterministic core and scores the result itself.
 */
export async function submitThrow(req: ThrowRequest): Promise<ThrowResponse> {
  const { kv, ctx } = { kv: platform().kv, ctx: platform().ctx() };
  if (typeof req.strokeLog !== 'string' || typeof req.commissionId !== 'string') throw new ApiErr('bad-request', 'Malformed throw.');
  const decoded = decodeLog(req.strokeLog);
  if (!decoded.ok) throw new ApiErr('bad-log', `Throw rejected: ${decoded.error}.`);
  const c = await resolveCommission(req.commissionId);
  const profile = replay(decoded.log);
  if (!profile.opened) throw new ApiErr('not-opened', 'Open the clay first: tap the centre of the lump.');
  const strokes = strokeCount(decoded.log);
  const score = scoreThrow(profile, c.target, c.dto.constraints, strokes, c.dto.barStrokes);
  const beatBar = score.total > c.dto.bar;
  const lbKey = K.lbThrow(c.dto.id);

  // Logged out: score it, store nothing. They can claim a ranked throw after logging in.
  if (!ctx.userId || !ctx.username) {
    return {
      potId: null,
      ranked: false,
      practiceReason: 'logged-out',
      score,
      bar: c.dto.bar,
      beatBar,
      rank: null,
      players: await kv.zCard(lbKey),
      starsEarned: 0,
    };
  }
  const { userId, username } = { userId: ctx.userId, username: ctx.username };

  // Idempotent retries: same key -> same result.
  const idemKey = K.idem(userId, String(req.idemKey ?? '').slice(0, 64));
  if (req.idemKey) {
    const prev = await kv.get(idemKey);
    if (prev) return JSON.parse(prev) as ThrowResponse;
  }

  const existing = await kv.hGet(K.throwRec(c.dto.id, userId), 'potId');
  const ranked = !existing;
  const potId = await nextId('pot');
  const now = platform().now();
  await kv.hSet(K.pot(potId), {
    potId,
    owner: username,
    ownerId: userId,
    commissionId: c.dto.id,
    title: c.dto.title,
    profile: JSON.stringify(encodeProfile(profile)),
    score: String(score.total),
    breakdown: JSON.stringify(score),
    ranked: ranked ? '1' : '0',
    strokes: String(strokes),
    createdAt: String(now),
    date: today(),
  });
  await kv.expire(K.pot(potId), TTL.pot);
  await kv.zAdd(K.myPots(userId), { member: potId, score: now });
  await kv.expire(K.myPots(userId), TTL.pot);

  let starsEarned = 0;
  if (ranked) {
    await kv.hSet(K.throwRec(c.dto.id, userId), {
      potId,
      strokeLog: req.strokeLog,
      score: String(score.total),
      strokes: String(strokes),
      ts: String(now),
    });
    await kv.expire(K.throwRec(c.dto.id, userId), TTL.throwRec);
    await kv.zAdd(lbKey, { member: username, score: lbScore(score.total, strokes) });
    await kv.expire(lbKey, TTL.lb);
    starsEarned = score.stars;
    await kv.hIncrBy(K.user(userId), 'throws', 1);
    if (starsEarned) await kv.hIncrBy(K.user(userId), 'stars', starsEarned);
    await kv.hIncrBy(K.stats(today()), 'throws', 1);
    await kv.expire(K.stats(today()), TTL.stats);
    if (c.dto.kind === 'player') await creditPatron(c.dto.id, score.total, c.dto.bar);
    await syncFlair(userId, username);
  } else {
    await kv.hIncrBy(K.stats(today()), 'practice', 1);
  }

  const rank = ranked ? await kv.zRank(lbKey, username) : undefined;
  const players = await kv.zCard(lbKey);
  const res: ThrowResponse = {
    potId,
    ranked,
    practiceReason: ranked ? null : 'already-ranked',
    score,
    bar: c.dto.bar,
    beatBar,
    rank: rank === undefined ? null : players - rank,
    players,
    starsEarned,
  };
  if (req.idemKey) await kv.set(idemKey, JSON.stringify(res), { expiration: new Date(now + TTL.idem * 1000) });
  return res;
}

/** Patron points for a player commission: 1 per completion, +3 when someone beats it by < 5 points. */
async function creditPatron(commId: string, total: number, bar: number): Promise<void> {
  const kv = platform().kv;
  const makerId = await kv.hGet(K.comm(commId), 'makerId');
  if (!makerId) return;
  await kv.hIncrBy(K.user(makerId), 'patron', 1);
  await kv.hIncrBy(K.comm(commId), 'completions', 1);
  if (total > bar && total - bar < 5) await kv.hIncrBy(K.user(makerId), 'patron', 3);
}

export async function myThrow(commId: string, userId: string): Promise<MyThrowDTO | null> {
  const kv = platform().kv;
  const potId = await kv.hGet(K.throwRec(commId, userId), 'potId');
  if (!potId) return null;
  const pot = await kv.hGetAll(K.pot(potId));
  if (!pot.breakdown) return null;
  const score = JSON.parse(pot.breakdown) as ScoreBreakdown;
  const c = await resolveCommission(commId);
  return { potId, score, ranked: true, beatBar: score.total > c.dto.bar, glazed: !!pot.glaze };
}

export async function leaderboard(commId: string, limit = 50): Promise<LeaderboardResponse> {
  const kv = platform().kv;
  const me = platform().ctx().username;
  const key = K.lbThrow(commId);
  const rows = await kv.zRange(key, 0, limit - 1, { by: 'rank', reverse: true });
  const out: LeaderRow[] = rows.map((r, i) => ({ rank: i + 1, username: r.member, score: lbTotal(r.score), isMe: r.member === me }));
  const players = await kv.zCard(key);
  let meRow: LeaderRow | null = out.find((r) => r.isMe) ?? null;
  if (!meRow && me) {
    const s = await kv.zScore(key, me);
    const r = await kv.zRank(key, me);
    if (s !== undefined && r !== undefined) meRow = { rank: players - r, username: me, score: lbTotal(s), isMe: true };
  }
  return { rows: out, me: meRow, players };
}
