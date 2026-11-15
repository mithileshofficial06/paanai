// Plays the new-player path: welcome -> tutorial (4 narrated steps) -> today's pot -> whole studio
// -> level 1 -> throw -> level result -> level map. Screenshots each stage.
//   node tools/shoot-levels.mjs [baseUrl]     (a harness must be running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = '.paanai/levels';
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

await fetch(`${base}/__harness/reset`, { method: 'POST' });
await p.goto(`${base}/studio.html?user=lvtest`);
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await btn('Open the kiln').click();
await p.waitForTimeout(2500);
await btn('Start the tutorial').click();
await p.waitForTimeout(3000);
await shot('01-tutorial-step1');
for (let k = 0; k < 3; k++) {
  await btn('Next', true).click();
  await p.waitForTimeout(1200);
}
await shot('02-tutorial-step4');
await btn('Start playing').click();
await p.waitForTimeout(2000);
await shot('03-after-tutorial-daily');
// A first-time player lands on today's pot with no menu bar: open the whole studio, then level 1.
const leave = p.getByRole('button', { name: /Back to the level map|Leave the wheel/ });
if (await leave.count()) await leave.click();
await p.getByRole('button', { name: 'More' }).click();
await p.getByRole('button', { name: 'Show the whole studio' }).click();
await p.getByRole('button', { name: 'Levels' }).last().click();
await btn('Play level 1').click();
await p.waitForTimeout(2000);
await shot('06-level1-wheel');
const box = await p.locator('.throw__canvas').boundingBox();
const cx = box.x + box.width / 2;

await p.locator('[data-tour=open]').click();
await p.waitForTimeout(1800);
for (let k = 0; k < 2; k++) await drag(cx + 62, 560, cx + 58, 400, 40, 30);
const match = await p.locator('.matchbar__num').textContent();
console.log('level 1 match before Done:', match);
await p.locator('[data-tour=done]').click();
await p.waitForTimeout(3200);
await shot('07-level1-result');
console.log('result:', (await p.locator('.lvr .pn-headline').textContent())?.trim());

await p.getByRole('button', { name: 'Levels' }).first().click();
await p.waitForTimeout(2500);
await shot('08-level-map');
await p.mouse.wheel(0, 700);
await p.waitForTimeout(1800);
await shot('09-level-map-sealed');
await p.locator('.lv__tile.is-locked').nth(3).click();
await p.waitForTimeout(200);
await shot('10-locked-tap');
await b.close();
