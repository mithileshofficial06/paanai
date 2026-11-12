// Inline feed view. Tiny and fast: no three.js, no Preact. Taps only, no scroll traps.
import './styles/tokens.css';
import './splash.css';
import { requestExpandedMode } from '@devvit/web/client';
import type { TodayResponse } from '../shared/api/types';
import { silhouettePath } from './app/silhouette';

const $ = (id: string) => document.getElementById(id);

function setText(id: string, text: string): void {
  const el = $(id);
  if (el) el.textContent = text;
}

/** A soft lump shape for the clay on the wheel (wobbles slightly as it spins). */
function lumpPath(t: number): string {
  const w = 34 + Math.sin(t * 0.9) * 0.8;
  const h = 46 + Math.sin(t * 0.7 + 1) * 0.6;
  const cx = 100;
  const base = 97;
  const top = base - h;
  return `M${cx - w},${base} C${cx - w - 2},${base - h * 0.55} ${cx - w * 0.72},${top + 4} ${cx},${top} C${cx + w * 0.72},${top + 4} ${cx + w + 2},${base - h * 0.55} ${cx + w},${base} Z`;
}

function drawRings(): void {
  const g = $('rings');
  if (!g) return;
  let s = '';
  for (let y = 54; y < 98; y += 3.2) s += `<path d="M60,${y.toFixed(1)} Q100,${(y + 2.4).toFixed(1)} 140,${y.toFixed(1)}" />`;
  g.innerHTML = s;
}

function animateClay(): void {
  const body = $('clayBody');
  const clip = $('clayClipPath');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const draw = (ms: number) => {
    const d = lumpPath(reduce ? 0 : ms / 1000);
    body?.setAttribute('d', d);
    clip?.setAttribute('d', d);
  };
  draw(0);
  if (reduce) return;
  let last = 0;
  const loop = (ms: number) => {
    if (document.visibilityState === 'visible' && ms - last > 33) {
      draw(ms);
      last = ms;
    }
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

function render(t: TodayResponse): void {
  const c = t.commission;
  setText('eyebrow', `Day ${t.dayNumber} · ${c.formatLabel}`);
  setText('title', c.title);
  setText('meta', `${c.origin} · by ${c.commissioner === 'the Master' ? 'the Master' : `u/${c.commissioner}`}`);
  setText('beat', String(c.bar));
  setText('beatBy', c.commissioner === 'the Master' ? "the Master's score" : `u/${c.commissioner}'s score`);
  $('target')?.setAttribute('d', silhouettePath(c.target));
  let status = '';
  let label = 'Throw';
  if (t.kilnWaiting > 0) {
    status = t.kilnWaiting === 1 ? 'Your pot is out of the kiln.' : `${t.kilnWaiting} pots are out of the kiln.`;
    label = 'Open the kiln';
  } else if (t.myThrow) {
    status = t.myThrow.beatBar
      ? `You scored ${t.myThrow.score.total} and beat the bar.`
      : `You scored ${t.myThrow.score.total}. Practice and try to beat ${c.bar}.`;
    label = t.myThrow.glazed ? 'Open the studio' : 'Glaze your pot';
  } else if (t.throwsToday > 0) {
    status = `${t.throwsToday} potter${t.throwsToday === 1 ? '' : 's'} at the wheel today.`;
  }
  setText('status', status);
  setText('throwLabel', label);
  document.body.classList.add('ready');
}

function init(): void {
  drawRings();
  animateClay();
  $('throw')?.addEventListener('click', (e) => {
    // Must be synchronous from the trusted click.
    requestExpandedMode(e, 'studio', { title: 'Paanai' });
  });
  fetch('/api/today')
    .then((r) => (r.ok ? (r.json() as Promise<TodayResponse>) : Promise.reject(new Error(String(r.status)))))
    .then(render)
    .catch(() => {
      setText('status', 'The studio is warming up. Tap Throw to start.');
      document.body.classList.add('ready');
    });
}

init();
