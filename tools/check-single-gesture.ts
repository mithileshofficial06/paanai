// Can every level and every daily vessel still be finished with one gesture (no Push / Thin buttons)?
//   npx tsx tools/check-single-gesture.ts
//
// With a single mode the wheel reads a drag that rises faster than 1.3x its sideways speed as a pull
// (THIN while moving up) and anything else as a push. For each Master throw this checks every move:
//  - OPEN and upward pulls: the same gesture works.
//  - THIN in place or moving down: needs the old Thin button (reported as a blocker).
//  - PUSH that drifts up the wall: the speed ratio is estimated from the pot's height at that moment
//    (vertical px per clay unit taken equal to horizontal, which overstates the ratio: the camera looks
//    down a little). If it would read as a pull, the player instead makes a few short sideways strokes at
//    heights along the same path, with the same total push. That version must still clear the level's
//    pass mark (levels) or beat the score to beat (daily vessels).
import { OFFICIAL } from '../src/shared/content/commissions';
import { LEVEL_COUNT, levelData, tutorialData } from '../src/shared/content/levels';
import { type Gesture, recipeToLog } from '../src/shared/content/recipes';
import { Mode, replay, strokeCount } from '../src/shared/core/shape';
import { RINGS } from '../src/shared/core/fixed';
import { barFor, scoreThrow, silhouetteMatch, type Constraint } from '../src/shared/core/score';
import { INPUT_TUNING as T } from '../src/client/input/pointerMapper';

type Verdict = { name: string; ok: boolean; changed: number; detail: string };

/** Rise / sideways speed of the drag that would make this push gesture. */
function pushRatio(ge: Gesture, potHeight: number): number {
  if (ge.toRing === undefined || ge.toRing <= ge.ring) return 0;
  const ringsPerTick = (ge.toRing - ge.ring) / Math.max(1, ge.ticks - 1);
  const rise = ringsPerTick * (potHeight / RINGS); // clay units per tick, upward
  const side = (Math.abs(ge.dr) + T.deadZone) / T.pushGain; // clay units per tick, sideways
  return rise / side;
}

/** The single-gesture version of a Master throw, and how many moves had to change. */
function singleGesture(recipe: readonly Gesture[]): { recipe: Gesture[]; changed: number; blockers: string[] } {
  const out: Gesture[] = [];
  const blockers: string[] = [];
  let changed = 0;
  for (const ge of recipe) {
    if (ge.mode === Mode.OPEN) out.push(ge);
    else if (ge.mode === Mode.THIN) {
      if (ge.toRing !== undefined && ge.toRing > ge.ring) out.push(ge);
      else {
        blockers.push(`thin at ring ${ge.ring}${ge.toRing !== undefined ? `->${ge.toRing}` : ''}`);
        out.push(ge);
      }
    } else {
      const h = replay(recipeToLog(out)).height;
      if (pushRatio(ge, h) <= T.pullRatio * 0.9) out.push(ge);
      else {
        // Three short sideways strokes spread along the same path, same total push.
        changed++;
        const n = 3;
        const per = Math.max(1, Math.round(ge.ticks / n));
        for (let k = 0; k < n; k++) {
          const ring = Math.round(ge.ring + ((ge.toRing! - ge.ring) * (k + 0.5)) / n);
          out.push({ ring, mode: Mode.PUSH, dr: ge.dr, ticks: per, pause: 4 });
        }
      }
    }
  }
  return { recipe: out, changed, blockers };
}

function checkLevel(name: string, recipe: readonly Gesture[], pass: number): Verdict {
  const target = replay(recipeToLog(recipe));
  const s = singleGesture(recipe);
  const p = replay(recipeToLog(s.recipe));
  const match = p.slumped ? 0 : silhouetteMatch(p, target);
  const ok = !s.blockers.length && match >= pass;
  return { name, ok, changed: s.changed, detail: `match ${match}% vs pass ${pass}%${s.blockers.length ? ` BLOCKED: ${s.blockers.join('; ')}` : ''}` };
}

function checkVessel(name: string, recipe: readonly Gesture[], constraints: readonly Constraint[]): Verdict {
  const log = recipeToLog(recipe);
  const target = replay(log);
  const masterStrokes = strokeCount(log);
  const bar = barFor(target, constraints, masterStrokes);
  const s = singleGesture(recipe);
  const l2 = recipeToLog(s.recipe);
  const p = replay(l2);
  const score = scoreThrow(p, target, constraints, strokeCount(l2), masterStrokes);
  const ok = !s.blockers.length && !p.slumped && score.total > bar;
  return { name, ok, changed: s.changed, detail: `score ${score.total} vs beat ${bar} (match ${score.match}%)${s.blockers.length ? ` BLOCKED: ${s.blockers.join('; ')}` : ''}` };
}

const results: Verdict[] = [];
const tut = tutorialData();
results.push(checkLevel('tutorial', tut.spec.recipe, tut.spec.pass));
for (let n = 1; n <= LEVEL_COUNT; n++) {
  const d = levelData(n);
  results.push(checkLevel(`level ${n}`, d.spec.recipe, d.spec.pass));
}
for (const c of OFFICIAL) results.push(checkVessel(`vessel ${c.id}`, c.recipe, c.constraints));

const bad = results.filter((r) => !r.ok);
const changed = results.filter((r) => r.changed > 0);
for (const r of changed) console.log(`changed  ${r.name.padEnd(22)} ${r.changed} drifting push(es) done as short strokes: ${r.detail}${r.ok ? '' : '  FAIL'}`);
for (const r of bad) if (!r.changed) console.log(`FAIL     ${r.name.padEnd(22)} ${r.detail}`);
console.log(`\n${results.length - bad.length}/${results.length} finishable with one gesture (tutorial + ${LEVEL_COUNT} levels + ${OFFICIAL.length} vessels); ${changed.length} need a drifting push done as short strokes.`);
process.exit(bad.length ? 1 : 0);
