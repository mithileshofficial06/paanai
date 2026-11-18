// Footage for the film, from the local harness on :5174 (seed first: node film/tools/seed.mjs 9 3).
//  Landscape hero shots (1920x1080, game UI hidden): the Paanai thrown on the wheel, a collapse,
//  then the same pot painted, fired and revealed full screen.
//  Phone shots (430x932 at 2.5x): the whole loop as a player sees it, with a log of every touch.
// Usage: node film/tools/shoot.mjs [hero|phone|hand|splash ...]
import { chromium } from 'playwright';
import { recorder } from '../../capture/rec.mjs';
import { VCLOCK, vrecorder } from './vrec.mjs';

const base = 'http://127.0.0.1:5174';
const ROOT = 'D:/Projects/2-In-Progress/paanai/video/footage/film';
const want = process.argv.slice(2);
const run = (k) => !want.length || want.includes(k);
const b = await chromium.launch({ args: ['--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist'] });
const stamp = Date.now() % 100000;

async function session(user, viewport, dpr) {
  const p = await b.newPage({ viewport, deviceScaleFactor: dpr });
  await p.addInitScript(VCLOCK);
  p.on('pageerror', (e) => console.log('pageerror', e.message));
  const s = { p, rec: null };
  s.btn = (name, exact = false) => p.getByRole('button', { name, exact }).first();
  s.wait = (ms) => p.waitForTimeout(ms);
  s.clip = async (name, fn) => {
    s.rec = await recorder(p, `${ROOT}/${name}`);
    await s.rec.start();
    await s.wait(300);
    try {
      await fn();
    } catch (e) {
      console.log(`  ${name} failed: ${String(e.message).split('\n')[0]}`);
    }
    const r = await s.rec.stop();
    console.log(`${name}: ${r.frames} frames, ${r.seconds.toFixed(1)} s`);
    s.rec = null;
  };
  /** Frame-exact clip on the virtual clock: fn gets the recorder (frames, drag, touch, mark). */
  s.vclip = async (name, fn) => {
    const v = await vrecorder(p, `${ROOT}/${name}`);
    s.rec = v;
    await v.start();
    try {
      await fn(v);
    } catch (e) {
      console.log(`  ${name} failed: ${String(e.message).split(String.fromCharCode(10))[0]}`);
    }
    const r = await v.stop();
    console.log(`${name}: ${r.frames} frames, ${r.seconds.toFixed(1)} s (virtual)`);
    s.rec = null;
  };
  /** Play the Master's throw on the virtual clock until the pot passes, then hold. */
  s.vmaster = async (v, hold = 3) => {
    v.mark('throw-start');
    await p.evaluate(() => window.__paanaiVideo.playMaster());
    for (let i = 0; i < 400; i++) {
      await v.frames(6);
      if (await p.locator('.is-ready').count()) break;
    }
    v.mark('passes');
    await v.seconds(hold);
  };
  s.tap = async (loc, pause = 380) => {
    await loc.waitFor({ state: 'visible', timeout: 15000 });
    const bb = await loc.boundingBox();
    const x = bb.x + bb.width / 2;
    const y = bb.y + bb.height / 2;
    s.rec?.touch('tap', x, y);
    await s.wait(pause);
    await p.mouse.click(x, y);
  };
  s.tapAt = async (x, y, pause = 320) => {
    s.rec?.touch('tap', x, y);
    await s.wait(pause);
    await p.mouse.click(x, y);
  };
  /** A finger drag from (x0,y0) to (x1,y1), logged for the edit. */
  s.drag = async (x0, y0, x1, y1, steps = 26, ms = 28) => {
    s.rec?.touch('down', x0, y0);
    await p.mouse.move(x0, y0);
    await p.mouse.down();
    for (let i = 1; i <= steps; i++) {
      const x = x0 + ((x1 - x0) * i) / steps;
      const y = y0 + ((y1 - y0) * i) / steps;
      await p.mouse.move(x, y);
      if (i % 2 === 0) s.rec?.touch('move', x, y);
      await s.wait(ms);
    }
    await p.mouse.up();
    s.rec?.touch('up', x1, y1);
  };
  s.hideUi = (on) =>
    p.evaluate((on) => {
      let st = document.getElementById('film-hide');
      if (!st) {
        st = document.createElement('style');
        st.id = 'film-hide';
        document.head.appendChild(st);
      }
      st.textContent = on ? '.throw > :not(.throw__canvas){opacity:0 !important; transition:none !important}' : '';
    }, on);
  s.toWheel = async () => {
    await p.goto(`${base}/studio.html?user=${user}`);
    await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
    await s.wait(1200);
    await s.btn('Open the kiln').click();
    await s.btn('Skip, throw today’s pot').click();
    await p.locator('.throw__canvas').waitFor();
    await s.wait(1200);
    const skip = p.getByRole('button', { name: 'Skip', exact: true });
    if (await skip.count()) await skip.click();
    await s.wait(400);
  };
  return s;
}

