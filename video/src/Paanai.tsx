// Paanai demo, 1920x1080, ~58 s. Real gameplay on a phone at native pixels, captions in the game's
// own type, a soft background taken from each shot, a film finish (grain, vignette, warm grade).
import React, { useEffect, useState } from 'react';
import {
  AbsoluteFill,
  Audio,
  continueRender,
  delayRender,
  Easing,
  Img,
  interpolate,
  OffthreadVideo,
  Sequence,
  staticFile,
  useCurrentFrame,
} from 'remotion';
import plan from './plan.json';
import { FPS } from './timeline';

type Piece = { clip: string; from: number; to: number; start: number; end: number; rate: number };
type Tap = { t: number; x: number; y: number };
type PlanShot = {
  id: string;
  start: number;
  end: number;
  kind: 'phone' | 'card' | 'title' | 'end';
  side?: 'left' | 'right';
  kicker?: string;
  headline?: string;
  sub?: string;
  zoom?: [number, number];
  pieces: Piece[];
  taps: Tap[];
};
const SHOTS = plan.shots as PlanShot[];

const C = {
  ink: '#fbeee4',
  muted: 'rgba(251, 233, 221, 0.74)',
  accent: '#ff8f7d',
  red: '#ff5747',
  gold: '#efbe68',
};
const SCREEN_W = 430;
const SCREEN_H = 932;
const BEZEL = 11;
const PHONE_X = { left: 560, right: 1360 }; // phone centre
const f = (s: number) => Math.round(s * FPS);
const ease = Easing.bezier(0.22, 1, 0.36, 1);
const clamp = { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' } as const;

// ---------- Fonts (the game's own) ----------
const FONTS: [string, string, string?][] = [
  ['Bagel', 'fonts/bagel-fat-one-latin.woff2'],
  ['FrauncesBlack', 'fonts/fraunces-black-latin.woff2'],
  ['FrauncesBlackItalic', 'fonts/fraunces-black-italic-latin.woff2'],
  ['Outfit', 'fonts/outfit-latin-var.woff2', '100 900'],
];
function useFonts() {
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

// ---------- Film finish ----------
const Grain: React.FC = () => {
  const frame = useCurrentFrame();
  const seed = Math.floor(frame / 2) % 50;
  return (
    <AbsoluteFill style={{ pointerEvents: 'none', mixBlendMode: 'overlay', opacity: 0.16 }}>
      <svg width="1920" height="1080">
        <filter id={`g${seed}`}>
          <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={seed} stitchTiles="stitch" />
          <feColorMatrix type="saturate" values="0" />
        </filter>
        <rect width="1920" height="1080" filter={`url(#g${seed})`} />
      </svg>
    </AbsoluteFill>
  );
};
const Vignette: React.FC = () => (
  <AbsoluteFill
    style={{
      pointerEvents: 'none',
      background: 'radial-gradient(120% 95% at 50% 48%, transparent 55%, rgba(4, 1, 1, 0.55) 100%)',
    }}
  />
);

// ---------- Backgrounds ----------
const Backgrounds: React.FC = () => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ backgroundColor: '#090304' }}>
      {SHOTS.map((s) => {
        const a = f(s.start);
        const b = f(s.end);
        if (frame < a - 1 || frame > b + 10) return null;
        const op = interpolate(frame, [a, a + 10], [0, 1], clamp);
        const src = s.kind === 'title' || s.kind === 'end' ? 'bg/kiln_full.png' : `bg/${s.id}.jpg`;
        const scale = interpolate(frame, [a, b + 10], [1.06, 1.12], clamp);
        const blur = s.kind === 'title' || s.kind === 'end' ? 'blur(26px) brightness(0.42) saturate(1.2)' : 'none';
        return (
          <AbsoluteFill key={s.id} style={{ opacity: op }}>
            <Img src={staticFile(src)} style={{ width: '100%', height: '100%', objectFit: 'cover', transform: `scale(${scale})`, filter: blur }} />
          </AbsoluteFill>
        );
      })}
      <AbsoluteFill style={{ background: 'radial-gradient(70% 60% at 50% 105%, rgba(255, 80, 40, 0.16), transparent 70%)' }} />
    </AbsoluteFill>
  );
};

