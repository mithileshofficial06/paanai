import { describe, expect, it } from 'vitest';
import { LEVEL_COUNT, levelData, levelDTO, levelNumberOf, levelPreview, levelStars, tutorialData } from '../../src/shared/content/levels';
import { scoreThrow, silhouetteMatch } from '../../src/shared/core/score';
import { replay } from '../../src/shared/core/shape';
import { g, recipeToLog } from '../../src/shared/content/recipes';
import { survivesKiln } from '../../src/shared/core/survival';
import { encodeProfile } from '../../src/shared/core/profile';

describe('levels', () => {
  const all = Array.from({ length: LEVEL_COUNT }, (_, i) => levelData(i + 1));

  it('builds 100 sound, opened targets', () => {
    for (const d of all) {
      expect(d.target.opened, `level ${d.spec.n} opened`).toBe(true);
      expect(d.target.slumped, `level ${d.spec.n} slumped`).toBe(false);
      expect(survivesKiln(d.target), `level ${d.spec.n} survives`).toBe(true);
    }
  });

  it('the Master clears every level with their own throw, an untouched lump clears none', () => {
    const lump = replay(recipeToLog([g.open()]));
    for (const d of all) {
      const s = scoreThrow(d.target, d.target, d.spec.constraints, d.strokes, d.strokes);
      expect(s.match, `level ${d.spec.n}`).toBeGreaterThanOrEqual(d.spec.pass);
      expect(s.results.every((r) => r.pass), `level ${d.spec.n} rules`).toBe(true);
      expect(levelStars(s.match, d.spec.pass)).toBe(3);
      expect(silhouetteMatch(lump, d.target), `lump on level ${d.spec.n}`).toBeLessThan(d.spec.pass);
    }
  });

  it('is deterministic and has no two identical neighbours', () => {
    for (let i = 1; i < all.length; i++) {
      expect(encodeProfile(all[i]!.target).join(), `levels ${i} and ${i + 1}`).not.toBe(encodeProfile(all[i - 1]!.target).join());
    }
    expect(levelDTO(levelData(37)).target).toEqual(levelDTO(levelData(37)).target);
  });

  it('gets harder: more gestures and higher pass marks further up', () => {
    const avg = (from: number, to: number) => all.slice(from - 1, to).reduce((s, d) => s + d.spec.recipe.length, 0) / (to - from + 1);
    expect(avg(81, 99)).toBeGreaterThan(avg(1, 19));
    // The share of the gap (untouched lump -> perfect 100) you must close grows with the level.
    const lump = replay(recipeToLog([g.open()]));
    const share = (n: number) => {
      const d = all[n - 1]!;
      const base = silhouetteMatch(lump, d.target);
      return (d.spec.pass - base) / (100 - base);
    };
    expect(share(99)).toBeGreaterThan(share(1) + 0.2);
    expect(all.filter((d) => d.spec.boss).map((d) => d.spec.n)).toEqual([10, 20, 30, 40, 50, 60, 70, 80, 90, 100]);
  });

  it('parses ids and keeps the tutorial apart from level 1', () => {
    expect(levelNumberOf('level-1')).toBe(1);
    expect(levelNumberOf('level-100')).toBe(100);
    expect(levelNumberOf('level-101')).toBeNull();
    expect(levelNumberOf('tutorial')).toBeNull();
    expect(encodeProfile(tutorialData().target).join()).not.toBe(encodeProfile(all[0]!.target).join());
    expect(levelPreview(42).glaze.glazes.length).toBeGreaterThan(0);
  });
});