async function paintPot(s) {
  const { p } = s;
  await s.tap(s.btn('Paint it and fire it'));
  await p.locator('.deco__canvas').waitFor();
  await s.wait(1400);
  const c = await p.locator('.deco__canvas').boundingBox();
  const cx = c.x + c.width / 2;
  await s.tap(p.getByRole('radio', { name: 'Indigo' }));
  await s.wait(300);
  await s.tapAt(cx, c.y + c.height * 0.55);
  await s.wait(800);
  await s.tap(p.getByRole('radio', { name: 'Gold' }));
  await s.wait(250);
  await s.tapAt(cx, c.y + c.height * 0.45);
  await s.wait(800);
  await s.tap(p.getByRole('tab', { name: 'Patterns' }));
  await s.wait(400);
  await s.tap(p.getByRole('radio', { name: 'Leaves' }));
  await s.tap(p.getByRole('radio', { name: 'Chalk white' }));
  await s.wait(250);
  await s.tapAt(cx, c.y + c.height * 0.64);
  await s.wait(900);
  await s.tap(p.getByRole('tab', { name: 'Rim' }));
  await s.wait(300);
  await s.tap(p.getByRole('radio', { name: 'Kumkum red' }));
  await s.wait(1800);
}

// ---------- Landscape hero shots ----------
if (run('hero')) {
  const s = await session(`hero${stamp}`, { width: 1920, height: 1080 }, 1.5);
  const { p } = s;
  await s.toWheel();
  await s.hideUi(true);
  await s.vclip('h01_throw', async (v) => {
    await v.seconds(2.5);
    await s.vmaster(v, 4);
  });
  await p.close();
}

// Other vessels of the rotation, thrown full screen (moves the harness clock back a day at a time).
if (run('vessels')) {
  for (const [shift, name] of [[-1, 'h07_meiping'], [-2, 'h08_moonjar']]) {
    await fetch(`${base}/__harness/advance-day?n=${shift}`, { method: 'POST' });
    const s = await session(`v${name}${stamp}`, { width: 1920, height: 1080 }, 1.5);
    const { p } = s;
    await s.toWheel();
    await s.hideUi(true);
    await s.vclip(name, async (v) => {
      await v.seconds(1);
      await s.vmaster(v, 3);
    });
    await p.close();
  }
}

if (run('collapse')) {
  const s = await session(`fall${stamp}`, { width: 1920, height: 1080 }, 1.5);
  const { p } = s;
  await s.toWheel();
  await s.hideUi(true);
  const box = await p.locator('.throw__canvas').boundingBox();
  const cx = box.x + box.width / 2;
  await s.vclip('h06_collapse', async (v) => {
    await v.seconds(1);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Open')?.click());
    await v.seconds(2);
    // Pull the same wall up again and again, too thin to stand.
    let fellAt = -1;
    for (let k = 0; k < 18; k++) {
      await v.drag(cx + 95, 760, cx + 88, 380, 30);
      await v.frames(10);
      const fell = await p.evaluate(() => /collapse|slump|fell/i.test(document.querySelector('.throw')?.textContent ?? ''));
      if (fell) {
        fellAt = k;
        break;
      }
    }
    v.mark('fell');
    console.log('  fell after pull', fellAt);
    await v.seconds(4);
  });
  await p.close();
}

// ---------- Phone: the gesture, with a finger ----------
if (run('hand')) {
  const s = await session(`hand${stamp}`, { width: 430, height: 932 }, 2.5);
  const { p } = s;
  await s.toWheel();
  const box = await p.locator('.throw__canvas').boundingBox();
  const cx = box.x + box.width / 2;
  await s.vclip('p03_hand', async (v) => {
    await v.seconds(0.8);
    const ob = await p.getByRole('button', { name: 'Open', exact: true }).boundingBox();
    v.touch('tap', ob.x + ob.width / 2, ob.y + ob.height / 2);
    await v.frames(14);
    await p.mouse.click(ob.x + ob.width / 2, ob.y + ob.height / 2);
    await v.seconds(1.6);
    await p.evaluate(() => [...document.querySelectorAll('button')].find((x) => x.textContent.trim() === 'Got it')?.click());
    await v.seconds(0.4);
    // Three pulls up the wall.
    for (let k = 0; k < 3; k++) {
      await v.drag(cx + 62, 600, cx + 56, 430, 34);
      await v.frames(20);
    }
    // Swell the belly out, then squeeze a neck.
    await v.drag(cx + 30, 545, cx + 72, 545, 30);
    await v.frames(24);
    await v.drag(cx + 72, 470, cx + 42, 470, 30);
    await v.seconds(1.6);
  });
  await p.close();
}

