// Seed the local harness with a lively community for the demo video: several potters throw the
// daily vessel for a few days, paint them, fire them, put them on show, and rate and like each other.
// Usage: node seed.mjs [days]   (harness on :5174, world is reset first)
const base = 'http://127.0.0.1:5174';
const DAYS = Number(process.argv[2] ?? 8);
const END = Number(process.argv[3] ?? 0); // finish this many days before the real date
const USERS = ['kofi_makes', 'harumi_clay', 'slip_and_score', 'priya_paints', 'leo_kiln', 'mateo_wheel', 'oak_and_ash', 'tara_glaze', 'wren_pottery', 'arjun_throws'];
const PAL = ['#b5532e', '#d39a2b', '#f4b41a', '#c8102e', '#253a8a', '#2aa7a1', '#3f8a3a', '#f1ebdd', '#1d1a18', '#d4af37', '#e07a8f', '#7fb8e6'];
const MOTIFS = ['dots', 'waves', 'zigzag', 'leaves', 'flowers', 'stars', 'stripes'];
let seed = 7;
const rnd = () => ((seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648);
const pick = (a) => a[Math.floor(rnd() * a.length)];

async function api(user, method, path, body) {
  const r = await fetch(`${base}/api/${path}${path.includes('?') ? '&' : '?'}user=${user}`, {
    method,
    headers: { 'content-type': 'application/json' },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) console.log('  !', user, path, r.status, JSON.stringify(j).slice(0, 120));
  return j;
}

function decor() {
  const bands = [];
  const nb = 1 + Math.floor(rnd() * 2);
  for (let i = 0; i < nb; i++) bands.push({ y: 0.25 + rnd() * 0.55, w: 0.03 + rnd() * 0.06, color: pick(PAL) });
  const motifs = rnd() < 0.6 ? [{ kind: pick(MOTIFS), y: 0.35 + rnd() * 0.35, size: 0.08 + rnd() * 0.08, count: 6 + Math.floor(rnd() * 6), color: pick(PAL) }] : [];
  return { base: rnd() < 0.3 ? pick(PAL) : null, rim: rnd() < 0.5 ? pick(PAL) : null, bands, motifs };
}

await fetch(`${base}/__harness/reset`, { method: 'POST' });
// Start DAYS in the past so the seeding ends on today (the server clock matches the browser's).
await fetch(`${base}/__harness/advance-day?n=${-DAYS - END}`, { method: 'POST' });
const pots = []; // { user, potId }
for (let d = 0; d < DAYS; d++) {
  const today = await api('kofi_makes', 'GET', 'today');
  const id = today.commission.id;
  const ghost = (await api('kofi_makes', 'GET', `commission/${id}`)).ghostLog;
  const who = USERS.filter((_, i) => (i + d) % 2 === 0 || rnd() < 0.3);
  for (const u of who) {
    await api(u, 'POST', 'me/hints', { onboarded: true });
    const t = await api(u, 'POST', 'throw', { commissionId: id, strokeLog: ghost, idemKey: `${u}-${d}` });
    if (!t.potId) continue;
    if (rnd() < 0.85) await api(u, 'POST', 'decorate', { potId: t.potId, decor: decor() });
    await api(u, 'POST', 'glaze', { potId: t.potId });
    pots.push({ user: u, potId: t.potId, day: d, title: today.commission.title });
  }
  console.log(`day ${d}: ${today.commission.title}, ${who.length} potters`);
  await fetch(`${base}/__harness/advance-day`, { method: 'POST' });
}
// Fire on read, open, and put the survivors on show.
for (const u of USERS) {
  const k = await api(u, 'GET', 'kiln');
  for (const it of k.items ?? []) {
    if (!it.fired) continue;
    await api(u, 'POST', 'kiln/open', { potId: it.potId });
    if (it.fired.survived) await api(u, 'POST', 'showcase', { potId: it.potId, on: true });
  }
}
// Everyone rates and likes a few pots.
for (const u of USERS) {
  for (const p of pots) {
    if (p.user === u || rnd() < 0.35) continue;
    await api(u, 'POST', 'rate', { potId: p.potId, stars: 3 + Math.floor(rnd() * 3) });
    if (rnd() < 0.55) await api(u, 'POST', 'like', { potId: p.potId });
  }
}
const sc = await api('kofi_makes', 'GET', 'showcase?sort=top');
console.log('on show:', sc.total, '| today:', (await api('kofi_makes', 'GET', 'today')).commission.title);
