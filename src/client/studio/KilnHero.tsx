// The landing-page kiln: a brick beehive kiln drawn in SVG (bricks, voussoir arch, soot,
// firelight), with HTML layers on top for the parts that move: the fire seen through the door
// seams, two riveted iron doors that swing open in 3D, embers, chimney smoke, and the pot that
// comes out glowing hot and cools. Pure SVG/CSS: no three.js, so it costs nothing on boot.
import type { ComponentChildren } from 'preact';
import { useMemo } from 'preact/hooks';

export type KilnState = 'closed' | 'opening' | 'open';

// Design space: viewBox 0 -60 400 500. HTML layers use the same space as percentages.
const VB_Y = -60;
const VB_H = 500;
const BODY = 'M30 410 L30 190 C30 70 110 20 200 20 C290 20 370 70 370 190 L370 410 Z';
const MOUTH = 'M120 410 L120 270 A80 80 0 0 1 280 270 L280 410 Z';

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

const BRICK = ['#5b2417', '#672b1b', '#4c1d13', '#743222', '#401810', '#5f2a1d', '#6d2f20'];

function bricks(seed: number, x0: number, x1: number, y0: number, y1: number, w: number, h: number) {
  const r = rng(seed);
  const out: { x: number; y: number; w: number; h: number; c: string; o: number }[] = [];
  let row = 0;
  for (let y = y0; y < y1; y += h, row++) {
    const off = row % 2 ? -w / 2 : 0;
    for (let x = x0 + off; x < x1; x += w) {
      const c = BRICK[Math.floor(r() * BRICK.length)]!;
      // A few scorched or pale bricks, as on a kiln that has been fired many times.
      const o = r() < 0.08 ? 0.55 : r() < 0.06 ? 1.25 : 1;
      out.push({ x: x + 0.9, y: y + 0.9, w: w - 1.8, h: h - 1.8, c, o });
    }
  }
  return out;
}

function voussoirs(cx: number, cy: number, r0: number, r1: number, n: number) {
  const out: string[] = [];
  const gap = 0.012;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + (i / n) * Math.PI + gap;
    const a1 = Math.PI + ((i + 1) / n) * Math.PI - gap;
    const p = (a: number, r: number) => `${(cx + Math.cos(a) * r).toFixed(1)} ${(cy + Math.sin(a) * r).toFixed(1)}`;
    out.push(`M${p(a0, r0)} L${p(a0, r1)} A${r1} ${r1} 0 0 1 ${p(a1, r1)} L${p(a1, r0)} A${r0} ${r0} 0 0 0 ${p(a0, r0)} Z`);
  }
  return out;
}

function pct(x: number, y: number, w: number, h: number) {
  return { left: `${(x / 400) * 100}%`, top: `${((y - VB_Y) / VB_H) * 100}%`, width: `${(w / 400) * 100}%`, height: `${(h / VB_H) * 100}%` };
}

const EMBERS = Array.from({ length: 18 }, (_, i) => {
  const r = rng(91 + i * 7);
  return { x: 34 + r() * 32, d: 2.6 + r() * 3.2, delay: -r() * 6, drift: (r() - 0.5) * 60, s: 2 + r() * 3 };
});
const SMOKE = Array.from({ length: 5 }, (_, i) => ({ delay: -i * 1.6, drift: (i % 2 ? 1 : -1) * (10 + i * 4) }));

