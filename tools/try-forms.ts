import { g, recipeToLog } from '../src/shared/content/recipes';
import { replay } from '../src/shared/core/shape';
import { shapeFacts } from '../src/shared/core/glazes';
import { wallStats } from '../src/shared/core/survival';
import { maxOuter } from '../src/shared/core/profile';
const forms: Record<string, ReturnType<typeof g.open>[]> = {
  thin: [g.open(), ...Array.from({ length: 5 }, () => g.thin(5, 8, 16, 47)), g.thin(8, 4, 16, 47)],
  uneven: [g.open(), g.thin(5, 8, 16, 47), g.thin(28, 12, 10, 47), g.thin(30, 12, 10, 47)],
  thin2: [g.open(), ...Array.from({ length: 4 }, () => g.thin(5, 8, 16, 47)), g.thin(5, 5, 16, 40)],
  bowl: [g.open(), g.thin(5, 8, 16, 47), g.thin(5, 8, 16, 47), g.push(26, 14, 22, 47), g.push(34, 18, 16, 47), g.push(44, 16, 8, 47)],
  bowl2: [g.open(), g.thin(5, 8, 16, 47), g.thin(5, 8, 16, 47), g.thin(5, 8, 16, 47), g.push(20, 10, 22, 47), g.push(30, 16, 18, 47), g.push(40, 20, 10, 47), g.push(47, 16, 8)],
};
for (const [k, r] of Object.entries(forms)) {
  const p = replay(recipeToLog(r));
  console.log(k, 'h', p.height / 10, 'maxR', maxOuter(p) / 10, 'rim', (p.outer[47] ?? 0) / 10, 'base', (p.outer[0] ?? 0) / 10, 'slumped', p.slumped, wallStats(p), JSON.stringify(shapeFacts(p)));
}
