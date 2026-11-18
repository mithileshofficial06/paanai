import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame } from 'remotion';
import { Embers, Flash, Letterbox, LightSweep, Vignette, Backdrop } from './fx';
import { C, clamp, ease, F, H, s2f, W } from './lib';
import { Clip, clipLen, CLIPS, markAt, Phone, ScreenRing } from './phone';
import { Chapter, Kicker, Kinetic, Pill } from './text';
import { SCENES, VO_AT, wordAt } from './timeline';
import { Reveal } from './transitions';

/** Local second of an absolute time, for a scene. */
const loc = (scene: keyof typeof SCENES) => (abs: number) => abs - SCENES[scene][0];

/** A full-frame hero clip with a slow camera move. */
export const Hero: React.FC<{
  clip: string;
  from?: number;
  rate?: number;
  zoom?: [number, number];
  focus?: [number, number];
  dur: number;
  blur?: number;
  dim?: number;
  shake?: number;
}> = ({ clip, from = 0, rate = 1, zoom = [1.1, 1.2], focus = [0.5, 0.5], dur, blur = 0, dim = 0, shake = 0 }) => {
  const f = useCurrentFrame();
  const z = interpolate(f, [0, s2f(dur)], zoom, { ...clamp, easing: (x) => x });
  const sx = shake ? Math.sin(f * 1.7) * shake + Math.sin(f * 2.9) * shake * 0.5 : 0;
  const sy = shake ? Math.cos(f * 2.3) * shake : 0;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <AbsoluteFill style={{ transformOrigin: `${focus[0] * 100}% ${focus[1] * 100}%`, transform: `translate(${sx}px, ${sy}px) scale(${z})`, filter: blur ? `blur(${blur}px)` : undefined }}>
        <Clip name={clip} from={from} rate={rate} />
      </AbsoluteFill>
      {dim > 0 && <AbsoluteFill style={{ background: `rgba(7,2,3,${dim})` }} />}
    </AbsoluteFill>
  );
};

// ======================================================================= 1. OPEN
export const SceneOpen: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('open');
  const dur = SCENES.open[1] - SCENES.open[0];
  const ts = markAt('h01_throw', 'throw-start');
  const titleAt = 9.7;
  const blur = interpolate(f, [s2f(titleAt), s2f(titleAt + 1.2)], [0, 16], clamp);
  const dim = interpolate(f, [s2f(titleAt), s2f(titleAt + 1.2)], [0, 0.45], clamp);
  const lb = interpolate(f, [s2f(0.2), s2f(1.4), s2f(titleAt - 0.2), s2f(titleAt + 0.6)], [0, 1, 1, 0], { ...clamp, easing: ease });
  const fadeIn = interpolate(f, [0, s2f(1.6)], [0, 1], clamp);
  // Phrases synced to the narration.
  const p1 = L(wordAt('open2', 'lump')) - 0.15;
  const p2 = L(wordAt('open2', 'spinning')) - 0.15;
  const p3 = L(wordAt('open2', 'pair')) - 0.35;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <AbsoluteFill style={{ opacity: fadeIn }}>
        {/* The lump turns in slow motion, then the throw begins as the narration says "a pair of hands" */}
        <AbsoluteFill style={{ transformOrigin: '50% 47%', transform: `scale(${interpolate(f, [0, s2f(dur)], [1.75, 1.15], clamp)})`, filter: blur ? `blur(${blur}px)` : undefined }}>
          <Sequence durationInFrames={s2f(p3 + 0.2)}>
            <Hero clip="h01_throw" from={0} rate={Math.max(0.2, (ts - 0.05) / (p3 + 0.2))} zoom={[1, 1]} dur={dur} />
          </Sequence>
          <Sequence from={s2f(p3 + 0.2)}>
            <Hero clip="h01_throw" from={ts} rate={0.8} zoom={[1, 1]} dur={dur} />
          </Sequence>
        </AbsoluteFill>
        <AbsoluteFill style={{ background: `rgba(7,2,3,${dim})` }} />
      </AbsoluteFill>
      <Embers count={50} opacity={0.7 * fadeIn} />
      <Vignette strength={0.85} />
      {/* opening line */}
      <div style={{ position: 'absolute', left: 120, bottom: 230 }}>
        <Kinetic text="Every pot in history" at={L(VO_AT.open1!) + 0.05} gap={0.16} size={70} font={F.italic} out={L(VO_AT.open2!) - 0.4} />
        <Kinetic text="began the same way." at={L(wordAt('open1', 'began'))} gap={0.14} size={70} font={F.italic} color={C.gold} out={L(VO_AT.open2!) - 0.4} />
      </div>
      <div style={{ position: 'absolute', left: 120, bottom: 230 }}>
        <Kinetic text="A lump of wet clay." at={p1} gap={0.1} size={92} font={F.display} out={p2 - 0.25} />
      </div>
      <div style={{ position: 'absolute', left: 120, bottom: 230 }}>
        <Kinetic text="A spinning wheel." at={p2} gap={0.1} size={92} font={F.display} out={p3 - 0.2} />
      </div>
      <div style={{ position: 'absolute', left: 120, bottom: 230 }}>
        <Kinetic text="And a pair of hands." at={p3} gap={0.1} size={92} font={F.display} colors={{ 4: C.coral }} out={titleAt - 0.3} />
      </div>
      <Letterbox amount={lb} />
      {/* Title */}
      <Sequence from={s2f(titleAt)}>
        <Title />
      </Sequence>
      <Flash at={titleAt + 0.15} dur={0.7} color="#ff9a6a" peak={0.55} />
    </AbsoluteFill>
  );
};

