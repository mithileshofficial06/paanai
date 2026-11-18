import React from 'react';
import { AbsoluteFill, interpolate, Sequence, spring, useCurrentFrame } from 'remotion';
import { Backdrop, Embers, Flash, LightSweep, Vignette } from './fx';
import { C, clamp, ease, F, H, s2f, W } from './lib';
import { clipLen, CLIPS, Phone } from './phone';
import { Hero, Logo } from './scenes1';
import { Chapter, Counter, Kicker, Kinetic, Pill } from './text';
import { SCENES, VO_AT, wordAt } from './timeline';
import { potPath } from './transitions';

const loc = (scene: keyof typeof SCENES) => (abs: number) => abs - SCENES[scene][0];
const useEnter = (at = 0.1, stiffness = 80) => {
  const f = useCurrentFrame();
  return spring({ frame: f - s2f(at), fps: 60, config: { damping: 18, stiffness } });
};

// ======================================================================= 5. SCORE
const LOG = ['OPEN', 'PULL  r4 → r22', 'PULL  r6 → r30', 'PULL  r8 → r38', 'PUSH  r18  +12', 'PUSH  r38  −22', 'PUSH  r47  +14'];

const Card: React.FC<{ x: number; y: number; w: number; h?: number; at: number; children: React.ReactNode; glow?: boolean }> = ({ x, y, w, h, at, children, glow }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 15, stiffness: 120 } });
  return (
    <div
      style={{
        position: 'absolute',
        left: x,
        top: y,
        width: w,
        height: h,
        padding: '26px 30px',
        borderRadius: 28,
        background: 'linear-gradient(150deg, rgba(58,14,20,0.82), rgba(16,5,7,0.86))',
        border: `1.5px solid ${glow ? C.coral : 'rgba(255,143,125,0.28)'}`,
        boxShadow: glow ? '0 0 60px rgba(255,87,71,0.35), 0 30px 80px rgba(0,0,0,0.6)' : '0 30px 80px rgba(0,0,0,0.6)',
        opacity: Math.min(1, sp * 1.6),
        transform: `translateY(${(1 - sp) * 60}px) scale(${0.94 + 0.06 * sp})`,
        fontFamily: F.body,
        color: C.cream,
      }}
    >
      {children}
    </div>
  );
};

const Bar: React.FC<{ label: string; at: number; to: number; color?: string }> = ({ label, at, to, color = C.coral }) => {
  const f = useCurrentFrame();
  const p = interpolate(f, [s2f(at), s2f(at + 0.9)], [0, to], { ...clamp, easing: ease });
  const o = interpolate(f, [s2f(at - 0.2), s2f(at + 0.1)], [0.25, 1], clamp);
  return (
    <div style={{ marginTop: 18, opacity: o }}>
      <div style={{ fontSize: 26, fontWeight: 600, marginBottom: 8 }}>{label}</div>
      <div style={{ height: 14, borderRadius: 8, background: 'rgba(255,255,255,0.08)', overflow: 'hidden' }}>
        <div style={{ width: `${p * 100}%`, height: '100%', borderRadius: 8, background: `linear-gradient(90deg, ${C.accent}, ${color})`, boxShadow: `0 0 16px ${color}` }} />
      </div>
    </div>
  );
};

