import { g, recipeToLog } from '../src/shared/content/recipes';
import { replay } from '../src/shared/core/shape';
import { minWall } from '../src/shared/core/profile';
import { wallStats } from '../src/shared/core/survival';
for (const dr of [8, 10, 12]) {
  for (let n = 1; n <= 6; n++) {
    const r = [g.open(), ...Array.from({ length: n }, () => g.thin(5, dr, 16, 47))];
    const p = replay(recipeToLog(r));
    const walls = Array.from(p.wall).filter((_, i) => i % 6 === 4 || i === 47).map((w) => w / 10);
    console.log(`dr=${dr} n=${n} h=${p.height / 10} min=${minWall(p) / 10} cv=${wallStats(p).cvPct} slumped=${p.slumped} unsafe=${p.unsafe} walls=${walls.join(' ')}`);
  }
}
