// Runs the guided tour from a fresh welcome screen and screenshots it at key steps.
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const B = 'http://127.0.0.1:5173';
mkdirSync('.paanai/tour', { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
await fetch(`${B}/__harness/reset`, { method: 'POST' });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
p.on('pageerror', (e) => console.log('pageerror', e.message));
await p.goto(`${B}/studio.html?user=tour1`);
await p.waitForSelector('.welcome');
await p.click('text=How to play');
const want = new Set((process.argv[2] ?? '2,7,10,12,15,17').split(',').map(Number));
const seen = new Set();
const t0 = Date.now();
while (Date.now() - t0 < 260000 && seen.size < want.size) {
  const n = await p.evaluate(() => Number(document.querySelector('.tour__count')?.textContent?.split('/')[0]?.trim() ?? 0));
  if (want.has(n) && !seen.has(n)) {
    seen.add(n);
    await p.waitForTimeout(n === 10 ? 3800 : n === 7 ? 2600 : 1600);
    await p.screenshot({ path: `.paanai/tour/step-${n}.png` });
    console.log('shot', n, Math.round((Date.now() - t0) / 1000) + 's');
  }
  await p.waitForTimeout(200);
}
console.log(await p.evaluate(() => document.querySelector('.throw__gauges')?.textContent));
await b.close();
