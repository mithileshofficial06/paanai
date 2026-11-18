import React from 'react';
import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame } from 'remotion';
import { C, clamp, H, rnd, W } from './lib';

/** The game's black-to-red backdrop, slowly breathing, with two drifting glows. */
export const Backdrop: React.FC<{ hue?: 'red' | 'gold' | 'deep'; intensity?: number }> = ({ hue = 'red', intensity = 1 }) => {
  const f = useCurrentFrame();
  const t = f / 60;
  const g1 = hue === 'gold' ? 'rgba(239,190,104,0.35)' : 'rgba(216,31,39,0.42)';
  const g2 = hue === 'deep' ? 'rgba(80,10,20,0.5)' : 'rgba(255,87,71,0.22)';
  return (
    <AbsoluteFill style={{ background: `radial-gradient(120% 90% at 50% 110%, ${C.bgRed} 0%, ${C.bgMid} 45%, ${C.bg} 80%)` }}>
      <div
        style={{
          position: 'absolute',
          width: 1400,
          height: 1400,
          left: 200 + Math.sin(t * 0.21) * 260,
          top: 300 + Math.cos(t * 0.17) * 120,
          background: `radial-gradient(circle, ${g1} 0%, transparent 60%)`,
          opacity: 0.8 * intensity,
          filter: 'blur(40px)',
        }}
      />
      <div
        style={{
          position: 'absolute',
          width: 1200,
          height: 1200,
          left: 900 + Math.cos(t * 0.13) * 300,
          top: -300 + Math.sin(t * 0.19) * 160,
          background: `radial-gradient(circle, ${g2} 0%, transparent 60%)`,
          opacity: 0.7 * intensity,
          filter: 'blur(50px)',
        }}
      />
    </AbsoluteFill>
  );
};

/** Embers drifting up from below, flickering. */
export const Embers: React.FC<{ count?: number; opacity?: number; speed?: number; seed?: number }> = ({ count = 70, opacity = 1, speed = 1, seed = 1 }) => {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity }}>
      {Array.from({ length: count }, (_, i) => {
        const life = 6 + rnd(i, seed) * 8; // seconds per rise
        const t = ((f / 60) * speed + rnd(i, seed + 1) * life) % life;
        const p = t / life;
        const x0 = rnd(i, seed + 2) * W;
        const x = x0 + Math.sin(t * (0.6 + rnd(i, seed + 3)) + i) * 40 * (0.5 + p);
        const y = H + 40 - p * (H + 160);
        const size = 1.5 + rnd(i, seed + 4) * 4.5;
        const flick = 0.55 + 0.45 * Math.sin(f * (0.12 + rnd(i, seed + 5) * 0.2) + i * 7);
        const fade = Math.min(1, p * 6) * Math.min(1, (1 - p) * 2.5);
        const hot = rnd(i, seed + 6) > 0.7;
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              width: size,
              height: size,
              borderRadius: '50%',
              background: hot ? '#ffd28a' : C.ember,
              boxShadow: `0 0 ${size * 4}px ${size * 1.5}px ${hot ? 'rgba(255,190,110,0.55)' : 'rgba(255,59,47,0.5)'}`,
              opacity: fade * flick,
            }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/** Film grain from pre-made noise tiles. */
export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.1 }) => {
  const f = useCurrentFrame();
  const k = Math.floor(f / 2);
  const i = k % 6;
  const ox = Math.floor(rnd(k, 9) * 300);
  const oy = Math.floor(rnd(k, 10) * 200);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity, overflow: 'hidden' }}>
      <Img src={staticFile(`film/grain${i}.png`)} style={{ position: 'absolute', left: -ox, top: -oy, width: 2560, height: 1440 }} />
    </AbsoluteFill>
  );
};

export const Vignette: React.FC<{ strength?: number }> = ({ strength = 0.7 }) => (
  <AbsoluteFill style={{ pointerEvents: 'none', background: `radial-gradient(130% 110% at 50% 50%, transparent 55%, rgba(0,0,0,${strength}) 100%)` }} />
);

/** Letterbox bars that slide in for cinematic moments. */
export const Letterbox: React.FC<{ amount: number }> = ({ amount }) => (
  <>
    <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 120 * amount, background: '#000' }} />
    <div style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 120 * amount, background: '#000' }} />
  </>
);

/** A bright diagonal light sweep across the frame (p: 0..1). */
export const LightSweep: React.FC<{ p: number; color?: string; width?: number }> = ({ p, color = 'rgba(255,220,190,0.55)', width = 380 }) => {
  if (p <= 0 || p >= 1) return null;
  const x = interpolate(p, [0, 1], [-600, W + 600]);
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', overflow: 'hidden' }}>
      <div
        style={{
          position: 'absolute',
          left: x - width / 2,
          top: -400,
          width,
          height: H + 800,
          transform: 'rotate(18deg)',
          background: `linear-gradient(90deg, transparent, ${color}, transparent)`,
          filter: 'blur(18px)',
        }}
      />
    </AbsoluteFill>
  );
};

/** A flash (white-hot or ember) peaking at local second `at`. */
export const Flash: React.FC<{ at: number; dur?: number; color?: string; peak?: number }> = ({ at, dur = 0.5, color = '#fff1e0', peak = 0.9 }) => {
  const f = useCurrentFrame() / 60;
  const o = interpolate(f, [at - dur * 0.35, at, at + dur], [0, peak, 0], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 50%, ${color} 0%, ${color}cc 35%, transparent 90%)`, opacity: o, mixBlendMode: 'screen', pointerEvents: 'none' }} />;
};

/** Soft blurred light leak in a corner. */
export const LightLeak: React.FC<{ opacity?: number }> = ({ opacity = 0.5 }) => {
  const f = useCurrentFrame() / 60;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'screen', opacity }}>
      <div
        style={{
          position: 'absolute',
          left: -300 + Math.sin(f * 0.4) * 80,
          top: -260,
          width: 900,
          height: 700,
          background: 'radial-gradient(ellipse, rgba(255,140,80,0.45), transparent 65%)',
          filter: 'blur(30px)',
        }}
      />
    </AbsoluteFill>
  );
};