export const SceneScore: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('score');
  const dur = SCENES.score[1] - SCENES.score[0];
  const enter = useEnter(0.05);
  const tServer = L(wordAt('score1', 'server'));
  const tReplay = L(VO_AT.score2!);
  const tFresh = L(wordAt('score2', 'fresh'));
  const tShape = L(wordAt('score2', 'shape'));
  const tWalls = L(wordAt('score2', 'walls'));
  const tRules = L(wordAt('score2', 'rules'));
  const tFake = L(wordAt('score2', 'nobody'));
  const tBoard = L(VO_AT.score3!);
  // Phone slides left and shrinks while the diagram builds.
  const slide = interpolate(f, [s2f(tReplay - 0.6), s2f(tReplay + 0.4)], [0, 1], { ...clamp, easing: ease });
  const phoneX = interpolate(slide, [0, 1], [W / 2 + 330, 330]);
  const board = interpolate(f, [s2f(tBoard - 0.5), s2f(tBoard + 0.3)], [0, 1], { ...clamp, easing: ease });
  const phoneScale = interpolate(slide, [0, 1], [1, 0.82]) + board * 0.18;
  const diagramOut = interpolate(f, [s2f(tBoard - 0.5), s2f(tBoard)], [1, 0], clamp);
  // Packets flowing from phone to server.
  const flowOn = interpolate(f, [s2f(tReplay), s2f(tReplay + 0.3), s2f(tShape), s2f(tShape + 0.4)], [0, 1, 1, 0], clamp);
  // The pot redrawing itself from a fresh lump.
  const draw = interpolate(f, [s2f(tFresh - 0.2), s2f(tShape)], [0, 1], { ...clamp, easing: ease });
  const stamp = spring({ frame: f - s2f(tFake), fps: 60, config: { damping: 10, stiffness: 200 } });
  const pathD = potPath(150, 150, 105);
  return (
    <AbsoluteFill>
      <Backdrop />
      <Embers count={30} opacity={0.45} seed={5} />
      <Phone
        pieces={[
          { at: 0, clip: 'p05_score', from: Math.max(0, (CLIPS_TAP('p05_score') ?? 0.6) - (tServer - 0.9)) },
          { at: tBoard - 0.3, clip: 'p12_home', from: (CLIPS_TAPS('p12_home')[1] ?? 4.6) - 0.5 },
        ]}
        x={phoneX + board * 90}
        y={H / 2 - 28}
        height={880}
        zoom={{ s: 1 + board * 0.4, x: 0.08, y: 0.06 }}
        rotY={interpolate(enter, [0, 1], [30, -8]) + slide * 14}
        rotX={3}
        scale={(0.85 + 0.15 * enter) * phoneScale}
        opacity={Math.min(1, enter * 1.5)}
      />
      {/* Before the diagram: the headline */}
      <div style={{ position: 'absolute', left: 140, top: 300, opacity: 1 - slide }}>
        <Kicker text="GET SCORED" at={0.3} />
        <div style={{ height: 22 }} />
        <Kinetic text={'Tap Done.\nThe server\ntakes over.'} at={L(VO_AT.score1!) - 0.05} gap={0.12} size={100} colors={{ 1: C.coral }} />
      </div>
      {/* The replay diagram */}
      <AbsoluteFill style={{ opacity: diagramOut }}>
        <Card x={680} y={180} w={420} at={tReplay} >
          <div style={{ fontSize: 18, letterSpacing: '0.28em', fontWeight: 700, color: C.coral }}>STROKE LOG</div>
          <div style={{ fontFamily: 'monospace', fontSize: 24, marginTop: 14, lineHeight: 1.55 }}>
            {LOG.map((l, i) => {
              const o = interpolate(f, [s2f(tReplay + 0.25 + i * 0.16), s2f(tReplay + 0.45 + i * 0.16)], [0, 1], clamp);
              return (
                <div key={i} style={{ opacity: o, color: i === 0 ? C.gold : C.cream }}>
                  {l}
                </div>
              );
            })}
          </div>
        </Card>
        {/* flow line */}
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          <path d="M 1100 400 C 1180 400, 1180 400, 1250 400" stroke="rgba(255,143,125,0.35)" strokeWidth={3} fill="none" strokeDasharray="8 10" opacity={slide} />
          {[0, 1, 2, 3].map((i) => {
            const q = ((f / 60) * 1.4 + i / 4) % 1;
            return <circle key={i} cx={1100 + q * 150} cy={400} r={8} fill={C.coral} opacity={flowOn * Math.sin(q * Math.PI)} style={{ filter: 'drop-shadow(0 0 8px #ff5747)' }} />;
          })}
        </svg>
        <Card x={1260} y={150} w={540} at={tReplay + 0.5} glow>
          <div style={{ fontSize: 18, letterSpacing: '0.28em', fontWeight: 700, color: C.coral }}>SERVER REPLAY</div>
          <div style={{ display: 'flex', gap: 24, alignItems: 'center', marginTop: 10 }}>
            <svg width={300} height={300} style={{ flexShrink: 0, margin: '-20px -40px -30px -40px' }}>
              <path d={pathD} fill="rgba(176,96,58,0.18)" stroke={C.coral} strokeWidth={5} pathLength={1} strokeDasharray="1" strokeDashoffset={1 - draw} style={{ filter: 'drop-shadow(0 0 10px #ff5747)' }} />
            </svg>
            <div style={{ fontSize: 26, color: C.muted, lineHeight: 1.35 }}>
              Every stroke, replayed from a <span style={{ color: C.cream, fontWeight: 700 }}>fresh lump of clay</span>.
            </div>
          </div>
          <Bar label="Shape match" at={tShape} to={0.94} />
          <Bar label="Even walls" at={tWalls} to={0.86} color={C.gold} />
          <Bar label="Commission rules" at={tRules} to={1} color="#7fdc9a" />
        </Card>
        {/* stamp */}
        <div
          style={{
            position: 'absolute',
            left: 760,
            top: 720,
            opacity: Math.min(1, stamp * 2) * (f > s2f(tFake) ? 1 : 0),
            transform: `rotate(-4deg) scale(${2.2 - 1.2 * stamp})`,
            transformOrigin: 'center',
            padding: '18px 40px',
            borderRadius: 18,
            border: `4px solid ${C.gold}`,
            color: C.gold,
            fontFamily: F.italic,
            fontSize: 64,
            boxShadow: '0 0 40px rgba(239,190,104,0.35), inset 0 0 30px rgba(239,190,104,0.15)',
            background: 'rgba(20,6,8,0.6)',
          }}
        >
          Nobody can fake a score.
        </div>
      </AbsoluteFill>
      {/* Leaderboard */}
      <div style={{ position: 'absolute', left: 720, top: 330 }}>
        <Kicker text="TODAY'S LEADERBOARD" at={tBoard} />
        <div style={{ height: 22 }} />
        <Kinetic text={'Your first throw\nof the day is ranked.'} at={tBoard + 0.15} gap={0.1} size={88} colors={{ 1: C.coral }} />
        <div style={{ display: 'flex', gap: 16, marginTop: 34 }}>
          <Pill text="One ranked throw a day" at={tBoard + 0.9} />
          <Pill text="Practice as much as you like" at={tBoard + 1.2} />
        </div>
      </div>
      <Chapter n="02" name="Get scored" dur={dur} />
      <Vignette />
    </AbsoluteFill>
  );
};