// ---------- Phone ----------
function phonePlacement(frame: number) {
  // Find the current phone shot and the side it came from, to glide between sides.
  const idx = SHOTS.findIndex((s) => frame >= f(s.start) && frame < f(s.end));
  const s = SHOTS[idx];
  if (!s || s.kind !== 'phone') return null;
  const prev = SHOTS[idx - 1];
  const x1 = PHONE_X[s.side ?? 'right'];
  const local = frame - f(s.start);
  const k = interpolate(local, [0, 14], [0, 1], { ...clamp, easing: ease });
  let x = x1;
  let y = 0;
  let op = 1;
  if (prev && prev.kind === 'phone') x = interpolate(k, [0, 1], [PHONE_X[prev.side ?? 'right'], x1]);
  else {
    y = interpolate(k, [0, 1], [90, 0]);
    op = k;
  }
  const z = s.zoom ?? [1, 1];
  const scale = interpolate(local, [0, f(s.end - s.start)], z, clamp);
  return { s, x, y, op, scale, local };
}

const TapMarks: React.FC<{ taps: Tap[]; shotStart: number }> = ({ taps, shotStart }) => {
  const frame = useCurrentFrame();
  const t = shotStart + frame / FPS;
  return (
    <>
      {taps.map((u, i) => {
        const d = t - u.t;
        if (d < -0.22 || d > 0.45) return null;
        const appear = interpolate(d, [-0.22, -0.05], [0, 1], clamp);
        const leave = interpolate(d, [0.15, 0.45], [1, 0], clamp);
        const press = interpolate(d, [-0.05, 0.05, 0.2], [1, 0.82, 1], clamp);
        const ring = interpolate(d, [0, 0.45], [0.6, 2.2], clamp);
        const ringOp = interpolate(d, [0, 0.45], [0.6, 0], clamp);
        return (
          <div key={i} style={{ position: 'absolute', left: u.x * SCREEN_W, top: u.y * SCREEN_H, width: 0, height: 0 }}>
            <div style={{ position: 'absolute', left: -21, top: -21, width: 42, height: 42, borderRadius: 21, background: 'rgba(255,255,255,0.42)', boxShadow: '0 0 0 1.5px rgba(255,255,255,0.7), 0 4px 14px rgba(0,0,0,0.35)', opacity: appear * leave, transform: `scale(${press})` }} />
            {d >= 0 ? <div style={{ position: 'absolute', left: -21, top: -21, width: 42, height: 42, borderRadius: 21, border: '2px solid rgba(255,255,255,0.8)', opacity: ringOp, transform: `scale(${ring})` }} /> : null}
          </div>
        );
      })}
    </>
  );
};

const Footage: React.FC<{ pieces: Piece[]; shotStart: number; w?: number; h?: number }> = ({ pieces, shotStart, w = SCREEN_W, h = SCREEN_H }) => (
  <>
    {pieces.map((p, i) => (
      <Sequence key={i} from={f(p.start - shotStart)} durationInFrames={Math.max(1, f(p.end - p.start))} layout="none">
        <OffthreadVideo
          src={staticFile(`footage/${p.clip}.mp4`)}
          startFrom={Math.round(p.from * FPS)}
          playbackRate={p.rate}
          muted
          style={{ position: 'absolute', inset: 0, width: w, height: h }}
        />
      </Sequence>
    ))}
  </>
);

const PhoneShell: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div
    style={{
      position: 'absolute',
      width: SCREEN_W + BEZEL * 2,
      height: SCREEN_H + BEZEL * 2,
      padding: BEZEL,
      borderRadius: 58,
      background: 'linear-gradient(160deg, #2a201d 0%, #120c0b 45%, #1c1513 100%)',
      boxShadow: '0 50px 90px -20px rgba(0,0,0,0.75), 0 18px 40px rgba(0,0,0,0.45), inset 0 0 0 1.5px rgba(255, 228, 214, 0.10), inset 0 1px 0 rgba(255,255,255,0.12)',
      ...style,
    }}
  >
    <div style={{ position: 'relative', width: SCREEN_W, height: SCREEN_H, borderRadius: 47, overflow: 'hidden', background: '#000' }}>{children}</div>
  </div>
);

const Phone: React.FC = () => {
  const frame = useCurrentFrame();
  const pl = phonePlacement(frame);
  if (!pl) return null;
  const { s, x, y, op, scale } = pl;
  return (
    <PhoneShell style={{ left: x - (SCREEN_W + BEZEL * 2) / 2, top: (1080 - SCREEN_H - BEZEL * 2) / 2 + y, opacity: op, transform: `scale(${scale})` }}>
      <Sequence from={f(s.start)} durationInFrames={f(s.end - s.start)} layout="none">
        <Footage pieces={s.pieces} shotStart={s.start} />
        <TapMarks taps={s.taps} shotStart={s.start} />
      </Sequence>
    </PhoneShell>
  );
};

