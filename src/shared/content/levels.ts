// Levels 1-100: a fixed ladder of vessels that grow more complex as you climb.
// Every level is a deterministic recipe (the same Master's gestures as official commissions),
// so the client and the server build the same target, and the server can re-score any throw.
//   1-3    plain cylinders of growing height
//   4-12   one feature (a belly, a flare, a foot, a waist, a shoulder or a lip)
//   13-30  two features
//   31-60  three features, rules start to appear
//   61-99  four features, up to two rules
//   every 10th level is a real Master vessel from the commission catalogue (a "boss" level)
import type { CommissionDTO, FiredResultDTO, GlazeChoice, Atmosphere } from '../api/types';
import { type Constraint, scoreThrow, silhouetteMatch } from '../core/score';
import { type Profile, capacityMl, encodeProfile } from '../core/profile';
import { Mode, type StrokeLog, replay, strokeCount } from '../core/shape';
import { survivesKiln } from '../core/survival';
import { GLAZES, APPLICATIONS, type GlazeId } from '../core/glazes';
import { fire } from '../core/fire';
import { encodeLog } from '../core/strokes';
import { hash32, mulberry32, randInt } from '../core/rng';
import { OFFICIAL, type OfficialCommission } from './commissions';
import { type Gesture, g, recipeToLog } from './recipes';
import { constraintLabel } from './labels';

export const LEVEL_COUNT = 100;
export const TUTORIAL_ID = 'tutorial';

export type LevelSpec = {
  n: number;
  id: string;
  title: string;
  /** One line under the title. */
  note: string;
  /** Tier name, e.g. "Ember" (levels 21-30). */
  tier: string;
  boss: boolean;
  recipe: Gesture[];
  constraints: Constraint[];
  /** Shape match (%) needed to clear the level: the live "Match" gauge on the wheel. */
  pass: number;
};

export type LevelData = { spec: LevelSpec; target: Profile; log: StrokeLog; strokes: number };

const TIERS = ['River', 'Clay', 'Ember', 'Ash', 'Copper', 'Saffron', 'Monsoon', 'Jade', 'Obsidian', 'Starfire'];

type Feature = 'foot' | 'belly' | 'waist' | 'shoulder' | 'neck' | 'flare' | 'lip';
const COMBOS: Feature[][][] = [
  [],
  [['flare'], ['belly'], ['foot'], ['waist'], ['shoulder'], ['lip']],
  [['belly', 'foot'], ['flare', 'foot'], ['belly', 'neck'], ['waist', 'flare'], ['shoulder', 'neck'], ['belly', 'lip'], ['foot', 'waist'], ['shoulder', 'lip']],
  [['belly', 'neck', 'lip'], ['foot', 'belly', 'neck'], ['waist', 'shoulder', 'neck'], ['foot', 'flare', 'lip'], ['foot', 'waist', 'flare'], ['foot', 'shoulder', 'neck']],
  [['foot', 'belly', 'neck', 'lip'], ['foot', 'waist', 'shoulder', 'neck'], ['foot', 'belly', 'shoulder', 'neck'], ['foot', 'waist', 'flare', 'lip']],
];
/** Build order on the wheel: low on the pot first, the rim last. */
const ORDER: Feature[] = ['foot', 'belly', 'waist', 'shoulder', 'neck', 'flare', 'lip'];

function pulls(n: number): Gesture[] {
  return Array.from({ length: n }, () => g.thin(5, 8, 16, 47));
}

function gesture(f: Feature, m: number, next: () => number): Gesture {
  const ri = (k: number) => randInt(next, k);
  switch (f) {
    case 'foot': {
      const r = 4 + ri(4);
      return g.push(r, -Math.round(m * 0.6), 10, r + 8);
    }
    case 'belly':
      return g.push(16 + ri(10), m, 14 + ri(3));
    case 'waist':
      return g.push(18 + ri(8), -Math.round(m * 0.6), 14);
    case 'shoulder':
      return g.push(30 + ri(5), Math.round(m * 0.9), 12 + ri(3));
    case 'neck':
      return g.push(37 + ri(4), -Math.round(m * 1.3), 12, 47);
    case 'flare':
      return g.push(30 + ri(8), Math.round(m * 1.3), 14 + ri(5), 47);
    case 'lip':
      return g.push(47, Math.round(m * 0.7), 6);
  }
}

