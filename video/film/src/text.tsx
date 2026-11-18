import React from 'react';
import { interpolate, spring, useCurrentFrame } from 'remotion';
import { C, clamp, F, s2f } from './lib';
import { VO, VO_AT } from './timeline';

/**
 * Words rise in one by one out of a soft blur. `at` = local second of the first word, `gap` = seconds
 * between words, or `times` = local second for each word (synced to the narration).
 */
export const Kinetic: React.FC<{
  text: string;
  at: number;
  gap?: number;
  times?: number[];
  size?: number;
  font?: string;
  color?: string;
  colors?: Record<number, string>;
  out?: number; // local second it leaves
  align?: 'left' | 'center' | 'right';
  style?: React.CSSProperties;
  lineHeight?: number;
  letterSpacing?: string;
}> = ({ text, at, gap = 0.08, times, size = 96, font = F.display, color = C.cream, colors = {}, out, align = 'left', style, lineHeight = 1.02, letterSpacing = '-0.01em' }) => {
  const f = useCurrentFrame();
  const lines = text.split('\n');
  let wi = 0;
  const leave = out !== undefined ? interpolate(f, [s2f(out), s2f(out + 0.45)], [0, 1], clamp) : 0;
  return (
    <div style={{ fontFamily: font, fontSize: size, color, lineHeight, textAlign: align, letterSpacing, ...style }}>
      {lines.map((ln, li) => (
        <div key={li} style={{ whiteSpace: 'nowrap' }}>
          {ln.split(' ').map((w, i) => {
            const idx = wi++;
            const t0 = times?.[idx] ?? at + idx * gap;
            const sp = spring({ frame: f - s2f(t0), fps: 60, config: { damping: 15, stiffness: 140, mass: 0.8 } });
            const o = interpolate(f, [s2f(t0), s2f(t0 + 0.25)], [0, 1], clamp) * (1 - leave);
            const blur = (1 - Math.min(1, sp)) * 14 + leave * 12;
            return (
              <span
                key={i}
                style={{
                  display: 'inline-block',
                  marginRight: '0.24em',
                  opacity: o,
                  color: colors[idx] ?? color,
                  transform: `translateY(${(1 - sp) * 0.55 * size - leave * 30}px) scale(${0.92 + 0.08 * sp})`,
                  filter: `blur(${blur}px)`,
                }}
              >
                {w}
              </span>
            );
          })}
        </div>
      ))}
    </div>
  );
};

/** Small letter-spaced label, like the website's "A DAILY POTTERY GAME FOR REDDIT". */
export const Kicker: React.FC<{ text: string; at: number; color?: string; size?: number; out?: number; style?: React.CSSProperties }> = ({ text, at, color = C.coral, size = 24, out, style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [s2f(at), s2f(at + 0.7)], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 3) });
  const leave = out !== undefined ? interpolate(f, [s2f(out), s2f(out + 0.4)], [0, 1], clamp) : 0;
  const chars = text.length;
  const shown = Math.round(p * chars);
  return (
    <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: size, letterSpacing: '0.32em', color, opacity: (p > 0 ? 1 : 0) * (1 - leave), display: 'flex', alignItems: 'center', gap: 16, ...style }}>
      <div style={{ width: 46 * p, height: 3, background: color, borderRadius: 2, boxShadow: `0 0 12px ${color}` }} />
      <span>
        {text.slice(0, shown)}
        <span style={{ opacity: 0 }}>{text.slice(shown)}</span>
      </span>
    </div>
  );
};

/** Rounded pill chip, like the website's feature chips. */
export const Pill: React.FC<{ text: string; at: number; icon?: React.ReactNode; size?: number; glow?: boolean; out?: number; style?: React.CSSProperties }> = ({ text, at, icon, size = 30, glow, out, style }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 13, stiffness: 160 } });
  const leave = out !== undefined ? interpolate(f, [s2f(out), s2f(out + 0.35)], [0, 1], clamp) : 0;
  return (
    <div
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 12,
        padding: `${size * 0.42}px ${size * 0.85}px`,
        borderRadius: 999,
        border: `2px solid ${glow ? C.coral : 'rgba(255,143,125,0.42)'}`,
        background: glow ? 'rgba(216,31,39,0.28)' : 'rgba(52,8,13,0.62)',
        boxShadow: glow ? `0 0 30px rgba(255,87,71,0.45)` : '0 10px 30px rgba(0,0,0,0.35)',
        backdropFilter: 'blur(10px)',
        color: C.cream,
        fontFamily: F.body,
        fontWeight: 600,
        fontSize: size,
        opacity: Math.min(1, sp * 1.5) * (1 - leave),
        transform: `translateY(${(1 - sp) * 40}px) scale(${0.85 + 0.15 * sp})`,
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      {icon}
      {text}
    </div>
  );
};

