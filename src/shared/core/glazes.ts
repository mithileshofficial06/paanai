import { RINGS, iabs, rdiv } from './fixed';
import { type Profile, maxOuter } from './profile';
import { wallStats } from './survival';

export const GLAZES = ['copper', 'iron', 'cobalt', 'tin', 'ash', 'tenmoku', 'rutile', 'clear'] as const;
export type GlazeId = (typeof GLAZES)[number];
export const APPLICATIONS = ['dip', 'pour', 'double-dip'] as const;
export type Application = (typeof APPLICATIONS)[number];
export type Atmosphere = 'oxidation' | 'reduction';

export type GlazeInfo = { id: GlazeId; name: string; raw: string; hint: string };

/** Raw (unfired) swatch colours and the potter's one-line hint shown in the picker. */
export const GLAZE_INFO: Record<GlazeId, GlazeInfo> = {
  copper: { id: 'copper', name: 'Copper', raw: '#7d8f86', hint: 'Copper carbonate. Its colour depends on the fire.' },
  iron: { id: 'iron', name: 'Iron', raw: '#8a5a3c', hint: 'Red iron oxide. Warm or cool, the kiln decides.' },
  cobalt: { id: 'cobalt', name: 'Cobalt', raw: '#5a5f8f', hint: 'Cobalt oxide. Strong and dependable.' },
  tin: { id: 'tin', name: 'Tin White', raw: '#e6e1d6', hint: 'An opaque white that softens what lies beneath.' },
  ash: { id: 'ash', name: 'Wood Ash', raw: '#a39a8a', hint: 'Ash from the kiln fire. It moves when it melts.' },
  tenmoku: { id: 'tenmoku', name: 'Tenmoku', raw: '#3b2a22', hint: 'A dark iron-saturated glaze from the tea bowls of old.' },
  rutile: { id: 'rutile', name: 'Rutile', raw: '#b7905d', hint: 'Titanium-rich. Restless; it breaks over edges.' },
  clear: { id: 'clear', name: 'Clear', raw: '#dfe7ea', hint: 'A clear glass coat that shows the clay and the form.' },
};

export type EffectId =
  // colour effects (one per pot)
  | 'gold-luster'
  | 'moon-white'
  | 'peach-bloom'
  | 'shino-blush'
  | 'blue-and-white'
  | 'copper-red'
  | 'copper-green'
  | 'celadon'
  | 'amber'
  | 'cobalt-blue'
  | 'temmoku-black'
  | 'satin-matte'
  // surface effects (up to two per pot)
  | 'oil-spot'
  | 'hares-fur'
  | 'rutile-float'
  | 'crawl'
  | 'crackle'
  | 'rutile-break'
  | 'ash-runs'
  | 'glass-pool'
  | 'iron-speckle'
  | 'craze-net'
  | 'pinholes'
  | 'drip-curtain';

export type EffectInfo = { id: EffectId; name: string; kind: 'colour' | 'surface'; rare: boolean; flaw: boolean; blurb: string };

