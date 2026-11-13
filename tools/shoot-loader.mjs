// Screenshots of the loading animation at several moments (the app script is blocked so it stays up).
//   node tools/shoot-loader.mjs [baseUrl]
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';
const base = process.argv[2] ?? 'http://127.0.0.1:5173';
const out = '.paanai/loader';
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 } });
p.on('pageerror', (e) => console.log('pageerror:', e.message));
await p.route(/studio\/main\.tsx|assets\/studio.*\.js/, (r) => r.abort());
await p.goto(`${base}/studio.html`);
const t0 = Date.now();
for (const t of [0.6, 1.6, 2.5, 3.6, 4.6, 5.6, 7.2]) {
  await p.waitForTimeout(Math.max(0, t * 1000 - (Date.now() - t0)));
  await p.screenshot({ path: `${out}/t${String(t).replace('.', '_')}.png` });
}
await b.close();
console.log('done');
