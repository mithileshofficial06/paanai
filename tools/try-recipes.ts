// Dev tool: print dimensions of the official commission recipes.
//   npx vite-node tools/try-recipes.ts   (or: npx tsx tools/try-recipes.ts)
import { OFFICIAL } from '../src/shared/content/commissions';
import { recipeToLog } from '../src/shared/content/recipes';
import { replay, strokeCount } from '../src/shared/core/shape';
import { capacityMl, maxOuter, minWall } from '../src/shared/core/profile';
import { kilnDefects, wallStats } from '../src/shared/core/survival';
import { scoreThrow } from '../src/shared/core/score';

for (const c of OFFICIAL) {
  const log = recipeToLog(c.recipe);
  const p = replay(log);
  const s = scoreThrow(p, p, c.constraints, strokeCount(log), strokeCount(log));
  const radii = Array.from(p.outer)
    .filter((_, i) => i % 6 === 0 || i === 47)
    .map((r) => Math.round(r / 10));
  console.log(
    `${c.id.padEnd(16)} h=${p.height / 10}mm cap=${capacityMl(p)}ml maxD=${(maxOuter(p) * 2) / 10}mm minWall=${minWall(p) / 10}mm cv=${wallStats(p).cvPct}% slumped=${p.slumped} defects=[${kilnDefects(p).join(',')}] strokes=${strokeCount(log)} ticks=${log.endTick} cons=${s.results.map((r) => (r.pass ? 'Y' : 'N') + ':' + r.detail).join(' | ')} radii=${radii.join(' ')}`
  );
}