const CLIPS_TAP = (c: string) => CLIPS[c]?.touches.find((t) => t.kind === 'tap')?.t;
const CLIPS_TAPS = (c: string) => (CLIPS[c]?.touches ?? []).filter((t) => t.kind === 'tap').map((t) => t.t);

// ======================================================================= 6. PAINT + FIRE
const SWATCHES = [
  ['Indigo', '#253a8a'],
  ['Gold', '#d4af37'],
  ['Chalk white', '#f1ebdd'],
  ['Kumkum red', '#c8102e'],
  ['Turmeric', '#f4b41a'],
  ['Peacock', '#2aa7a1'],
];

export const ScenePaint: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('paint');
  const dur = SCENES.paint[1] - SCENES.paint[0];
  const enter = useEnter(0.05);
  const tPaint = L(VO_AT.paint1!);
  const tFire = L(VO_AT.fire1!);
  const tTogether = L(wordAt('fire1', 'together'));
  const tCrack = L(wordAt('fire1', 'crack'));
  const tSurprise = L(wordAt('fire1', 'surprise'));
  const tTen = L(VO_AT.fire2!);
  const fireTaps = CLIPS_TAPS('p07_fire');
  const fireFrom = Math.max(0, (fireTaps[0] ?? 0.5) - 0.5);
  const fireLen = clipLen('p07_fire');
  // The fire clip plays the 10 s test firing; stretch it from "Then into the kiln" to the end of the scene.
  const fireRate = Math.max(0.6, Math.min(1.2, (fireLen - fireFrom) / (dur - (tFire - 0.4))));
  const heat = interpolate(f, [s2f(tFire - 0.5), s2f(tFire + 1)], [0, 1], clamp);
  const ring = interpolate(f, [s2f(tTen), s2f(dur - 0.3)], [0, 1], clamp);
  const ringIn = interpolate(f, [s2f(tTen - 0.2), s2f(tTen + 0.4)], [0, 1], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Backdrop hue={heat > 0.5 ? 'gold' : 'red'} intensity={1 + heat * 0.4} />
      <AbsoluteFill style={{ background: 'radial-gradient(70% 60% at 30% 100%, rgba(255,120,40,0.35), transparent 70%)', opacity: heat }} />
      <Embers count={30 + Math.round(heat * 60)} opacity={0.5 + heat * 0.5} speed={1 + heat * 0.8} seed={6} />
      <Phone
        pieces={[
          { at: 0, clip: 'p06_paint', from: 0.2 },
          { at: tFire - 0.4, clip: 'p07_fire', from: fireFrom, rate: fireRate },
        ]}
        x={560}
        y={H / 2 - 28}
        height={880}
        rotY={interpolate(enter, [0, 1], [-30, 10])}
        rotX={3}
        scale={0.85 + 0.15 * enter}
        opacity={Math.min(1, enter * 1.5)}
      />
      {/* swatches orbiting the phone while painting */}
      {SWATCHES.map(([name, col], i) => {
        const sp = spring({ frame: f - s2f(tPaint + 0.6 + i * 0.12), fps: 60, config: { damping: 12 } });
        const leave = interpolate(f, [s2f(tFire - 0.8), s2f(tFire - 0.2)], [1, 0], clamp);
        const a = -1.2 + i * 0.5 + f / 60 * 0.15;
        const x = 560 + Math.cos(a) * 420;
        const y = H / 2 + Math.sin(a) * 380;
        return (
          <div key={name} style={{ position: 'absolute', left: x - 36, top: y - 36, width: 72, height: 72, borderRadius: '50%', background: col, border: '4px solid rgba(255,255,255,0.85)', boxShadow: `0 0 30px ${col}, 0 10px 30px rgba(0,0,0,0.6)`, transform: `scale(${sp})`, opacity: leave }} />
        );
      })}
      <div style={{ position: 'absolute', left: 1050, top: 260 }}>
        <Kicker text="PAINT IT" at={tPaint - 0.2} out={tFire - 0.7} />
        <div style={{ height: 22 }} />
        <Kinetic text={'Now make\nit yours.'} at={tPaint} gap={0.12} size={120} colors={{ 3: C.gold }} out={tFire - 0.7} />
        <div style={{ display: 'flex', gap: 14, marginTop: 34, flexWrap: 'wrap', width: 720 }}>
          {['Bands', 'Patterns', 'Body', 'Rim'].map((t, i) => (
            <Pill key={t} text={t} at={L(wordAt('paint1', t.toLowerCase())) - 0.05} out={tFire - 0.7} />
          ))}
        </div>
      </div>
      <div style={{ position: 'absolute', left: 1050, top: 230 }}>
        <Kicker text="FIRE IT" at={tFire} color={C.gold} out={tTen - 0.6} />
        <div style={{ height: 22 }} />
        <Kinetic text={'One kiln.\nThe whole\nsubreddit.'} at={tFire + 0.1} gap={0.12} size={110} colors={{ 1: C.coral }} out={tTen - 0.6} />
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 34, alignItems: 'flex-start' }}>
          <Pill text="Fires together at 00:00 UTC" at={tTogether} glow out={tTen - 0.6} />
          <Pill text="Thin walls can crack" at={tCrack - 0.1} out={tTen - 0.6} />
          <Pill text="The glaze is a surprise" at={tSurprise - 0.3} out={tTen - 0.6} />
        </div>
      </div>
      {/* first pot: ten second test firing */}
      <div style={{ position: 'absolute', left: 1080, top: 210, opacity: ringIn, transform: `scale(${0.9 + 0.1 * ringIn})` }}>
        <svg width={360} height={360}>
          <circle cx={180} cy={180} r={160} stroke="rgba(255,255,255,0.08)" strokeWidth={14} fill="none" />
          <circle
            cx={180}
            cy={180}
            r={160}
            stroke={C.gold}
            strokeWidth={14}
            fill="none"
            strokeLinecap="round"
            pathLength={1}
            strokeDasharray="1"
            strokeDashoffset={ring}
            transform="rotate(-90 180 180)"
            style={{ filter: 'drop-shadow(0 0 14px #efbe68)' }}
          />
          <text x={180} y={200} textAnchor="middle" fontFamily="FrauncesBlack" fontSize={140} fill={C.cream}>
            {Math.max(0, Math.ceil(10 * (1 - ring)))}
          </text>
          <text x={180} y={255} textAnchor="middle" fontFamily="Outfit" fontWeight={700} fontSize={22} letterSpacing={6} fill={C.coral}>
            SECONDS
          </text>
        </svg>
        <div style={{ marginTop: 30 }}>
          <Kinetic text={'Your first pot fires\nin ten seconds.'} at={tTen + 0.2} gap={0.1} size={64} colors={{ 4: C.gold, 5: C.gold }} />
          <div style={{ fontFamily: F.body, fontSize: 30, color: C.muted, marginTop: 18, opacity: interpolate(f, [s2f(tTen + 2.5), s2f(tTen + 3)], [0, 1], clamp) }}>
            A new player sees the whole loop on their first visit.
          </div>
        </div>
      </div>
      <Chapter n="03" name="Paint it. Fire it." dur={dur} />
      <Vignette />
    </AbsoluteFill>
  );
};

