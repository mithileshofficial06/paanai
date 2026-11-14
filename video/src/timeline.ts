// The edit: every cut sits on a bar line of the music ("Travel Vibes", 105 BPM, first downbeat 0.284 s).
export const FPS = 30;
export const BAR = (60 / 105) * 4; // 2.2857 s
export const DOWNBEAT0 = 0.284;
export const bar = (k: number) => DOWNBEAT0 + k * BAR;

/** The music is spliced at bar 22 to the song's real ending (bars 44 onward), 7.14 s long. */
export const END_S = bar(22) + 7.14;
export const TOTAL_FRAMES = Math.round(END_S * FPS);

export type Seg = { clip: string; from: number; to: number };
export type Shot = {
  id: string;
  start: number; // seconds
  end: number;
  kind: 'phone' | 'card' | 'title' | 'end';
  segs?: Seg[]; // footage pieces, played back to back, stretched to fill the shot
  side?: 'left' | 'right'; // where the phone sits
  kicker?: string;
  headline?: string;
  sub?: string;
  /** Slow camera: phone scale from -> to, and an optional focus point (0..1 of the screen). */
  zoom?: [number, number];
  focus?: [number, number];
};

export const SHOTS: Shot[] = [
  {
    id: 'feed', start: 0, end: bar(2), kind: 'phone', side: 'right',
    segs: [{ clip: 'c00_feed', from: 1.0, to: 5.6 }],
    kicker: 'On Reddit, every day', headline: 'A pottery game that lives inside a post.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'card', start: bar(2), end: bar(3), kind: 'card',
    segs: [{ clip: 'c00_card', from: 0.6, to: 2.9 }],
  },
  { id: 'title', start: bar(3), end: bar(4), kind: 'title' },
  {
    id: 'today', start: bar(4), end: bar(5), kind: 'phone', side: 'right',
    segs: [{ clip: 'c03_throw', from: 0.05, to: 1.25 }],
    kicker: '01  Today’s commission', headline: 'One real vessel from history. Every day.',
    sub: 'Meiping Vase · Song dynasty, China',
    zoom: [1.0, 1.025],
  },
  {
    id: 'throw', start: bar(5), end: bar(8), kind: 'phone', side: 'left',
    segs: [{ clip: 'c03_throw', from: 1.25, to: 8.4 }],
    kicker: '02  Shape it', headline: 'Pull the clay up with your finger.',
    sub: 'Match the glowing outline. Done lights up when it passes.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'score', start: bar(8), end: bar(9), kind: 'phone', side: 'right',
    segs: [{ clip: 'c04_score', from: 0.55, to: 3.5 }],
    kicker: '03  Scored fairly', headline: 'Every stroke is replayed on the server.',
    sub: 'Nobody can fake a score.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'paint', start: bar(9), end: bar(11), kind: 'phone', side: 'left',
    segs: [{ clip: 'c05_paint', from: 3.2, to: 9.4 }],
    kicker: '04  Paint it', headline: 'Bands, patterns, a painted rim.',
    sub: 'Your paint stays under the glaze.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'fire', start: bar(11), end: bar(12), kind: 'phone', side: 'right',
    segs: [
      { clip: 'c06_fire', from: 0.25, to: 1.15 },
      { clip: 'c06_fire', from: 3.5, to: 5.6 },
    ],
    kicker: '05  The shared kiln', headline: 'Every pot in the sub fires together.',
    sub: 'Once a night, at 00:00 UTC.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'reveal', start: bar(12), end: bar(14), kind: 'phone', side: 'left',
    segs: [{ clip: 'c07_reveal', from: 2.0, to: 6.7 }],
    kicker: '06  Open the kiln', headline: 'The fire picks the glaze.',
    sub: 'Find a new one first and your name goes in the Codex.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'show', start: bar(14), end: bar(16), kind: 'phone', side: 'right',
    segs: [{ clip: 'c07_reveal', from: 7.1, to: 11.8 }],
    kicker: '07  Show it off', headline: 'Put it on show. Share it to the thread.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'showcase', start: bar(16), end: bar(19), kind: 'phone', side: 'left',
    segs: [
      { clip: 'c08_showcase', from: 1.7, to: 5.0 },
      { clip: 'c08_showcase', from: 6.4, to: 11.0 },
    ],
    kicker: '08  The community', headline: 'Rate, like, and crown the Pot of the Week.',
    zoom: [1.0, 1.025],
  },
  {
    id: 'home', start: bar(19), end: bar(22), kind: 'phone', side: 'right',
    segs: [
      { clip: 'c10_home', from: 1.7, to: 4.1 },
      { clip: 'c10_home', from: 4.5, to: 8.2 },
    ],
    kicker: '09  Come back tomorrow', headline: 'A new vessel daily. 100 levels to master.',
    zoom: [1.0, 1.025],
  },
  { id: 'end', start: bar(22), end: END_S, kind: 'end' },
];
