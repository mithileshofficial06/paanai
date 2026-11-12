import { officialById } from '../../shared/content/commissions';
import { recipeToLog } from '../../shared/content/recipes';
import { encodeProfile } from '../../shared/core/profile';
import { replay, strokeCount } from '../../shared/core/shape';
import { scoreThrow } from '../../shared/core/score';
import { fire } from '../../shared/core/fire';
import type { PotSummary } from '../../shared/api/types';

let cached: PotSummary | null = null;

/**
 * First-visit hook: "An old potter left a pot in the kiln for you." A Master's tall
 * cylinder, double-dipped in copper and fired in reduction: Copper Red with a drip curtain.
 * Same deterministic core as every real pot.
 */
export function starterPot(): PotSummary {
  if (cached) return cached;
  const c = officialById('tall-cylinder')!;
  const log = recipeToLog(c.recipe);
  const p = replay(log);
  const s = scoreThrow(p, p, [], strokeCount(log), strokeCount(log));
  const r = fire(p, { glazes: ['copper'], application: 'double-dip' }, 'reduction', { match: s.match, evenness: s.evenness, total: s.total }, 'starter');
  cached = {
    potId: 'starter',
    owner: 'the Master',
    commissionId: c.id,
    title: 'A gift from the kiln',
    profile: encodeProfile(p),
    score: s.total,
    ranked: false,
    glaze: { glazes: ['copper'], application: 'double-dip' },
    fired: { survived: r.survived, defects: r.defects, effects: r.effects, newDiscoveries: [], atmosphere: 'reduction', kilnScore: r.kilnScore, seed: r.seed },
    likes: 0,
    createdAt: 0,
  };
  return cached;
}