// ======================================================================= 7. REVEAL
export const SceneReveal: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('reveal');
  const dur = SCENES.reveal[1] - SCENES.reveal[0];
  const taps = CLIPS_TAPS('p08_reveal');
  // second tap = "Open the kiln"
  const openTap = taps[1] ?? 1.6;
  const tSee = L(wordAt('reveal1', 'see'));
  const from = Math.max(0, openTap - (tSee - 0.3));
  const rot = (f / 60) * 12;
  const zoom = interpolate(f, [s2f(tSee), s2f(tSee + 2.5)], [1, 1.22], { ...clamp, easing: ease });
  return (
    <AbsoluteFill>
      <Backdrop hue="gold" intensity={1.3} />
      {/* light rays */}
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', opacity: interpolate(f, [s2f(tSee - 0.2), s2f(tSee + 0.6)], [0, 0.75], clamp) }}>
        <div
          style={{
            width: 2400,
            height: 2400,
            borderRadius: '50%',
            background: 'repeating-conic-gradient(from 0deg, rgba(255,190,110,0.22) 0deg 6deg, transparent 6deg 18deg)',
            transform: `rotate(${rot}deg)`,
            maskImage: 'radial-gradient(circle, black 0%, transparent 60%)',
            WebkitMaskImage: 'radial-gradient(circle, black 0%, transparent 60%)',
          }}
        />
      </AbsoluteFill>
      <Embers count={80} opacity={0.9} speed={1.4} seed={7} />
      <Phone clip="p08_reveal" from={from} x={W / 2} y={H / 2 - 28} height={900} rotY={Math.sin(f / 60 * 0.6) * 6} zoom={{ s: zoom, x: 0.5, y: 0.28 }} />
      <div style={{ position: 'absolute', left: 90, top: 380, width: 520 }}>
        <Kinetic text={'Open\nthe kiln.'} at={L(VO_AT.reveal1!)} gap={0.12} size={110} />
      </div>
      <div style={{ position: 'absolute', right: 70, top: 380, width: 640 }}>
        <Kinetic text={'See what\nthe fire made.'} at={tSee} gap={0.12} size={82} colors={{ 3: C.gold, 4: C.gold }} align="right" />
      </div>
      <Flash at={tSee - 0.05} dur={0.8} color="#ffe2b8" peak={0.7} />
      <Vignette />
    </AbsoluteFill>
  );
};

