// Screenshot the throw lab after a scripted throw (GPU Chromium, 1x scale).
// Usage: node tools/shoot.mjs [outDir] [baseUrl]   (npm run harness must be running)
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const out = process.argv[2] ?? '.paanai/shots';
const base = process.argv[3] ?? 'http://127.0.0.1:5173';
mkdirSync(out, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const page = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1 });
page.on('console', (m) => m.type() === 'error' && console.log('console:', m.text()));
page.on('pageerror', (e) => console.log('pageerror:', e.message));
await page.goto(`${base}/dev/throw-lab.html?target=moon-jar`);
await page.waitForTimeout(1500);
const frame = () => page.evaluate(() => window.stage.getScreenFrame());
await page.screenshot({ path: `${out}/1-centering.png` });

// Hold to centre.
let f = await frame();
await page.mouse.move(f.axisX, (f.baseY + f.rimY) / 2);
await page.mouse.down();
await page.waitForTimeout(1600);
await page.mouse.up();
await page.waitForTimeout(300);

// Tap the top to open.
f = await frame();
await page.mouse.click(f.axisX, f.topY + 4);
await page.waitForTimeout(900);
await page.screenshot({ path: `${out}/2-opened.png` });

// Four pulls: drag upward along the right wall, slowly.
for (let k = 0; k < 4; k++) {
  f = await frame();
  const x = f.axisX + f.maxRadiusPx * 0.95;
  await page.mouse.move(x, f.baseY - 4);
  await page.mouse.down();
  const steps = 40;
  for (let i = 1; i <= steps; i++) {
    const g = await frame();
    await page.mouse.move(x, f.baseY - 4 - ((f.baseY - g.rimY + 6) * i) / steps);
    await page.waitForTimeout(35);
    if (k === 3 && i === 24) await page.screenshot({ path: `${out}/3-pulling.png` });
  }
  await page.mouse.up();
  await page.waitForTimeout(250);
}
// Belly out a little, then collar the neck in.
f = await frame();
const mid = f.baseY - (f.baseY - f.rimY) * 0.45;
await page.mouse.move(f.axisX + f.maxRadiusPx, mid);
await page.mouse.down();
for (let i = 1; i <= 12; i++) {
  await page.mouse.move(f.axisX + f.maxRadiusPx + i * 3, mid);
  await page.waitForTimeout(35);
}
await page.mouse.up();
await page.waitForTimeout(1000);
await page.screenshot({ path: `${out}/4-shaped.png` });
console.log(await page.evaluate(() => document.getElementById("hud").textContent));
console.log(await page.evaluate(() => { const l = window.stage.finish(); const s = []; let cur = null; for (const e of l.entries) { if (e.start) { cur = { mode: e.mode, n: 0, sum: 0, max: 0, rings: [99, 0] }; s.push(cur); } if (!cur) continue; cur.n++; cur.sum += e.dr; cur.max = Math.max(cur.max, e.dr); cur.rings = [Math.min(cur.rings[0], e.ring), Math.max(cur.rings[1], e.ring)]; } return JSON.stringify(s); }));
await browser.close();