/** The Paanai wordmark, letter by letter, in the website's style. */
export const Logo: React.FC<{ at?: number; size?: number }> = ({ at = 0, size = 260 }) => {
  const f = useCurrentFrame();
  const letters = 'Paanai'.split('');
  return (
    <div style={{ fontFamily: F.logo, fontSize: size, lineHeight: 1, display: 'flex', letterSpacing: '-0.01em' }}>
      {letters.map((ch, i) => {
        const sp = spring({ frame: f - s2f(at + i * 0.07), fps: 60, config: { damping: 11, stiffness: 150, mass: 0.9 } });
        const ai = i >= 4;
        return (
          <span
            key={i}
            style={{
              display: 'inline-block',
              color: ai ? C.coral : C.cream,
              opacity: Math.min(1, sp * 2),
              transform: `translateY(${(1 - sp) * 120}px) scale(${0.6 + 0.4 * sp}) rotate(${(1 - sp) * (i % 2 ? 8 : -8)}deg)`,
              textShadow: ai ? '0 0 40px rgba(255,87,71,0.75), 0 0 90px rgba(255,59,47,0.45)' : '0 0 50px rgba(255,200,170,0.25)',
            }}
          >
            {ch}
          </span>
        );
      })}
    </div>
  );
};

const Title: React.FC = () => {
  const f = useCurrentFrame();
  const sweep = interpolate(f, [s2f(1.3), s2f(2.4)], [0, 1], clamp);
  const out = interpolate(f, [s2f(5.0), s2f(5.7)], [0, 1], clamp);
  return (
    <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: 1 - out * 0.0, transform: `scale(${1 + out * 0.06})` }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 26 }}>
        <Kicker text="A DAILY POTTERY GAME FOR REDDIT" at={0.2} size={26} />
        <Logo at={0.15} size={250} />
        <Kinetic text="Throw it. Paint it. Fire it together." at={1.0} gap={0.12} size={66} font={F.italic} colors={{ 4: C.gold, 5: C.gold, 6: C.gold }} align="center" />
      </div>
      <LightSweep p={sweep} />
    </AbsoluteFill>
  );
};

