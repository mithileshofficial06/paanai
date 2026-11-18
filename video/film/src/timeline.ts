import vo from '../vo.json';
import { s2f } from './lib';

export type VoLine = { id: string; text: string; dur: number; words: { w: string; t: number; d: number }[] };
export const VO: Record<string, VoLine> = Object.fromEntries((vo.lines as VoLine[]).map((l) => [l.id, l]));

// Scene windows in seconds (neighbours overlap for the transitions).
export const SCENES = {
  open: [0, 16],
  hook: [15.4, 37.6],
  throw: [37, 59.8],
  clay: [59.2, 71.2],
  score: [70.6, 90.6],
  paint: [90, 115.6],
  reveal: [115, 122.2],
  comm: [121.6, 140.6],
  tech: [140, 162.6],
  out: [162, 176],
} as const;
export type SceneId = keyof typeof SCENES;

// When each narration line starts (seconds, absolute).
export const VO_AT: Record<string, number> = {
  open1: 1.2,
  open2: 5.0,
  hook1: 16.2,
  hook2: 21.4,
  hook3: 33.4,
  throw1: 37.8,
  throw2: 41.4,
  throw3: 50.9,
  clay1: 59.8,
  score1: 71.1,
  score2: 74.4,
  score3: 86.2,
  paint1: 90.8,
  fire1: 98.1,
  fire2: 107.4,
  reveal1: 115.7,
  comm1: 122.2,
  comm2: 131.8,
  tech1: 140.7,
  tech2: 154.6,
  out1: 163.4,
  out2: 168.4,
};

export const TOTAL = s2f(SCENES.out[1]);

/** Absolute second a word of a line is spoken (first match from index `from`). */
export function wordAt(id: string, word: string, nth = 0): number {
  const l = VO[id];
  if (!l) return VO_AT[id] ?? 0;
  const hits = l.words.filter((w) => w.w.toLowerCase().replace(/[^a-z0-9-]/g, '') === word.toLowerCase());
  const h = hits[Math.min(nth, hits.length - 1)];
  return (VO_AT[id] ?? 0) + (h ? h.t : 0);
}
export const voEnd = (id: string) => (VO_AT[id] ?? 0) + (VO[id]?.dur ?? 0);

// Check: no two lines overlap.
const order = Object.entries(VO_AT).sort((a, b) => a[1] - b[1]);
for (let i = 1; i < order.length; i++) {
  const [pid, pt] = order[i - 1]!;
  const [id, t] = order[i]!;
  if (pt + (VO[pid]?.dur ?? 0) > t - 0.15) console.warn(`narration overlap: ${pid} runs into ${id}`);
}
