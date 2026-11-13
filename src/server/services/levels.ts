// Level ladder: progress per player, and level throws scored by the server.
// Like daily throws, the client's score is never trusted: the stroke log is replayed here.
import { LEVEL_COUNT, levelData, levelStars } from '../../shared/content/levels';
import { replay, strokeCount } from '../../shared/core/shape';
import { scoreThrow } from '../../shared/core/score';
import { decodeLog } from '../../shared/core/strokes';
import type { LevelThrowRequest, LevelThrowResponse, LevelsResponse } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { ApiErr } from './errors';
import { createPot } from './pots';
import { encodeProfile } from '../../shared/core/profile';
import { today } from './time';

function bestList(rec: Record<string, string>): number[] {
  return Array.from({ length: LEVEL_COUNT }, (_, i) => Number(rec[`b${i + 1}`] ?? '0') || 0);
}

export async function levelProgress(): Promise<LevelsResponse> {
  const { userId } = platform().ctx();
  if (!userId) return { unlocked: 1, best: bestList({}), tutorialDone: false, saved: false };
  const rec = await platform().kv.hGetAll(K.levels(userId));
  const unlocked = Math.max(1, Math.min(LEVEL_COUNT, Number(rec.unlocked ?? '1') || 1));
  return { unlocked, best: bestList(rec), tutorialDone: rec.tutorial === '1', saved: true };
}

export async function markTutorialDone(): Promise<{ ok: true }> {
  const { userId } = platform().ctx();
  if (userId) {
    await platform().kv.hSet(K.levels(userId), { tutorial: '1' });
    await platform().kv.expire(K.levels(userId), TTL.levels);
  }
  return { ok: true };
}

export async function submitLevelThrow(req: LevelThrowRequest): Promise<LevelThrowResponse> {
  const level = Number(req?.level);
  if (!Number.isInteger(level) || level < 1 || level > LEVEL_COUNT || typeof req.strokeLog !== 'string') throw new ApiErr('bad-request', 'Malformed level throw.');
  const decoded = decodeLog(req.strokeLog);
  if (!decoded.ok) throw new ApiErr('bad-log', `Throw rejected: ${decoded.error}.`);
  const profile = replay(decoded.log);
  if (!profile.opened) throw new ApiErr('not-opened', 'Open the clay first: tap the centre of the lump.');

  const d = levelData(level);
  const score = scoreThrow(profile, d.target, d.spec.constraints, strokeCount(decoded.log), d.strokes);
  // Clearing needs the shape (the live Match gauge) and every rule of the level.
  const passed = score.match >= d.spec.pass && !profile.slumped && score.results.every((r) => r.pass);
  const stars = passed ? levelStars(score.match, d.spec.pass) : 0;

  const { userId } = platform().ctx();
  if (!userId) {
    return { level, score, pass: d.spec.pass, passed, stars, firstClear: passed, unlocked: passed ? Math.min(LEVEL_COUNT, level + 1) : level, best: score.match, saved: false, potId: null };
  }
  const kv = platform().kv;
  const key = K.levels(userId);
  const rec = await kv.hGetAll(key);
  const unlockedBefore = Math.max(1, Number(rec.unlocked ?? '1') || 1);
  if (level > unlockedBefore) throw new ApiErr('locked', `Level ${level} is still locked. Clear level ${unlockedBefore} first.`, 403);

  const prevBest = Number(rec[`b${level}`] ?? '0') || 0;
  // Best = best shape match that also met the rules (a rule-breaking throw does not count).
  const best = Math.max(prevBest, passed ? score.match : Math.min(score.match, d.spec.pass - 1));
  const firstClear = passed && prevBest < d.spec.pass;
  const unlocked = passed && level === unlockedBefore ? Math.min(LEVEL_COUNT, level + 1) : unlockedBefore;
  await kv.hSet(key, { [`b${level}`]: String(best), unlocked: String(unlocked) });
  await kv.expire(key, TTL.levels);
  // Keep the pot so it can be painted, put in the Showcase and shared.
  const potId = await createPot(userId, {
    owner: platform().ctx().username ?? 'potter',
    commissionId: `level-${level}`,
    title: `Level ${level}: ${d.spec.title}`,
    profile: JSON.stringify(encodeProfile(profile)),
    score: String(score.match),
    breakdown: JSON.stringify(score),
    ranked: '0',
    strokes: String(strokeCount(decoded.log)),
    date: today(),
  });
  return { level, score, pass: d.spec.pass, passed, stars, firstClear, unlocked, best, saved: true, potId };
}