// ======================================================================= 2. HOOK
const FeedCard: React.FC = () => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(0.2), fps: 60, config: { damping: 18, stiffness: 90 } });
  const rot = interpolate(f, [0, s2f(6)], [-16, -8], clamp);
  const w = 640;
  const media = (w * 640) / 520;
  return (
    <div
      style={{
        position: 'absolute',
        left: 1080,
        top: 40 + (1 - sp) * 300,
        width: w + 40,
        opacity: Math.min(1, sp * 1.5),
        transform: `perspective(2000px) rotateY(${rot}deg) rotateX(4deg)`,
        borderRadius: 34,
        padding: 20,
        background: 'linear-gradient(160deg, #1d0d10, #0e0607)',
        boxShadow: '0 50px 140px rgba(0,0,0,0.8), 0 0 0 2px rgba(255,143,125,0.2), 0 0 90px rgba(216,31,39,0.25)',
        fontFamily: F.body,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 12 }}>
        <div style={{ width: 46, height: 46, borderRadius: '50%', background: `radial-gradient(circle at 35% 35%, ${C.coral}, ${C.accent})`, boxShadow: '0 0 18px rgba(255,87,71,0.5)' }} />
        <div>
          <div style={{ color: C.cream, fontWeight: 700, fontSize: 22 }}>r/paanai_game_dev</div>
          <div style={{ color: C.muted, fontSize: 17 }}>Daily commission · 2h</div>
        </div>
      </div>
      <div style={{ color: C.cream, fontWeight: 700, fontSize: 27, marginBottom: 14 }}>Today's commission: Paanai, Tamil Nadu</div>
      <div style={{ width: w, height: media, borderRadius: 20, overflow: 'hidden', background: '#000' }}>
        <Clip name="p00_splash" from={0} />
      </div>
      <div style={{ display: 'flex', gap: 16, marginTop: 16, color: C.muted, fontSize: 20, fontWeight: 600 }}>
        {['Upvote', 'Comments', 'Share'].map((t) => (
          <div key={t} style={{ padding: '8px 18px', borderRadius: 999, background: 'rgba(255,255,255,0.06)' }}>
            {t}
          </div>
        ))}
      </div>
    </div>
  );
};

const VesselPanel: React.FC<{ clip: string; name: string; origin: string; at: number; i: number; total: number }> = ({ clip, name, origin, at, i, total }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [s2f(at), s2f(at + 0.75)], [0, 1], { ...clamp, easing: ease });
  const pw = W / total;
  const x0 = i * pw;
  const skew = 90;
  // Parallelogram panel sliding up from below.
  const dy = (1 - p) * H;
  const poly = `polygon(${x0 + skew}px ${dy}px, ${x0 + pw + skew}px ${dy}px, ${x0 + pw - skew}px ${H + dy}px, ${x0 - skew}px ${H + dy}px)`;
  const ps = markAt(clip, 'passes');
  const lab = interpolate(f, [s2f(at + 0.5), s2f(at + 1.1)], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill style={{ clipPath: poly }}>
      <AbsoluteFill style={{ left: x0 + pw / 2 - W / 2 }}>
        <Sequence from={s2f(at)}>
          <Hero clip={clip} from={Math.max(0, ps - 1.6)} rate={0.6} zoom={[1.45, 1.3]} focus={[0.5, 0.5]} dur={12} />
        </Sequence>
      </AbsoluteFill>
      <AbsoluteFill style={{ background: 'linear-gradient(180deg, transparent 55%, rgba(7,2,3,0.92) 100%)' }} />
      <div style={{ position: 'absolute', left: x0 + 40, width: pw - 80, bottom: 150, textAlign: 'center', opacity: lab, transform: `translateY(${(1 - lab) * 30}px)` }}>
        <div style={{ fontFamily: F.display, fontSize: 60, color: C.cream, textShadow: '0 4px 30px rgba(0,0,0,0.8)' }}>{name}</div>
        <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 20, letterSpacing: '0.28em', color: C.coral, marginTop: 6 }}>{origin.toUpperCase()}</div>
      </div>
      <div style={{ position: 'absolute', left: x0 + pw - skew - 2, top: 0, width: 4, height: H, background: C.coral, opacity: 0.0 }} />
    </AbsoluteFill>
  );
};

