// The kiln: a brick beehive kiln with iron buckstays, a pyrometer, stoke holes and a woodpile,
// drawn as one STATIC SVG (so it rasterises once), plus HTML layers for everything that moves:
// firelight, the fire behind the doors, two cast-iron doors (detailed SVG each) that swing open
// in 3D after the latch bar lifts, the gauge needle, embers, chimney smoke, and the pot.
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

const BRICK = ['#5b2417', '#672b1b', '#4c1d13', '#743222', '#401810', '#5f2a1d', '#6d2f20', '#57261a'];

function bricks(seed: number, x0: number, x1: number, y0: number, y1: number, w: number, h: number) {
  const r = rng(seed);
  const out: { x: number; y: number; w: number; h: number; c: string; o: number }[] = [];
  let row = 0;
  for (let y = y0; y < y1; y += h, row++) {
    const off = row % 2 ? -w / 2 : 0;
    for (let x = x0 + off; x < x1; x += w) {
      const c = BRICK[Math.floor(r() * BRICK.length)]!;
      const o = r() < 0.08 ? 0.55 : r() < 0.06 ? 1.25 : 0.9 + r() * 0.2;
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

/** Rivet with a lit top-left. */
function Rivet({ x, y, r = 1.7 }: { x: number; y: number; r?: number }) {
  return (
    <g>
      <circle cx={x + 0.4} cy={y + 0.6} r={r} fill="#000" opacity="0.55" />
      <circle cx={x} cy={y} r={r} fill="url(#khd-rivet)" />
    </g>
  );
}

/** One cast-iron door leaf, drawn for the LEFT side; the right leaf is mirrored. Leaf space 80 x 214. */
function DoorLeaf({ side }: { side: 'l' | 'r' }) {
  const shape = 'M0 214 L0 80 A80 80 0 0 1 80 0 L80 214 Z';
  const frame = 'M6 208 L6 81 A74 74 0 0 1 74 7.3 L74 208 Z';
  const rivets: [number, number][] = [];
  for (let y = 100; y <= 200; y += 14) rivets.push([10.5, y]);
  for (let y = 22; y <= 200; y += 14) rivets.push([69.5, y]);
  for (let a = 0; a <= 8; a++) {
    const t = Math.PI + (a / 8) * (Math.PI / 2);
    rivets.push([80 + Math.cos(t) * 69.5, 80 + Math.sin(t) * 69.5]);
  }
  return (
    <svg class="kh__leafsvg" viewBox={side === 'l' ? '-16 -2 98 218' : '-2 -2 98 218'} preserveAspectRatio="none" aria-hidden="true">
      <g transform={side === 'r' ? 'translate(80 0) scale(-1 1)' : undefined}>
        {/* hinge straps run past the hinge edge onto the frame, so draw their pins first */}
        {[46, 166].map((y) => (
          <g key={y}>
            <rect x="-15" y={y - 7} width="7" height="22" rx="2.5" fill="url(#khd-pin)" />
            <rect x="-15" y={y - 7} width="7" height="22" rx="2.5" fill="none" stroke="#000" stroke-opacity="0.6" />
          </g>
        ))}
        <path d={shape} fill="url(#khd-iron)" />
        <path d={shape} fill="url(#khd-heat)" />
        <path d={shape} filter="url(#khd-grain)" opacity="0.55" />
        <ellipse cx="28" cy="150" rx="16" ry="26" fill="#7a3416" opacity="0.28" filter="url(#khd-soft)" />
        <ellipse cx="56" cy="60" rx="10" ry="18" fill="#6a2c12" opacity="0.25" filter="url(#khd-soft)" />
        <path d="M20 120 q2 22 -1 46" stroke="#5a2410" stroke-width="3" opacity="0.35" fill="none" filter="url(#khd-soft)" />
        {/* raised frame and bevelled panels */}
        <path d={frame} fill="none" stroke="#0b0807" stroke-width="3" />
        <path d={frame} fill="none" stroke="#6b5c54" stroke-width="0.8" stroke-opacity="0.55" transform="translate(-0.7 -0.7)" />
        <path d="M16 112 L16 86 A58 58 0 0 1 64 30 L64 112 Z" fill="url(#khd-panel)" stroke="#0a0706" stroke-width="1.6" />
        <path d="M16 112 L16 86 A58 58 0 0 1 64 30" fill="none" stroke="#8a776c" stroke-opacity="0.35" stroke-width="0.8" transform="translate(0.9 0.9)" />
        <rect x="16" y="124" width="48" height="74" rx="2" fill="url(#khd-panel)" stroke="#0a0706" stroke-width="1.6" />
        <path d="M17 197 L17 125 L63 125" fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="1" />
        <path d="M17 197 L63 197 L63 125" fill="none" stroke="#8a776c" stroke-opacity="0.3" stroke-width="0.8" />
        {/* hinge straps with spear tips */}
        {[46, 166].map((y) => (
          <g key={y}>
            <path d={`M-10 ${y} L52 ${y} L64 ${y + 4} L52 ${y + 8} L-10 ${y + 8} Z`} fill="url(#khd-strap)" stroke="#060404" stroke-width="1" />
            <path d={`M-10 ${y + 0.8} L52 ${y + 0.8}`} stroke="#a08c80" stroke-opacity="0.35" stroke-width="0.7" />
            <Rivet x={4} y={y + 4} r={1.5} />
            <Rivet x={22} y={y + 4} r={1.5} />
            <Rivet x={40} y={y + 4} r={1.5} />
          </g>
        ))}
        {rivets.map(([x, y], i) => (
          <Rivet key={i} x={x} y={y} r={1.3} />
        ))}
        {side === 'l' ? (
          <g>
            <circle cx="40" cy="95" r="12" fill="url(#khd-bezel)" stroke="#050303" stroke-width="1.2" />
            <circle cx="40" cy="95" r="8" fill="#140604" />
            <circle cx="40" cy="95" r="8" fill="url(#khd-glow)" class="kh__peepGlow" />
            <path d="M32 95 H48 M40 87 V103" stroke="#1c1210" stroke-width="2" />
            <Rivet x={40} y={81.5} r={1.2} />
            <Rivet x={40} y={108.5} r={1.2} />
          </g>
        ) : (
          <g>
            <rect x="62" y="128" width="12" height="30" rx="3" fill="url(#khd-strap)" stroke="#050303" />
            <circle cx="68" cy="152" r="9" fill="none" stroke="#000" stroke-opacity="0.6" stroke-width="4" transform="translate(0.8 1.2)" />
            <circle cx="68" cy="152" r="9" fill="none" stroke="url(#khd-ring)" stroke-width="3.2" />
            <Rivet x={68} y={134} r={1.6} />
          </g>
        )}
        {/* hot seam edge */}
        <path d="M79.6 4 L79.6 214" stroke="url(#khd-seam)" stroke-width="0.9" />
        <path d={shape} fill="none" stroke="#000" stroke-opacity="0.7" stroke-width="1.2" />
      </g>
    </svg>
  );
}

/** Gradients and filters shared by every door leaf (rendered once per kiln). */
function DoorDefs() {
  return (
    <svg width="0" height="0" style="position:absolute" aria-hidden="true">
      <defs>
        <linearGradient id="khd-iron" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#3d3430" />
          <stop offset="0.45" stop-color="#262019" />
          <stop offset="1" stop-color="#120d0b" />
        </linearGradient>
        <linearGradient id="khd-heat" x1="0" x2="1">
          <stop offset="0.55" stop-color="#5a3a8a" stop-opacity="0" />
          <stop offset="0.8" stop-color="#4a3a7a" stop-opacity="0.22" />
          <stop offset="0.95" stop-color="#8a4a2a" stop-opacity="0.22" />
          <stop offset="1" stop-color="#d0642a" stop-opacity="0.32" />
        </linearGradient>
        <linearGradient id="khd-panel" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#1a1412" />
          <stop offset="1" stop-color="#2a221e" />
        </linearGradient>
        <linearGradient id="khd-strap" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#4f4540" />
          <stop offset="0.5" stop-color="#2c2421" />
          <stop offset="1" stop-color="#17110f" />
        </linearGradient>
        <linearGradient id="khd-pin" x1="0" x2="1">
          <stop offset="0" stop-color="#18120f" />
          <stop offset="0.45" stop-color="#5d524c" />
          <stop offset="1" stop-color="#1b1411" />
        </linearGradient>
        <radialGradient id="khd-rivet" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stop-color="#b8a69a" />
          <stop offset="0.4" stop-color="#5e514a" />
          <stop offset="1" stop-color="#1a1310" />
        </radialGradient>
        <radialGradient id="khd-bezel" cx="0.35" cy="0.3" r="0.8">
          <stop offset="0" stop-color="#7d6d64" />
          <stop offset="0.6" stop-color="#342b27" />
          <stop offset="1" stop-color="#120d0b" />
        </radialGradient>
        <radialGradient id="khd-glow">
          <stop offset="0" stop-color="#fff4c0" />
          <stop offset="0.45" stop-color="#ff9a34" />
          <stop offset="1" stop-color="#a3220b" />
        </radialGradient>
        <linearGradient id="khd-ring" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stop-color="#9a877b" />
          <stop offset="0.5" stop-color="#3a302b" />
          <stop offset="1" stop-color="#6a5a51" />
        </linearGradient>
        <linearGradient id="khd-seam" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ff7a2a" stop-opacity="0.2" />
          <stop offset="0.6" stop-color="#ff8a34" stop-opacity="0.65" />
          <stop offset="1" stop-color="#ffd27a" stop-opacity="0.9" />
        </linearGradient>
        <filter id="khd-grain" x="0" y="0" width="100%" height="100%">
          <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="3" seed="4" />
          <feColorMatrix values="0 0 0 0 0.05  0 0 0 0 0.03  0 0 0 0 0.02  0 0 0 -1.6 1.1" />
        </filter>
        <filter id="khd-soft" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" />
        </filter>
      </defs>
    </svg>
  );
}

export function KilnHero({ state, pot, label, heat = 'hot' }: { state: KilnState; pot?: ComponentChildren; label: string; heat?: 'hot' | 'cool' }) {
  const wall = useMemo(() => bricks(7, 20, 380, 20, 410, 40, 17), []);
  const chimney = useMemo(() => bricks(23, 262, 302, -40, 70, 20, 12), []);
  const arch = useMemo(() => voussoirs(200, 270, 80, 106, 13), []);
  const mouth = pct(120, 190, 160, 220);
  return (
    <figure class={`kh kh--${state} kh--${heat}`} role="img" aria-label={label}>
      <div class="kh__halo" />
      <DoorDefs />
      <svg class="kh__svg" viewBox={`0 ${VB_Y} 400 ${VB_H}`} aria-hidden="true">
        <defs>
          <clipPath id="kh-body">
            <path d={BODY} />
          </clipPath>
          <clipPath id="kh-chimney">
            <rect x="262" y="-40" width="40" height="110" />
          </clipPath>
          <linearGradient id="kh-round" x1="0" x2="1">
            <stop offset="0" stop-color="#000" stop-opacity="0.78" />
            <stop offset="0.28" stop-color="#000" stop-opacity="0.15" />
            <stop offset="0.55" stop-color="#000" stop-opacity="0" />
            <stop offset="0.8" stop-color="#000" stop-opacity="0.3" />
            <stop offset="1" stop-color="#000" stop-opacity="0.82" />
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
          <linearGradient id="kh-stone" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#4a3a33" />
            <stop offset="1" stop-color="#1c1411" />
          </linearGradient>
          <linearGradient id="kh-arch" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#7f3a24" />
            <stop offset="1" stop-color="#9a4a2a" />
          </linearGradient>
          <linearGradient id="kh-post" x1="0" x2="1">
            <stop offset="0" stop-color="#141010" />
            <stop offset="0.4" stop-color="#4a423e" />
            <stop offset="0.6" stop-color="#2c2522" />
            <stop offset="1" stop-color="#0e0b0a" />
          </linearGradient>
          <linearGradient id="kh-rod" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#5a504a" />
            <stop offset="1" stop-color="#151110" />
          </linearGradient>
          <radialGradient id="kh-face" cx="0.45" cy="0.4" r="0.7">
            <stop offset="0" stop-color="#f4ead8" />
            <stop offset="1" stop-color="#bfae94" />
          </radialGradient>
          <radialGradient id="kh-log" cx="0.5" cy="0.5" r="0.5">
            <stop offset="0" stop-color="#c79a62" />
            <stop offset="0.55" stop-color="#9a6a3a" />
            <stop offset="0.85" stop-color="#6a4226" />
            <stop offset="1" stop-color="#2e1a0e" />
          </radialGradient>
          <filter id="kh-grit" x="0" y="0" width="100%" height="100%">
            <feTurbulence type="fractalNoise" baseFrequency="0.95" numOctaves="2" seed="11" />
            <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -1.4 0.95" />
          </filter>
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
        <rect x="256" y="-48" width="52" height="1.5" fill="#8a766a" opacity="0.5" />

        {/* brick body */}
        <g clip-path="url(#kh-body)">
          <rect x="0" y="0" width="400" height="420" fill="#170906" />
          {wall.map((b, i) => (
            <g key={i}>
              <rect x={b.x} y={b.y} width={b.w} height={b.h} rx="1.4" fill={b.c} style={b.o === 1 ? undefined : { filter: `brightness(${b.o.toFixed(2)})` }} />
              <rect x={b.x + 1} y={b.y + 0.6} width={b.w - 2} height="1" fill="#ffb08a" opacity="0.1" />
            </g>
          ))}
          <rect x="0" y="0" width="400" height="420" filter="url(#kh-grit)" opacity="0.45" />
          <ellipse cx="200" cy="150" rx="105" ry="150" fill="url(#kh-soot)" />
          <rect x="0" y="0" width="400" height="420" fill="url(#kh-round)" />
          <rect x="0" y="0" width="400" height="420" fill="url(#kh-top)" />
        </g>
        <path d={BODY} fill="none" stroke="#000" stroke-opacity="0.5" stroke-width="2" />

        {/* iron buckstays and tie rod */}
        <path d="M58 118 C120 96 280 96 342 118" fill="none" stroke="url(#kh-rod)" stroke-width="4" />
        <rect x="190" y="98" width="20" height="8" rx="2" fill="url(#kh-post)" stroke="#050303" />
        {[44, 348].map((x) => (
          <g key={x}>
            <rect x={x} y="110" width="10" height="300" fill="url(#kh-post)" stroke="#050303" stroke-width="1" />
            <rect x={x - 3} y="112" width="16" height="9" rx="2" fill="url(#kh-post)" stroke="#050303" />
            {[160, 250, 340].map((y) => (
              <circle key={y} cx={x + 5} cy={y} r="2.2" fill="#6a5d56" stroke="#0a0706" stroke-width="0.8" />
            ))}
          </g>
        ))}

        {/* stoke holes */}
        {[68, 312].map((x) => (
          <g key={x}>
            <path d={`M${x} 404 L${x} 390 A10 10 0 0 1 ${x + 20} 390 L${x + 20} 404 Z`} fill="#0a0303" stroke="#2a1009" stroke-width="2" />
          </g>
        ))}

        {/* arch ring and jambs */}
        {arch.map((d, i) => (
          <path key={i} d={d} fill="url(#kh-arch)" stroke="#1a0906" stroke-width="1.4" style={{ filter: `brightness(${0.75 + ((i * 37) % 11) / 30})` }} />
        ))}
        <path d="M100 270 A100 100 0 0 1 300 270" fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="3" />
        {[270, 299, 328, 357, 386].map((y, i) => (
          <g key={y}>
            <rect x={i % 2 ? 98 : 94} y={y} width={i % 2 ? 22 : 26} height="27" rx="1.5" fill="#8e4428" stroke="#1a0906" stroke-width="1.4" />
            <rect x="280" y={y} width={i % 2 ? 22 : 26} height="27" rx="1.5" fill="#8e4428" stroke="#1a0906" stroke-width="1.4" />
          </g>
        ))}
        <path d={MOUTH} fill="#070202" />

        {/* pyrometer on the wall */}
        <path d="M330 268 V292" stroke="url(#kh-post)" stroke-width="4" />
        <circle cx="330" cy="250" r="19" fill="#0c0908" />
        <circle cx="330" cy="250" r="17.5" fill="url(#kh-post)" />
        <circle cx="330" cy="250" r="14" fill="url(#kh-face)" />
        <path d="M319 258 A13 13 0 1 1 341 258" fill="none" stroke="#3a2a20" stroke-width="1" stroke-dasharray="1 3.2" />
        <path d="M336 239 A13 13 0 0 1 341 258" fill="none" stroke="#c62a1a" stroke-width="2.2" />
        <text x="330" y="259" text-anchor="middle" font-size="4.2" fill="#3a2a20" font-family="sans-serif" font-weight="700">
          °C
        </text>

        {/* plinth, floor and woodpile */}
        <rect x="12" y="408" width="376" height="14" rx="3" fill="url(#kh-stone)" />
        <rect x="12" y="408" width="376" height="2" fill="#7a6458" opacity="0.45" />
        <ellipse cx="200" cy="432" rx="210" ry="10" fill="#000" opacity="0.55" />
        <g>
          {[
            [10, 418, 9],
            [29, 418, 9.5],
            [48, 419, 8.5],
            [20, 401, 9],
            [39, 401, 9],
            [29, 385, 8.5],
          ].map(([x, y, r], i) => (
            <g key={i}>
              <circle cx={x! + 1} cy={y! + 1.5} r={r} fill="#000" opacity="0.6" />
              <circle cx={x} cy={y} r={r} fill="url(#kh-log)" stroke="#24140a" stroke-width="1.6" />
              <circle cx={x} cy={y} r={r! * 0.55} fill="none" stroke="#7a5030" stroke-width="0.6" opacity="0.7" />
              <circle cx={x} cy={y} r={r! * 0.25} fill="none" stroke="#7a5030" stroke-width="0.6" opacity="0.7" />
            </g>
          ))}
        </g>
      </svg>

      {/* moving light on the static wall */}
      <div class="kh__firelight" />
      <div class="kh__port" style={pct(68, 380, 20, 24)} />
      <div class="kh__port" style={pct(312, 380, 20, 24)} />
      <div class="kh__needle" style={pct(330 - 1, 250 - 12, 2, 12)} />

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
            <DoorLeaf side="l" />
          </div>
          <div class="kh__door kh__door--r">
            <DoorLeaf side="r" />
          </div>
          <div class="kh__bar">
            <span class="kh__barCatch kh__barCatch--l" />
            <span class="kh__barCatch kh__barCatch--r" />
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
