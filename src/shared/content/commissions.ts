import type { Constraint } from '../core/score';
import { type Gesture, g } from './recipes';

/** Weekly calendar formats (report §6). */
export type Format = 'match' | 'capacity' | 'commission-day' | 'puzzle' | 'blind' | 'community' | 'free';

export type OfficialCommission = {
  id: string;
  title: string;
  /** Short historical note shown on the card. */
  note: string;
  origin: string;
  constraints: Constraint[];
  /** The Master's reference throw. Its replay is the target; its log is the ghost. */
  recipe: Gesture[];
};

/** n upward thinning passes over the wall (how a potter pulls up). */
function pulls(n: number, dr: number, ticks = 16): Gesture[] {
  return Array.from({ length: n }, () => g.thin(5, dr, ticks, 47));
}

export const OFFICIAL: OfficialCommission[] = [
  {
    id: 'tall-cylinder',
    title: 'Tall Cylinder',
    origin: 'Studio basics',
    note: 'Every potter learns this first: straight, even walls from foot to rim.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.thin(10, 5, 14, 40), g.push(20, -5, 14, 47)],
  },
  {
    id: 'moon-jar',
    title: 'Moon Jar',
    origin: 'Korea, Joseon dynasty',
    note: 'A full white sphere, once made from two bowls joined at the waist.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(4, 8), g.push(24, 11, 16), g.push(40, -18, 12, 47), g.push(8, -10, 10, 14)],
  },
  {
    id: 'wide-bowl',
    title: 'Wide Bowl',
    origin: 'Song dynasty, China',
    note: 'A low open form that flares from a narrow foot, made for rice or tea.',
    constraints: [{ kind: 'rim', rule: 'wider' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(30, 22, 18, 47), g.push(38, 18, 14, 47), g.push(6, -10, 8, 12)],
  },
  {
    id: 'meiping',
    title: 'Meiping Vase',
    origin: 'Song dynasty, China',
    note: 'A broad high shoulder, a narrow foot and a tiny mouth for a single plum branch.',
    constraints: [{ kind: 'rim', rule: 'narrower' }],
    recipe: [g.open(), ...pulls(4, 8), g.push(32, 14, 14), g.push(6, -12, 12, 18), g.push(44, -24, 14, 47)],
  },
  {
    id: 'tamil-paanai',
    title: 'Paanai',
    origin: 'Tamil Nadu, India',
    note: 'The round earthen pot that boils over at Pongal, a sign of plenty.',
    constraints: [{ kind: 'capacity', ml: 1000, tolPct: 15 }],
    recipe: [g.open(), ...pulls(4, 8), g.push(18, 12, 16), g.push(38, -22, 12, 44), g.push(47, 14, 6)],
  },
  {
    id: 'chawan',
    title: 'Chawan',
    origin: 'Japan',
    note: 'A tea bowl held in two hands; slightly uneven by intent, but sound.',
    constraints: [{ kind: 'height', min: 950, max: 1200 }],
    recipe: [g.open(), ...pulls(2, 8), g.push(34, 14, 12, 47), g.push(8, -6, 8, 14)],
  },
];

export function officialById(id: string): OfficialCommission | undefined {
  return OFFICIAL.find((c) => c.id === id);
}