// ---------- Captions ----------
const Rise: React.FC<{ at: number; out: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, out, children, style }) => {
  const frame = useCurrentFrame();
  const k = interpolate(frame, [at, at + 16], [0, 1], { ...clamp, easing: ease });
  const o = interpolate(frame, [out - 7, out], [1, 0], clamp);
  return (
    <div style={{ overflow: 'hidden', paddingBottom: 6, ...style }}>
      <div style={{ transform: `translateY(${(1 - k) * 105}%) translateY(${(1 - o) * -10}px)`, opacity: Math.min(k * 1.4, o) }}>{children}</div>
    </div>
  );
};

const Kicker: React.FC<{ text: string }> = ({ text }) => {
  const m = text.match(/^(\d\d)\s+(.*)$/);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 16, font: '600 23px Outfit', letterSpacing: '0.24em', textTransform: 'uppercase', color: C.accent }}>
      {m ? <span style={{ color: C.gold, letterSpacing: '0.08em' }}>{m[1]}</span> : null}
      <span style={{ width: 34, height: 2, background: 'rgba(255, 143, 125, 0.7)' }} />
      <span>{m ? m[2] : text}</span>
    </div>
  );
};

const Caption: React.FC<{ s: PlanShot; left: number }> = ({ s, left }) => {
  const dur = f(s.end - s.start);
  return (
    <div style={{ position: 'absolute', left, top: 0, bottom: 0, width: 760, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 22 }}>
      {s.kicker ? (
        <Rise at={4} out={dur}>
          <Kicker text={s.kicker} />
        </Rise>
      ) : null}
      {s.headline ? (
        <Rise at={8} out={dur}>
          <div style={{ font: '400 78px FrauncesBlack', lineHeight: 1.02, letterSpacing: '-0.01em', color: C.ink, textShadow: '0 6px 30px rgba(0,0,0,0.45)' }}>{s.headline}</div>
        </Rise>
      ) : null}
      {s.sub ? (
        <Rise at={15} out={dur}>
          <div style={{ font: '400 30px Outfit', lineHeight: 1.35, color: C.muted, maxWidth: 640 }}>{s.sub}</div>
        </Rise>
      ) : null}
    </div>
  );
};

const PhoneShot: React.FC<{ s: PlanShot }> = ({ s }) => {
  const left = s.side === 'left' ? 1000 : 170;
  return <Caption s={s} left={left} />;
};

// ---------- Feed card close-up ----------
const CardShot: React.FC<{ s: PlanShot }> = ({ s }) => {
  const frame = useCurrentFrame();
  const dur = f(s.end - s.start);
  const k = interpolate(frame, [0, 12], [0, 1], { ...clamp, easing: ease });
  const scale = interpolate(frame, [0, dur], [1.2, 1.26], clamp);
  return (
    <AbsoluteFill>
      <Caption s={{ ...s, kicker: 'In the feed', headline: 'Even the post is making a pot.', sub: 'Today’s vessel takes shape right in the Reddit feed.' }} left={170} />
      <div
        style={{
          position: 'absolute',
          left: 1360 - 215,
          top: 540 - 280,
          width: 430,
          height: 560,
          borderRadius: 26,
          overflow: 'hidden',
          transform: `translateY(${(1 - k) * 40}px) scale(${scale})`,
          opacity: k,
          boxShadow: '0 50px 90px -20px rgba(0,0,0,0.75), 0 0 0 1px rgba(255,228,214,0.1)',
        }}
      >
        <Footage pieces={s.pieces} shotStart={s.start} w={430} h={560} />
      </div>
    </AbsoluteFill>
  );
};

// ---------- Embers (title and end) ----------
const Embers: React.FC<{ n?: number }> = ({ n = 34 }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: 'none' }}>
      {Array.from({ length: n }, (_, i) => {
        const x = (i * 139.7) % 1920;
        const speed = 1.1 + ((i * 37) % 9) / 6;
        const life = 150 + ((i * 53) % 90);
        const t = (frame * speed + i * 41) % life;
        const y = 1100 - (t / life) * 900;
        const drift = Math.sin((frame + i * 17) / 30) * 18;
        const size = 2 + (i % 3);
        const op = interpolate(t, [0, 20, life * 0.7, life], [0, 0.9, 0.5, 0]);
        return <div key={i} style={{ position: 'absolute', left: x + drift, top: y, width: size, height: size, borderRadius: size, background: '#ffb36b', boxShadow: '0 0 8px 2px rgba(255,110,50,0.7)', opacity: op }} />;
      })}
    </AbsoluteFill>
  );
};