export function KilnHero({ state, pot, label, heat = 'hot' }: { state: KilnState; pot?: ComponentChildren; label: string; heat?: 'hot' | 'cool' }) {
  const wall = useMemo(() => bricks(7, 20, 380, 20, 410, 40, 17), []);
  const chimney = useMemo(() => bricks(23, 262, 302, -40, 70, 20, 12), []);
  const arch = useMemo(() => voussoirs(200, 270, 80, 106, 13), []);
  const mouth = pct(120, 190, 160, 220);
  return (
    <figure class={`kh kh--${state} kh--${heat}`} role="img" aria-label={label}>
      <div class="kh__halo" />
      <svg class="kh__svg" viewBox={`0 ${VB_Y} 400 ${VB_H}`} aria-hidden="true">
        <defs>
          <clipPath id="kh-body">
            <path d={BODY} />
          </clipPath>
          <clipPath id="kh-chimney">
            <rect x="262" y="-40" width="40" height="110" />
          </clipPath>
          <linearGradient id="kh-round" x1="0" x2="1">
            <stop offset="0" stop-color="#000" stop-opacity="0.75" />
            <stop offset="0.28" stop-color="#000" stop-opacity="0.15" />
            <stop offset="0.55" stop-color="#000" stop-opacity="0" />
            <stop offset="0.8" stop-color="#000" stop-opacity="0.3" />
            <stop offset="1" stop-color="#000" stop-opacity="0.8" />
          </linearGradient>
          <linearGradient id="kh-top" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#000" stop-opacity="0.65" />
            <stop offset="0.45" stop-color="#000" stop-opacity="0.1" />
            <stop offset="1" stop-color="#000" stop-opacity="0.35" />
          </linearGradient>
          <radialGradient id="kh-soot" cx="0.5" cy="0.75" r="0.6">
            <stop offset="0" stop-color="#050202" stop-opacity="0.95" />
            <stop offset="0.6" stop-color="#0b0403" stop-opacity="0.55" />
            <stop offset="1" stop-color="#0b0403" stop-opacity="0" />
          </radialGradient>
          <radialGradient id="kh-firelight" cx="200" cy="360" r="230" gradientUnits="userSpaceOnUse">
            <stop offset="0" stop-color="#ff9a3c" stop-opacity="0.85" />
            <stop offset="0.35" stop-color="#ff5a1f" stop-opacity="0.35" />
            <stop offset="1" stop-color="#ff3a10" stop-opacity="0" />
          </radialGradient>
          <linearGradient id="kh-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#4a3a33" />
            <stop offset="1" stop-color="#1c1411" />
          </linearGradient>
          <linearGradient id="kh-arch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#7f3a24" />
            <stop offset="1" stop-color="#9a4a2a" />
          </linearGradient>
        </defs>

        {/* chimney behind the dome */}
        <g clip-path="url(#kh-chimney)">
          <rect x="262" y="-40" width="40" height="110" fill="#1a0b08" />
          {chimney.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="1" fill={b.c} style={{ filter: `brightness(${b.o * 0.8})` }} />
          ))}
          <rect x="262" y="-40" width="40" height="110" fill="url(#kh-round)" />
        </g>
        <rect x="256" y="-48" width="52" height="10" rx="2" fill="url(#kh-stone)" />

        {/* brick body */}
        <g clip-path="url(#kh-body)">
          <rect x="0" y="0" width="400" height="420" fill="#170906" />
          {wall.map((b, i) => (
            <rect key={i} x={b.x} y={b.y} width={b.w} height={b.h} rx="1.4" fill={b.c} style={b.o === 1 ? undefined : { filter: `brightness(${b.o})` }} />
          ))}
          <rect class="kh__firelight" x="0" y="0" width="400" height="420" fill="url(#kh-firelight)" />
          <ellipse cx="200" cy="150" rx="105" ry="150" fill="url(#kh-soot)" />
          <rect x="0" y="0" width="400" height="420" fill="url(#kh-round)" />
          <rect x="0" y="0" width="400" height="420" fill="url(#kh-top)" />
        </g>
        <path d={BODY} fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="2" />

        {/* arch ring and jambs */}
        {arch.map((d, i) => (
          <path key={i} d={d} fill="url(#kh-arch)" stroke="#1a0906" stroke-width="1.4" style={{ filter: `brightness(${0.75 + ((i * 37) % 11) / 30})` }} />
        ))}
        {[270, 299, 328, 357, 386].map((y, i) => (
          <g key={y}>
            <rect x={i % 2 ? 98 : 94} y={y} width={i % 2 ? 22 : 26} height="27" rx="1.5" fill="#8e4428" stroke="#1a0906" stroke-width="1.4" />
            <rect x="280" y={y} width={i % 2 ? 22 : 26} height="27" rx="1.5" fill="#8e4428" stroke="#1a0906" stroke-width="1.4" />
          </g>
        ))}
        <path d={MOUTH} fill="#070202" />

        {/* plinth and floor */}
        <rect x="12" y="408" width="376" height="14" rx="3" fill="url(#kh-stone)" />
        <rect x="12" y="408" width="376" height="2" fill="#7a6458" opacity="0.45" />
        <ellipse cx="200" cy="432" rx="210" ry="10" fill="#000" opacity="0.55" />
      </svg>

      {/* the fire inside, seen through the door gaps and the open door */}
      <div class="kh__mouth" style={mouth}>
        <div class="kh__inside">
          <div class="kh__backwall" />
          <svg class="kh__ware" viewBox="0 0 160 220" preserveAspectRatio="none" aria-hidden="true">
            <path d="M18 168 C10 150 14 128 24 120 L22 112 L36 112 L34 120 C44 128 48 150 40 168 Z" />
            <path d="M118 168 C108 160 106 140 112 128 C116 120 116 112 112 106 L134 106 C130 112 130 120 134 128 C140 140 138 160 128 168 Z" />
            <rect x="6" y="168" width="148" height="7" rx="1.5" />
            <rect x="16" y="175" width="8" height="45" />
            <rect x="136" y="175" width="8" height="45" />
          </svg>
          <div class="kh__flames">
            <i style="--x:14%;--d:1.1s;--h:46%" />
            <i style="--x:30%;--d:0.8s;--h:62%" />
            <i style="--x:47%;--d:1.3s;--h:74%" />
            <i style="--x:64%;--d:0.9s;--h:58%" />
            <i style="--x:80%;--d:1.2s;--h:44%" />
          </div>
          <div class="kh__core" />
        </div>
        <div class="kh__doors">
          <div class="kh__door kh__door--l">
            <span class="kh__strap" style="top:30%" />
            <span class="kh__strap" style="top:70%" />
            <span class="kh__peep" />
          </div>
          <div class="kh__door kh__door--r">
            <span class="kh__strap" style="top:30%" />
            <span class="kh__strap" style="top:70%" />
            <span class="kh__handle" />
          </div>
        </div>
      </div>

      <div class="kh__spill" />
      <div class="kh__pot" style={pct(110, 230, 180, 182)}>
        {pot}
      </div>

      <div class="kh__smoke" style={pct(262, -48, 40, 10)}>
        {SMOKE.map((s, i) => (
          <i key={i} style={`--delay:${s.delay}s;--drift:${s.drift}px`} />
        ))}
      </div>
      <div class="kh__embers" style={pct(120, 190, 160, 220)}>
        {EMBERS.map((e, i) => (
          <i key={i} style={`--x:${e.x}%;--d:${e.d}s;--delay:${e.delay}s;--drift:${e.drift}px;--s:${e.s}px`} />
        ))}
      </div>
    </figure>
  );
}