const POTTERS = ['kofi_makes', 'harumi_clay', 'slip_and_score', 'priya_paints', 'leo_kiln', 'mateo_wheel', 'oak_and_ash', 'tara_glaze', 'wren_pottery', 'arjun_throws', 'mira', 'you'];

const SamePot: React.FC<{ at: number }> = ({ at }) => {
  const f = useCurrentFrame();
  const lt = f / 60 - at;
  const len = clipLen('h01_throw');
  return (
    <AbsoluteFill>
      <Hero clip="h01_throw" from={len - 3.2} rate={0.5} zoom={[1.5, 1.6]} focus={[0.5, 0.5]} dur={6} dim={0.35} />
      <Embers count={40} opacity={0.6} seed={4} />
      {POTTERS.map((u, i) => {
        const a = (i / POTTERS.length) * Math.PI * 2 + lt * 0.35;
        const rx = 700;
        const ry = 250;
        const x = W / 2 + Math.cos(a) * rx;
        const y = H / 2 + 40 + Math.sin(a) * ry;
        const depth = (Math.sin(a) + 1) / 2; // 0 back .. 1 front
        const sp = spring({ frame: f - s2f(at + 0.05 * i), fps: 60, config: { damping: 14 } });
        return (
          <div
            key={u}
            style={{
              position: 'absolute',
              left: x,
              top: y,
              transform: `translate(-50%, -50%) scale(${(0.7 + 0.45 * depth) * sp})`,
              opacity: (0.45 + 0.55 * depth) * Math.min(1, sp * 2),
              zIndex: Math.round(depth * 10),
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '10px 20px 10px 10px',
              borderRadius: 999,
              background: u === 'you' ? 'rgba(216,31,39,0.55)' : 'rgba(30,10,12,0.7)',
              border: `2px solid ${u === 'you' ? C.coral : 'rgba(255,143,125,0.35)'}`,
              color: C.cream,
              fontFamily: F.body,
              fontWeight: 600,
              fontSize: 24,
              filter: `blur(${(1 - depth) * 1.5}px)`,
            }}
          >
            <div style={{ width: 34, height: 34, borderRadius: '50%', background: `hsl(${(i * 47) % 360}, 55%, 55%)` }} />
            u/{u}
          </div>
        );
      })}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 120, display: 'flex', justifyContent: 'center' }}>
        <Kinetic text="Everyone throws the same pot." at={at + 0.3} gap={0.13} size={88} font={F.display} colors={{ 3: C.coral }} align="center" />
      </div>
    </AbsoluteFill>
  );
};

