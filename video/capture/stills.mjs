// High-resolution stills (DPR 2.5) of the four core steps, for the "How to play" post.
// Run after seed.mjs. Writes brand/howto/*.png; extra shots (0-welcome, 1b-score, 6-codex, 7-levels) feed the README.
// Then: python video/capture/readme_media.py
import { chromium } from 'playwright';
import { mkdirSync } from 'node:fs';

const base = 'http://127.0.0.1:5174';
const OUT = 'D:/Projects/2-In-Progress/paanai/brand/howto';
mkdirSync(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5 });
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
const snap = async (name) => { await p.screenshot({ path: `${OUT}/${name}.png`, timeout: 60000 }); console.log('still', name); };

await p.goto(`${base}/studio.html?user=nila`);
await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
await p.waitForTimeout(2500);
await snap('0-welcome');
await btn('Open the kiln').click();
await btn('Skip, throw today’s pot').click();
await p.locator('.throw__canvas').waitFor();
await p.waitForTimeout(1500);
const skip = p.getByRole('button', { name: 'Skip', exact: true });
if (await skip.count()) await skip.click();
await p.waitForTimeout(500);
await p.evaluate(() => window.__paanaiVideo.playMaster());
await p.locator('.is-ready').first().waitFor({ timeout: 40000 });
await p.waitForTimeout(1200);
await snap('1-shape');

await btn('Done').click();
await p.waitForTimeout(3500);
await snap('1b-score');
await btn('Paint it and fire it').click();
await p.locator('.deco__canvas').waitFor();
await p.waitForTimeout(1500);
const c = await p.locator('.deco__canvas').boundingBox();
const cx = c.x + c.width / 2;
await p.getByRole('radio', { name: 'Indigo' }).click();
await p.mouse.click(cx, c.y + c.height * 0.56);
await p.waitForTimeout(500);
await p.getByRole('radio', { name: 'Gold' }).click();
await p.mouse.click(cx, c.y + c.height * 0.47);
await p.waitForTimeout(500);
await p.getByRole('tab', { name: 'Patterns' }).click();
await p.getByRole('radio', { name: 'Leaves' }).click();
await p.getByRole('radio', { name: 'Chalk white' }).click();
await p.mouse.click(cx, c.y + c.height * 0.66);
await p.waitForTimeout(500);
await p.getByRole('tab', { name: 'Rim' }).click();
await p.getByRole('radio', { name: 'Kumkum red' }).click();
await p.waitForTimeout(1500);
await snap('2-paint');

await btn('Fire it in the kiln').click();
await p.locator('.kiln__hero').waitFor();
await p.waitForTimeout(6500); // mid test firing: the temperature is climbing
await snap('3-fire');

await p.locator('.kiln__ready').first().waitFor({ timeout: 30000 });
await p.waitForTimeout(1000);
await p.locator('.kiln__ready').getByRole('button', { name: 'Open' }).click();
await p.waitForTimeout(1200);
await btn('Open the kiln').click();
await p.waitForTimeout(4500);
await snap('4-open');
await btn('Put on show').click().catch(() => {});
await p.locator('.unlock__item', { hasText: 'Showcase' }).click();
await p.locator('.show__card').first().waitFor();
await p.getByRole('tab', { name: 'Top rated' }).click();
await p.waitForTimeout(2500);
await snap('5-showcase');

await p.getByRole('button', { name: 'Studio' }).last().click();
await p.waitForTimeout(800);
await p.getByRole('tab', { name: 'Codex' }).click();
await p.waitForTimeout(2000);
await snap('6-codex');
await p.getByRole('button', { name: 'Levels' }).last().click();
await p.waitForTimeout(3000);
await snap('7-levels');
await b.close();
