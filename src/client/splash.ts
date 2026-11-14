// Inline feed view. Tiny and fast: no three.js, no Preact. Taps only, no scroll traps.
// A ten-second loop tells the whole game: today's vessel rises on the wheel, the kiln fires it,
// and it comes out glazed. Plain SVG, about 30 frames a second, paused while the post is hidden.
import './styles/tokens.css';
import './splash.css';
import { requestExpandedMode } from '@devvit/web/client';
import type { TodayResponse } from '../shared/api/types';
import { decodeOutline, silhouettePath } from './app/silhouette';

const $ = (id: string) => document.getElementById(id);

function setText(id: string, text: string): void {
  const el = $(id);
  if (el && el.textContent !== text) el.textContent = text;
}

// ---------- The vessel on the wheel ----------

const CX = 100;
const BASE = 131;
const ROWS = 48;
const LOOP = 10_000;

/** A Moon jar until today's commission arrives. */
const FALLBACK = Array.from({ length: ROWS }, (_, i) => {
  const y = (i + 0.5) / ROWS;
  return 30 + 22 * Math.sin(Math.PI * Math.min(1, y * 1.05)) - (y > 0.9 ? (y - 0.9) * 120 : 0);
});

let target = { height: 92, rows: FALLBACK.map((r) => r * 0.95), opened: true };
const lump = Array.from({ length: ROWS }, (_, i) => {
  const y = (i + 0.5) / ROWS;
  return 36 * Math.sqrt(Math.max(0, 1 - Math.pow(y, 2.6))) + 2;
});
const LUMP_H = 44;

function setTarget(encoded: readonly number[]): void {
  const { height, outer, opened } = decodeOutline(encoded);
  const maxR = Math.max(...outer, 1);
  const s = Math.min(94 / Math.max(height, 1), 54 / maxR);
  target = { height: height * s, rows: outer.map((r) => r * s), opened };
  $('ghost')?.setAttribute('d', potPath(target.rows, target.height));
}

function potPath(rows: number[], h: number): string {
  const pts: string[] = [];
  const left: string[] = [];
  for (let i = 0; i < ROWS; i += 2) {
    const y = (BASE - ((i + 0.5) / ROWS) * h).toFixed(1);
    pts.push(`${(CX + rows[i]!).toFixed(1)},${y}`);
    left.unshift(`${(CX - rows[i]!).toFixed(1)},${y}`);
  }
  const top = (BASE - h).toFixed(1);
  const rt = rows[ROWS - 1]!;
  return `M${(CX - rows[0]!).toFixed(1)},${BASE} L${(CX + rows[0]!).toFixed(1)},${BASE} L${pts.join(' L')} L${(CX + rt).toFixed(1)},${top} L${(CX - rt).toFixed(1)},${top} L${left.join(' L')} Z`;
}

const ease = (x: number) => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
const lerp = (a: number, b: number, t: number) => a + (b - a) * t;
const seg = (t: number, a: number, b: number) => ease((t - a) / (b - a));

const GLAZES = [
  { name: 'Celadon', c: ['#e2f4e8', '#93c4a8', '#2c5646'] },
  { name: 'Cobalt Blue', c: ['#c9d8ff', '#4a72d6', '#14245e'] },
  { name: 'Copper Red', c: ['#ffc2b0', '#c8392f', '#4e0b0b'] },
  { name: 'Oil Spot', c: ['#d9c3a0', '#4a2e1f', '#0e0705'] },
  { name: 'Copper Green', c: ['#d6f2c8', '#4f9a62', '#173a24'] },
  { name: 'Moon White', c: ['#ffffff', '#e4ddd2', '#8c8478'] },
];

function setGlaze(i: number): void {
  const g = GLAZES[i % GLAZES.length]!;
  g.c.forEach((col, k) => $(`gz${k}`)?.setAttribute('stop-color', col));
  setText('foundName', g.name);
}

function drawRings(): void {
  const g = $('rings');
  if (!g) return;
  let s = '';
  for (let y = 30; y < 132; y += 3.4) s += `<path d="M40,${y.toFixed(1)} Q100,${(y + 3).toFixed(1)} 160,${y.toFixed(1)}" />`;
  g.innerHTML = s;
}

function spawnEmbers(): void {
  const box = $('embers');
  if (!box) return;
  let html = '';
  for (let i = 0; i < 18; i++) {
    const x = (i * 37 + 11) % 100;
    const d = 3 + ((i * 7) % 5);
    const delay = -((i * 0.77) % d);
    const size = 2 + (i % 3);
    html += `<i style="--x:${x}%;--d:${d}s;--t:${delay.toFixed(2)}s;--s:${size}px"></i>`;
  }
  box.innerHTML = html;
}

