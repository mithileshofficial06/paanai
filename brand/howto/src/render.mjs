// Renders the "How to play" gallery slides (1080x1350) from slide-*.html into brand/howto/slide-*.png.
// The slides use brand/howto/1-shape.png ... 5-showcase.png (made by video/capture/stills.mjs).
import { chromium } from 'playwright';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, join } from 'node:path';
const here = dirname(fileURLToPath(import.meta.url));
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1080, height: 1350 } });
for (const i of process.argv.slice(2).length ? process.argv.slice(2) : ['0', '1', '2', '3', '4', '5']) {
  await p.goto(pathToFileURL(join(here, `slide-${i}.html`)).href);
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(300);
  await p.screenshot({ path: join(here, '..', `slide-${i}.png`) });
  console.log('slide', i);
}
await b.close();