export const SceneHook: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('hook');
  const vesselsAt = L(VO_AT.hook2!) - 0.2;
  const sameAt = L(VO_AT.hook3!) - 0.6;
  const tKorean = L(wordAt('hook2', 'korean')) - 0.25;
  const tSong = L(wordAt('hook2', 'song')) - 0.25;
  const tTamil = L(wordAt('hook2', 'tamil')) - 0.25;
  const commAt = L(wordAt('hook2', 'commission')) - 0.2;
  const leaveIntro = interpolate(f, [s2f(tKorean - 0.3), s2f(tKorean + 0.3)], [1, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Embers count={45} opacity={0.6} seed={2} />
      {/* A post in the feed */}
      <Sequence durationInFrames={s2f(vesselsAt + 0.8)}>
        <AbsoluteFill style={{ opacity: interpolate(f, [s2f(vesselsAt - 0.3), s2f(vesselsAt + 0.3)], [1, 0], clamp) }}>
          <FeedCard />
          <div style={{ position: 'absolute', left: 130, top: 300 }}>
            <Kicker text="INSIDE A REDDIT POST" at={L(VO_AT.hook1!) - 0.2} />
            <div style={{ height: 26 }} />
            <Kinetic text={'A daily pottery\ngame that lives\ninside a Reddit post.'} at={L(VO_AT.hook1!) + 0.2} gap={0.11} size={84} colors={{ 8: C.coral, 9: C.coral }} />
          </div>
        </AbsoluteFill>
      </Sequence>
      {/* One commission a day */}
      <Sequence from={s2f(vesselsAt)} durationInFrames={s2f(sameAt - vesselsAt + 0.8)}>
        <AbsoluteFill style={{ opacity: leaveIntro }}>
          <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 30 }}>
            <Kicker text="EVERY DAY" at={0.1} />
            <Kinetic text="One commission." at={commAt - vesselsAt} gap={0.12} size={120} align="center" />
            <Kinetic text="A real vessel from a real tradition." at={commAt - vesselsAt + 0.9} gap={0.09} size={56} font={F.italic} color={C.gold} align="center" />
          </AbsoluteFill>
        </AbsoluteFill>
        <VesselPanel clip="h08_moonjar" name="Moon Jar" origin="Korea, Joseon" at={tKorean - vesselsAt} i={0} total={3} />
        <VesselPanel clip="h07_meiping" name="Meiping" origin="Song dynasty, China" at={tSong - vesselsAt} i={1} total={3} />
        <VesselPanel clip="h01_throw" name="Paanai" origin="Tamil Nadu, India" at={tTamil - vesselsAt} i={2} total={3} />
      </Sequence>
      {/* Everyone throws the same pot */}
      <Sequence from={s2f(sameAt)}>
        <Reveal2>
          <SamePot at={0} />
        </Reveal2>
      </Sequence>
      <Vignette />
    </AbsoluteFill>
  );
};

/** Quick zoom-through used inside a scene. */
const Reveal2: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [0, s2f(0.55)], [0, 1], { ...clamp, easing: ease });
  return <AbsoluteFill style={{ opacity: p, transform: `scale(${1.25 - 0.25 * p})`, filter: `blur(${(1 - p) * 18}px)` }}>{children}</AbsoluteFill>;
};

// ======================================================================= 3. THROW
const ArrowUp: React.FC<{ color?: string }> = ({ color = C.coral }) => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12 20V4M5 11l7-7 7 7" />
  </svg>
);
const ArrowSide: React.FC<{ color?: string }> = ({ color = C.coral }) => (
  <svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
    <path d="M3 12h18M7 8l-4 4 4 4M17 8l4 4-4 4" />
  </svg>
);

