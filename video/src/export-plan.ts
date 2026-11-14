// Build plan.json: each shot's footage pieces with their playback rates, and every recorded tap
// placed on the final video's clock. Run: npx tsx src/export-plan.ts (from video/).
import { readFileSync, writeFileSync } from 'node:fs';
import { SHOTS, END_S } from './timeline';

type Touch = { kind: string; x?: number; y?: number; t: number };
const touchesOf = (clip: string): Touch[] => JSON.parse(readFileSync(`public/footage/${clip}.touches.json`, 'utf8'));

const shots = SHOTS.map((s) => {
  const segs = s.segs ?? [];
  const total = segs.reduce((a, g) => a + (g.to - g.from), 0);
  const dur = s.end - s.start;
  const rate = total > 0 ? total / dur : 1;
  let t = s.start;
  const pieces = segs.map((g) => {
    const len = (g.to - g.from) / rate;
    const p = { ...g, start: t, end: t + len, rate };
    t += len;
    return p;
  });
  const taps = pieces.flatMap((p) =>
    touchesOf(p.clip)
      .filter((u) => u.kind === 'tap' && u.t >= p.from - 0.05 && u.t <= p.to)
      .map((u) => ({ t: p.start + (u.t - p.from) / p.rate, x: u.x!, y: u.y! })),
  );
  return { ...s, pieces, rate, taps };
});
writeFileSync('src/plan.json', JSON.stringify({ end: END_S, shots }, null, 1));
for (const s of shots) console.log(`${s.id.padEnd(9)} ${s.start.toFixed(2)}-${s.end.toFixed(2)}  rate ${s.rate.toFixed(2)}  taps ${s.taps.length}`);