const NAMES: Record<string, string> = {
  flare: 'Bowl',
  belly: 'Jar',
  foot: 'Footed Cup',
  waist: 'Spool Jar',
  shoulder: 'Shouldered Jar',
  lip: 'Lipped Cup',
  'foot,belly': 'Round Jar',
  'foot,flare': 'Footed Bowl',
  'belly,neck': 'Bottle',
  'waist,flare': 'Beaker',
  'shoulder,neck': 'Vase',
  'belly,lip': 'Cooking Pot',
  'foot,waist': 'Goblet',
  'shoulder,lip': 'Storage Jar',
  'belly,neck,lip': 'Flask',
  'foot,belly,neck': 'Gourd Bottle',
  'waist,shoulder,neck': 'Pear Vase',
  'foot,flare,lip': 'Tazza',
  'foot,waist,flare': 'Chalice',
  'foot,shoulder,neck': 'Shoulder Vase',
  'foot,belly,neck,lip': 'Long-neck Flask',
  'foot,waist,shoulder,neck': 'Pear Bottle',
  'foot,belly,shoulder,neck': 'Globe Vase',
  'foot,waist,flare,lip': 'Trumpet Vase',
  'foot,waist,shoulder': 'Waisted Urn',
  'foot,belly,shoulder': 'Storage Urn',
};

function vesselName(fs: Feature[], nPulls: number): string {
  if (!fs.length) return nPulls <= 2 ? 'Cup' : nPulls === 3 ? 'Tumbler' : 'Tall Cylinder';
  const key = [...fs].sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b)).join(',');
  if (NAMES[key]) return NAMES[key];
  if (fs.includes('neck')) return 'Bottle';
  if (fs.includes('flare')) return 'Bowl';
  return 'Jar';
}

const ROMAN = ['', ' II', ' III', ' IV', ' V'];

function sound(p: Profile): boolean {
  return p.opened && !p.slumped && survivesKiln(p);
}

/** The ten Master vessels for levels 10, 20 ... 100, from simplest to hardest. */
let bossCache: OfficialCommission[] | null = null;
function bosses(): OfficialCommission[] {
  if (bossCache) return bossCache;
  const cx = (c: OfficialCommission) =>
    c.recipe.reduce((s, ge) => s + (ge.mode === Mode.PUSH ? Math.abs(ge.dr) * ge.ticks : 0), 0) / 10 + c.recipe.length * 8 + c.constraints.length * 30;
  // Skip vessels the untouched lump already resembles (nothing to shape, needle-thin pass mark).
  const distinct = OFFICIAL.filter((c) => silhouetteMatch(openedLump(), replay(recipeToLog(c.recipe))) <= 84);
  const sorted = [...distinct].sort((a, b) => cx(a) - cx(b) || a.id.localeCompare(b.id));
  const picks: OfficialCommission[] = [];
  for (let k = 0; k < 10; k++) picks.push(sorted[Math.min(sorted.length - 1, Math.round((k * (sorted.length - 1)) / 9))]!);
  bossCache = picks;
  return picks;
}

function constraintsFor(n: number, p: Profile, next: () => number): Constraint[] {
  const want = n >= 71 ? 2 : n >= 31 && n % 3 !== 1 ? 1 : 0;
  if (!want) return [];
  const rim = p.outer[p.outer.length - 1] ?? 0;
  const base = p.outer[0] ?? 0;
  const cands: Constraint[] = [{ kind: 'survive' }, { kind: 'height', min: Math.round(p.height * 0.9), max: Math.round(p.height * 1.1) }];
  if (rim > base * 1.15) cands.push({ kind: 'rim', rule: 'wider' });
  if (rim < base * 0.85) cands.push({ kind: 'rim', rule: 'narrower' });
  const ml = Math.round(capacityMl(p) / 50) * 50;
  if (ml >= 150) cands.push({ kind: 'capacity', ml, tolPct: 15 });
  const out: Constraint[] = [];
  while (out.length < want && cands.length) out.push(cands.splice(randInt(next, cands.length), 1)[0]!);
  return out;
}