function frame(ms: number, reduce: boolean): void {
  const t = reduce ? 7000 : ms % LOOP;
  const loopN = Math.floor(ms / LOOP);
  // Shape: centre (0-0.8 s), two pulls up to the target (0.8-5.2 s), fire and reveal, then back to clay.
  const e = t < 9200 ? seg(t, 800, 5000) : 1 - seg(t, 9200, 9900);
  const h = lerp(LUMP_H, target.height, e);
  const rows = lump.map((r, i) => lerp(r, target.rows[i] ?? r, e));
  const d = potPath(rows, h);
  $('clay')?.setAttribute('d', d);
  $('glaze')?.setAttribute('d', d);
  $('clipPath')?.setAttribute('d', d);
  const glaze = t < 9200 ? seg(t, 5600, 6500) : 1 - seg(t, 9200, 9600);
  ($('glaze') as SVGElement | null)?.style.setProperty('opacity', glaze.toFixed(3));
  // The mouth of the pot opens as the walls rise.
  const mouth = $('mouth');
  if (mouth) {
    const rt = rows[ROWS - 1]!;
    const open = target.opened ? e : 0;
    mouth.setAttribute('cy', (BASE - h).toFixed(1));
    mouth.setAttribute('rx', (rt * 0.9 * open).toFixed(1));
    mouth.setAttribute('ry', (Math.max(1.2, rt * 0.2) * open).toFixed(1));
  }
  // The fingertip rides up the right-hand wall, twice.
  const tip = $('tip');
  if (tip) {
    const pulling = t > 800 && t < 5200;
    const local = pulling ? ((t - 800) % 2200) / 2200 : 0;
    const yf = ease(local);
    const i = Math.min(ROWS - 1, Math.floor(yf * ROWS));
    tip.setAttribute('cx', (CX + (rows[i] ?? 0) + 4).toFixed(1));
    tip.setAttribute('cy', (BASE - 3 - yf * (h - 4)).toFixed(1));
    tip.style.setProperty('opacity', pulling ? String(Math.min(1, local * 6, (1 - local) * 6)) : '0');
  }
  // Match climbs while the pot takes shape.
  const best = 86 + (loopN % 4) * 3;
  setText('matchNum', String(Math.round(lerp(14, best, e))));
  const phase = t < 5200 ? 'throw' : t < 6600 ? 'fire' : 'reveal';
  if (document.body.dataset.phase !== phase) {
    document.body.dataset.phase = phase;
    if (phase === 'throw') setGlaze(loopN);
  }
}

function animate(): void {
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  setGlaze(0);
  frame(0, reduce);
  if (reduce) {
    document.body.classList.add('still');
    return;
  }
  let last = 0;
  let clock = 0;
  let prev = 0;
  const loop = (ms: number) => {
    const dt = Math.min(100, ms - prev);
    prev = ms;
    if (document.visibilityState === 'visible') {
      clock += dt;
      if (ms - last > 33) {
        frame(clock, false);
        last = ms;
      }
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

// ---------- Today's data ----------

function countdown(ms: number): string {
  const m = Math.max(0, Math.floor(ms / 60000));
  const h = Math.floor(m / 60);
  return h ? `${h}h ${m % 60}m` : `${m}m`;
}

function countUp(id: string, to: number): void {
  const el = $(id);
  if (!el) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    el.textContent = String(to);
    return;
  }
  const t0 = performance.now();
  const step = (now: number) => {
    const k = Math.min(1, (now - t0) / 900);
    el.textContent = String(Math.round(to * (1 - Math.pow(1 - k, 3))));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function render(t: TodayResponse): void {
  const c = t.commission;
  const master = c.commissioner === 'the Master';
  setText('eyebrow', `Day ${t.dayNumber} · ${c.formatLabel}`);
  setText('title', c.title);
  setText('meta', `${c.origin} · by ${master ? 'the Master' : `u/${c.commissioner}`}`);
  countUp('beat', c.bar);
  setText('beatBy', master ? "the Master's score" : `u/${c.commissioner}'s score`);
  $('target')?.setAttribute('d', silhouettePath(c.target));
  setTarget(c.target);
  setText('live', t.throwsToday > 0 ? `${t.throwsToday} potter${t.throwsToday === 1 ? '' : 's'} at the wheel today` : 'Be the first potter today');
  const tick = () => setText('kiln', `Kiln fires in ${countdown(t.nextKilnAt - Date.now())}`);
  tick();
  setInterval(tick, 30_000);
  const leader = t.top[0];
  let status = '';
  let label = "Throw today's pot";
  if (t.kilnWaiting > 0) {
    status = t.kilnWaiting === 1 ? 'Your pot is out of the kiln. Come and see what the fire made.' : `${t.kilnWaiting} of your pots are out of the kiln.`;
    label = 'Open the kiln';
    document.body.classList.add('is-ready');
  } else if (t.myThrow) {
    status = t.myThrow.beatBar ? `You scored ${t.myThrow.score.total} and beat the bar.` : `You scored ${t.myThrow.score.total}. Practise and try to beat ${c.bar}.`;
    label = t.myThrow.glazed ? 'Open the studio' : 'Paint and fire it';
  } else if (leader) {
    status = `u/${leader.username} leads with ${leader.score}. Can you beat it?`;
  }
  setText('status', status);
  setText('throwLabel', label);
  document.body.classList.add('ready');
}

function init(): void {
  drawRings();
  spawnEmbers();
  $('ghost')?.setAttribute('d', potPath(target.rows, target.height));
  animate();
  $('throw')?.addEventListener('click', (e) => {
    // Must be synchronous from the trusted click.
    requestExpandedMode(e, 'studio', { title: 'Paanai' });
  });
  fetch('/api/today')
    .then((r) => (r.ok ? (r.json() as Promise<TodayResponse>) : Promise.reject(new Error(String(r.status)))))
    .then(render)
    .catch(() => {
      setText('status', 'The studio is warming up. Tap to start.');
      document.body.classList.add('ready');
    });
}

init();
