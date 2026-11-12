import { describe, expect, it } from 'vitest';
import { OFFICIAL } from '../../src/shared/content/commissions';
import { recipeToLog } from '../../src/shared/content/recipes';
import { replay, strokeCount } from '../../src/shared/core/shape';
import { kilnDefects } from '../../src/shared/core/survival';
import { scoreThrow, silhouetteMatch } from '../../src/shared/core/score';

const pots = OFFICIAL.map((c) => {
  const log = recipeToLog(c.recipe);
  return { c, p: replay(log), n: strokeCount(log) };
});

describe('official commissions', () => {
  it('has 35 with unique ids and short notes', () => {
    expect(OFFICIAL).toHaveLength(35);
    expect(new Set(OFFICIAL.map((c) => c.id)).size).toBe(35);
    for (const c of OFFICIAL) {
      expect(c.note.length, c.id).toBeLessThanOrEqual(110);
      expect(c.constraints.length, c.id).toBeLessThanOrEqual(2);
    }
  });

  it("every Master pot stands, survives the kiln, and passes its own constraints", () => {
    for (const { c, p, n } of pots) {
      expect(p.slumped, c.id).toBe(false);
      expect(kilnDefects(p), c.id).toEqual([]);
      const s = scoreThrow(p, p, c.constraints, n, n);
      expect(s.results.every((r) => r.pass), c.id).toBe(true);
    }
  });

  it('no two silhouettes are near-identical', () => {
    for (let i = 0; i < pots.length; i++)
      for (let j = i + 1; j < pots.length; j++) {
        const m = silhouetteMatch(pots[i]!.p, pots[j]!.p);
        expect(m, `${pots[i]!.c.id} ~ ${pots[j]!.c.id}`).toBeLessThan(92);
      }
  });
});
