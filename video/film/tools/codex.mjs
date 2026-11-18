// Re-shoot of the Codex clip: Home -> Glaze Codex tile, then scroll.
import { chromium } from 'playwright';
import { recorder } from '../../capture/rec.mjs';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5 });
await p.goto('http://127.0.0.1:5174/studio.html?user=kofi_makes');
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await p.waitForTimeout(2500);
const home = p.getByRole('button', { name: 'Home' }).last();
if (await home.count()) await home.click();
await p.waitForTimeout(1500);
const tile = p.getByRole('button', { name: /Glaze Codex/ }).first();
await tile.scrollIntoViewIfNeeded();
await p.waitForTimeout(600);
const rec = await recorder(p, 'D:/Projects/2-In-Progress/paanai/video/footage/film/p10_codex');
await rec.start();
await p.waitForTimeout(500);
const bb = await tile.boundingBox();
rec.touch('tap', bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.waitForTimeout(350);
await p.mouse.click(bb.x + bb.width / 2, bb.y + bb.height / 2);
await p.waitForTimeout(2200);
await p.mouse.move(215, 600);
for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 45); await p.waitForTimeout(60); }
await p.waitForTimeout(1500);
for (let i = 0; i < 12; i++) { await p.mouse.wheel(0, 45); await p.waitForTimeout(60); }
await p.waitForTimeout(1800);
const r = await rec.stop();
console.log('p10_codex', r.frames, r.seconds.toFixed(1));
await p.screenshot({ path: 'D:/Projects/2-In-Progress/paanai/video/codex_check.png' });
await b.close();
