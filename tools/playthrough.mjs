// Click through the studio in the local harness and screenshot each screen.
// Usage: node tools/playthrough.mjs [outDir]   (npm run harness must be running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const out = process.argv[2] ?? '.paanai/play';
mkdirSync(out, { recursive: true });
const base = 'http://127.0.0.1:5173';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
p.on('console', (m) => m.type() === 'error' && console.log('console:', m.text().slice(0, 200)));
const shot = async (n) => { await p.waitForTimeout(700); await p.screenshot({ path: `${out}/${n}.png` }); console.log('shot', n); };
const click = async (name) => { await p.getByRole('button', { name }).first().click(); };
await p.request.post(`${base}/__harness/reset`).catch(() => {});
await p.goto(`${base}/studio.html?user=alice`);
await p.waitForTimeout(1500);
await shot('01-welcome');
await click('Open the kiln'); await shot('02-starter');
await click('How to play'); await shot('03-howto');
await click('Next'); await click('Next'); await click('Next'); await click('Start throwing');
await p.waitForTimeout(1500); await shot('04-throw');
// Scripted throw on the canvas.
await click('Open'); await p.waitForTimeout(800);
await p.getByRole('button', { name: /Show the commissioner/ }).click().catch(() => console.log('no ghost button'));
const box = await p.locator('.throw__canvas').boundingBox();
const cx = box.x + box.width / 2;
for (let k = 0; k < 4; k++) {
  await p.mouse.move(cx + 62, 560); await p.mouse.down();
  for (let i = 1; i <= 40; i++) { await p.mouse.move(cx + 58, 560 - i * 4); await p.waitForTimeout(30); }
  await p.mouse.up(); await p.waitForTimeout(200);
}
await shot('05-thrown');
await click('Done'); await p.waitForTimeout(1500); await shot('06-result');
await click('Glaze and fire it'); await shot('07-glaze');
await p.getByRole('button', { name: /Copper/ }).click(); await p.getByRole('button', { name: /Iron/ }).click();
await click('Place in the kiln'); await p.waitForTimeout(1200); await shot('08-kiln');
await p.request.post(`${base}/__harness/advance-day`).catch(() => {});
await p.reload(); await p.waitForTimeout(2000); await shot('09-kiln-ready');
const open = p.getByRole('button', { name: 'Open', exact: true });
if (await open.count()) { await open.first().click(); await click('Open the kiln'); await p.waitForTimeout(2600); await shot('10-reveal'); }
await p.goto(`${base}/studio.html?user=alice`); await p.waitForTimeout(1500);
await p.getByRole('button', { name: 'Codex' }).click(); await shot('11-codex');
await p.getByRole('button', { name: 'Shelf' }).click(); await shot('12-shelf');
await b.close();
