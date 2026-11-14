// Screen recorder for the demo video: CDP screencast frames (JPEG) with timestamps, plus a log of
// every tap and drag so the edit can draw a fingertip. Usage: import { recorder } from './rec.mjs'.
import { mkdirSync, rmSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

export async function recorder(page, dir) {
  rmSync(dir, { recursive: true, force: true });
  mkdirSync(dir, { recursive: true });
  const cdp = await page.context().newCDPSession(page);
  const frames = [];
  const touches = [];
  let t0 = null;
  let n = 0;
  cdp.on('Page.screencastFrame', async (f) => {
    const ts = f.metadata.timestamp;
    if (t0 === null) t0 = ts;
    const name = `f${String(n++).padStart(5, '0')}.jpg`;
    writeFileSync(join(dir, name), Buffer.from(f.data, 'base64'));
    frames.push({ name, t: ts - t0 });
    await cdp.send('Page.screencastFrameAck', { sessionId: f.sessionId }).catch(() => {});
  });
  const vp = page.viewportSize();
  const now = () => (t0 === null ? 0 : Date.now() / 1000 - wall0);
  let wall0 = 0;
  return {
    async start() {
      wall0 = Date.now() / 1000;
      await cdp.send('Page.startScreencast', { format: 'jpeg', quality: 95, maxWidth: 1200, maxHeight: 2600, everyNthFrame: 1 });
    },
    /** Note a touch at CSS px (x, y); kind: 'tap' | 'down' | 'move' | 'up'. */
    touch(kind, x, y) {
      touches.push({ kind, x: x / vp.width, y: y / vp.height, t: now() });
    },
    mark(label) {
      touches.push({ kind: 'mark', label, t: now() });
    },
    async stop() {
      await cdp.send('Page.stopScreencast').catch(() => {});
      writeFileSync(join(dir, 'frames.json'), JSON.stringify({ frames, touches, viewport: vp }, null, 1));
      return { frames: frames.length, seconds: frames.length ? frames[frames.length - 1].t : 0 };
    },
  };
}