export const EFFECTS: EffectInfo[] = [
  { id: 'gold-luster', name: 'Gold Luster', kind: 'colour', rare: true, flaw: false, blurb: 'A metallic gold sheen that only the most even walls can hold.' },
  { id: 'moon-white', name: 'Moon White', kind: 'colour', rare: true, flaw: false, blurb: 'A soft, cool white with the glow of a full moon.' },
  { id: 'peach-bloom', name: 'Peach Bloom', kind: 'colour', rare: false, flaw: false, blurb: 'Pink blushing into green, prized by Qing emperors.' },
  { id: 'shino-blush', name: 'Shino Blush', kind: 'colour', rare: false, flaw: false, blurb: 'Thick white flushed with orange where it runs thin.' },
  { id: 'blue-and-white', name: 'Blue-and-White', kind: 'colour', rare: false, flaw: false, blurb: 'Crisp blue under white, the most traded ceramic in history.' },
  { id: 'copper-red', name: 'Copper Red', kind: 'colour', rare: false, flaw: false, blurb: 'Deep oxblood red. Copper starved of oxygen.' },
  { id: 'copper-green', name: 'Copper Green', kind: 'colour', rare: false, flaw: false, blurb: 'A fresh green. Copper given plenty of air.' },
  { id: 'celadon', name: 'Celadon', kind: 'colour', rare: false, flaw: false, blurb: 'Jade-like green from a whisper of iron in a starved fire.' },
  { id: 'amber', name: 'Amber', kind: 'colour', rare: false, flaw: false, blurb: 'Honey and amber browns from iron in a clean fire.' },
  { id: 'cobalt-blue', name: 'Cobalt Blue', kind: 'colour', rare: false, flaw: false, blurb: 'A deep, certain blue in any fire.' },
  { id: 'temmoku-black', name: 'Temmoku Black', kind: 'colour', rare: false, flaw: false, blurb: 'Glossy black breaking to rust at the rim.' },
  { id: 'satin-matte', name: 'Satin Matte', kind: 'colour', rare: false, flaw: false, blurb: 'A quiet, buttery white with no shine.' },
  { id: 'oil-spot', name: 'Oil Spot', kind: 'surface', rare: false, flaw: false, blurb: 'Silver spots like oil drops floating on black.' },
  { id: 'hares-fur', name: "Hare's Fur", kind: 'surface', rare: false, flaw: false, blurb: 'Fine brown streaks running down like fur.' },
  { id: 'rutile-float', name: 'Rutile Float', kind: 'surface', rare: false, flaw: false, blurb: 'Pale blue wisps floating in the melt.' },
  { id: 'crawl', name: 'Crawl', kind: 'surface', rare: false, flaw: false, blurb: 'The glaze pulls back into islands, like dried riverbed.' },
  { id: 'crackle', name: 'Crackle', kind: 'surface', rare: false, flaw: false, blurb: 'A web of fine cracks caught in the glaze as it cooled.' },
  { id: 'rutile-break', name: 'Rutile Break', kind: 'surface', rare: false, flaw: false, blurb: 'Colour shifts wherever the form turns sharply.' },
  { id: 'ash-runs', name: 'Ash Runs', kind: 'surface', rare: false, flaw: false, blurb: 'Rivulets of green ash glass running down a tall form.' },
  { id: 'glass-pool', name: 'Glass Pool', kind: 'surface', rare: false, flaw: false, blurb: 'A pool of thick glass gathered in the bottom of the bowl.' },
  { id: 'iron-speckle', name: 'Iron Speckle', kind: 'surface', rare: false, flaw: false, blurb: 'Dark iron freckles bleeding through the glaze.' },
  { id: 'craze-net', name: 'Craze Net', kind: 'surface', rare: false, flaw: false, blurb: 'A fine net of crazing over a thin, clear coat.' },
  { id: 'pinholes', name: 'Pinholes', kind: 'surface', rare: false, flaw: true, blurb: 'Tiny pits where gas escaped. A flaw of uneven walls.' },
  { id: 'drip-curtain', name: 'Drip Curtain', kind: 'surface', rare: false, flaw: false, blurb: 'Heavy glaze sliding into a curtain of drips.' },
];

export const EFFECT_BY_ID = new Map(EFFECTS.map((e) => [e.id, e]));

/** Shape facts the glaze rules can see. All integer. */
export type ShapeFacts = {
  wide: boolean; // wider than tall
  tall: boolean; // >= 150 mm and taller than wide
  steep: boolean; // walls mostly upright
  belly: boolean; // widest in the middle third, clearly wider than rim and foot
  bowl: boolean; // rim is the widest part and the form is open
  moonJar: boolean; // round, about as tall as wide, closed-ish rim
  sharp: boolean; // abrupt changes in the profile
  thinWalls: boolean; // mean wall < 8 mm
  uneven: boolean; // wall variation > 20%
};

export function shapeFacts(p: Profile): ShapeFacts {
  const maxR = maxOuter(p);
  const dia = maxR * 2;
  const rim = p.outer[RINGS - 1] ?? 0;
  const base = p.outer[0] ?? 0;
  let maxI = 0;
  for (let i = 0; i < RINGS; i++) if ((p.outer[i] ?? 0) === maxR) maxI = i;
  let lean = 0;
  let sharpest = 0;
  const from = p.opened ? p.floorRings + 1 : 1;
  for (let i = 1; i < RINGS; i++) {
    lean += iabs((p.outer[i] ?? 0) - (p.outer[i - 1] ?? 0));
    if (i >= from && i + 1 < RINGS) {
      const d2 = iabs((p.outer[i + 1] ?? 0) - 2 * (p.outer[i] ?? 0) + (p.outer[i - 1] ?? 0));
      if (d2 > sharpest) sharpest = d2;
    }
  }
  // Average lean per ring relative to ring spacing (height / RINGS): steep if < 25%.
  const steep = lean * 4 * RINGS < p.height * (RINGS - 1);
  const { mean, cvPct } = wallStats(p);
  const midLo = rdiv(RINGS, 3);
  const midHi = rdiv(RINGS * 2, 3);
  const belly = maxI >= midLo && maxI <= midHi && maxR * 100 > rim * 115 && maxR * 100 > base * 115;
  return {
    wide: dia > p.height,
    tall: p.height >= 1500 && p.height > dia,
    steep,
    belly,
    bowl: maxI >= midHi && rim * 100 >= maxR * 85 && rim * 10 > base * 14 && p.height < rim * 2,
    moonJar: belly && p.height * 100 >= dia * 85 && p.height * 100 <= dia * 115 && rim * 100 < maxR * 70,
    sharp: sharpest > 30,
    thinWalls: p.opened && mean < 80,
    uneven: cvPct > 20,
  };
}

