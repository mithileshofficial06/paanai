// Frame-exact capture of the 3D wheel: the page's animation clock (performance.now and
// requestAnimationFrame) is taken over, stepped 1/60 s at a time, and every step is screenshotted.
// Smooth 60 fps no matter how slow the GPU or the screenshot is.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export const VCLOCK = () => {
  const realRaf = window.requestAnimationFrame.bind(window);
  const realCaf = window.cancelAnimationFrame.bind(window);
  const realNow = performance.now.bind(performance);
  const vt = { on: false, t: 0, id: 1e6, cbs: [] };
  window.__vt = vt;
  performance.now = () => (vt.on ? vt.t : realNow());
  window.requestAnimationFrame = (cb) => {
    if (!vt.on) return realRaf(cb);
    const id = ++vt.id;
    vt.cbs.push([id, cb]);
    return id;
  };
  window.cancelAnimationFrame = (id) => {
    if (vt.on) vt.cbs = vt.cbs.filter((c) => c[0] !== id);
    else realCaf(id);
  };
  vt.start = () => {
    vt.t = realNow();
    vt.on = true;
  };
  vt.stop = () => {
    vt.on = false;
    const cbs = vt.cbs;
    vt.cbs = [];
    for (const [, cb] of cbs) realRaf(cb);
  };
  vt.step = (ms) => {
    vt.t += ms;
    const cbs = vt.cbs;
    vt.cbs = [];
    for (const [, cb] of cbs) {
      try {
        cb(vt.t);
      } catch (e) {
        console.error(e);
      }
    }
  };
};

export async function vrecorder(page, dir, fps = 60) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const frames = [];
  const touches = [];
  const vp = page.viewportSize();
  let n = 0;
  const dt = 1000 / fps;
  const r = {
    async start() {
      await page.evaluate(() => window.__vt.start());
      // let the loop hop onto the virtual clock
      await page.waitForTimeout(120);
    },
    /** Advance n frames, screenshotting each. */
    async frames(k = 1) {
      for (let i = 0; i < k; i++) {
        await page.evaluate((d) => window.__vt.step(d), dt);
        // page.screenshot honours deviceScaleFactor (CDP captureScreenshot returns CSS pixels here).
        const name = `f${String(n).padStart(5, '0')}.jpg`;
        await page.screenshot({ path: join(dir, name), type: 'jpeg', quality: 92, animations: 'allow', caret: 'initial', scale: 'device' });
        frames.push({ name, t: n / fps });
        n++;
      }
    },
    seconds(s) {
      return r.frames(Math.round(s * fps));
    },
    now: () => n / fps,
    touch(kind, x, y) {
      touches.push({ kind, x: x / vp.width, y: y / vp.height, t: n / fps });
    },
    mark(label) {
      touches.push({ kind: 'mark', label, t: n / fps });
    },
    /** A finger drag over `frames` frames. */
    async drag(x0, y0, x1, y1, k = 24) {
      r.touch('down', x0, y0);
      await page.mouse.move(x0, y0);
      await page.mouse.down();
      await r.frames(2);
      for (let i = 1; i <= k; i++) {
        const x = x0 + ((x1 - x0) * i) / k;
        const y = y0 + ((y1 - y0) * i) / k;
        await page.mouse.move(x, y);
        r.touch('move', x, y);
        await r.frames(1);
      }
      await page.mouse.up();
      r.touch('up', x1, y1);
      await r.frames(2);
    },
    async stop() {
      await page.evaluate(() => window.__vt.stop());
      writeFileSync(join(dir, 'frames.json'), JSON.stringify({ frames, touches, viewport: vp, fps }, null, 1));
      return { frames: n, seconds: n / fps };
    },
  };
  return r;
}
