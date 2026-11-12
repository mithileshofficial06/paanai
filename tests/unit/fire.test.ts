import { describe, expect, it } from 'vitest';
import { OFFICIAL } from '../../src/shared/content/commissions';
import { g, recipeToLog } from '../../src/shared/content/recipes';
import { replay } from '../../src/shared/core/shape';
import { fire } from '../../src/shared/core/fire';
import { APPLICATIONS, EFFECTS, GLAZES, type Atmosphere, type EffectId, type GlazeSpec, shapeFacts, validGlazeSpec } from '../../src/shared/core/glazes';
import { simulate } from '../helpers';
import { Mode } from '../../src/shared/core/shape';

function allSpecs(): GlazeSpec[] {
  const out: GlazeSpec[] = [];
  for (const app of APPLICATIONS) {
    for (const a of GLAZES) {
      out.push({ glazes: [a], application: app });
      for (const b of GLAZES) if (b !== a) out.push({ glazes: [a, b], application: app });
    }
  }
  return out;
}

describe('fire', () => {
  it('is deterministic', () => {
    const p = replay(recipeToLog(OFFICIAL[1]!.recipe));
    const spec: GlazeSpec = { glazes: ['copper'], application: 'dip' };
    const a = fire(p, spec, 'reduction', { match: 90, evenness: 80, total: 85 }, 'pot1:2026-11-12');
    const b = fire(p, spec, 'reduction', { match: 90, evenness: 80, total: 85 }, 'pot1:2026-11-12');
    expect(a).toEqual(b);
    expect(a.effects).toContain('copper-red');
  });

  it('copper follows real chemistry: red in reduction, green in oxidation', () => {
    const p = replay(recipeToLog(OFFICIAL[0]!.recipe));
    const spec: GlazeSpec = { glazes: ['copper'], application: 'dip' };
    const k = { match: 80, evenness: 80, total: 80 };
    expect(fire(p, spec, 'reduction', k, 's').effects[0]).toBe('copper-red');
    expect(fire(p, spec, 'oxidation', k, 's').effects[0]).toBe('copper-green');
  });

  it('survival is skill-based: a slumped pot never survives', () => {
    const { p } = simulate([[{ ring: 0, mode: Mode.OPEN, dr: 0 }], Array.from({ length: 40 }, () => ({ ring: 24, mode: Mode.THIN, dr: 40 })), Array.from({ length: 30 }, () => null)]);
    expect(p.slumped).toBe(true);
    const r = fire(p, { glazes: ['clear'], application: 'dip' }, 'oxidation', { match: 0, evenness: 0, total: 0 }, 's');
    expect(r.survived).toBe(false);
    expect(r.defects).toContain('collapsed');
  });

  it('every one of the 24 effects is reachable with the official forms', () => {
    const found = new Set<EffectId>();
    // Official Master pots plus typical player pots (thin-walled, uneven, flared bowl).
    const playerForms = [
      [g.open(), ...Array.from({ length: 4 }, () => g.thin(5, 8, 16, 47)), g.thin(5, 5, 16, 40)],
      [g.open(), g.thin(5, 8, 16, 47), g.thin(28, 12, 10, 47), g.thin(30, 12, 10, 47)],
      [g.open(), g.thin(5, 8, 16, 47), g.thin(5, 8, 16, 47), g.thin(5, 8, 16, 47), g.push(20, 10, 22, 47), g.push(30, 16, 18, 47), g.push(40, 20, 10, 47), g.push(47, 16, 8)],
    ];
    const pots = [...OFFICIAL.map((c) => c.recipe), ...playerForms].map((r) => replay(recipeToLog(r)));
    for (const p of pots) expect(p.slumped).toBe(false);
    const specs = allSpecs();
    for (const p of pots) {
      for (const spec of specs) {
        for (const atm of ['oxidation', 'reduction'] as Atmosphere[]) {
          for (const e of fire(p, spec, atm, { match: 95, evenness: 96, total: 95 }, 'x').effects) found.add(e);
        }
      }
    }
    const missing = EFFECTS.map((e) => e.id).filter((id) => !found.has(id));
    // Diagnostic for tuning: which forms trigger which shape facts.
    if (missing.length) console.log('missing', missing, pots.map((p) => shapeFacts(p)));
    expect(missing).toEqual([]);
  });

  it('validates glaze specs', () => {
    expect(validGlazeSpec({ glazes: ['copper'], application: 'dip' })).toBe(true);
    expect(validGlazeSpec({ glazes: ['copper', 'copper'], application: 'dip' })).toBe(false);
    expect(validGlazeSpec({ glazes: [], application: 'dip' })).toBe(false);
    expect(validGlazeSpec({ glazes: ['gold'], application: 'dip' })).toBe(false);
    expect(validGlazeSpec({ glazes: ['iron', 'tin', 'ash'], application: 'dip' })).toBe(false);
  });
});
