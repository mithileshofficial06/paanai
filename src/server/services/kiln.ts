import { decodeProfile } from '../../shared/core/profile';
import { fire } from '../../shared/core/fire';
import { APPLICATIONS, EFFECT_BY_ID, GLAZES, type EffectId, type GlazeSpec, validGlazeSpec } from '../../shared/core/glazes';
import { hash32, mulberry32 } from '../../shared/core/rng';
import type { ScoreBreakdown } from '../../shared/core/score';
import type { FiredResultDTO, GlazeChoice, PotSummary } from '../../shared/api/types';
import { platform } from '../platform';
import { K, TTL } from '../store/keys';
import { atmosphereFor } from './commissions';
import { ApiErr } from './errors';
import { getPot, loadSummaries, potSummary } from './pots';
import { addDays, dateOf, today } from './time';
import { syncFlair } from './users';

/**
 * The kiln master glazes every pot: one or two glazes and a way of applying them, picked from the
 * pot id. Players no longer choose; each firing is a surprise and the Codex fills by chance.
 */
export function kilnGlaze(potId: string): GlazeSpec {
  const rnd = mulberry32(hash32(`glaze:${potId}`));
  const a = GLAZES[rnd() % GLAZES.length]!;
  const glazes: GlazeSpec['glazes'] = [a];
  if (rnd() % 100 < 45) {
    const b = GLAZES[rnd() % GLAZES.length]!;
    if (b !== a) glazes.push(b);
  }
  return { glazes, application: APPLICATIONS[rnd() % APPLICATIONS.length]! };
}

/** A player's very first kiln pot gets a quick test firing, so a first visit sees the whole loop. */
export const QUICK_FIRE_MS = 90_000;

/** Queue the pot for the next kiln (fires at the next 00:00 UTC). No choice = the kiln glazes it. */
export async function glazePot(userId: string, potId: string, choice: unknown): Promise<{ kilnDate: string; atmosphere: string; quickAt: number | null }> {
  const kv = platform().kv;
  if (choice == null) choice = kilnGlaze(potId);
  if (!validGlazeSpec(choice)) throw new ApiErr('bad-glaze', 'Pick one or two different glazes and an application.');
  const pot = await getPot(potId);
  if (!pot.potId) throw new ApiErr('not-found', 'That pot is gone.', 404);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'You can only glaze your own pots.', 403);
  if (pot.glaze) throw new ApiErr('already-glazed', 'This pot is already in the kiln.', 409);
  const kilnDate = today();
  const g: GlazeChoice = { glazes: choice.glazes, application: choice.application };
  const firstPot = (await kv.hGet(K.user(userId), 'quickFire')) == null;
  const quickAt = firstPot ? platform().now() + QUICK_FIRE_MS : null;
  await kv.hSet(K.pot(potId), { glaze: JSON.stringify(g), kilnDate, ...(quickAt ? { quickAt: String(quickAt) } : {}) });
  if (firstPot) await kv.hSet(K.user(userId), { quickFire: '1' });
  await kv.zAdd(K.kilnQueue(kilnDate), { member: potId, score: platform().now() });
  await kv.expire(K.kilnQueue(kilnDate), TTL.kilnQueue);
  await kv.hIncrBy(K.stats(kilnDate), 'glazes', 1);
  return { kilnDate, atmosphere: atmosphereFor(kilnDate), quickAt };
}

/** Is this pot due to fire: its kiln night has passed, or its quick test firing is done. */
function fireDue(pot: Record<string, string>): boolean {
  if (!pot.kilnDate) return false;
  if (kilnHasFired(pot.kilnDate)) return true;
  const q = Number(pot.quickAt ?? '0');
  return q > 0 && platform().now() >= q;
}

/** Has the kiln for this date fired yet? (It fires at 00:00 UTC the next day.) */
export function kilnHasFired(kilnDate: string): boolean {
  return today() > kilnDate;
}

