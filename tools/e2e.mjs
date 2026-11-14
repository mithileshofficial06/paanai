// End-to-end workflow check of the studio, as a player would use it (phone size).
//   node tools/e2e.mjs [baseUrl]      default http://127.0.0.1:5173
// Resets the harness world, then walks: loading -> welcome -> starter kiln -> tutorial -> today's pot
// (first run: no menu bar) -> score -> paint -> kiln -> reveal, the studio opens up -> put on show ->
// my pots -> codex hint -> level 1: coach, collapse card, undo, clear -> level map ->
// showcase (another player rates, likes) -> leaderboard.
// Prints PASS/FAIL per step; screenshots failures.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = '.paanai/e2e';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
const errors = [];
p.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
p.on('console', (m) => m.type() === 'error' && !/telemetry|404/.test(m.text()) && errors.push(`console: ${m.text().slice(0, 160)}`));
p.on('response', async (r) => {
  if (!r.url().includes('/api/') || r.status() < 400 || r.url().includes('telemetry')) return;
  errors.push(`api ${r.status()} ${r.url().replace(base, '')} ${(await r.text().catch(() => '')).slice(0, 160)}`);
});

let n = 0;
let failed = 0;
async function step(name, fn) {
  n++;
  try {
    await fn();
    console.log(`PASS ${String(n).padStart(2)} ${name}`);
    if (process.env.SHOTS) await p.waitForTimeout(700).then(() => p.screenshot({ path: `${out}/step-${String(n).padStart(2, '0')}.png` }));
  } catch (e) {
    failed++;
    console.log(`FAIL ${String(n).padStart(2)} ${name}: ${String(e.message ?? e).split('\n')[0]}`);
    await p.screenshot({ path: `${out}/fail-${n}.png` }).catch(() => {});
  }
}
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
const expectVisible = async (loc, what, timeout = 8000) => {
  await loc.waitFor({ state: 'visible', timeout }).catch(() => {
    throw new Error(`${what} not visible`);
  });
};
async function drag(x0, y0, x1, y1, steps = 30, ms = 28) {
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await p.waitForTimeout(ms);
  }
  await p.mouse.up();
  await p.waitForTimeout(150);
}

await fetch(`${base}/__harness/reset`, { method: 'POST' });

await step('Loading screen shows, then hands over', async () => {
  await p.goto(`${base}/studio.html?user=e2e`);
  await expectVisible(p.locator('#boot'), 'inline loader', 3000);
  await p.locator('#boot').waitFor({ state: 'detached', timeout: 15000 });
});
await step('Welcome page with kiln and today’s commission', async () => {
  await expectVisible(p.locator('.welcome .kh'), 'kiln');
  await expectVisible(p.locator('.welcome__today'), 'commission card');
});
await step('Open the kiln gives the starter pot', async () => {
  await btn('Open the kiln').click();
  await expectVisible(p.getByText('Still warm from the'), 'opened headline');
  await expectVisible(p.locator('.kh__pot img, .kh__pot svg'), 'starter pot', 10000);
});
await step('Start the tutorial: narrated steps', async () => {
  await btn('Start the tutorial').click();
  await expectVisible(p.locator('.tour__card'), 'tour card');
  await p.waitForTimeout(1500);
  await btn('Next', true).click();
  await expectVisible(p.locator('.tour__title', { hasText: 'Hands, Push and Thin' }), 'tour step 2');
});
await step('Skip tutorial lands on today’s commission, with no menu bar yet', async () => {
  await btn('Skip tutorial').click();
  await p.locator('.tour').waitFor({ state: 'detached' });
  await expectVisible(p.locator('.throw__canvas'), 'wheel canvas');
  await expectVisible(p.locator('.throw__beat-label', { hasText: 'Beat' }), 'daily score to beat');
});

