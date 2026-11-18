import React, { useEffect, useState } from 'react';
import { continueRender, delayRender, Easing, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from 'remotion';

export const FPS = 60;
export const W = 1920;
export const H = 1080;
export const s2f = (s: number) => Math.round(s * FPS);

// The game's palette.
export const C = {
  bg: '#070203',
  bgMid: '#14050a',
  bgRed: '#34080d',
  accent: '#d81f27',
  ember: '#ff3b2f',
  coral: '#ff5747',
  coralSoft: '#ff8f7d',
  cream: '#fbeee4',
  muted: 'rgba(251, 233, 221, 0.72)',
  gold: '#efbe68',
  goldDeep: '#d39a2b',
  terracotta: '#b0603a',
  bisque: '#d9b9a0',
  green: '#4ad08a',
  glass: 'rgba(36, 10, 14, 0.55)',
  line: 'rgba(255, 143, 125, 0.28)',
};

export const F = {
  logo: 'Bagel, sans-serif',
  display: 'FrauncesBlack, serif',
  italic: 'FrauncesBlackItalic, serif',
  body: 'Outfit, sans-serif',
};

export const ease = Easing.bezier(0.22, 1, 0.36, 1);
export const easeIn = Easing.bezier(0.55, 0, 0.75, 0.2);
export const easeInOut = Easing.bezier(0.65, 0, 0.35, 1);
export const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

/** 0..1 over [a, b] seconds of local time, eased. */
export function prog(frame: number, a: number, b: number, e = ease) {
  return interpolate(frame, [s2f(a), Math.max(s2f(a) + 1, s2f(b))], [0, 1], { ...clamp, easing: e });
}

export function useSpring(delaySec = 0, config: { damping?: number; stiffness?: number; mass?: number } = {}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return spring({ frame: frame - s2f(delaySec), fps, config: { damping: 16, stiffness: 120, mass: 0.9, ...config } });
}

const FONTS: [string, string, string?][] = [
  ['Bagel', 'fonts/bagel-fat-one-latin.woff2'],
  ['FrauncesBlack', 'fonts/fraunces-black-latin.woff2'],
  ['FrauncesBlackItalic', 'fonts/fraunces-black-italic-latin.woff2'],
  ['Outfit', 'fonts/outfit-latin-var.woff2', '100 900'],
];
export function useFonts() {
  const [handle] = useState(() => delayRender('fonts'));
  useEffect(() => {
    Promise.all(
      FONTS.map(([name, file, weight]) => {
        const face = new FontFace(name, `url(${staticFile(file)})`, weight ? { weight } : {});
        document.fonts.add(face);
        return face.load();
      }),
    ).then(() => continueRender(handle));
  }, [handle]);
}

/** Deterministic pseudo random in [0,1). */
export function rnd(i: number, salt = 0) {
  const x = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return x - Math.floor(x);
}

export const Glow: React.FC<{ color?: string; size?: number; x?: number; y?: number; opacity?: number }> = ({
  color = C.accent,
  size = 900,
  x = W / 2,
  y = H / 2,
  opacity = 0.5,
}) => (
  <div
    style={{
      position: 'absolute',
      left: x - size / 2,
      top: y - size / 2,
      width: size,
      height: size,
      borderRadius: '50%',
      background: `radial-gradient(circle, ${color} 0%, transparent 65%)`,
      opacity,
      filter: 'blur(20px)',
      pointerEvents: 'none',
    }}
  />
);
