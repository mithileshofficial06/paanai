// Capture the demo footage from the local harness (run seed.mjs first). A fresh player, "mira",
// plays the whole loop; each moment is recorded to its own folder of frames with a tap log.
// Usage: node shoot.mjs [onlyClip]
import { chromium } from 'playwright';
import { recorder } from './rec.mjs';

const base = 'http://127.0.0.1:5174';
const ROOT = 'D:/Projects/2-In-Progress/paanai/video/footage';
const only = process.argv[2];
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const p = await b.newPage({ viewport: { width: 430, height: 932 }, deviceScaleFactor: 2.5 });
p.on('pageerror', (e) => console.log('pageerror', e.message));
const btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
const wait = (ms) => p.waitForTimeout(ms);

let rec = null;
async function clip(name, fn) {
  rec = await recorder(p, `${ROOT}/${name}`);
  await rec.start();
  await wait(250);
  try {
    await fn();
  } catch (e) {
    console.log(`  ${name} failed: ${String(e.message).split('\n')[0]}`);
  }
  const r = await rec.stop();
  console.log(`${name}: ${r.frames} frames, ${r.seconds.toFixed(1)} s`);
  rec = null;
}
/** Tap a locator like a finger: log the touch for the edit, then click. */
async function tap(loc, pause = 350) {
  await loc.waitFor({ state: 'visible', timeout: 15000 });
  const bb = await loc.boundingBox();
  const x = bb.x + bb.width / 2;
  const y = bb.y + bb.height / 2;
  rec?.touch('tap', x, y);
  await wait(pause);
  await p.mouse.click(x, y);
}
async function tapAt(x, y, pause = 300) {
  rec?.touch('tap', x, y);
  await wait(pause);
  await p.mouse.click(x, y);
}

await p.goto(`${base}/studio.html?user=mira`);

await clip('c01_welcome', async () => {
  await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
  await wait(2600);
  await tap(btn('Open the kiln'));
  await wait(3800);
});

await clip('c02_today', async () => {
  await tap(btn('Skip, throw today’s pot'));
  await p.locator('.throw__canvas').waitFor();
  await wait(2600);
});

await clip('c03_throw', async () => {
  const skip = p.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await tap(skip);
  await wait(500);
  rec.mark('throw-start');
  await p.evaluate(() => window.__paanaiVideo.playMaster());
  await p.locator('.is-ready').first().waitFor({ timeout: 40000 });
  rec.mark('passes');
  await wait(2200);
});

await clip('c04_score', async () => {
  await tap(btn('Done'));
  await wait(5200);
});

await clip('c05_paint', async () => {
  await tap(btn('Paint it and fire it'));
  await p.locator('.deco__canvas').waitFor();
  await wait(1400);
  const c = await p.locator('.deco__canvas').boundingBox();
  const cx = c.x + c.width / 2;
  await tap(p.getByRole('radio', { name: 'Indigo' }));
  await wait(300);
  await tapAt(cx, c.y + c.height * 0.56);
  await wait(700);
  await tap(p.getByRole('radio', { name: 'Gold' }));
  await wait(250);
  await tapAt(cx, c.y + c.height * 0.47);
  await wait(700);
  await tap(p.getByRole('tab', { name: 'Patterns' }));
  await wait(400);
  await tap(p.getByRole('radio', { name: 'Leaves' }));
  await tap(p.getByRole('radio', { name: 'Chalk white' }));
  await wait(250);
  await tapAt(cx, c.y + c.height * 0.66);
  await wait(800);
  await tap(p.getByRole('tab', { name: 'Rim' }));
  await wait(300);
  await tap(p.getByRole('radio', { name: 'Kumkum red' }));
  await wait(1600);
});

await clip('c06_fire', async () => {
  await tap(btn('Fire it in the kiln'));
  await p.locator('.kiln__hero').waitFor();
  await wait(4500);
});

// The quick test firing takes about 90 s of real time: wait without recording.
console.log('waiting for the test firing...');
await p.locator('.kiln__ready').first().waitFor({ timeout: 150000 });
await wait(1500);

await clip('c07_reveal', async () => {
  await tap(p.locator('.kiln__ready').getByRole('button', { name: 'Open' }));
  await wait(1200);
  await tap(btn('Open the kiln'));
  await wait(4200);
  const show = btn('Put on show');
  if (await show.count()) await tap(show);
  await wait(1500);
  const share = btn('Share on Reddit');
  if (await share.count()) await tap(share);
  await wait(2500);
  await p.mouse.wheel(0, 500);
  await wait(2200);
});

await clip('c08_showcase', async () => {
  await tap(p.locator('.unlock__item', { hasText: 'Showcase' }));
  await p.locator('.show__card').first().waitFor();
  await wait(1500);
  await tap(p.getByRole('tab', { name: 'Top rated' }));
  await wait(1600);
  await p.mouse.wheel(0, 260);
  await wait(900);
  const card = p.locator('.show__card').nth(3);
  await card.scrollIntoViewIfNeeded();
  await wait(500);
  await tap(card.getByRole('radio', { name: '5 stars' }));
  await wait(900);
  await tap(card.locator('.show__like'));
  await wait(1800);
});

await clip('c09_codex', async () => {
  await tap(p.getByRole('button', { name: 'Studio' }).last());
  await wait(800);
  await tap(p.getByRole('tab', { name: 'Codex' }));
  await wait(1800);
  await p.mouse.wheel(0, 380);
  await wait(1600);
});

await clip('c10_home', async () => {
  await tap(p.getByRole('button', { name: 'Home' }).last());
  await wait(2600);
  await tap(p.getByRole('button', { name: 'Levels' }).last());
  await wait(1200);
  await p.mouse.wheel(0, 700);
  await wait(1800);
});

await b.close();
