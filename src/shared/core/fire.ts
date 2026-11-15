import { type Profile } from './profile';
import { type Defect, kilnDefects } from './survival';
import { type Atmosphere, type EffectId, EFFECT_BY_ID, type GlazeSpec, type Skill, glazeEffects, shapeFacts } from './glazes';
import { hash32 } from './rng';

/** A player's very first kiln pot gets a quick test firing, so a first visit sees the whole loop. */
export const QUICK_FIRE_MS = 10_000;
/** The test firing climbs from room temperature to stoneware heat (degrees C). */
export const FIRE_START_C = 20;
export const FIRE_PEAK_C = 1240;

export type FireResult = {
  survived: boolean;
  defects: Defect[];
  effects: EffectId[];
  /** Kiln score = throw score + 10 for surviving + 4 per effect (+8 more if rare); flaws subtract 4. */
  kilnScore: number;
  /** Seed for cosmetic placement only (crack paths, speckles). */
  seed: number;
};

/**
 * Fire a pot. Deterministic: same pot, glaze, atmosphere and skill give the same result
 * on every device and every run. Survival depends only on how the pot was thrown.
 */
export function fire(p: Profile, spec: GlazeSpec, atm: Atmosphere, skill: Skill & { total: number }, seedKey: string): FireResult {
  const defects = kilnDefects(p);
  const survived = defects.length === 0;
  const effects = p.slumped ? [] : glazeEffects(spec, atm, shapeFacts(p), skill);
  let bonus = survived ? 10 : 0;
  for (const e of effects) {
    const info = EFFECT_BY_ID.get(e);
    if (!info) continue;
    bonus += info.flaw ? -4 : 4 + (info.rare ? 8 : 0);
  }
  return { survived, defects, effects, kilnScore: Math.max(0, skill.total + bonus), seed: hash32(seedKey) };
}