// ======================================================================= 8. COMMUNITY
export const SceneCommunity: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('comm');
  const dur = SCENES.comm[1] - SCENES.comm[0];
  const enter = useEnter(0.05);
  const tShow = L(VO_AT.comm1!);
  const tRate = L(wordAt('comm1', 'rate'));
  const tLike = L(wordAt('comm1', 'like'));
  const tShare = L(wordAt('comm1', 'share'));
  const tWeek = L(wordAt('comm1', 'week'));
  const t2 = L(VO_AT.comm2!);
  const tGlazes = L(wordAt('comm2', 'glazes'));
  const tLevels = L(wordAt('comm2', 'levels'));
  const showTaps = CLIPS_TAPS('p09_showcase');
  const part2 = interpolate(f, [s2f(t2 - 0.6), s2f(t2 + 0.2)], [0, 1], { ...clamp, easing: ease });
  const sp1 = spring({ frame: f - s2f(t2 - 0.3), fps: 60, config: { damping: 16, stiffness: 90 } });
  const sp2 = spring({ frame: f - s2f(t2), fps: 60, config: { damping: 16, stiffness: 90 } });
  return (
    <AbsoluteFill>
      <Backdrop />
      <Embers count={40} opacity={0.5} seed={8} />
      {/* part 1: showcase */}
      <AbsoluteFill style={{ opacity: 1 - part2, transform: `translateX(${-part2 * 200}px)` }}>
        <Phone
          pieces={[
            { at: 0, clip: 'p09_showcase', from: Math.max(0, (showTaps[0] ?? 1) - 0.7) },
            { at: tRate - 0.9, clip: 'p09_showcase', from: (showTaps[2] ?? 12.9) - 0.9 },
            { at: tLike - 0.5, clip: 'p09_showcase', from: (showTaps[3] ?? 28.6) - 0.6 },
          ]}
          x={1340}
          y={H / 2 - 28}
          height={880}
          rotY={interpolate(enter, [0, 1], [35, -10])}
          rotX={3}
          scale={0.85 + 0.15 * enter}
          opacity={Math.min(1, enter * 1.5)}
        />
        <div style={{ position: 'absolute', left: 140, top: 240 }}>
          <Kicker text="SHOW IT OFF" at={tShow - 0.2} />
          <div style={{ height: 22 }} />
          <Kinetic text={'Put your best\npots on show.'} at={tShow} gap={0.11} size={96} colors={{ 2: C.coral, 3: C.coral }} />
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16, marginTop: 40, alignItems: 'flex-start' }}>
            <Pill text="Rate out of five" at={tRate - 0.1} icon={<Star />} />
            <Pill text="Like the ones you love" at={tLike - 0.1} icon={<Heart />} />
            <Pill text="Share to the day's post in one tap" at={tShare - 0.1} />
            <Pill text="Pot of the Week" at={tWeek - 0.3} glow icon={<Star color={C.gold} />} />
          </div>
        </div>
      </AbsoluteFill>
      {/* part 2: codex + levels */}
      <AbsoluteFill style={{ opacity: part2 }}>
        <Sequence from={s2f(t2 - 0.6)} layout="none">
        <Phone clip="p10_codex" from={0.6} x={430} y={H / 2 - 30} height={850} rotY={interpolate(sp1, [0, 1], [-50, 16])} rotX={3} scale={0.8 + 0.2 * sp1} />
        <Phone clip="p11_levels" from={0.6} x={1490} y={H / 2 - 30} height={850} rotY={interpolate(sp2, [0, 1], [50, -16])} rotX={3} scale={0.8 + 0.2 * sp2} />
        </Sequence>
        <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 50 }}>
          <Stat at={tGlazes - 0.6} to={24} label="GLAZES TO DISCOVER" sub="The first to fire one gets their name on it" />
          <Stat at={tLevels - 0.6} to={100} label="LEVELS TO MASTER" sub="Each one a vessel to match" />
        </AbsoluteFill>
      </AbsoluteFill>
      <Chapter n="04" name="Show it off" dur={dur} />
      <Vignette />
    </AbsoluteFill>
  );
};

