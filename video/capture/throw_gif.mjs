// Frames for the README GIF: a new player pulls up the wall of today's pot on the wheel.
// Harness on :5174. Writes video/footage/gif/f###.png; then `python video/capture/readme_media.py` builds docs/media/throw.gif.
import { chromium } from 'playwright';
import { mkdirSync, rmSync } from 'node:fs';

const base = 'http://127.0.0.1:5174';
const out = 'D:/Projects/2-In-Progress/paanai/video/footage/gif';
rmSync(out, { recursive: true, force: true });
mkdirSync(out, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
await p.goto(`${base}/studio.html?user=gifmaker`);
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await btn('Open the kiln').click();
await btn('Skip, throw today’s pot').click();
await p.locator('.throw__canvas').waitFor();
await p.waitForTimeout(1200);
const skip = p.getByRole('button', { name: 'Skip', exact: true });
if (await skip.count()) await skip.click();
const box = await p.locator('.throw__canvas').boundingBox();
const cx = box.x + box.width / 2;
let n = 0;
const snap = async () => {
  await p.screenshot({ path: `${out}/f${String(n++).padStart(3, '0')}.png` });
};
await btn('Open', true).click();
for (let i = 0; i < 10; i++) {
  await snap();
  await p.waitForTimeout(150);
}
const got = p.getByRole('button', { name: 'Got it' });
if (await got.count()) await got.first().click().catch(() => {});
for (let k = 0; k < 4; k++) {
  await p.mouse.move(cx + 62, 560);
  await p.mouse.down();
  for (let i = 1; i <= 24; i++) {
    await p.mouse.move(cx + 62 - (4 * i) / 24, 560 - (160 * i) / 24);
    await p.waitForTimeout(30);
    if (i % 2 === 0) await snap();
  }
  await p.mouse.up();
  for (let i = 0; i < 3; i++) {
    await snap();
    await p.waitForTimeout(80);
  }
}
for (let i = 0; i < 12; i++) {
  await snap();
  await p.waitForTimeout(150);
}
console.log('gif frames', n);
await b.close();