const specCache = new Map<number, LevelData>();

let lumpCache: Profile | null = null;
/** The freshly opened lump, before any shaping. */
function openedLump(): Profile {
  lumpCache ??= replay(recipeToLog([g.open()]));
  return lumpCache;
}

/**
 * Pass mark: how far you must move the match from where the untouched lump already sits
 * toward a perfect 100. 30% of that gap on level 1, 60% on level 100. Master levels +2.
 */
function passMark(target: Profile, d: number, boss: boolean): number {
  const base = silhouetteMatch(openedLump(), target);
  return Math.min(97, Math.round(base + (100 - base) * (0.3 + 0.3 * d)) + (boss ? 2 : 0));
}

/** Stars on a cleared level: 1 for clearing, 2 and 3 for closing the rest of the gap to 100. */
export function levelStars(match: number, pass: number): 0 | 1 | 2 | 3 {
  if (match < pass) return 0;
  const step = (100 - pass) / 3;
  return match >= pass + 2 * step ? 3 : match >= pass + step ? 2 : 1;
}

/** Level n (1..100): spec, target profile and the Master's stroke log (the ghost). */
export function levelData(n: number): LevelData {
  const lv = Math.max(1, Math.min(LEVEL_COUNT, Math.trunc(n)));
  const hit = specCache.get(lv);
  if (hit) return hit;
  const d = (lv - 1) / (LEVEL_COUNT - 1);
  const tier = TIERS[Math.floor((lv - 1) / 10)]!;
  let spec: LevelSpec;
  let log: StrokeLog;
  let target: Profile;

  if (lv % 10 === 0) {
    const b = bosses()[lv / 10 - 1]!;
    log = recipeToLog(b.recipe);
    target = replay(log);
    spec = { n: lv, id: `level-${lv}`, title: b.title, note: `${b.origin}. ${b.note}`, tier, boss: true, recipe: b.recipe, constraints: b.constraints, pass: passMark(target, d, true) };
  } else {
    const next = mulberry32(hash32(`level:${lv}`));
    const count = lv <= 3 ? 0 : lv <= 12 ? 1 : lv <= 30 ? 2 : lv <= 60 ? 3 : 4;
    const combos = COMBOS[count]!;
    // Step through every combination in turn (5 is coprime with each list length), so neighbours differ.
    let feats: Feature[] = count ? [...combos[(lv * 5 + randInt(next, 1)) % combos.length]!] : [];
    feats.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const nPulls = lv <= 3 ? lv + 1 : Math.max(2, Math.min(4, 2 + Math.floor(d * 2.5) + (feats.includes('neck') ? 1 : 0) - (feats.includes('flare') ? 1 : 0)));
    let m = 8 + Math.round(d * 14) + randInt(next, 4);
    const seed = hash32(`level-shape:${lv}`);
    let recipe: Gesture[] = [];
    target = replay(recipeToLog([g.open(), ...pulls(nPulls)]));
    log = recipeToLog([g.open(), ...pulls(nPulls)]);
    // Shrink the moves until the pot is sound; drop the last feature if it never is.
    for (let attempt = 0; attempt < 8; attempt++) {
      const gNext = mulberry32(seed + attempt * 101);
      recipe = [g.open(), ...pulls(nPulls), ...feats.map((f) => gesture(f, m, gNext))];
      const l = recipeToLog(recipe);
      const p = replay(l);
      if (sound(p)) {
        log = l;
        target = p;
        break;
      }
      if (attempt % 2 === 1 && feats.length > 1) feats = feats.slice(0, -1);
      else m = Math.max(4, Math.round(m * 0.78));
      if (attempt === 7) recipe = [g.open(), ...pulls(nPulls)];
    }
    const base = `${tier} ${vesselName(feats, nPulls)}`;
    let repeats = 0;
    for (let k = Math.floor((lv - 1) / 10) * 10 + 1; k < lv; k++) if (k % 10 !== 0 && levelData(k).spec.title.startsWith(base)) repeats++;
    spec = {
      n: lv,
      id: `level-${lv}`,
      title: `${base}${ROMAN[repeats] ?? ` ${repeats + 1}`}`,
      note: feats.length ? `Shape it: ${feats.join(', ')}.` : 'Straight, even walls from foot to rim.',
      tier,
      boss: false,
      recipe,
      constraints: constraintsFor(lv, target, next),
      pass: passMark(target, d, false),
    };
  }
  const data: LevelData = { spec, target, log, strokes: strokeCount(log) };
  specCache.set(lv, data);
  return data;
}

