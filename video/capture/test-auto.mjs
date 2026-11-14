// Quick check: fresh player -> today's pot -> play the Master's throw -> Done. Records the screen.
import { chromium } from 'playwright';
import { recorder } from './rec.mjs';
const base = 'http://127.0.0.1:5174';
const OUT = 'D:/Projects/2-In-Progress/paanai/video/footage/test';
await fetch(`${base}/__harness/reset`, { method: 'POST' });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5 });
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
await p.goto(`${base}/studio.html?user=mira`);
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await btn('Open the kiln').click();
await btn('Skip, throw today’s pot').click();
await p.locator('.throw__canvas').waitFor();
await p.waitForTimeout(1500);
const rec = await recorder(p, OUT);
await rec.start();
const skip = p.getByRole('button', { name: 'Skip', exact: true });
if (await skip.count()) await skip.click();
await p.waitForTimeout(600);
console.log('play', await p.evaluate(() => window.__paanaiVideo.playMaster()));
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(500);
  const m = await p.locator('.throw__beat, .throw__match, [class*=match]').first().textContent().catch(() => '');
  if (i % 4 === 0) console.log(i / 2, 's', (m || '').replace(/\s+/g, ' ').slice(0, 60));
}
console.log(await rec.stop());
await p.screenshot({ path: `${OUT}/end.png` });
await btn('Done').click();
await p.waitForTimeout(2500);
await p.screenshot({ path: `${OUT}/score.png` });
await b.close();
