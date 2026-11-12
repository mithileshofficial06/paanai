// Maps a glaze choice + kiln result to visual parameters for the glaze material.
// Purely cosmetic (client only). Colours are realistic ceramic references.
import { GLAZE_INFO, type EffectId, type GlazeId } from '../../shared/core/glazes';
import type { FiredResultDTO, GlazeChoice } from '../../shared/api/types';

export type GlazeLook = {
  /** Main glaze colour (sRGB hex). */
  base: string;
  /** Break / rim / speckle / pooling colour. */
  secondary: string;
  /** 0 = dry matte, 1 = wet glass. */
  gloss: number;
  /** How opaque the glaze is: 0 shows the clay body through, 1 hides it. */
  opacity: number;
  /** Clay body colour where the glaze is thin or absent. */
  body: string;
  drips: number;
  crackle: number;
  speckle: number;
  oilSpots: number;
  streaks: number;
  crawl: number;
  pool: number;
  luster: number;
  breakEdges: number;
  pinholes: number;
  /** Structural crack from the kiln (not a glaze effect). */
  cracked: boolean;
  /** Pot slumped/collapsed (render as a sagged, unglazed lump). */
  collapsed: boolean;
};

const COLOUR: Partial<Record<EffectId, { base: string; secondary: string; gloss: number; opacity: number; luster?: number }>> = {
  'gold-luster': { base: '#6e521f', secondary: '#e3c477', gloss: 0.95, opacity: 1, luster: 0.85 },
  'moon-white': { base: '#efeee8', secondary: '#d8d5ca', gloss: 0.55, opacity: 1 },
  'peach-bloom': { base: '#d98d7d', secondary: '#6f9a7a', gloss: 0.8, opacity: 0.95 },
  'shino-blush': { base: '#efe5d3', secondary: '#cf6f36', gloss: 0.35, opacity: 0.9 },
  'blue-and-white': { base: '#f3f2ec', secondary: '#1d3d8c', gloss: 0.85, opacity: 1 },
  'copper-red': { base: '#7b161c', secondary: '#c53a3a', gloss: 0.9, opacity: 1 },
  'copper-green': { base: '#2e6a4f', secondary: '#69a883', gloss: 0.85, opacity: 0.95 },
  celadon: { base: '#9db8a0', secondary: '#cddcc6', gloss: 0.92, opacity: 0.78 },
  amber: { base: '#93541b', secondary: '#dc9c4c', gloss: 0.9, opacity: 0.85 },
  'cobalt-blue': { base: '#1b2d76', secondary: '#4e6ac9', gloss: 0.9, opacity: 1 },
  'temmoku-black': { base: '#15100d', secondary: '#7c3b17', gloss: 0.95, opacity: 1 },
  'satin-matte': { base: '#e7e1d3', secondary: '#cbc2b0', gloss: 0.22, opacity: 1 },
};

/** Fallback fired colours when no colour effect formed. */
const FIRED_PLAIN: Record<GlazeId, { base: string; secondary: string; gloss: number; opacity: number }> = {
  copper: { base: '#4d5a4c', secondary: '#7c8a74', gloss: 0.7, opacity: 0.9 },
  iron: { base: '#6b3f22', secondary: '#a8693a', gloss: 0.8, opacity: 0.85 },
  cobalt: { base: '#1b2d76', secondary: '#4e6ac9', gloss: 0.9, opacity: 1 },
  tin: { base: '#ece8de', secondary: '#d6cfbf', gloss: 0.6, opacity: 1 },
  ash: { base: '#8c8a64', secondary: '#b6b48a', gloss: 0.75, opacity: 0.75 },
  tenmoku: { base: '#1b120d', secondary: '#7c3b17', gloss: 0.95, opacity: 1 },
  rutile: { base: '#a8794a', secondary: '#c9b48e', gloss: 0.7, opacity: 0.9 },
  clear: { base: '#c9a27c', secondary: '#e6d4bd', gloss: 0.95, opacity: 0.05 },
};

const BODY = { oxidation: '#c79b72', reduction: '#9a8878' } as const;

function zero(): Omit<GlazeLook, 'base' | 'secondary' | 'gloss' | 'opacity' | 'body'> {
  return { drips: 0, crackle: 0, speckle: 0, oilSpots: 0, streaks: 0, crawl: 0, pool: 0, luster: 0, breakEdges: 0.25, pinholes: 0, cracked: false, collapsed: false };
}

/** Raw (unfired) glaze: powdery, matte, the swatch colour. */
export function rawLook(choice: GlazeChoice): GlazeLook {
  const top = GLAZE_INFO[(choice.glazes.at(-1) ?? 'clear') as GlazeId];
  const under = GLAZE_INFO[(choice.glazes[0] ?? 'clear') as GlazeId];
  return { ...zero(), base: top.raw, secondary: under.raw, gloss: 0.05, opacity: 0.9, body: '#b98a63', breakEdges: 0 };
}

/** Wet clay, no glaze (on the wheel). */
export function clayLook(): GlazeLook {
  return { ...zero(), base: '#9c6a4a', secondary: '#7f5238', gloss: 0.6, opacity: 0, body: '#9c6a4a', breakEdges: 0 };
}

export function firedLook(choice: GlazeChoice, fired: FiredResultDTO): GlazeLook {
  const body = BODY[fired.atmosphere];
  if (fired.defects.includes('collapsed')) {
    return { ...zero(), base: body, secondary: body, gloss: 0.1, opacity: 0, body, collapsed: true, breakEdges: 0 };
  }
  const colourFx = fired.effects.find((e) => COLOUR[e]);
  const plain = FIRED_PLAIN[(choice.glazes.at(-1) ?? 'clear') as GlazeId];
  const c = colourFx ? COLOUR[colourFx]! : plain;
  const look: GlazeLook = { ...zero(), base: c.base, secondary: c.secondary, gloss: c.gloss, opacity: c.opacity, body, luster: COLOUR[colourFx ?? 'amber']?.luster ?? 0 };
  if (!colourFx) look.luster = 0;
  if (choice.application === 'double-dip') look.drips = 0.25;
  for (const e of fired.effects) {
    switch (e) {
      case 'oil-spot':
        look.oilSpots = 0.85;
        look.secondary = '#b9b4ad';
        break;
      case 'hares-fur':
        look.streaks = 0.85;
        look.secondary = '#8a4a1f';
        break;
      case 'rutile-float':
        look.streaks = 0.45;
        look.speckle = 0.25;
        look.secondary = '#9fb4c9';
        break;
      case 'crawl':
        look.crawl = 0.8;
        break;
      case 'crackle':
        look.crackle = 0.85;
        break;
      case 'rutile-break':
        look.breakEdges = 0.9;
        break;
      case 'ash-runs':
        look.drips = Math.max(look.drips, 0.7);
        look.secondary = '#6f8a4a';
        break;
      case 'glass-pool':
        look.pool = 0.9;
        look.secondary = '#5f8f86';
        break;
      case 'iron-speckle':
        look.speckle = 0.75;
        look.secondary = '#3a2416';
        break;
      case 'craze-net':
        look.crackle = Math.max(look.crackle, 0.45);
        break;
      case 'pinholes':
        look.pinholes = 0.6;
        break;
      case 'drip-curtain':
        look.drips = 1;
        break;
      default:
        break;
    }
  }
  look.cracked = !fired.survived;
  return look;
}