export function levelNumberOf(id: string): number | null {
  const m = /^level-(\d{1,3})$/.exec(id);
  if (!m) return null;
  const n = Number(m[1]);
  return n >= 1 && n <= LEVEL_COUNT ? n : null;
}

/** The tutorial's practice pot: a short cup with a soft belly. Separate from level 1. */
let tutorialCache: LevelData | null = null;
export function tutorialData(): LevelData {
  if (tutorialCache) return tutorialCache;
  const recipe = [g.open(), ...pulls(3), g.push(20, 8, 14)];
  const log = recipeToLog(recipe);
  const target = replay(log);
  tutorialCache = {
    spec: { n: 0, id: TUTORIAL_ID, title: 'Practice Cup', note: 'Your first pot, with a guide at your side.', tier: 'Tutorial', boss: false, recipe, constraints: [], pass: passMark(target, 0, false) },
    target,
    log,
    strokes: strokeCount(log),
  };
  return tutorialCache;
}

export function levelDTO(d: LevelData): CommissionDTO {
  const s = d.spec;
  const isTut = s.id === TUTORIAL_ID;
  return {
    id: s.id,
    kind: isTut ? 'tutorial' : 'level',
    title: s.title,
    note: s.note,
    origin: isTut ? 'Tutorial' : `Level ${s.n} of ${LEVEL_COUNT}`,
    commissioner: 'the Master',
    bar: s.pass,
    barStrokes: d.strokes,
    constraints: s.constraints,
    constraintLabels: s.constraints.map(constraintLabel),
    target: encodeProfile(d.target),
    format: 'match',
    formatLabel: isTut ? 'Tutorial' : s.boss ? 'Master level' : 'Level',
    postId: null,
  };
}

export function levelGhost(d: LevelData): string {
  return encodeLog(d.log);
}

/** A glazed, fired look for the level's picture in the level grid. */
export function levelPreview(n: number): { profile: number[]; glaze: GlazeChoice; fired: FiredResultDTO } {
  const d = levelData(n);
  const glazes: GlazeId[] = [GLAZES[(n * 3) % GLAZES.length]!];
  if (n > 30 && n % 2 === 0) glazes.push(GLAZES[(n * 5 + 1) % GLAZES.length]!);
  const application = APPLICATIONS[n % APPLICATIONS.length]!;
  const atmosphere: Atmosphere = (hash32(`level-atm:${n}`) & 1) === 0 ? 'oxidation' : 'reduction';
  const s = scoreThrow(d.target, d.target, [], d.strokes, d.strokes);
  const r = fire(d.target, { glazes, application }, atmosphere, { match: s.match, evenness: s.evenness, total: s.total }, `level-${n}`);
  return {
    profile: encodeProfile(d.target),
    glaze: { glazes, application },
    fired: { survived: true, defects: [], effects: r.effects, newDiscoveries: [], atmosphere, kilnScore: r.kilnScore, seed: r.seed },
  };
}
