// Screenshots of the landing page (closed and opened kiln) at desktop and phone sizes.
import { chromium } from 'playwright';
const B = 'http://127.0.0.1:5173';
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
for (const [name, vp] of [['desk', { width: 1440, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
  await fetch(`${B}/__harness/reset`, { method: 'POST' });
  const p = await b.newPage({ viewport: vp, deviceScaleFactor: name === 'phone' ? 2 : 1 });
  await p.goto(`${B}/studio.html?user=land${name}`);
  await p.waitForSelector('.welcome');
  await p.waitForTimeout(1500);
  await p.screenshot({ path: `.paanai/land/${name}-closed.png` });
  await p.click('text=Open the kiln');
  await p.waitForTimeout(700);
  await p.screenshot({ path: `.paanai/land/${name}-opening.png` });
  await p.waitForTimeout(4000);
  await p.screenshot({ path: `.paanai/land/${name}-open.png` });
  await p.close();
}
await b.close();
