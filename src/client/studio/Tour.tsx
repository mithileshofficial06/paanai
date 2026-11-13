// Guided tour: plays one throw on the real wheel by itself, spotlighting every control with a
// shining gold frame, a caption card and spoken narration (Web Speech API, if available).
// Gestures are real pointer events sent to the canvas, so what you see is exactly what a
// finger would do. Nothing is submitted: the tour never presses Done.
import { useEffect, useRef, useState } from 'preact/hooks';
import type { ThrowStage } from '../three/throwStage';
import * as S from './store';
import { finishOnboarding } from './controller';

/** The live wheel, registered by the Throw screen. */
export const tourStage: { st: ThrowStage | null; canvas: HTMLCanvasElement | null } = { st: null, canvas: null };

type Ctx = {
  alive: () => boolean;
  wait: (ms: number) => Promise<void>;
  click: (sel: string) => Promise<void>;
  hold: (ms: number) => Promise<void>;
  pull: (n: number) => Promise<void>;
  push: (dx: number, at: number) => Promise<void>;
};
type Target = string | 'pot' | null;
/** One spotlight moment inside a step: what to light up, what to say, and what to do on the wheel. */
type Beat = { target: Target; say: string; act?: (c: Ctx) => Promise<void> };
type Step = { title: string; beats: Beat[] };

const opened = () => tourStage.st?.getProfile().opened ?? false;

// Four short steps: the idea, the three tools, how scoring works, and what happens after Done.
const STEPS: Step[] = [
  {
    title: 'How it works',
    beats: [
      { target: '[data-tour=brief]', say: 'Every day there is one commission, and everyone throws the same pot.' },
      {
        target: 'pot',
        say: 'Shape the spinning clay to match the glowing outline. Hold to centre it, then tap Open.',
        act: async (c) => {
          tourStage.st?.recenter();
          await c.wait(500);
          await c.hold(1600);
          if (!opened()) await c.click('[data-tour=open]');
        },
      },
      { target: '[data-tour=beat]', say: 'Beat this score, set by the Master. Your first throw each day is the ranked one.' },
    ],
  },
  {
    title: 'Hands, Push and Thin',
    beats: [
      {
        target: '[data-tour=tool-hands]',
        say: 'Hands: drag up along the wall to pull the pot taller.',
        act: async (c) => {
          if (!opened()) await c.click('[data-tour=open]');
          await c.wait(400);
          await c.pull(2);
        },
      },
      {
        target: '[data-tour=tool-push]',
        say: 'Push: drag sideways to swell the belly out or squeeze a neck in.',
        act: async (c) => {
          await c.click('[data-tour=tool-push]');
          await c.push(30, 0.45);
        },
      },
      {
        target: '[data-tour=tool-thin]',
        say: 'Thin: thins the wall. Too thin and the pot wobbles, then collapses.',
        act: async (c) => {
          await c.click('[data-tour=tool-thin]');
          await c.wait(900);
          await c.click('[data-tour=tool-hands]');
        },
      },
      { target: '[data-tour=water]', say: 'Tap Water when the clay dries out. Undo takes back your last stroke.' },
    ],
  },
  {
    title: 'Scoring and the leaderboard',
    beats: [
      { target: '[data-tour=gauges]', say: 'Matching the shape is most of your score. Even walls, the rules, and using few strokes add the rest.' },
      { target: '[data-tour=ghost]', say: 'Stuck? The ghost replays the Master’s own strokes so you can copy them.' },
      { target: '[data-tour=done]', say: 'Tap Done to score. Your ranked throw goes on today’s leaderboard, and stars raise your potter rank.' },
    ],
  },
  {
    title: 'After you tap Done',
    beats: [
      { target: '.pn-bottomnav__cell:nth-child(2)', say: 'Glaze your pot and load the kiln. It fires at midnight UTC, so come back tomorrow to open it.' },
      { target: '.pn-bottomnav__cell:nth-child(4)', say: 'New glaze effects go in the Codex, and the Shelf shows every fired pot for likes.' },
      { target: '[data-tour=info]', say: 'Tap here to watch this again. The wheel is yours, potter.' },
    ],
  },
];

// ---------- narration ----------
let voice: SpeechSynthesisVoice | null = null;
function pickVoice() {
  const vs = window.speechSynthesis?.getVoices() ?? [];
  const pref = [/en-IN/i, /Google UK English Female/i, /Natural/i, /en-GB/i, /en-US/i];
  for (const p of pref) {
    const v = vs.find((x) => p.test(x.lang) || p.test(x.name));
    if (v) return v;
  }
  return vs[0] ?? null;
}
function speak(text: string, on: boolean): Promise<void> {
  const fallback = 900 + text.split(/\s+/).length * 330;
  const synth = window.speechSynthesis;
  if (!on || !synth || typeof SpeechSynthesisUtterance === 'undefined') return new Promise((r) => setTimeout(r, fallback));
  return new Promise((resolve) => {
    synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    voice ??= pickVoice();
    if (voice) u.voice = voice;
    u.rate = 1.03;
    u.pitch = 1;
    let done = false;
    const t0 = Date.now();
    const minMs = 700 + text.split(/\s+/).length * 220; // if the voice errors out instantly, still give time to read
    const end = () => {
      if (!done) {
        done = true;
        setTimeout(resolve, Math.max(0, minMs - (Date.now() - t0)));
      }
    };
    u.onend = end;
    u.onerror = end;
    setTimeout(end, fallback + 1500); // never hang on a stuck voice
    synth.speak(u);
  });
}

