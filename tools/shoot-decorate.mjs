// Decorating, end to end: paint a level pot by hand, then a daily pot with "Surprise me",
// glaze it, fire it overnight and open the kiln. Screenshots each stage.
//   node tools/shoot-decorate.mjs [baseUrl]     (a harness must be running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = '.paanai/decorate';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
p.on('console', (m) => m.type() === 'error' && !/404|telemetry/.test(m.text()) && console.log('console:', m.text().slice(0, 200)));
const shot = async (name) => {
  await p.screenshot({ path: `${out}/${name}.png` });
  console.log('shot', name);
};
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
async function drag(x0, y0, x1, y1, steps = 30, ms = 28) {
  await p.mouse.move(x0, y0);
  await p.mouse.down();
  for (let i = 1; i <= steps; i++) {
    await p.mouse.move(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps);
    await p.waitForTimeout(ms);
  }
  await p.mouse.up();
  await p.waitForTimeout(200);
}
async function throwPot() {
  const skip = p.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await p.locator('[data-tour=open]').click();
  await p.waitForTimeout(1800);
  const box = await p.locator('.throw__canvas').boundingBox();
  const cx = box.x + box.width / 2;
  for (let k = 0; k < 2; k++) await drag(cx + 62, 560, cx + 58, 400, 40, 30);
  await p.locator('[data-tour=done]').click();
}
async function tapPot(frac) {
  const c = await p.locator('.deco__canvas').boundingBox();
  // The pot sits roughly in the middle 60% of the canvas height.
  await p.mouse.click(c.x + c.width / 2, c.y + c.height * (0.78 - frac * 0.52));
  await p.waitForTimeout(250);
}

await fetch(`${base}/__harness/reset`, { method: 'POST' });
await p.goto(`${base}/studio.html?user=painter`);
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await btn('Open the kiln').click();
await p.waitForTimeout(2500);
await btn('Skip to level 1').click();
await p.waitForTimeout(1500);

// ---- a level pot, painted by hand ----
await throwPot();
await p.locator('.lvr').waitFor({ timeout: 10000 });
await p.waitForTimeout(2500);
await btn('Decorate it').click();
await p.waitForTimeout(1500);
await shot('01-table-empty');
await p.getByRole('radio', { name: 'Indigo' }).click();
await tapPot(0.25);
await tapPot(0.8);
await p.getByRole('tab', { name: 'Patterns' }).click();
await p.getByRole('radio', { name: 'Flowers' }).click();
await p.getByRole('radio', { name: 'Kumkum red' }).click();
await tapPot(0.52);
await p.getByRole('tab', { name: 'Rim' }).click();
await p.getByRole('radio', { name: 'Gold' }).click();
await p.getByRole('tab', { name: 'Body' }).click();
await p.getByRole('radio', { name: 'Chalk white' }).click();
await p.waitForTimeout(1200);
await shot('02-table-painted');
await btn('Done painting').click();
await p.waitForTimeout(2500);
await shot('03-level-result-painted');

// ---- a daily pot: surprise paint, glaze, fire ----
await btn('Daily').click();
await p.waitForTimeout(1200);
await throwPot();
await p.locator('.result').waitFor({ timeout: 10000 });
await p.waitForTimeout(2200);
await btn('Decorate and fire it').click();
await p.waitForTimeout(1200);
await btn('Surprise me').click();
await p.waitForTimeout(1200);
await shot('04-daily-surprise');
await btn('Next: glaze and fire').click();
await p.waitForTimeout(800);
await p.getByRole('button', { name: /Clear/ }).first().click();
await p.waitForTimeout(1500);
await shot('05-glaze-with-paint');
await btn('Place in the kiln').click();
await p.waitForTimeout(1500);
await fetch(`${base}/__harness/advance-day`, { method: 'POST' });
await p.reload();
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
if (!(await p.locator('.kiln').count())) await btn('Kiln').click();
await btn('Open', true).click();
await btn('Open the kiln').click();
await p.waitForTimeout(3500);
await shot('06-kiln-reveal-painted');
await b.close();
