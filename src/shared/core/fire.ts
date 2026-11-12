import { type Profile } from './profile';
import { type Defect, kilnDefects } from './survival';
import { type Atmosphere, type EffectId, EFFECT_BY_ID, type GlazeSpec, type Skill, glazeEffects, shapeFacts } from './glazes';
import { hash32 } from './rng';

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