// ---------- gestures ----------
const PID = 7301;
let held: { x: number; y: number } | null = null;
function fire(type: string, x: number, y: number) {
  const c = tourStage.canvas;
  if (!c) return;
  held = type === 'pointerup' ? null : { x, y };
  c.dispatchEvent(
    new PointerEvent(type, { pointerId: PID, pointerType: 'mouse', isPrimary: true, button: 0, buttons: type === 'pointerup' ? 0 : 1, clientX: x, clientY: y, bubbles: true, cancelable: true }),
  );
}
function frameClient() {
  const st = tourStage.st;
  const c = tourStage.canvas;
  if (!st || !c) return null;
  const f = st.getScreenFrame();
  const r = c.getBoundingClientRect();
  return { ...f, axisX: f.axisX + r.left, baseY: f.baseY + r.top, rimY: f.rimY + r.top, topY: f.topY + r.top };
}

export function Tour() {
  const [i, setStep] = useState(0);
  const [bi, setBeat] = useState(0);
  const setI = (n: number) => {
    setStep(n);
    setBeat(0);
  };
  const [playing, setPlaying] = useState(true);
  const [voiceOn, setVoiceOn] = useState(!S.muted.value);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [finger, setFinger] = useState<{ x: number; y: number; down: boolean } | null>(null);
  const run = useRef(0);
  const step = STEPS[i]!;
  const beat = step.beats[bi] ?? step.beats[0]!;
  const last = i === STEPS.length - 1;
  const lastBeat = bi >= step.beats.length - 1;

  // Track the target's position (it can move: the pot grows, the HUD reflows).
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const t = beat.target;
      if (t === null) setRect(null);
      else if (t === 'pot') {
        const f = frameClient();
        if (f) {
          const w = Math.max(120, f.maxRadiusPx * 2 + 120);
          const top = Math.min(f.rimY, f.topY) - 60;
          setRect({ x: f.axisX - w / 2, y: top, w, h: f.baseY - top + 34 });
        }
      } else {
        const el = document.querySelector(t);
        if (el) {
          const r = el.getBoundingClientRect();
          setRect({ x: r.left - 6, y: r.top - 6, w: r.width + 12, h: r.height + 12 });
        } else setRect(null);
      }
      raf = window.setTimeout(measure, 120);
    };
    measure();
    return () => clearTimeout(raf);
  }, [i, bi]);

  // Run the step: narrate and act together, then advance when both are done.
  useEffect(() => {
    const id = ++run.current;
    const alive = () => run.current === id;
    const wait = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));
    const moveFinger = async (x: number, y: number, down: boolean) => {
      if (alive()) setFinger({ x, y, down });
    };
    const ctx: Ctx = {
      alive,
      wait,
      async click(sel) {
        const el = document.querySelector<HTMLElement>(sel);
        if (!el || !alive()) return;
        const r = el.getBoundingClientRect();
        await moveFinger(r.left + r.width / 2, r.top + r.height / 2, false);
        await wait(450);
        if (!alive()) return;
        await moveFinger(r.left + r.width / 2, r.top + r.height / 2, true);
        el.click();
        await wait(220);
        await moveFinger(r.left + r.width / 2, r.top + r.height / 2, false);
      },
      async hold(ms) {
        const f = frameClient();
        if (!f || !alive()) return;
        const x = f.axisX;
        const y = (f.baseY + f.rimY) / 2;
        await moveFinger(x, y, false);
        await wait(400);
        await moveFinger(x, y, true);
        fire('pointerdown', x, y);
        const t0 = Date.now();
        while (Date.now() - t0 < ms && alive()) {
          await wait(60);
          fire('pointermove', x + Math.sin(Date.now() / 90) * 0.6, y);
        }
        fire('pointerup', x, y);
        await moveFinger(x, y, false);
      },
      async pull(n) {
        for (let k = 0; k < n && alive(); k++) {
          const f = frameClient();
          if (!f) return;
          const x = f.axisX + f.maxRadiusPx * 0.95;
          const y0 = f.baseY - 4;
          await moveFinger(x, y0, false);
          await wait(350);
          await moveFinger(x, y0, true);
          fire('pointerdown', x, y0);
          const steps = 40;
          for (let s = 1; s <= steps && alive(); s++) {
            const g = frameClient();
            if (!g) break;
            const y = y0 - ((f.baseY - g.rimY + 6) * s) / steps;
            fire('pointermove', x, y);
            setFinger({ x, y, down: true });
            await wait(38);
          }
          const g = frameClient();
          fire('pointerup', x, g ? g.rimY - 6 : y0);
          setFinger((p) => (p ? { ...p, down: false } : p));
          await wait(300);
        }
      },
      async push(dx, at) {
        const f = frameClient();
        if (!f || !alive()) return;
        const y = f.baseY - (f.baseY - f.rimY) * at;
        const x0 = f.axisX + f.maxRadiusPx;
        await moveFinger(x0, y, false);
        await wait(350);
        await moveFinger(x0, y, true);
        fire('pointerdown', x0, y);
        for (let s = 1; s <= 12 && alive(); s++) {
          fire('pointermove', x0 + (dx * s) / 12, y);
          setFinger({ x: x0 + (dx * s) / 12, y, down: true });
          await wait(40);
        }
        fire('pointerup', x0 + dx, y);
        setFinger((p) => (p ? { ...p, down: false } : p));
      },
    };
    void (async () => {
      setFinger(null);
      const said = speak(bi === 0 ? `${step.title}. ${beat.say}` : beat.say, voiceOn);
      const did = beat.act ? beat.act(ctx) : Promise.resolve();
      await Promise.all([said, did]);
      if (!alive()) return;
      setFinger(null);
      await wait(350);
      if (!alive() || !playing) return;
      if (!lastBeat) setBeat(bi + 1);
      else if (!last) setI(i + 1);
    })();
    return () => {
      run.current++;
      window.speechSynthesis?.cancel();
      if (held) fire('pointerup', held.x, held.y);
    };
  }, [i, bi, playing, voiceOn]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  function end() {
    run.current++;
    window.speechSynthesis?.cancel();
    S.tour.value = false;
    if (S.me.value && !S.me.value.onboarded) void finishOnboarding();
  }

  const vh = typeof window !== 'undefined' ? window.innerHeight : 800;
  const below = !rect || rect.y + rect.h / 2 < vh * 0.45;
  const cardStyle = rect
    ? below
      ? { top: `${Math.min(vh - 230, rect.y + rect.h + 14)}px` }
      : { bottom: `${Math.min(vh - 230, vh - rect.y + 14)}px` }
    : { top: '50%', transform: 'translate(-50%, -50%)' };

  return (
    <div class="tour" role="dialog" aria-modal="true" aria-labelledby="tour-title">
      <div class="tour__block" />
      {rect ? (
        <div class="tour__spot" style={{ left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.w}px`, height: `${rect.h}px` }} />
      ) : (
        <div class="tour__dim" />
      )}
      {finger ? <div class={`tour__finger${finger.down ? ' is-down' : ''}`} style={{ left: `${finger.x}px`, top: `${finger.y}px` }} /> : null}
      <div class="tour__card" style={cardStyle} key={i}>
        <div class="tour__progress" style={{ '--p': `${((i + (bi + 1) / step.beats.length) / STEPS.length) * 100}%` }} />
        <div class="tour__head">
          <span class="tour__count">
            Step {i + 1} of {STEPS.length}
          </span>
          <button type="button" class={`tour__voice${voiceOn ? ' is-on' : ''}`} aria-pressed={voiceOn} aria-label={voiceOn ? 'Turn narration off' : 'Turn narration on'} onClick={() => setVoiceOn(!voiceOn)}>
            {voiceOn ? (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M16 8.5a5 5 0 0 1 0 7M18.5 6a8.5 8.5 0 0 1 0 12" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" /></svg>
            ) : (
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" /><path d="M17 9l5 6M22 9l-5 6" stroke="currentColor" stroke-width="2" stroke-linecap="round" /></svg>
            )}
          </button>
          <button type="button" class="tour__skip" onClick={end}>
            Skip tour
          </button>
        </div>
        <h2 id="tour-title" class="tour__title">{step.title}</h2>
        <p class="tour__text" key={bi}>
          {beat.say}
        </p>
        <div class="tour__beats" aria-hidden="true">
          {step.beats.map((_, k) => (
            <i key={k} class={k < bi ? 'is-done' : k === bi ? 'is-on' : ''} />
          ))}
        </div>
        <div class="tour__nav">
          <button type="button" class="tour__btn" disabled={i === 0} onClick={() => setI(i - 1)}>
            Back
          </button>
          <button type="button" class="tour__btn" onClick={() => setPlaying(!playing)} aria-pressed={!playing}>
            {playing ? 'Pause' : 'Play'}
          </button>
          {last ? (
            <button type="button" class="tour__btn tour__btn--gold" onClick={end}>
              Throw now
            </button>
          ) : (
            <button type="button" class="tour__btn tour__btn--gold" onClick={() => setI(i + 1)}>
              Next
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