/**
 * Fire one pot. Idempotent: a fired pot is never fired again, and because fire() is
 * deterministic the batch job and fire-on-read always agree.
 */
export async function firePot(potId: string): Promise<FiredResultDTO | null> {
  const kv = platform().kv;
  const pot = await getPot(potId);
  if (!pot.potId || !pot.glaze || !pot.kilnDate) return null;
  if (pot.fired) return JSON.parse(pot.fired) as FiredResultDTO;
  if (!fireDue(pot)) return null;
  const profile = decodeProfile(JSON.parse(pot.profile ?? '[]') as number[]);
  const spec = JSON.parse(pot.glaze) as GlazeSpec;
  const score = JSON.parse(pot.breakdown ?? '{}') as Partial<ScoreBreakdown>;
  const atmosphere = atmosphereFor(pot.kilnDate);
  const r = fire(profile, spec, atmosphere, { match: score.match ?? 0, evenness: score.evenness ?? 0, total: score.total ?? 0 }, `${potId}:${pot.kilnDate}`);
  const newDiscoveries: string[] = [];
  for (const e of r.effects) if (await claimDiscovery(e, pot.owner ?? 'potter', pot.ownerId ?? '', pot.kilnDate)) newDiscoveries.push(e);
  const dto: FiredResultDTO = {
    survived: r.survived,
    defects: r.defects,
    effects: r.effects,
    newDiscoveries,
    atmosphere,
    kilnScore: r.kilnScore,
    seed: r.seed,
  };
  await kv.hSet(K.pot(potId), { fired: JSON.stringify(dto), firedAt: String(platform().now()) });
  // Kiln stats for the morning Kiln Report.
  const sk = K.stats(`kiln:${pot.kilnDate}`);
  await kv.hIncrBy(sk, 'fired', 1);
  if (r.survived) await kv.hIncrBy(sk, 'survived', 1);
  for (const e of r.effects) await kv.hIncrBy(sk, `fx:${e}`, 1);
  for (const e of newDiscoveries) await kv.hSet(sk, { [`new:${e}`]: pot.owner ?? 'potter' });
  await kv.expire(sk, TTL.stats);
  if (pot.ranked === '1') {
    await kv.zAdd(K.lbKiln(pot.kilnDate), { member: pot.owner ?? 'potter', score: r.kilnScore });
    await kv.expire(K.lbKiln(pot.kilnDate), TTL.lb);
  }
  if (pot.ownerId) {
    if (r.survived) await kv.hIncrBy(K.user(pot.ownerId), 'fired', 1);
    if (pot.owner) await syncFlair(pot.ownerId, pot.owner);
  }
  return dto;
}

/** First discoverer of an effect in this community wins it. Optimistic transaction. */
async function claimDiscovery(effect: EffectId, username: string, userId: string, date: string): Promise<boolean> {
  const kv = platform().kv;
  for (let attempt = 0; attempt < 2; attempt++) {
    const tx = await kv.watch(K.codex());
    const existing = await kv.hGet(K.codex(), effect);
    if (existing) {
      await tx.unwatch();
      return false;
    }
    await tx.multi();
    await tx.hSet(K.codex(), { [effect]: JSON.stringify({ user: username, date }) });
    const res = await tx.exec();
    if (res) {
      if (userId) await kv.hIncrBy(K.user(userId), 'discoveries', 1);
      return true;
    }
  }
  return false;
}

/** Scheduler: fire up to `max` pots from yesterday's kiln queue. Safe to re-run. */
export async function kilnBatch(max = 400): Promise<{ date: string; fired: number; remaining: number }> {
  const kv = platform().kv;
  const date = addDays(today(), -1);
  const batch = await kv.zRange(K.kilnQueue(date), 0, max - 1, { by: 'rank' });
  let fired = 0;
  for (const m of batch) {
    try {
      await firePot(m.member);
      fired++;
    } catch (err) {
      console.error('fire failed', m.member, err);
    }
    await kv.zRem(K.kilnQueue(date), [m.member]);
  }
  return { date, fired, remaining: await kv.zCard(K.kilnQueue(date)) };
}