/** Boot screen: a lump of clay rising into a pot on a spinning wheel. */
export function BootLoader({ text }: { text: string }) {
  return (
    <div class="boot" role="status" aria-live="polite">
      <svg class="boot__art" viewBox="0 0 160 140" aria-hidden="true">
        <defs>
          <linearGradient id="boot-clay" x1="0" x2="1">
            <stop offset="0" stop-color="#3b1d14" />
            <stop offset="0.45" stop-color="#9a5a3d" />
            <stop offset="0.7" stop-color="#7a4330" />
            <stop offset="1" stop-color="#2c140e" />
          </linearGradient>
          <clipPath id="boot-rise">
            <rect class="boot__rise" x="0" y="0" width="160" height="112" />
          </clipPath>
        </defs>
        <ellipse class="boot__glow" cx="80" cy="112" rx="70" ry="18" fill="#ff4a1c" opacity="0.25" />
        <ellipse cx="80" cy="114" rx="64" ry="13" fill="#2a2a30" />
        <ellipse class="boot__spin" cx="80" cy="112" rx="64" ry="13" fill="none" stroke="#6b6b75" stroke-width="2" stroke-dasharray="6 9" />
        <g clip-path="url(#boot-rise)">
          <path d="M58 112 C50 100 46 84 52 70 C56 60 62 54 62 46 L60 40 L100 40 L98 46 C98 54 104 60 108 70 C114 84 110 100 102 112 Z" fill="url(#boot-clay)" />
          <path class="boot__rings" d="M52 70 H108 M50 84 H110 M52 98 H108" stroke="#000" stroke-opacity="0.18" stroke-width="1.5" />
        </g>
        <path class="boot__outline" d="M58 112 C50 100 46 84 52 70 C56 60 62 54 62 46 L60 40 L100 40 L98 46 C98 54 104 60 108 70 C114 84 110 100 102 112" fill="none" stroke="#ff7a5a" stroke-width="1.6" stroke-linecap="round" />
      </svg>
      <p class="boot__text">{text}</p>
    </div>
  );
}