/** Chapter tag in the top-left corner: number, name, and a progress line. */
export const Chapter: React.FC<{ n: string; name: string; dur: number }> = ({ n, name, dur }) => {
  const f = useCurrentFrame();
  const a = interpolate(f, [s2f(0.3), s2f(0.9), s2f(Math.min(dur - 0.8, 4.2)), s2f(Math.min(dur - 0.3, 4.8))], [0, 1, 1, 0], clamp);
  const pr = interpolate(f, [0, s2f(dur)], [0, 1], clamp);
  return (
    <div style={{ position: 'absolute', left: 72, top: 60, opacity: a, display: 'flex', alignItems: 'center', gap: 18, fontFamily: F.body }}>
      <div style={{ fontFamily: F.display, fontSize: 34, color: C.coral }}>{n}</div>
      <div>
        <div style={{ fontSize: 18, letterSpacing: '0.3em', fontWeight: 700, color: C.cream }}>{name.toUpperCase()}</div>
        <div style={{ marginTop: 8, width: 220, height: 3, borderRadius: 2, background: 'rgba(255,255,255,0.12)' }}>
          <div style={{ width: 220 * pr, height: 3, borderRadius: 2, background: C.coral, boxShadow: `0 0 10px ${C.coral}` }} />
        </div>
      </div>
    </div>
  );
};

/** Subtitles: the line being spoken, each word lighting up as it is said. Uses absolute time. */
export const Captions: React.FC = () => {
  const f = useCurrentFrame();
  const t = f / 60;
  const id = Object.keys(VO_AT).find((k) => t >= VO_AT[k]! - 0.15 && t <= VO_AT[k]! + (VO[k]?.dur ?? 0) + 0.35);
  if (!id) return null;
  const line = VO[id]!;
  const t0 = VO_AT[id]!;
  const lt = t - t0;
  // Show the sentence containing the current word (split long lines into chunks of <= 9 words).
  const display = line.text.split(' ');
  const timed = line.words;
  const chunks: number[][] = [];
  let cur: number[] = [];
  display.forEach((w, i) => {
    cur.push(i);
    if (/[.:?!]$/.test(w) || cur.length >= 9) {
      chunks.push(cur);
      cur = [];
    }
  });
  if (cur.length) chunks.push(cur);
  const wt = (i: number) => timed[Math.min(i, timed.length - 1)]?.t ?? 0;
  let ci = 0;
  for (let k = 0; k < chunks.length; k++) if (lt >= wt(chunks[k]![0]!) - 0.1) ci = k;
  const chunk = chunks[ci]!;
  const a = interpolate(lt, [-0.15, 0.1, line.dur + 0.1, line.dur + 0.35], [0, 1, 1, 0], clamp);
  return (
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 54, display: 'flex', justifyContent: 'center', opacity: a, pointerEvents: 'none' }}>
      <div
        style={{
          padding: '12px 26px',
          borderRadius: 16,
          background: 'rgba(7,2,3,0.62)',
          backdropFilter: 'blur(8px)',
          border: '1px solid rgba(255,143,125,0.16)',
          fontFamily: F.body,
          fontWeight: 500,
          fontSize: 31,
          color: 'rgba(251,238,228,0.5)',
          maxWidth: 1500,
          textAlign: 'center',
        }}
      >
        {chunk.map((i) => {
          const on = lt >= wt(i) - 0.02;
          return (
            <span key={i} style={{ color: on ? C.cream : undefined, transition: 'none' }}>
              {display[i]}{' '}
            </span>
          );
        })}
      </div>
    </div>
  );
};

/** Number that counts up. */
export const Counter: React.FC<{ to: number; at: number; dur?: number; suffix?: string; prefix?: string; style?: React.CSSProperties }> = ({ to, at, dur = 1.4, suffix = '', prefix = '', style }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [s2f(at), s2f(at + dur)], [0, 1], { ...clamp, easing: (x) => 1 - Math.pow(1 - x, 4) });
  return (
    <span style={{ fontVariantNumeric: 'tabular-nums', ...style }}>
      {prefix}
      {Math.round(to * p)}
      {suffix}
    </span>
  );
};