export type KilnItem = PotSummary & { opened: boolean; kilnDate: string; firesAt: number | null };

/** My recent pots that are in or out of the kiln. Fires on read anything the batch has not reached. */
export async function myKiln(userId: string): Promise<KilnItem[]> {
  const kv = platform().kv;
  const recent = await kv.zRange(K.myPots(userId), 0, 19, { by: 'rank', reverse: true });
  const out: KilnItem[] = [];
  for (const m of recent) {
    const h = await getPot(m.member);
    if (!h.glaze || !h.kilnDate) continue;
    if (!h.fired && fireDue(h)) {
      await firePot(m.member);
      Object.assign(h, await getPot(m.member));
    }
    const s = potSummary(h);
    if (!s) continue;
    const firesAt = h.fired ? null : Number(h.quickAt ?? '0') || Date.parse(`${addDays(h.kilnDate, 1)}T00:00:00Z`);
    out.push({ ...s, opened: h.opened === '1', kilnDate: h.kilnDate, firesAt });
  }
  return out;
}

export async function markOpened(userId: string, potId: string): Promise<void> {
  const pot = await getPot(potId);
  if (pot.ownerId !== userId) throw new ApiErr('forbidden', 'Not your pot.', 403);
  await platform().kv.hSet(K.pot(potId), { opened: '1' });
}

export async function kilnWaitingCount(userId: string): Promise<number> {
  const items = await myKiln(userId);
  return items.filter((i) => i.fired && !i.opened).length;
}

export async function codex(): Promise<{ id: string; name: string; blurb: string; kind: string; rare: boolean; discoverer: string | null; date: string | null }[]> {
  const raw = await platform().kv.hGetAll(K.codex());
  return [...EFFECT_BY_ID.values()].map((e) => {
    const hit = raw[e.id] ? (JSON.parse(raw[e.id]!) as { user: string; date: string }) : null;
    return {
      id: e.id,
      name: hit ? e.name : '?',
      blurb: hit ? e.blurb : 'Not yet discovered in this community.',
      kind: e.kind,
      rare: e.rare,
      discoverer: hit?.user ?? null,
      date: hit?.date ?? null,
    };
  });
}

/** Text of the morning Kiln Report comment for a kiln date. */
export async function kilnReportText(kilnDate: string): Promise<string | null> {
  const s = await platform().kv.hGetAll(K.stats(`kiln:${kilnDate}`));
  const fired = Number(s.fired ?? '0');
  if (!fired) return null;
  const survived = Number(s.survived ?? '0');
  const atm = atmosphereFor(kilnDate);
  const fx = Object.entries(s)
    .filter(([k]) => k.startsWith('fx:'))
    .map(([k, v]) => ({ name: EFFECT_BY_ID.get(k.slice(3) as EffectId)?.name ?? k.slice(3), n: Number(v) }))
    .sort((a, b) => b.n - a.n)
    .slice(0, 5);
  const news = Object.entries(s)
    .filter(([k]) => k.startsWith('new:'))
    .map(([k, v]) => `**${EFFECT_BY_ID.get(k.slice(4) as EffectId)?.name ?? k.slice(4)}**, discovered by u/${v}`);
  const lines = [
    `**Kiln Report for ${dateOf(Date.parse(`${kilnDate}T00:00:00Z`))}** (${atm} firing)`,
    '',
    `${fired} pot${fired === 1 ? '' : 's'} went into the kiln and ${survived} came out whole.`,
  ];
  if (fx.length) lines.push('', `Effects seen: ${fx.map((f) => `${f.name} x${f.n}`).join(', ')}.`);
  if (news.length) lines.push('', `New in the Glaze Codex: ${news.join('; ')}.`);
  else lines.push('', 'No new Codex discoveries this time. What do you think the recipes are?');
  return lines.join('\n');
}

export { loadSummaries };
