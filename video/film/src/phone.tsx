import React from 'react';
import { AbsoluteFill, Freeze, interpolate, OffthreadVideo, Sequence, staticFile, useCurrentFrame } from 'remotion';
import clipsInfo from '../../public/film/clips/clips.json';
import { C, clamp } from './lib';

type Touch = { kind: string; x: number; y: number; t: number; label?: string };
type ClipInfo = { seconds: number; w: number; h: number; touches: Touch[] };
export const CLIPS = clipsInfo as unknown as Record<string, ClipInfo>;
export const clipLen = (c: string) => CLIPS[c]?.seconds ?? 10;
export const markAt = (c: string, label: string) => CLIPS[c]?.touches.find((t) => t.kind === 'mark' && t.label === label)?.t ?? 0;

/**
 * A recorded clip. `from` = second in the clip shown at local frame 0; `rate` = speed.
 * Holds the last frame when the clip runs out.
 */
export const Clip: React.FC<{ name: string; from?: number; rate?: number; style?: React.CSSProperties; hold?: boolean }> = ({ name, from = 0, rate = 1, style }) => {
  const f = useCurrentFrame();
  const len = clipLen(name);
  // Always ask for a whole source frame (slow motion repeats frames), and hold the last one.
  const last = Math.max(0, Math.floor((len - 0.05) * 60));
  const src = Math.min(last, Math.max(0, Math.round(from * 60 + f * rate)));
  return (
    <Freeze frame={src}>
      <OffthreadVideo src={staticFile(`film/clips/${name}.mp4`)} muted style={{ width: '100%', height: '100%', objectFit: 'cover', ...style }} />
    </Freeze>
  );
};

/** Fingertip: a soft glowing dot for drags (with a trail) and a ripple for taps. */
export const Finger: React.FC<{ clip: string; from?: number; rate?: number; w: number; h: number }> = ({ clip, from = 0, rate = 1, w, h }) => {
  const f = useCurrentFrame();
  const t = from + (f / 60) * rate; // clip time
  const touches = CLIPS[clip]?.touches ?? [];
  const els: React.ReactNode[] = [];
  // taps
  touches.forEach((tc, i) => {
    if (tc.kind !== 'tap') return;
    const d = t - tc.t;
    if (d < -0.35 || d > 0.7) return;
    const press = interpolate(d, [-0.35, -0.05, 0.05, 0.35], [0, 1, 1, 0], clamp);
    const ring = interpolate(d, [0, 0.7], [0, 1], clamp);
    els.push(
      <React.Fragment key={`t${i}`}>
        <div style={dot(tc.x * w, tc.y * h, 46 - press * 8, `rgba(255,240,230,${0.42 * press})`, 'rgba(255,255,255,0.7)')} />
        {d > 0 && (
          <div
            style={{
              position: 'absolute',
              left: tc.x * w - 40 - ring * 50,
              top: tc.y * h - 40 - ring * 50,
              width: 80 + ring * 100,
              height: 80 + ring * 100,
              borderRadius: '50%',
              border: `3px solid rgba(255,143,125,${1 - ring})`,
            }}
          />
        )}
      </React.Fragment>,
    );
  });
  // drags: find the active down..up segment
  let seg: Touch[] = [];
  let active = false;
  let lastUp = -1;
  for (let i = 0; i < touches.length; i++) {
    const tc = touches[i]!;
    if (tc.kind === 'down') {
      const segPts: Touch[] = [tc];
      let j = i + 1;
      while (j < touches.length && touches[j]!.kind !== 'up') {
        if (touches[j]!.kind === 'move') segPts.push(touches[j]!);
        j++;
      }
      const up = touches[j];
      if (up) segPts.push(up);
      const t0 = tc.t - 0.25;
      const t1 = (up?.t ?? tc.t) + 0.3;
      if (t >= t0 && t <= t1) {
        seg = segPts;
        active = true;
        lastUp = up?.t ?? t1;
      }
      i = j;
    }
  }
  if (active && seg.length) {
    const t0 = seg[0]!.t;
    const pts = seg.filter((p) => p.t <= t);
    const cur = pts.length ? pts[pts.length - 1]! : seg[0]!;
    const fadeIn = interpolate(t, [t0 - 0.25, t0], [0, 1], clamp);
    const fadeOut = interpolate(t, [lastUp, lastUp + 0.3], [1, 0], clamp);
    const a = fadeIn * fadeOut;
    const trail = pts.slice(-18);
    if (trail.length > 1) {
      els.push(
        <svg key="trail" width={w} height={h} style={{ position: 'absolute', left: 0, top: 0, overflow: 'visible' }}>
          <defs>
            <linearGradient id="trailg" x1="0" x2="0" y1="1" y2="0">
              <stop offset="0" stopColor={C.coral} stopOpacity="0" />
              <stop offset="1" stopColor="#ffd6c8" stopOpacity="0.9" />
            </linearGradient>
          </defs>
          <polyline
            points={trail.map((p) => `${p.x * w},${p.y * h}`).join(' ')}
            fill="none"
            stroke={C.coral}
            strokeOpacity={0.75 * a}
            strokeWidth={10}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ filter: 'drop-shadow(0 0 10px rgba(255,87,71,0.9))' }}
          />
        </svg>,
      );
    }
    els.push(<div key="drag" style={{ ...dot(cur.x * w, cur.y * h, 50, `rgba(255,240,230,${0.45 * a})`, `rgba(255,255,255,${0.85 * a})`) }} />);
  }
  return <AbsoluteFill style={{ pointerEvents: 'none' }}>{els}</AbsoluteFill>;
};