const GestureCard: React.FC<{ at: number; icon: React.ReactNode; title: string; text: string; out?: number }> = ({ at, icon, title, text, out }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 15, stiffness: 130 } });
  const leave = out !== undefined ? interpolate(f, [s2f(out), s2f(out + 0.4)], [0, 1], clamp) : 0;
  return (
    <div
      style={{
        display: 'flex',
        gap: 26,
        alignItems: 'center',
        padding: '26px 34px',
        borderRadius: 28,
        background: 'linear-gradient(135deg, rgba(60,14,20,0.75), rgba(20,6,8,0.75))',
        border: '1.5px solid rgba(255,143,125,0.3)',
        boxShadow: '0 30px 80px rgba(0,0,0,0.5)',
        opacity: Math.min(1, sp * 1.6) * (1 - leave),
        transform: `translateX(${(1 - sp) * 120}px)`,
        width: 760,
      }}
    >
      <div style={{ width: 86, height: 86, borderRadius: 24, background: 'rgba(216,31,39,0.22)', border: `2px solid ${C.coral}`, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 0 30px rgba(255,87,71,0.35)' }}>{icon}</div>
      <div>
        <div style={{ fontFamily: F.display, fontSize: 48, color: C.cream }}>{title}</div>
        <div style={{ fontFamily: F.body, fontSize: 28, color: C.muted, marginTop: 4 }}>{text}</div>
      </div>
    </div>
  );
};

export const SceneThrow: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('throw');
  const dur = SCENES.throw[1] - SCENES.throw[0];
  const hand = 'p03_hand';
  const touches = (CLIPS_TOUCH(hand));
  const openTap = touches.find((t) => t.kind === 'tap')?.t ?? 1;
  const downs = touches.filter((t) => t.kind === 'down');
  const pull1 = downs[0]?.t ?? 3;
  const side1 = downs[3]?.t ?? 7;
  const tOpen = L(wordAt('throw1', 'open'));
  const tDrag = L(wordAt('throw2', 'drag'));
  const tSide = L(wordAt('throw2', 'sideways'));
  const tOutline = L(wordAt('throw3', 'glowing'));
  const tDone = L(wordAt('throw3', 'done'));
  const tPass = L(wordAt('throw3', 'passes'));
  // Piece 1: up to just after the Open tap, timed so the tap lands on "Open".
  const p1from = Math.max(0, openTap - tOpen + 0.1);
  const afterOpen = openTap + 0.9;
  const p2at = afterOpen - p1from; // local time piece 2 starts
  // Piece 2: slow drift until the first pull lands on "Drag".
  const p3at = tDrag - 0.35;
  const slowRate = Math.max(0.15, (pull1 - 0.25 - afterOpen) / Math.max(0.5, p3at - p2at));
  // Piece 3: pulls at normal speed; piece 4 jumps so the sideways strokes land on "sideways".
  const p4at = tSide - 0.3;
  // Piece 5: the Master's throw that passes, on the second clip.
  const thr = 'p04_throw';
  const ts = markAt(thr, 'throw-start');
  const ps = markAt(thr, 'passes');
  const p5at = tOutline - 1.2;
  const rate5 = Math.min(2.2, Math.max(0.7, (ps - ts) / Math.max(1, tPass - p5at)));
  const pieces = [
    { at: 0, clip: hand, from: p1from, rate: 1 },
    { at: p2at, clip: hand, from: afterOpen, rate: slowRate },
    { at: p3at, clip: hand, from: pull1 - 0.25, rate: 1 },
    { at: p4at, clip: hand, from: side1 - 0.25, rate: 1 },
    { at: p5at, clip: thr, from: ts, rate: rate5 },
  ];
  const enter = spring({ frame: f - s2f(0.1), fps: 60, config: { damping: 18, stiffness: 80 } });
  const zoomIn = interpolate(f, [s2f(p3at - 0.6), s2f(p3at + 0.2), s2f(p5at - 0.4), s2f(p5at + 0.3)], [1, 1.32, 1.32, 1], { ...clamp, easing: ease });
  const zoomDone = interpolate(f, [s2f(tDone - 0.3), s2f(tDone + 0.4)], [1, 1.0], clamp);
  const ring = interpolate(f, [s2f(tDone - 0.2), s2f(tDone + 0.3), s2f(dur - 1), s2f(dur - 0.5)], [0, 1, 1, 0], clamp);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Embers count={35} opacity={0.5} seed={3} />
      <Phone
        pieces={pieces}
        x={610}
        y={H / 2 - 22}
        height={840}
        rotY={interpolate(enter, [0, 1], [-35, 12])}
        rotX={4}
        scale={0.85 + 0.15 * enter}
        opacity={Math.min(1, enter * 1.5)}
        zoom={{ s: zoomIn * zoomDone, x: 0.5, y: 0.55 }}
      >
        <ScreenRingAbs x={214} y={866} w={124} h={46} p={ring} />
      </Phone>
      <div style={{ position: 'absolute', left: 1000, top: 210 }}>
        <Kicker text="THROW IT" at={0.4} out={L(VO_AT.throw2!) - 0.1} />
        <div style={{ height: 22 }} />
        <Kinetic text={'Tap Open.\nThe clay opens\non the wheel.'} at={tOpen - 0.1} gap={0.1} size={92} colors={{ 1: C.coral }} out={L(VO_AT.throw2!) - 0.1} />
      </div>
      <div style={{ position: 'absolute', left: 1000, top: 250, display: 'flex', flexDirection: 'column', gap: 36 }}>
        <Kinetic text="One natural gesture." at={L(wordAt('throw2', 'one')) - 0.1} gap={0.1} size={70} font={F.italic} color={C.gold} out={tOutline - 0.9} />
        <GestureCard at={tDrag} icon={<ArrowUp />} title="Drag up" text="Pull the wall taller and thinner" out={tOutline - 0.9} />
        <GestureCard at={tSide} icon={<ArrowSide />} title="Drag sideways" text="Swell the belly or squeeze a neck" out={tOutline - 0.9} />
      </div>
      <div style={{ position: 'absolute', left: 1000, top: 270, display: 'flex', flexDirection: 'column', gap: 30 }}>
        <Kinetic text={'Chase the\nglowing outline.'} at={tOutline - 0.1} gap={0.1} size={96} colors={{ 2: C.coral, 3: C.coral }} />
        <div style={{ display: 'flex', gap: 18, marginTop: 20 }}>
          <Pill text="Done lights up when it passes" at={tDone} glow />
        </div>
      </div>
      <Chapter n="01" name="Throw it" dur={dur} />
      <Vignette />
    </AbsoluteFill>
  );
};