// ---------- Phone: the Master's throw, frame-exact at full resolution ----------
if (run('master')) {
  const s = await session(`mst${stamp}`, { width: 430, height: 932 }, 2.5);
  const { p } = s;
  await s.toWheel();
  await s.vclip('p04_throw', async (v) => {
    await v.seconds(0.6);
    await s.vmaster(v, 3);
  });
  await p.close();
}

// ---------- Phone: the whole loop ----------
if (run('phone')) {
  const s = await session(`mira${stamp}`, { width: 430, height: 932 }, 2.5);
  const { p } = s;
  await p.goto(`${base}/studio.html?user=mira${stamp}`);
  await s.clip('p01_welcome', async () => {
    await p.locator('#boot').waitFor({ state: 'detached', timeout: 20000 });
    await s.wait(2800);
    await s.tap(s.btn('Open the kiln'));
    await s.wait(3800);
  });
  await s.clip('p02_today', async () => {
    await s.tap(s.btn('Skip, throw today’s pot'));
    await p.locator('.throw__canvas').waitFor();
    await s.wait(2600);
  });
  const skip = p.getByRole('button', { name: 'Skip', exact: true });
  if (await skip.count()) await skip.click();
  await s.wait(600);
  await s.vclip('p04_throw', async (v) => {
    await v.seconds(0.6);
    await s.vmaster(v, 3);
  });
  await s.clip('p05_score', async () => {
    await s.tap(s.btn('Done'));
    await s.wait(5500);
    await p.mouse.wheel(0, 400);
    await s.wait(1800);
  });
  await s.clip('p06_paint', async () => paintPot(s));
  await s.clip('p07_fire', async () => {
    await s.tap(s.btn('Fire it in the kiln'));
    await p.locator('.kiln__hero').waitFor();
    await p.locator('.kiln__ready').first().waitFor({ timeout: 30000 });
    await s.wait(1500);
  });
  await s.clip('p08_reveal', async () => {
    await s.tap(p.locator('.kiln__ready').getByRole('button', { name: 'Open' }));
    await s.wait(1200);
    await s.tap(s.btn('Open the kiln'));
    await s.wait(4500);
    const show = s.btn('Put on show');
    if (await show.count()) await s.tap(show);
    await s.wait(1500);
    const share = s.btn('Share on Reddit');
    if (await share.count()) await s.tap(share);
    await s.wait(2600);
  });
  await s.clip('p09_showcase', async () => {
    await p.mouse.wheel(0, 500);
    await s.wait(1200);
    await s.tap(p.locator('.unlock__item', { hasText: 'Showcase' }));
    await p.locator('.show__card').first().waitFor();
    await s.wait(1500);
    await s.tap(p.getByRole('tab', { name: 'Top rated' }));
    await s.wait(1600);
    await p.mouse.wheel(0, 260);
    await s.wait(900);
    const card = p.locator('.show__card').nth(3);
    await card.scrollIntoViewIfNeeded();
    await s.wait(500);
    await s.tap(card.getByRole('radio', { name: '5 stars' }));
    await s.wait(900);
    await s.tap(card.locator('.show__like'));
    await s.wait(1800);
  });
  await s.clip('p10_codex', async () => {
    await s.tap(p.getByRole('button', { name: 'Studio' }).last());
    await s.wait(800);
    await s.tap(p.getByRole('tab', { name: 'Codex' }));
    await s.wait(1800);
    await p.mouse.wheel(0, 380);
    await s.wait(1800);
  });
  await s.clip('p11_levels', async () => {
    await s.tap(p.getByRole('button', { name: 'Levels' }).last());
    await s.wait(1600);
    await p.mouse.wheel(0, 600);
    await s.wait(1400);
    await p.mouse.wheel(0, 900);
    await s.wait(1800);
  });
  await s.clip('p12_home', async () => {
    await s.tap(p.getByRole('button', { name: 'Home' }).last());
    await s.wait(2400);
    const lb = p.getByRole('button', { name: /Leaderboard/ }).first();
    if (await lb.count()) {
      await s.tap(lb);
      await s.wait(2600);
    }
  });
  await p.close();
}

// ---------- The post in the feed (inline splash) ----------
if (run('splash')) {
  const s = await session(`feed${stamp}`, { width: 520, height: 640 }, 2.5);
  const { p } = s;
  await p.goto(`${base}/splash.html?user=feed${stamp}`);
  await s.clip('p00_splash', async () => {
    await s.wait(5000);
  });
  await p.close();
}

await b.close();
