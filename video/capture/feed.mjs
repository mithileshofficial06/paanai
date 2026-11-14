// Record the real Reddit feed at phone size: the Paanai post animating, then a tap that opens the game.
import { chromium } from 'playwright';
import { recorder } from './rec.mjs';

const b = await chromium.connectOverCDP('http://127.0.0.1:9333');
const ctx = b.contexts()[0];
const p = await ctx.newPage();
await p.setViewportSize({ width: 430, height: 932 });
const cdp = await ctx.newCDPSession(p);
await cdp.send('Emulation.setDeviceMetricsOverride', { width: 430, height: 932, deviceScaleFactor: 2.5, mobile: true });
await cdp.send('Emulation.setTouchEmulationEnabled', { enabled: true });
await p.goto('https://www.reddit.com/r/paanai_game_dev/?playtest=paanai-game', { waitUntil: 'domcontentloaded' });
for (let i = 0; i < 40 && !p.frames().some((f) => f.url().includes('splash.html')); i++) await p.waitForTimeout(500);
const sp = p.frames().find((f) => f.url().includes('splash.html'));
await sp.locator('#throw').waitFor({ state: 'visible', timeout: 20000 });
// Bring the post into view.
const post = p.locator('shreddit-post').first();
await post.scrollIntoViewIfNeeded();
await p.mouse.wheel(0, 120);
await p.waitForTimeout(2500);
const rec = await recorder(p, 'D:/Projects/2-In-Progress/paanai/video/footage/c00_feed');
await rec.start();
await p.waitForTimeout(11500);
const bb = await sp.locator('#throw').boundingBox();
const fb = await p.locator('shreddit-post').first().boundingBox();
console.log('button', JSON.stringify(bb), 'post', JSON.stringify(fb));
const btn = await p.frameLocator('iframe').first().locator('#throw').boundingBox().catch(() => null);
const box = btn ?? bb;
rec.touch('tap', box.x + box.width / 2, box.y + box.height / 2);
await p.waitForTimeout(400);
await sp.locator('#throw').click();
await p.waitForTimeout(6000);
console.log(await rec.stop());
await p.screenshot({ path: 'D:/Projects/2-In-Progress/paanai/video/footage/c00_end.png' });
await p.close();
await b.close().catch(() => {});
