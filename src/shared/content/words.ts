// Curated word list for player commission titles. Titles are always "<adjective> <vessel>",
// chosen from these lists only: no free text inside the app (Devvit rules: limited expression).

export const ADJECTIVES = [
  'Tall', 'Short', 'Wide', 'Narrow', 'Round', 'Slender', 'Squat', 'Graceful', 'Humble', 'Proud',
  'Quiet', 'Bold', 'Gentle', 'Heavy', 'Light', 'Ancient', 'Modern', 'Rustic', 'Royal', 'Sleepy',
  'Morning', 'Evening', 'Winter', 'Summer', 'Harvest', 'Monsoon', 'River', 'Mountain', 'Desert', 'Coastal',
  'Village', 'Temple', 'Market', 'Garden', 'Kitchen', 'Festival', 'Wedding', 'Travelling', 'Lucky', 'Patient',
  'Curious', 'Brave', 'Shy', 'Elegant', 'Sturdy', 'Delicate', 'Lopsided', 'Perfect', 'Classic', 'Twilight',
  'Moonlit', 'Sunlit', 'Stormy', 'Misty', 'Golden', 'Silver', 'Copper', 'Iron', 'Jade', 'Amber',
] as const;

export const VESSELS = [
  'Vase', 'Jar', 'Bowl', 'Cup', 'Pot', 'Urn', 'Jug', 'Pitcher', 'Bottle', 'Flask',
  'Amphora', 'Moon Jar', 'Meiping', 'Chawan', 'Paanai', 'Olla', 'Tagine', 'Planter', 'Lantern', 'Beaker',
  'Tumbler', 'Goblet', 'Chalice', 'Basin', 'Crock', 'Canister', 'Carafe', 'Decanter', 'Pithos', 'Krater',
  'Kalash', 'Matka', 'Tokkuri', 'Yunomi', 'Hydria', 'Lekythos', 'Stamnos', 'Albarello', 'Ginger Jar', 'Tea Bowl',
  'Rice Bowl', 'Soup Bowl', 'Water Jar', 'Oil Jar', 'Storage Jar', 'Bud Vase', 'Column', 'Tower', 'Cylinder', 'Bell',
] as const;

export function isValidTitle(adj: unknown, noun: unknown): boolean {
  return (ADJECTIVES as readonly string[]).includes(String(adj)) && (VESSELS as readonly string[]).includes(String(noun));
}
