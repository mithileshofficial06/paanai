import React from 'react';
import { AbsoluteFill, interpolate, useCurrentFrame } from 'remotion';
import { C, clamp, easeInOut, H, s2f, W } from './lib';

export type Enter = 'iris' | 'smear' | 'zoom' | 'sweep' | 'flash' | 'blinds' | 'fade' | 'none';

/** A paanai silhouette (round belly, short neck, flared rim) centred on (cx, cy), `s` px half-height. */
export function potPath(cx: number, cy: number, s: number) {
  const P = (x: number, y: number) => `${(cx + x * s).toFixed(1)},${(cy + y * s).toFixed(1)}`;
  return [
    `M ${P(-0.42, -1)}`,
    `L ${P(0.42, -1)}`,
    `C ${P(0.42, -0.9)} ${P(0.24, -0.86)} ${P(0.27, -0.7)}`,
    `C ${P(0.95, -0.52)} ${P(1.08, 0.32)} ${P(0.6, 0.78)}`,
    `L ${P(0.36, 0.98)}`,
    `L ${P(-0.36, 0.98)}`,
    `L ${P(-0.6, 0.78)}`,
    `C ${P(-1.08, 0.32)} ${P(-0.95, -0.52)} ${P(-0.27, -0.7)}`,
    `C ${P(-0.24, -0.86)} ${P(-0.42, -0.9)} ${P(-0.42, -1)}`,
    'Z',
  ].join(' ');
}

/** Wraps a scene; for its first `dur` seconds it is revealed over the scene below with the given effect. */
export const Reveal: React.FC<{ type: Enter; dur?: number; children: React.ReactNode }> = ({ type, dur = 0.6, children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, s2f(dur)], [0, 1], { ...clamp, easing: easeInOut });
  if (type === 'none' || p >= 1) return <AbsoluteFill>{children}</AbsoluteFill>;
  if (type === 'fade') return <AbsoluteFill style={{ opacity: p }}>{children}</AbsoluteFill>;
  if (type === 'iris') {
    const s = interpolate(p, [0, 1], [2, 1250]);
    const d = potPath(W / 2, H / 2 + s * 0.05, s);
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ clipPath: `path('${d}')` }}>{children}</AbsoluteFill>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0, overflow: 'visible' }}>
          <path d={d} fill="none" stroke={C.coral} strokeWidth={6} opacity={1 - p} style={{ filter: 'drop-shadow(0 0 18px #ff5747)' }} />
        </svg>
      </AbsoluteFill>
    );
  }
  if (type === 'smear') {
    // A wet, wavy clay edge sweeping left to right.
    const edge = interpolate(p, [0, 1], [-260, W + 260]);
    const pts: string[] = [];
    const N = 28;
    for (let i = 0; i <= N; i++) {
      const y = (i / N) * H;
      const x = edge + Math.sin(i * 0.9 + f * 0.25) * 70 + Math.sin(i * 2.3) * 30 - (y / H) * 160;
      pts.push(`${x}px ${y}px`);
    }
    const poly = `polygon(-10px -10px, ${pts.join(', ')}, -10px ${H + 10}px)`;
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ clipPath: poly }}>{children}</AbsoluteFill>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <polyline
            points={pts.map((q) => q.replace(/px/g, '')).join(' ')}
            fill="none"
            stroke={C.terracotta}
            strokeWidth={26}
            strokeLinecap="round"
            opacity={0.85 * Math.sin(p * Math.PI)}
            style={{ filter: 'blur(6px)' }}
          />
          <polyline points={pts.map((q) => q.replace(/px/g, '')).join(' ')} fill="none" stroke={C.coral} strokeWidth={4} opacity={Math.sin(p * Math.PI)} />
        </svg>
      </AbsoluteFill>
    );
  }
  if (type === 'zoom') {
    return (
      <AbsoluteFill style={{ opacity: Math.min(1, p * 1.6), transform: `scale(${1.35 - 0.35 * p})`, filter: `blur(${(1 - p) * 24}px)` }}>{children}</AbsoluteFill>
    );
  }
  if (type === 'flash') {
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ opacity: interpolate(p, [0.35, 0.6], [0, 1], clamp) }}>{children}</AbsoluteFill>
        <AbsoluteFill style={{ background: 'radial-gradient(circle, #fff6ea 0%, #ffd2a0 40%, rgba(255,120,60,0.6) 80%)', opacity: Math.sin(p * Math.PI), mixBlendMode: 'screen' }} />
      </AbsoluteFill>
    );
  }
  if (type === 'sweep') {
    const x = interpolate(p, [0, 1], [-400, W + 400]);
    const poly = `polygon(-10px -10px, ${x + 300}px -10px, ${x - 300}px ${H + 10}px, -10px ${H + 10}px)`;
    return (
      <AbsoluteFill>
        <AbsoluteFill style={{ clipPath: poly }}>{children}</AbsoluteFill>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <line x1={x + 300} y1={-10} x2={x - 300} y2={H + 10} stroke="#ffe2cf" strokeWidth={5} style={{ filter: 'drop-shadow(0 0 24px #ff8f7d) drop-shadow(0 0 8px #fff)' }} />
        </svg>
      </AbsoluteFill>
    );
  }
  // blinds: vertical slats that open with a stagger
  const n = 12;
  const sw = W / n;
  let d = '';
  for (let i = 0; i < n; i++) {
    const q = interpolate(p, [i / n / 2, 0.5 + i / n / 2], [0, 1], clamp);
    const w = sw * q;
    const x = i * sw + (sw - w) / 2;
    d += `M ${x} 0 L ${x + w} 0 L ${x + w} ${H} L ${x} ${H} Z `;
  }
  return <AbsoluteFill style={{ clipPath: `path('${d}')` }}>{children}</AbsoluteFill>;
};
