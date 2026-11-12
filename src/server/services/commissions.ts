import { OFFICIAL, type Format, type OfficialCommission, officialById } from '../../shared/content/commissions';
import { recipeToLog } from '../../shared/content/recipes';
import { type Profile, decodeProfile, encodeProfile } from '../../shared/core/profile';
import { type StrokeLog, replay, strokeCount } from '../../shared/core/shape';
import { type Constraint, barFor } from '../../shared/core/score';
import { decodeLog, encodeLog } from '../../shared/core/strokes';
import { hash32 } from '../../shared/core/rng';
import type { Atmosphere, CommissionDTO } from '../../shared/api/types';
import { platform } from '../platform';
import { K } from '../store/keys';
import { dayNumber, weekday } from './time';
import { ApiErr } from './errors';

export type ResolvedCommission = {
  dto: CommissionDTO;
  target: Profile;
  ghostLog: StrokeLog;
};

export const FORMAT_LABEL: Record<Format, string> = {
  match: 'Match the form',
  capacity: 'Match and hold',
  'commission-day': 'Commission Day',
  puzzle: 'Constraint puzzle',
  blind: 'Blind throw',
  community: 'Community commission',
  free: 'Free throw',
};

/** Weekly calendar (report §6). Index = UTC weekday, 0 = Sunday. */
const CALENDAR: Format[] = ['free', 'match', 'capacity', 'commission-day', 'puzzle', 'blind', 'community'];

export function formatFor(date: string): Format {
  return CALENDAR[weekday(date)] ?? 'match';
}

export function atmosphereFor(date: string): Atmosphere {
  return (hash32(`atmosphere:${date}`) & 1) === 0 ? 'oxidation' : 'reduction';
}

export function constraintLabel(c: Constraint): string {
  switch (c.kind) {
    case 'capacity':
      return `Holds ${(c.ml / 1000).toFixed(c.ml % 1000 === 0 ? 1 : 2)} L (within ${c.tolPct}%)`;
    case 'rim':
      return c.rule === 'narrower' ? 'Rim narrower than the base' : 'Rim wider than the base';
    case 'height':
      return `Height ${Math.round(c.min / 10)}-${Math.round(c.max / 10)} mm`;
    case 'survive':
      return 'Must survive the kiln';
    case 'maxStrokes':
      return `At most ${c.n} strokes`;
  }
}

type OfficialCache = { target: Profile; log: StrokeLog; bar: number; strokes: number };
const officialCache = new Map<string, OfficialCache>();

function officialData(c: OfficialCommission): OfficialCache {
  const hit = officialCache.get(c.id);
  if (hit) return hit;
  const log = recipeToLog(c.recipe);
  const target = replay(log);
  const strokes = strokeCount(log);
  const bar = barFor(target, c.constraints, strokes);
  const data = { target, log, bar, strokes };
  officialCache.set(c.id, data);
  return data;
}

export function officialDTO(c: OfficialCommission, format: Format, postId: string | null): ResolvedCommission {
  const d = officialData(c);
  return {
    target: d.target,
    ghostLog: d.log,
    dto: {
      id: c.id,
      kind: 'official',
      title: c.title,
      note: c.note,
      origin: c.origin,
      commissioner: 'the Master',
      bar: d.bar,
      barStrokes: d.strokes,
      constraints: c.constraints,
      constraintLabels: c.constraints.map(constraintLabel),
      target: encodeProfile(d.target),
      format,
      formatLabel: FORMAT_LABEL[format],
      postId,
    },
  };
}

/** The official commission for a given date (rotates through the pool). */
export function officialFor(date: string): OfficialCommission {
  const n = dayNumber(date);
  const i = ((n % OFFICIAL.length) + OFFICIAL.length) % OFFICIAL.length;
  return OFFICIAL[i] ?? OFFICIAL[0]!;
}

/** Resolve any commission id (official or player-made). */
export async function resolveCommission(id: string, format?: Format, postId: string | null = null): Promise<ResolvedCommission> {
  const off = officialById(id);
  if (off) return officialDTO(off, format ?? 'match', postId);
  const rec = await platform().kv.hGetAll(K.comm(id));
  if (!rec.id || rec.status === 'removed') throw new ApiErr('not-found', 'That commission no longer exists.', 404);
  const decoded = decodeLog(rec.ghostLog ?? '');
  if (!decoded.ok) throw new ApiErr('corrupt', 'Commission data is damaged.', 500);
  const target = decodeProfile(JSON.parse(rec.target ?? '[]') as number[]);
  const constraints = JSON.parse(rec.constraints ?? '[]') as Constraint[];
  const f = format ?? 'commission-day';
  return {
    target,
    ghostLog: decoded.log,
    dto: {
      id,
      kind: 'player',
      title: rec.title ?? 'Commission',
      note: `A commission by u/${rec.maker}. Beat their score to outthrow them.`,
      origin: 'Player commission',
      commissioner: rec.maker ?? 'unknown',
      bar: Number(rec.bar ?? '0'),
      barStrokes: Number(rec.barStrokes ?? '1'),
      constraints,
      constraintLabels: constraints.map(constraintLabel),
      target: encodeProfile(target),
      format: f,
      formatLabel: FORMAT_LABEL[f],
      postId: rec.postId ?? null,
    },
  };
}

export function ghostLogString(r: ResolvedCommission): string {
  return encodeLog(r.ghostLog);
}