const CLIPS_TOUCH = (c: string) => CLIPS[c]?.touches ?? [];
const ScreenRingAbs: React.FC<{ x: number; y: number; w: number; h: number; p: number }> = (props) => <ScreenRing {...props} />;

// ======================================================================= 4. CLAY
export const SceneClay: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('clay');
  const dur = SCENES.clay[1] - SCENES.clay[0];
  const fell = markAt('h06_collapse', 'fell');
  const tCol = L(wordAt('clay1', 'collapses'));
  const from = Math.max(0, fell - tCol - 0.3);
  const words: [string, number][] = [
    ['dries', L(wordAt('clay1', 'dries')) - 0.1],
    ['thins', L(wordAt('clay1', 'thins')) - 0.1],
    ['wobbles', L(wordAt('clay1', 'wobbles')) - 0.1],
    ['collapses', tCol - 0.05],
  ];
  const shake = interpolate(f, [s2f(tCol), s2f(tCol + 0.15), s2f(tCol + 1.2)], [0, 10, 0], clamp);
  return (
    <AbsoluteFill>
      <Hero clip="h06_collapse" from={from} rate={1} zoom={[1.2, 1.45]} focus={[0.5, 0.52]} dur={dur} dim={0.12} shake={shake} />
      <AbsoluteFill style={{ background: 'linear-gradient(90deg, rgba(7,2,3,0.85) 0%, rgba(7,2,3,0.35) 38%, transparent 60%)' }} />
      <div style={{ position: 'absolute', left: 120, top: 200 }}>
        <Kinetic text={'The clay behaves\nlike clay.'} at={L(VO_AT.clay1!) + 0.1} gap={0.1} size={72} font={F.italic} color={C.gold} />
        <div style={{ height: 40 }} />
        {words.map(([w, t], i) => {
          const sp = spring({ frame: f - s2f(t), fps: 60, config: { damping: 14, stiffness: 160 } });
          const next = words[i + 1]?.[1];
          const dimmed = next !== undefined ? interpolate(f, [s2f(next), s2f(next + 0.3)], [1, 0.35], clamp) : 1;
          const last = i === words.length - 1;
          return (
            <div
              key={w}
              style={{
                fontFamily: F.display,
                fontSize: last ? 120 : 96,
                lineHeight: 1.05,
                color: last ? C.coral : C.cream,
                opacity: Math.min(1, sp * 1.5) * dimmed,
                transform: `translateX(${(1 - sp) * -80}px) ${last ? `rotate(${Math.sin(f * 0.9) * shake * 0.25}deg)` : ''}`,
                textShadow: last ? '0 0 40px rgba(255,87,71,0.7)' : 'none',
                filter: `blur(${(1 - Math.min(1, sp)) * 10}px)`,
              }}
            >
              It {w}.
            </div>
          );
        })}
      </div>
      <Flash at={tCol + 0.05} dur={0.6} color="#ff6a4a" peak={0.35} />
      <Vignette strength={0.8} />
    </AbsoluteFill>
  );
};