// ---------- Title ----------
const Wordmark: React.FC<{ at: number; size: number }> = ({ at, size }) => {
  const frame = useCurrentFrame();
  const letters = 'Paanai'.split('');
  return (
    <div style={{ display: 'flex', font: `400 ${size}px Bagel`, lineHeight: 1, letterSpacing: '-0.01em' }}>
      {letters.map((ch, i) => {
        const k = interpolate(frame, [at + i * 2.5, at + i * 2.5 + 16], [0, 1], { ...clamp, easing: ease });
        return (
          <span key={i} style={{ display: 'inline-block', color: i >= 4 ? C.red : C.ink, transform: `translateY(${(1 - k) * 0.5 * size}px)`, opacity: k, textShadow: '0 10px 50px rgba(255, 59, 47, 0.45)' }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const TitleShot: React.FC<{ s: PlanShot }> = ({ s }) => {
  const frame = useCurrentFrame();
  const dur = f(s.end - s.start);
  const tag = interpolate(frame, [18, 34], [0, 1], { ...clamp, easing: ease });
  const out = interpolate(frame, [dur - 6, dur], [1, 0], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: out }}>
      <Embers />
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26, transform: `scale(${interpolate(frame, [0, dur], [1, 1.04])})` }}>
        <div style={{ font: '600 24px Outfit', letterSpacing: '0.3em', textTransform: 'uppercase', color: C.accent, opacity: tag }}>A daily pottery game for Reddit</div>
        <Wordmark at={2} size={250} />
        <div style={{ font: '400 54px FrauncesBlackItalic', color: C.ink, opacity: tag, transform: `translateY(${(1 - tag) * 20}px)` }}>
          Throw it. Paint it. <span style={{ color: C.gold }}>Fire it together.</span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

// ---------- End card ----------
const EndShot: React.FC<{ s: PlanShot }> = ({ s }) => {
  const frame = useCurrentFrame();
  const dur = f(s.end - s.start);
  const k = (a: number) => interpolate(frame, [a, a + 16], [0, 1], { ...clamp, easing: ease });
  const fadeOut = interpolate(frame, [dur - 20, dur], [1, 0], clamp);
  const reveal: Piece[] = [{ clip: 'c07_reveal', from: 4.4, to: 9.4, start: s.start, end: s.end, rate: 5 / (s.end - s.start) }];
  return (
    <AbsoluteFill style={{ opacity: fadeOut }}>
      <Embers n={26} />
      <div style={{ position: 'absolute', left: 170, top: 0, bottom: 0, width: 880, display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 24 }}>
        <Wordmark at={4} size={200} />
        <div style={{ font: '400 50px FrauncesBlackItalic', color: C.ink, opacity: k(16), transform: `translateY(${(1 - k(16)) * 20}px)` }}>
          Throw today’s pot.
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 18, marginTop: 18, opacity: k(26), transform: `translateY(${(1 - k(26)) * 20}px)` }}>
          <div style={{ padding: '16px 30px', borderRadius: 999, background: 'linear-gradient(180deg, #ff5a4a, #c4141e)', font: '700 30px Outfit', color: '#fff', boxShadow: '0 14px 40px -10px rgba(255,48,40,0.8)' }}>
            Play free on Reddit
          </div>
          <div style={{ font: '600 32px Outfit', color: C.ink }}>r/paanai_game_dev</div>
        </div>
        <div style={{ font: '400 24px Outfit', color: C.muted, marginTop: 10, opacity: k(36) }}>
          A new vessel every day · Every pot fires together · Built on Reddit’s Developer Platform
        </div>
      </div>
      <PhoneShell style={{ left: 1400 - (SCREEN_W + BEZEL * 2) / 2, top: (1080 - SCREEN_H - BEZEL * 2) / 2 + (1 - k(0)) * 80, opacity: k(0) }}>
        <Footage pieces={reveal} shotStart={s.start} />
      </PhoneShell>
    </AbsoluteFill>
  );
};

// ---------- Composition ----------
export const Paanai: React.FC = () => {
  useFonts();
  return (
    <AbsoluteFill style={{ backgroundColor: '#090304', filter: 'contrast(1.04) saturate(1.06)' }}>
      <Backgrounds />
      {SHOTS.map((s) => (
        <Sequence key={s.id} from={f(s.start)} durationInFrames={f(s.end - s.start)}>
          {s.kind === 'phone' ? <PhoneShot s={s} /> : s.kind === 'card' ? <CardShot s={s} /> : s.kind === 'title' ? <TitleShot s={s} /> : <EndShot s={s} />}
        </Sequence>
      ))}
      <Phone />
      <Vignette />
      <Grain />
      <Audio src={staticFile('audio/soundtrack.wav')} />
    </AbsoluteFill>
  );
};