export type GlazeSpec = { glazes: GlazeId[]; application: Application };
export type Skill = { match: number; evenness: number };

const has = (s: GlazeSpec, g: GlazeId) => s.glazes.includes(g);
const only = (s: GlazeSpec, g: GlazeId) => s.glazes.length === 1 && s.glazes[0] === g;
/** b applied over a (second layer over first). */
const over = (s: GlazeSpec, top: GlazeId, under: GlazeId) => s.glazes[0] === under && s.glazes[1] === top;

type Rule = { id: EffectId; when: (s: GlazeSpec, a: Atmosphere, f: ShapeFacts, k: Skill) => boolean };

/** Colour rules: first match wins. Rare effects are gated by skill, never by chance. */
const COLOUR_RULES: Rule[] = [
  { id: 'gold-luster', when: (s, a, _f, k) => has(s, 'copper') && has(s, 'tenmoku') && a === 'reduction' && k.evenness >= 95 },
  { id: 'moon-white', when: (s, a, f, k) => only(s, 'tin') && s.application === 'double-dip' && a === 'reduction' && f.moonJar && k.match >= 90 },
  { id: 'peach-bloom', when: (s, a) => has(s, 'copper') && has(s, 'tin') && a === 'reduction' && s.application === 'pour' },
  { id: 'shino-blush', when: (s, a) => has(s, 'tin') && has(s, 'iron') && a === 'reduction' && s.application === 'pour' },
  { id: 'blue-and-white', when: (s, a) => has(s, 'cobalt') && has(s, 'tin') && a === 'oxidation' },
  { id: 'copper-red', when: (s, a) => has(s, 'copper') && a === 'reduction' },
  { id: 'copper-green', when: (s, a) => has(s, 'copper') && a === 'oxidation' },
  { id: 'celadon', when: (s, a) => has(s, 'iron') && a === 'reduction' && s.application === 'dip' },
  { id: 'amber', when: (s, a) => has(s, 'iron') && a === 'oxidation' },
  { id: 'cobalt-blue', when: (s) => has(s, 'cobalt') },
  { id: 'temmoku-black', when: (s) => has(s, 'tenmoku') },
  { id: 'satin-matte', when: (s, a) => has(s, 'tin') && a === 'oxidation' && s.application === 'dip' },
];

/** Surface rules: up to two, in this priority order. */
const SURFACE_RULES: Rule[] = [
  { id: 'oil-spot', when: (s, a, f) => has(s, 'tenmoku') && s.application === 'double-dip' && f.wide && a === 'reduction' },
  { id: 'hares-fur', when: (s, a, f) => has(s, 'tenmoku') && s.application === 'double-dip' && f.tall && f.steep && a === 'reduction' },
  { id: 'rutile-float', when: (s, a) => has(s, 'rutile') && s.application === 'double-dip' && a === 'reduction' },
  { id: 'crawl', when: (s, a, f) => has(s, 'ash') && s.application === 'double-dip' && f.belly && a === 'oxidation' },
  { id: 'crackle', when: (s) => over(s, 'tin', 'iron') },
  { id: 'rutile-break', when: (s, _a, f) => has(s, 'rutile') && s.application === 'pour' && f.sharp },
  { id: 'ash-runs', when: (s, _a, f) => has(s, 'ash') && s.application === 'double-dip' && f.tall },
  { id: 'glass-pool', when: (s, _a, f) => has(s, 'clear') && f.bowl },
  { id: 'iron-speckle', when: (s, a) => has(s, 'iron') && has(s, 'ash') && a === 'oxidation' },
  { id: 'craze-net', when: (s, _a, f) => has(s, 'clear') && f.thinWalls },
  { id: 'pinholes', when: (s, _a, f) => has(s, 'clear') && f.uneven },
  { id: 'drip-curtain', when: (s, _a, f) => s.application === 'double-dip' && f.tall && f.steep },
];

export function glazeEffects(spec: GlazeSpec, atm: Atmosphere, facts: ShapeFacts, skill: Skill): EffectId[] {
  const out: EffectId[] = [];
  const colour = COLOUR_RULES.find((r) => r.when(spec, atm, facts, skill));
  if (colour) out.push(colour.id);
  for (const r of SURFACE_RULES) {
    if (out.length >= (colour ? 3 : 2)) break;
    if (r.when(spec, atm, facts, skill)) out.push(r.id);
  }
  return out;
}

export function validGlazeSpec(x: unknown): x is GlazeSpec {
  if (typeof x !== 'object' || x === null) return false;
  const o = x as { glazes?: unknown; application?: unknown };
  if (!Array.isArray(o.glazes) || o.glazes.length < 1 || o.glazes.length > 2) return false;
  if (!o.glazes.every((gl) => (GLAZES as readonly string[]).includes(String(gl)))) return false;
  if (o.glazes.length === 2 && o.glazes[0] === o.glazes[1]) return false;
  return (APPLICATIONS as readonly string[]).includes(String(o.application));
}