const box = await p.locator('.throw__canvas').boundingBox();
const cx = box.x + box.width / 2;
await step('Daily: open, the first-throw hint, four pulls', async () => {
  const skip = p.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await btn('Open', true).click();
  await p.waitForTimeout(2200);
  const guide = p.locator('.throw__coach, .pn-hint__bubble').first();
  await expectVisible(guide, 'coach or first-throw hint');
  console.log(`      guide: "${(await guide.textContent()).trim().slice(0, 90)}"`);
  for (let k = 0; k < 4; k++) await drag(cx + 62, 560, cx + 58, 400, 40, 30);
});
await step('Done scores the throw; the first run offers only Paint and fire', async () => {
  await btn('Done').click();
  await expectVisible(p.locator('.pn-score, .score, [class*=score]').first(), 'score', 10000);
  await expectVisible(btn('Paint it and fire it'), 'paint button');
  if (await btn('Put on show').count()) throw new Error('show button visible during the first run');
  if (await p.locator('.pn-bottomnav').count()) throw new Error('menu bar visible during the first run');
});
await step('Decorate: paint a band, surprise me, undo', async () => {
  await btn('Paint it and fire it').click();
  await expectVisible(p.locator('.deco__canvas'), 'painting table');
  await p.waitForTimeout(1200);
  const c = await p.locator('.deco__canvas').boundingBox();
  await p.getByRole('radio', { name: 'Indigo' }).click();
  await p.mouse.click(c.x + c.width / 2, c.y + c.height * 0.55);
  await btn('Surprise me').click();
  await btn('Undo').click();
  if (await btn('Undo').isDisabled()) throw new Error('band was not painted (nothing to undo)');
});
await step('Fire it: straight into the kiln (no glaze step)', async () => {
  await btn('Fire it in the kiln').click();
  await expectVisible(p.getByText('Waiting for the fire'), 'waiting list', 8000);
  await expectVisible(p.locator('.kiln__hero'), 'kiln countdown');
  await expectVisible(p.locator('.kiln__heroInfo', { hasText: 'test firing' }), 'first pot gets a quick test firing');
});
await step('Next day: the first pot opens and the studio opens up', async () => {
  await fetch(`${base}/__harness/advance-day`, { method: 'POST' });
  await p.reload();
  await p.locator('#boot').waitFor({ state: 'detached', timeout: 15000 });
  if (!(await p.locator('.kiln').count())) await btn('Studio').click();
  await btn('Open', true).click();
  await btn('Open the kiln').click();
  await expectVisible(p.locator('.reveal__result'), 'reveal result', 6000);
  await expectVisible(p.locator('.unlock'), 'the studio-is-open panel', 6000);
  await expectVisible(p.locator('.pn-bottomnav__badge', { hasText: 'New' }).first(), 'New badges on the menu bar');
  console.log(`      reveal: ${(await p.locator('.reveal__result').textContent()).replace(/\s+/g, ' ').slice(0, 120)}`);
});
await step('Put the fired pot on show', async () => {
  const show = btn('Put on show');
  if (await show.count()) {
    await show.click();
    await expectVisible(btn('On show'), 'on show', 5000);
  } else console.log('      (pot cracked: showing a level pot instead)');
});
await step('Studio: My pots and Codex', async () => {
  await btn('Back to the kiln').click();
  await p.getByRole('tab', { name: 'My pots' }).click();
  await expectVisible(p.locator('.mypot').first(), 'my pot');
  const n = await p.locator('.mypot').count();
  console.log(`      my pots: ${n}`);
  if (!(await p.locator('.mypot.is-onshow').count())) await p.locator('.mypot').first().getByRole('button', { name: 'Put on show' }).click();
  await p.getByRole('tab', { name: 'Codex' }).click();
  await expectVisible(p.locator('.codex__grid'), 'codex grid');
  await p.locator('.codex__item:not(.is-found)').first().click();
  await expectVisible(p.locator('.codex__detail.is-locked'), 'codex hint');
});
await step('Levels: play level 1, the coach asks for a pull', async () => {
  await p.getByRole('button', { name: 'Levels' }).first().click();
  await btn('Play level 1').click();
  await expectVisible(p.getByText('Level 1 of 100'), 'level 1 header');
  await p.waitForTimeout(800);
  const skip = p.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await btn('Open', true).click();
  await p.waitForTimeout(2200);
  await expectVisible(p.locator('.throw__coach, .pn-hint__bubble').first(), 'coach');
});
await step('Four pulls raise the pot', async () => {
  for (let k = 0; k < 4; k++) await drag(cx + 62, 560, cx + 58, 400, 40, 30);
  await p.getByRole('button', { name: 'Show measurements' }).click();
  const h = await p.locator('.gauge', { hasText: 'Height' }).locator('.gauge__value').textContent();
  if (parseInt(h) < 90) throw new Error(`height only ${h}`);
});
await step('Coach gives a shaping tip', async () => {
  await p.waitForTimeout(400);
  const t = await p.locator('.throw__coach').textContent();
  if (!t || t.length < 10) throw new Error('no coach text');
  console.log(`      coach: "${t.trim()}"`);
});
await step('Over-thinning collapses: card with Undo / Start again', async () => {
  await p.locator('[data-tour=water]').click(); // wet clay thins (and collapses) faster
  await p.locator('[data-tour=tool-thin]').click();
  for (let k = 0; k < 22 && !(await p.locator('.throw__alert--slump').count()); k++) await drag(cx + 52, 540, cx + 50, 380, 24, 20);
  await expectVisible(p.locator('.throw__alert--slump'), 'collapse card', 10000);
  await expectVisible(p.locator('.throw__alert-btn', { hasText: 'Undo' }), 'Undo button');
  await expectVisible(p.locator('.throw__alert-btn', { hasText: 'Start again' }), 'Start again button');
  const r = await p.locator('.throw__alert').boundingBox();
  if (r.y > 400) throw new Error(`card sits over the clay at y=${Math.round(r.y)}`);
});
await step('Undo from the card restores the pot', async () => {
  await p.locator('.throw__alert-btn', { hasText: 'Undo' }).click({ timeout: 5000 });
  await p.waitForTimeout(500);
  if (await p.locator('.throw__alert--slump').count()) throw new Error('still collapsed after undo');
  await p.locator('[data-tour=tool-hands]').click();
});
await step('Clear level 1: result, next box unsealed', async () => {
  await p.reload();
  await p.locator('#boot').waitFor({ state: 'detached', timeout: 15000 });
  await expectVisible(p.locator('.lv__grid'), 'level map after reload');
  await btn('Play level 1').click();
  await p.waitForTimeout(800);
  await btn('Open', true).click();
  await p.waitForTimeout(1500);
  for (let k = 0; k < 2; k++) await drag(cx + 62, 560, cx + 58, 400, 40, 30);
  await btn('Done').click();
  await expectVisible(p.locator('.lvr'), 'level result', 10000);
  const h = (await p.locator('.lvr .pn-headline').textContent()).trim();
  console.log(`      level 1: ${h}`);
  if (!/cleared/i.test(h)) throw new Error(`level 1 not cleared (${h})`);
  await expectVisible(p.locator('.lvr__unlock'), 'unsealed card', 6000);
});
await step('Level map: level 2 to play, the rest sealed', async () => {
  await p.getByRole('button', { name: 'Levels' }).first().click();
  await expectVisible(p.locator('.lv__tile.is-cleared[data-level="1"]'), 'cleared level 1');
  await expectVisible(p.locator('.lv__tile.is-current[data-level="2"]'), 'level 2 to play');
  const sealed = await p.locator('.lv__tile.is-locked').count();
  if (sealed !== 98) throw new Error(`${sealed} sealed boxes, expected 98`);
  const w = await p.locator('.lv__tiles').first().evaluate((el) => el.scrollWidth - el.clientWidth);
  if (w > 1) throw new Error(`level grid overflows by ${w}px`);
});
await step('Showcase: another player rates and likes it', async () => {
  const q = await b.newPage({ viewport: { width: 390, height: 844 } });
  q.on('pageerror', (e) => errors.push(`bob pageerror: ${e.message}`));
  await q.goto(`${base}/studio.html?user=bob`);
  await q.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
  const openKiln = q.getByRole('button', { name: 'Open the kiln' });
  if (await openKiln.count()) {
    await openKiln.click();
    await q.getByRole('button', { name: 'Skip, throw today’s pot' }).click({ timeout: 8000 });
    await q.waitForTimeout(800);
  }
  // Bob is on his first run (no menu bar): open the whole studio from the More menu.
  const leave = q.getByRole('button', { name: /Back to the level map|Leave the wheel/ });
  if (await leave.count()) await leave.click();
  await q.getByRole('button', { name: 'More' }).click();
  await q.getByRole('button', { name: 'Show the whole studio' }).click();
  await q.getByRole('button', { name: 'Showcase' }).first().click();
  await q.locator('.show__card').first().waitFor({ timeout: 8000 });
  await q.locator('.show__card').first().getByRole('radio', { name: '4 stars' }).click();
  await q.waitForTimeout(600);
  const score = (await q.locator('.show__card').first().locator('.show__score').textContent()).trim();
  if (!/4\.0/.test(score)) throw new Error(`rating not shown (${score})`);
  const like = q.locator('.show__like').first();
  const before = await like.textContent();
  await like.click();
  await q.waitForTimeout(600);
  if (before === (await like.textContent())) throw new Error('like did not change');
  await q.getByRole('tab', { name: 'Top rated' }).click();
  await q.locator('.show__card').first().waitFor({ timeout: 5000 });
  if (process.env.SHOTS) await q.waitForTimeout(1200).then(() => q.screenshot({ path: `${out}/showcase.png` }));
  await q.close();
});
await step('More menu: leaderboard', async () => {
  await p.getByRole('button', { name: 'More' }).click();
  await btn('Today’s leaderboard').or(btn("Today's leaderboard")).first().click();
  await expectVisible(p.locator('main'), 'leaderboard');
  await p.waitForTimeout(500);
});

console.log(errors.length ? `\nErrors seen:\n  ${[...new Set(errors)].join('\n  ')}` : '\nNo page, console or API errors.');
console.log(`\n${n - failed}/${n} steps passed.`);
await b.close();
process.exit(failed ? 1 : 0);