const Stat: React.FC<{ at: number; to: number; label: string; sub: string }> = ({ at, to, label, sub }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 14 } });
  return (
    <div style={{ textAlign: 'center', opacity: Math.min(1, sp * 1.5), transform: `scale(${0.8 + 0.2 * sp})` }}>
      <div style={{ fontFamily: F.logo, fontSize: 170, lineHeight: 1, color: C.cream, textShadow: '0 0 50px rgba(255,87,71,0.5)' }}>
        <Counter to={to} at={at} dur={1.2} />
      </div>
      <div style={{ fontFamily: F.body, fontWeight: 700, letterSpacing: '0.3em', fontSize: 24, color: C.coral, marginTop: 6 }}>{label}</div>
      <div style={{ fontFamily: F.body, fontSize: 24, color: C.muted, marginTop: 8 }}>{sub}</div>
    </div>
  );
};

const Star: React.FC<{ color?: string }> = ({ color = C.gold }) => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill={color}>
    <path d="M12 2.5l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.4l-5.9 3.1 1.2-6.5L2.5 9.4l6.6-.9z" />
  </svg>
);
const Heart: React.FC = () => (
  <svg width="28" height="28" viewBox="0 0 24 24" fill={C.coral}>
    <path d="M12 21s-7.5-4.6-9.6-9.2C.9 8.3 3.2 4.5 6.9 4.5c2.1 0 3.6 1.2 5.1 3 1.5-1.8 3-3 5.1-3 3.7 0 6 3.8 4.5 7.3C19.5 16.4 12 21 12 21z" />
  </svg>
);

// ======================================================================= 9. TECH
type TNode = { id: string; x: number; y: number; w: number; title: string; sub: string; word: [string, string]; accent?: string };
const NODES: TNode[] = [
  { id: 'devvit', x: 110, y: 250, w: 520, title: 'Devvit Web', sub: 'Lives in a Reddit post. Scheduler jobs roll the day and fire the kiln.', word: ['tech1', 'devvit'] },
  { id: 'three', x: 110, y: 560, w: 520, title: 'three.js + Preact', sub: 'The 3D wheel, wet clay, painted and glazed pots.', word: ['tech1', 'three'] },
  { id: 'hono', x: 800, y: 250, w: 440, title: 'Hono server', sub: 'Replays every stroke log to score it.', word: ['tech1', 'hoh-no'] },
  { id: 'redis', x: 1400, y: 250, w: 420, title: 'Redis', sub: 'Pots, kilns, leaderboards, the Codex.', word: ['tech1', 'redis'] },
  { id: 'core', x: 800, y: 560, w: 1020, title: 'Integer-only shaping core', sub: 'Shared by client and server. Same strokes, same pot, every time.', word: ['tech1', 'integer'], accent: C.gold },
];
const EDGES: [string, string, string][] = [
  ['three', 'hono', 'stroke log'],
  ['hono', 'redis', ''],
  ['three', 'core', ''],
  ['hono', 'core', ''],
];

