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
  // ---- 29 more (2026-11-12): one real symmetric vessel per day, no handles or spouts. ----
  {
    id: 'albarello',
    title: 'Albarello',
    origin: 'Italy, Renaissance',
    note: 'An apothecary jar with a pinched waist, easy to grab from a crowded shelf.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(4, 8), g.push(24, -9, 14), g.push(44, 4, 8, 47)],
  },
  {
    id: 'kulhad',
    title: 'Kulhad',
    origin: 'North India',
    note: 'A small unglazed cup for chai, traditionally used once and returned to the earth.',
    constraints: [],
    recipe: [g.open(), ...pulls(3, 8), g.push(6, -12, 10, 16), g.push(40, 6, 10, 47)],
  },
  {
    id: 'matki',
    title: 'Matki',
    origin: 'Rajasthan, India',
    note: 'A round water pot; the porous clay keeps water cool as it evaporates.',
    constraints: [],
    recipe: [g.open(), ...pulls(3, 8), g.push(20, 14, 16), g.push(36, -16, 12, 44), g.push(46, 6, 6)],
  },
  {
    id: 'kalash',
    title: 'Kalash',
    origin: 'India',
    note: 'A full-bellied ritual pot with a narrow neck, filled with water for blessings.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(4, 8), g.push(12, 12, 16), g.push(30, -24, 14, 42), g.push(46, 18, 6, 47)],
  },
  {
    id: 'surahi',
    title: 'Surahi',
    origin: 'Mughal India',
    note: 'A long-necked water flask; the narrow neck kept out dust and kept water cool.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(4, 8), g.push(10, 12, 16), g.push(24, -24, 18, 47)],
  },
  {
    id: 'tianqiuping',
    title: 'Tianqiuping',
    origin: 'Ming dynasty, China',
    note: 'The \'celestial globe\' vase: a near-perfect sphere under a tall straight neck.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(14, 13, 18), g.push(30, -22, 14, 47), g.push(47, 4, 4)],
  },
  {
    id: 'yuhuchun',
    title: 'Yuhuchun',
    origin: 'Yuan dynasty, China',
    note: 'A pear-shaped wine vase whose slender neck opens into a flaring mouth.',
    constraints: [{ kind: 'height', min: 1350, max: 1650 }],
    recipe: [g.open(), ...pulls(4, 8), g.push(12, 14, 16), g.push(30, -22, 12, 40), g.push(44, 14, 10, 47)],
  },
  {
    id: 'gu',
    title: 'Gu Beaker',
    origin: 'Shang dynasty, China',
    note: 'A trumpet-mouthed ritual beaker, first cast in bronze, later made in porcelain.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(20, -14, 16), g.push(44, 18, 12, 47)],
  },
  {
    id: 'ginger-jar',
    title: 'Ginger Jar',
    origin: 'China',
    note: 'A round-shouldered spice jar, later prized in Europe as a display piece.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(2, 8), g.push(26, 12, 16), g.push(44, -12, 8, 47)],
  },
  {
    id: 'onggi',
    title: 'Onggi',
    origin: 'Korea',
    note: 'A breathing fermentation jar for kimchi and soy sauce, kept outdoors in rows.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(36, 12, 16), g.push(8, -8, 10, 14)],
  },
  {
    id: 'alabastron',
    title: 'Alabastron',
    origin: 'Ancient Greece',
    note: 'A slender perfume flask with a narrow foot and neck, made to hold scented oil.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(4, -10, 12, 14), g.push(36, -18, 12, 47), g.push(47, 10, 4)],
  },
  {
    id: 'tsubo',
    title: 'Tsubo',
    origin: 'Japan',
    note: 'A storage jar from the old Shigaraki and Tamba kilns, glazed by wood ash.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(30, 12, 16), g.push(44, -10, 8, 47), g.push(6, -10, 10, 14)],
  },
  {
    id: 'hira-chawan',
    title: 'Hira Chawan',
    origin: 'Japan',
    note: 'A shallow summer tea bowl; the wide surface lets the tea cool quickly.',
    constraints: [{ kind: 'rim', rule: 'wider' }],
    recipe: [g.open(), ...pulls(2, 8), g.push(28, 24, 16, 47), g.push(40, 16, 12, 47)],
  },
  {
    id: 'mizusashi',
    title: 'Mizusashi',
    origin: 'Japan',
    note: 'The fresh-water jar of the tea ceremony, used to refill the kettle.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(24, 7, 30, 44)],
  },
  {
    id: 'tokkuri',
    title: 'Tokkuri',
    origin: 'Japan',
    note: 'A sake flask with a round body and a narrow neck that keeps the sake warm.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(14, 14, 16), g.push(30, -26, 16, 47), g.push(47, 4, 4)],
  },
  {
    id: 'guinomi',
    title: 'Guinomi',
    origin: 'Japan',
    note: 'A small sake cup; collectors judge a potter by how one feels in the hand.',
    constraints: [],
    recipe: [g.open(), ...pulls(1, 8), g.push(30, 6, 10, 47)],
  },
  {
    id: 'acoma-olla',
    title: 'Acoma Olla',
    origin: 'Acoma Pueblo, New Mexico',
    note: 'A thin-walled water jar with a wide shoulder, carried on the head.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(24, 13, 18), g.push(42, -12, 10, 47)],
  },
  {
    id: 'tinaja',
    title: 'Tinaja',
    origin: 'Spain',
    note: 'A large egg-shaped jar for wine, oil or water, partly buried to stay cool.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(26, 11, 18), g.push(6, -10, 10, 14), g.push(46, -10, 6)],
  },
  {
    id: 'bell-beaker',
    title: 'Bell Beaker',
    origin: 'Bronze Age Europe',
    note: 'An S-curved cup like an upturned bell, found from Iberia to Hungary.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(14, 10, 14), g.push(28, -10, 12), g.push(44, 10, 10, 47)],
  },
  {
    id: 'flower-pot',
    title: 'Flower Pot',
    origin: 'England',
    note: 'A plain tapered pot; the slope lets the root ball slide out in one piece.',
    constraints: [{ kind: 'rim', rule: 'wider' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(8, -12, 12), g.push(40, 14, 16, 47)],
  },
  {
    id: 'seed-jar',
    title: 'Seed Jar',
    origin: 'Ancestral Puebloan, US Southwest',
    note: 'A round jar with a tiny mouth that kept seeds safe from mice through winter.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(20, 13, 18), g.push(36, -26, 14, 47)],
  },
  {
    id: 'bean-pot',
    title: 'Bean Pot',
    origin: 'New England',
    note: 'A deep round pot for slow-baked beans, its mouth narrower than its belly.',
    constraints: [],
    recipe: [g.open(), ...pulls(3, 8), g.push(18, 14, 16), g.push(42, -8, 10, 47)],
  },
  {
    id: 'iznik-bowl',
    title: 'Iznik Bowl',
    origin: 'Ottoman Turkey',
    note: 'A deep footed bowl from Iznik, famed for cobalt and tomato-red tulips.',
    constraints: [{ kind: 'survive' }],
    recipe: [g.open(), ...pulls(3, 8), g.push(30, 18, 16, 47), g.push(6, -12, 10, 14)],
  },
  {
    id: 'tenmoku-bowl',
    title: 'Tenmoku Bowl',
    origin: 'Song dynasty, China',
    note: 'A conical tea bowl from the Jian kilns, glazed in iron \'hare\'s fur\'.',
    constraints: [{ kind: 'rim', rule: 'wider' }],
    recipe: [g.open(), ...pulls(2, 8), g.push(4, -14, 10, 14), g.push(24, 18, 20, 47)],
  },
  {
    id: 'baluster-vase',
    title: 'Baluster Vase',
    origin: 'Qing dynasty, China',
    note: 'A tall vase that swells at the shoulder and tucks in at the waist.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(30, 14, 14), g.push(16, -8, 12), g.push(46, 10, 8, 47)],
  },
  {
    id: 'crock',
    title: 'Crock',
    origin: 'United States, 1800s',
    note: 'A wide salt-glazed stoneware jar for pickles and butter, straight and strong.',
    constraints: [],
    recipe: [g.open(), ...pulls(3, 8), g.push(24, 14, 30, 44)],
  },
  {
    id: 'bitong',
    title: 'Bitong',
    origin: 'China',
    note: 'A scholar\'s brush pot: a short straight cylinder kept on the writing desk.',
    constraints: [],
    recipe: [g.open(), ...pulls(3, 8)],
  },
  {
    id: 'lota',
    title: 'Lota',
    origin: 'South Asia',
    note: 'A round water vessel with a rolled lip, made in clay and brass across the region.',
    constraints: [],
    recipe: [g.open(), ...pulls(2, 8), g.push(16, 13, 16), g.push(34, -18, 12, 44), g.push(47, 12, 6)],
  },
  {
    id: 'beer-jar',
    title: 'Beer Jar',
    origin: 'Ancient Egypt',
    note: 'A tall slender jar with a narrow base, used to brew and store beer by the Nile.',
    constraints: [],
    recipe: [g.open(), ...pulls(4, 8), g.push(4, -12, 14, 16), g.push(30, 6, 14)],
  },
];

export function officialById(id: string): OfficialCommission | undefined {
  return OFFICIAL.find((c) => c.id === id);
}
