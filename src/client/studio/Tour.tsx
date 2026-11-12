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
type Step = { target: Target; title: string; text: string; act?: (c: Ctx) => Promise<void> };

const STEPS: Step[] = [
  { target: null, title: 'Welcome to the studio', text: 'I will throw one pot for you and show you every control on the way. Sit back and watch, or tap Next whenever you like.' },
  { target: '[data-tour=brief]', title: 'Today’s commission', text: 'This is today’s commission: a real vessel from a real tradition. Everyone in the community throws the same one today.' },
  { target: '[data-tour=beat]', title: 'The score to beat', text: 'This is the score to beat, set by the Master’s own throw. Your first throw each day is the ranked one.' },
  { target: '[data-tour=rules]', title: 'Constraints', text: 'These are the rules for this pot. Meet them for extra points, for example a rim wider than the base.' },
  { target: '[data-tour=gauges]', title: 'Live readings', text: 'Live readings: how closely your shape matches, its height, the thinnest wall, how much it holds, and the time left.' },
  { target: 'pot', title: 'The target shape', text: 'The glowing outline is the shape you are aiming for. The clay sits in the middle of the spinning wheel.' },
  {
    target: 'pot',
    title: 'Centre the clay',
    text: 'First, centring. Press and hold the clay to steady it on the wheel. Watch the wobble settle.',
    act: async (c) => {
      tourStage.st?.recenter();
      await c.wait(900);
      await c.hold(2600);
    },
  },
  {
    target: '[data-tour=open]',
    title: 'Open it',
    text: 'Now tap Open. It presses a hollow into the middle, so the pot can have walls.',
    act: async (c) => {
      await c.wait(1200);
      await c.click('[data-tour=open]');
    },
  },
  { target: '[data-tour=tools]', title: 'Your hands', text: 'These are your hands. Hands does everything: drag up to pull, drag sideways to push. Push only moves clay in or out. Thin only thins the wall.' },
  {
    target: 'pot',
    title: 'Pull the walls up',
    text: 'Watch. Dragging up along the wall pulls the clay taller and thinner. Each pull adds height.',
    act: async (c) => {
      await c.wait(600);
      await c.pull(3);
    },
  },
  {
    target: '[data-tour=water]',
    title: 'Keep it wet',
    text: 'Clay dries as you work, and dry clay drags on your fingers. The blue meter shows how wet it is. Tap Water to wet it again.',
    act: async (c) => {
      await c.wait(1600);
      await c.click('[data-tour=water]');
    },
  },
  {
    target: '[data-tour=tool-push]',
    title: 'Push',
    text: 'Switch to Push. Drag sideways on the wall to swell the belly out, or squeeze a neck in.',
    act: async (c) => {
      await c.wait(900);
      await c.click('[data-tour=tool-push]');
      await c.push(30, 0.45);
    },
  },
  {
    target: '[data-tour=tool-thin]',
    title: 'Thin',
    text: 'Thin makes the walls thinner without moving them. Careful: too thin and the pot wobbles, then collapses.',
    act: async (c) => {
      await c.wait(900);
      await c.click('[data-tour=tool-thin]');
      await c.wait(1500);
      await c.click('[data-tour=tool-hands]');
    },
  },
  {
    target: '[data-tour=undo]',
    title: 'Undo',
    text: 'Made a mistake? Undo takes back your last stroke. You can undo as many times as you need.',
    act: async (c) => {
      await c.wait(1800);
      await c.click('[data-tour=undo]');
    },
  },
  {
    target: '[data-tour=ghost]',
    title: 'The ghost',
    text: 'The ghost replays the commissioner’s own throw beside yours, stroke by stroke, so you can copy their moves.',
    act: async (c) => {
      await c.wait(900);
      await c.click('[data-tour=ghost]');
      await c.wait(4200);
      await c.click('[data-tour=ghost]');
    },
  },
  { target: '[data-tour=done]', title: 'Done', text: 'When you are happy, tap Done. The server replays your strokes and scores the shape, the evenness of the walls, the rules, and how few strokes you used. Then you glaze it and load it in the kiln.' },
  { target: '.pn-bottomnav__cell:nth-child(2)', title: 'The kiln', text: 'Every pot fires together at midnight, UTC. Come back the next day to open the kiln and see what the fire did to your glaze.' },
  { target: '.pn-bottomnav__cell:nth-child(3)', title: 'The shelf', text: 'The shelf holds every pot fired in this community. Like your favourites; the most liked becomes Pot of the Week.' },
  { target: '.pn-bottomnav__cell:nth-child(4)', title: 'The codex', text: 'The codex has twenty four glaze effects to discover. Fire a new one first, and your name goes on it.' },
  { target: '.pn-bottomnav__cell:nth-child(5)', title: 'Commissions', text: 'Once you are a Journeyman, you can post your own pot as a commission, and others try to beat you.' },
  { target: '[data-tour=info]', title: 'Replay this tour', text: 'Tap this any time to watch the tour again.' },
  { target: null, title: 'Your turn', text: 'That’s everything. The clay is fresh and the wheel is yours. Good luck, potter.' },
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
  const [i, setI] = useState(0);
  const [playing, setPlaying] = useState(true);
  const [voiceOn, setVoiceOn] = useState(!S.muted.value);
  const [rect, setRect] = useState<{ x: number; y: number; w: number; h: number } | null>(null);
  const [finger, setFinger] = useState<{ x: number; y: number; down: boolean } | null>(null);
  const run = useRef(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;

  // Track the target's position (it can move: the pot grows, the HUD reflows).
  useEffect(() => {
    let raf = 0;
    const measure = () => {
      const t = step.target;
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
  }, [i]);

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
      const said = speak(`${step.title}. ${step.text}`, voiceOn);
      const did = step.act ? step.act(ctx) : Promise.resolve();
      await Promise.all([said, did]);
      if (!alive()) return;
      setFinger(null);
      await wait(500);
      if (alive() && playing && !last) setI((v) => Math.min(STEPS.length - 1, v + 1));
    })();
    return () => {
      run.current++;
      window.speechSynthesis?.cancel();
      if (held) fire('pointerup', held.x, held.y);
    };
  }, [i, playing, voiceOn]);

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
        <div class="tour__progress" style={{ '--p': `${((i + 1) / STEPS.length) * 100}%` }} />
        <div class="tour__head">
          <span class="tour__count">
            {i + 1} / {STEPS.length}
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
        <p class="tour__text">{step.text}</p>
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