export const SceneTech: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('tech');
  const dur = SCENES.tech[1] - SCENES.tech[0];
  const at = (n: TNode) => L(wordAt(n.word[0], n.word[1])) - 0.15;
  const byId = Object.fromEntries(NODES.map((n) => [n.id, n]));
  const t2 = L(VO_AT.tech2!);
  const shrink = interpolate(f, [s2f(t2 - 0.5), s2f(t2 + 0.4)], [0, 1], { ...clamp, easing: ease });
  const nodeH = 190;
  const center = (n: TNode) => ({ x: n.x + n.w / 2, y: n.y + nodeH / 2 });
  return (
    <AbsoluteFill>
      <Backdrop hue="deep" />
      {/* blueprint grid */}
      <AbsoluteFill
        style={{
          backgroundImage: 'linear-gradient(rgba(255,143,125,0.06) 1px, transparent 1px), linear-gradient(90deg, rgba(255,143,125,0.06) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
          backgroundPosition: `${(f / 60) * 6}px ${(f / 60) * 4}px`,
          maskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
          WebkitMaskImage: 'radial-gradient(ellipse at center, black 30%, transparent 75%)',
        }}
      />
      <div style={{ position: 'absolute', left: 0, right: 0, top: 110, display: 'flex', justifyContent: 'center', opacity: 1 - shrink }}>
        <Kinetic text="Under the hood." at={0.5} gap={0.12} size={76} font={F.italic} color={C.gold} align="center" />
      </div>
      <AbsoluteFill style={{ transformOrigin: '50% 20%', transform: `scale(${1 - shrink * 0.42}) translateY(${-shrink * 80}px)`, opacity: 1 - shrink * 0.25 }}>
        <svg width={W} height={H} style={{ position: 'absolute', inset: 0 }}>
          {EDGES.map(([a, b, label], i) => {
            const A = byId[a]!;
            const B = byId[b]!;
            const t = Math.max(at(A), at(B)) + 0.3;
            const p = interpolate(f, [s2f(t), s2f(t + 0.6)], [0, 1], { ...clamp, easing: ease });
            const pa = center(A);
            const pb = center(B);
            const d = `M ${pa.x} ${pa.y} C ${(pa.x + pb.x) / 2} ${pa.y}, ${(pa.x + pb.x) / 2} ${pb.y}, ${pb.x} ${pb.y}`;
            return (
              <g key={i}>
                <path d={d} stroke="rgba(255,143,125,0.45)" strokeWidth={3} fill="none" pathLength={1} strokeDasharray="1" strokeDashoffset={1 - p} />
                {p >= 1 &&
                  [0, 1, 2].map((k) => {
                    const q = ((f / 60) * 0.6 + k / 3) % 1;
                    const x = pa.x + (pb.x - pa.x) * q;
                    // follow the bezier roughly
                    const y = pa.y + (pb.y - pa.y) * (3 * q * q - 2 * q * q * q);
                    return <circle key={k} cx={x} cy={y} r={7} fill={C.coral} style={{ filter: 'drop-shadow(0 0 8px #ff5747)' }} />;
                  })}
                {label && p > 0.5 && (
                  <text x={(pa.x + pb.x) / 2} y={(pa.y + pb.y) / 2 - 40} textAnchor="middle" fontFamily="Outfit" fontWeight={700} fontSize={22} letterSpacing={4} fill={C.gold}>
                    {label.toUpperCase()}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
        {NODES.map((n) => (
          <NodeCard key={n.id} n={n} at={at(n)} h={nodeH} />
        ))}
      </AbsoluteFill>
      {/* tested */}
      <div style={{ position: 'absolute', left: 0, right: 0, top: 640, display: 'flex', justifyContent: 'center', gap: 120, opacity: shrink }}>
        <BigStat at={t2 + 0.2} value={<><Counter to={136} at={t2 + 0.2} dur={1.6} />/136</>} label="FINISHABLE WITH ONE GESTURE" />
        <BigStat at={t2 + 0.8} value={<Counter to={61} at={t2 + 0.8} />} label="UNIT TESTS" />
        <BigStat at={t2 + 1.2} value={<Counter to={22} at={t2 + 1.2} />} label="END-TO-END STEPS" />
      </div>
      <Chapter n="05" name="Under the hood" dur={dur} />
      <Vignette />
    </AbsoluteFill>
  );
};

const NodeCard: React.FC<{ n: TNode; at: number; h: number }> = ({ n, at, h }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 14, stiffness: 140 } });
  const glow = interpolate(f, [s2f(at), s2f(at + 0.3), s2f(at + 1.4)], [0, 1, 0.25], clamp);
  const ac = n.accent ?? C.coral;
  return (
    <div
      style={{
        position: 'absolute',
        left: n.x,
        top: n.y,
        width: n.w,
        height: h,
        padding: '28px 32px',
        borderRadius: 26,
        background: 'linear-gradient(150deg, rgba(58,14,20,0.9), rgba(16,5,7,0.92))',
        border: `2px solid ${ac}`,
        boxShadow: `0 0 ${20 + glow * 60}px ${ac}${Math.round(40 + glow * 80).toString(16)}, 0 30px 70px rgba(0,0,0,0.6)`,
        opacity: Math.min(1, sp * 1.5),
        transform: `translateY(${(1 - sp) * 50}px) scale(${0.9 + 0.1 * sp})`,
        boxSizing: 'border-box',
      }}
    >
      <div style={{ fontFamily: F.display, fontSize: 46, color: C.cream }}>{n.title}</div>
      <div style={{ fontFamily: F.body, fontSize: 25, color: C.muted, marginTop: 10, lineHeight: 1.35 }}>{n.sub}</div>
    </div>
  );
};

const BigStat: React.FC<{ at: number; value: React.ReactNode; label: string }> = ({ at, value, label }) => {
  const f = useCurrentFrame();
  const sp = spring({ frame: f - s2f(at), fps: 60, config: { damping: 13 } });
  return (
    <div style={{ textAlign: 'center', opacity: Math.min(1, sp * 1.5), transform: `translateY(${(1 - sp) * 50}px)` }}>
      <div style={{ fontFamily: F.logo, fontSize: 140, color: C.cream, lineHeight: 1, textShadow: '0 0 40px rgba(255,87,71,0.45)' }}>{value}</div>
      <div style={{ fontFamily: F.body, fontWeight: 700, fontSize: 22, letterSpacing: '0.28em', color: C.coral, marginTop: 10 }}>{label}</div>
    </div>
  );
};

// ======================================================================= 10. OUTRO
export const SceneOut: React.FC = () => {
  const f = useCurrentFrame();
  const L = loc('out');
  const dur = SCENES.out[1] - SCENES.out[0];
  const len = clipLen('h01_throw');
  const t1 = L(VO_AT.out1!);
  const tThrow = L(wordAt('out1', 'throw'));
  const tPaint = L(wordAt('out1', 'paint'));
  const tFire = L(wordAt('out1', 'fire'));
  const t2 = L(VO_AT.out2!);
  const fadeOut = interpolate(f, [s2f(dur - 1.6), s2f(dur - 0.1)], [0, 1], clamp);
  const sweep = interpolate(f, [s2f(t1 + 0.3), s2f(t1 + 1.4)], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Hero clip="h01_throw" from={len - 3} rate={0.35} zoom={[1.15, 1.3]} focus={[0.5, 0.5]} dur={dur} blur={10} dim={0.55} />
      <Embers count={70} opacity={0.8} seed={9} />
      <AbsoluteFill style={{ alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 22, transform: `translateY(-40px)` }}>
        <Logo at={0.3} size={270} />
        <div style={{ display: 'flex', gap: 30 }}>
          <Kinetic text="Throw it." at={tThrow - 0.1} size={74} font={F.italic} />
          <Kinetic text="Paint it." at={tPaint - 0.1} size={74} font={F.italic} />
          <Kinetic text="Fire it, together." at={tFire - 0.1} gap={0.15} size={74} font={F.italic} color={C.gold} />
        </div>
        <div style={{ marginTop: 40, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 22 }}>
          <Pill text="Play today's pot on r/paanai_game_dev" at={t2 - 0.2} glow size={36} />
          <div style={{ fontFamily: F.body, fontSize: 24, color: C.muted, letterSpacing: '0.12em', opacity: interpolate(f, [s2f(t2 + 0.8), s2f(t2 + 1.4)], [0, 1], clamp) }}>
            Built on Devvit Web for Reddit's Game of the Day Hackathon
          </div>
        </div>
      </AbsoluteFill>
      <LightSweep p={sweep} />
      <Vignette strength={0.8} />
      <AbsoluteFill style={{ background: '#000', opacity: fadeOut }} />
    </AbsoluteFill>
  );
};

