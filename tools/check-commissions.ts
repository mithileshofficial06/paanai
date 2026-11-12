// Validate the official commissions: Master pot sound, passes its own constraints, silhouettes distinct.
//   npx tsx tools/check-commissions.ts
import { OFFICIAL } from '../src/shared/content/commissions';
import { recipeToLog } from '../src/shared/content/recipes';
import { replay, strokeCount } from '../src/shared/core/shape';
import { capacityMl, maxOuter } from '../src/shared/core/profile';
import { kilnDefects } from '../src/shared/core/survival';
import { scoreThrow, silhouetteMatch } from '../src/shared/core/score';

const pots = OFFICIAL.map((c) => {
  const log = recipeToLog(c.recipe);
  return { c, p: replay(log), n: strokeCount(log) };
});
for (const { c, p, n } of pots) {
  const s = scoreThrow(p, p, c.constraints, n, n);
  const bad = [p.slumped && 'SLUMPED', kilnDefects(p).length && `DEFECTS=${kilnDefects(p).join(',')}`, s.results.some((r) => !r.pass) && 'CONSTRAINT'].filter(Boolean);
  console.log(`${c.id.padEnd(15)} h=${p.height / 10} cap=${capacityMl(p)} D=${(maxOuter(p) * 2) / 10} rimD=${((p.outer[47] ?? 0) * 2) / 10} ${bad.join(' ')}`);
}
for (let i = 0; i < pots.length; i++)
  for (let j = i + 1; j < pots.length; j++) {
    const m = silhouetteMatch(pots[i]!.p, pots[j]!.p);
    if (m >= 92) console.log(`TOO SIMILAR ${pots[i]!.c.id} ~ ${pots[j]!.c.id} = ${m}`);
  }
console.log('count', OFFICIAL.length, 'unique', new Set(OFFICIAL.map((c) => c.id)).size === OFFICIAL.length);