function dot(x: number, y: number, size: number, fill: string, ring: string): React.CSSProperties {
  return {
    position: 'absolute',
    left: x - size / 2,
    top: y - size / 2,
    width: size,
    height: size,
    borderRadius: '50%',
    background: fill,
    border: `3px solid ${ring}`,
    boxShadow: '0 0 30px rgba(255,120,90,0.6), inset 0 0 12px rgba(255,255,255,0.4)',
  };
}

export const SCREEN_W = 430;
export const SCREEN_H = 932;

/**
 * A modern phone with a recorded clip on its screen, floating in 3D.
 * `height` = phone height in px; rotY/rotX in degrees.
 */
export type Piece = { at: number; clip: string; from?: number; rate?: number };
export const Phone: React.FC<{
  clip?: string;
  pieces?: Piece[];
  from?: number;
  rate?: number;
  height?: number;
  x: number;
  y: number;
  rotY?: number;
  rotX?: number;
  rotZ?: number;
  scale?: number;
  opacity?: number;
  finger?: boolean;
  zoom?: { s: number; x: number; y: number }; // zoom into the screen: scale, focus point (0..1)
  children?: React.ReactNode; // overlays drawn in screen space (430x932 units)
}> = ({ clip, pieces, from = 0, rate = 1, height = 900, x, y, rotY = 0, rotX = 0, rotZ = 0, scale = 1, opacity = 1, finger = true, zoom, children }) => {
  const f = useCurrentFrame();
  const bez = 14;
  const sh = height - bez * 2;
  const k = sh / SCREEN_H;
  const sw = SCREEN_W * k;
  const pw = sw + bez * 2;
  const float = Math.sin(f / 60 * 1.1) * 6;
  const z = zoom ?? { s: 1, x: 0.5, y: 0.5 };
  return (
    <div
      style={{
        position: 'absolute',
        left: x - pw / 2,
        top: y - height / 2 + float,
        width: pw,
        height,
        transform: `perspective(2200px) rotateY(${rotY}deg) rotateX(${rotX}deg) rotateZ(${rotZ}deg) scale(${scale})`,
        transformStyle: 'preserve-3d',
        opacity,
      }}
    >
      {/* shadow */}
      <div
        style={{
          position: 'absolute',
          left: 30,
          right: 30,
          bottom: -50,
          height: 80,
          borderRadius: '50%',
          background: 'rgba(0,0,0,0.7)',
          filter: 'blur(30px)',
          transform: 'translateZ(-40px)',
        }}
      />
      {/* body */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 64 * (height / 900),
          background: 'linear-gradient(145deg, #3a2a28 0%, #120a0a 40%, #241716 100%)',
          boxShadow: `0 40px 120px rgba(0,0,0,0.75), 0 0 0 2px rgba(255,200,180,0.18), inset 0 0 0 2px rgba(255,255,255,0.06), 0 0 80px rgba(216,31,39,0.25)`,
        }}
      />
      {/* screen */}
      <div
        style={{
          position: 'absolute',
          left: bez,
          top: bez,
          width: sw,
          height: sh,
          borderRadius: 52 * (height / 900),
          overflow: 'hidden',
          background: '#000',
        }}
      >
        <div
          style={{
            position: 'absolute',
            width: sw,
            height: sh,
            transformOrigin: `${z.x * 100}% ${z.y * 100}%`,
            transform: `scale(${z.s})`,
          }}
        >
          {(() => {
            const list: Piece[] = pieces ?? [{ at: 0, clip: clip!, from, rate }];
            const lt = f / 60;
            let cur = list[0]!;
            for (const pc of list) if (lt >= pc.at) cur = pc;
            return (
              <Sequence key={`${cur.clip}${cur.at}`} from={Math.round(cur.at * 60)} layout="none">
                <Clip name={cur.clip} from={cur.from ?? 0} rate={cur.rate ?? 1} />
                {finger && <Finger clip={cur.clip} from={cur.from ?? 0} rate={cur.rate ?? 1} w={sw} h={sh} />}
              </Sequence>
            );
          })()}
          <div style={{ position: 'absolute', left: 0, top: 0, width: SCREEN_W, height: SCREEN_H, transform: `scale(${k})`, transformOrigin: '0 0' }}>{children}</div>
        </div>
        {/* glass reflection */}
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: 'linear-gradient(115deg, rgba(255,255,255,0.10) 0%, rgba(255,255,255,0.02) 28%, transparent 40%)',
            pointerEvents: 'none',
          }}
        />
      </div>
      {/* side buttons */}
      <div style={{ position: 'absolute', right: -3, top: height * 0.22, width: 4, height: height * 0.1, borderRadius: 2, background: '#2b1d1c' }} />
      <div style={{ position: 'absolute', left: -3, top: height * 0.18, width: 4, height: height * 0.06, borderRadius: 2, background: '#2b1d1c' }} />
      <div style={{ position: 'absolute', left: -3, top: height * 0.27, width: 4, height: height * 0.06, borderRadius: 2, background: '#2b1d1c' }} />
    </div>
  );
};

/** Ring highlight in screen units (430x932) for drawing attention to a control. */
export const ScreenRing: React.FC<{ x: number; y: number; w: number; h: number; p: number; color?: string }> = ({ x, y, w, h, p, color = C.gold }) => {
  if (p <= 0) return null;
  const pulse = 1 + 0.04 * Math.sin(useCurrentFrame() / 6);
  return (
    <div
      style={{
        position: 'absolute',
        left: x - 8,
        top: y - 8,
        width: w + 16,
        height: h + 16,
        borderRadius: 999,
        border: `3px solid ${color}`,
        boxShadow: `0 0 24px ${color}, inset 0 0 18px ${color}55`,
        opacity: p,
        transform: `scale(${(1.3 - 0.3 * p) * pulse})`,
      }}
    />
  );
};
