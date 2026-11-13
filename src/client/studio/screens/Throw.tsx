// The wheel: full-screen 3D throw stage with a glass HUD.
import { useEffect, useRef, useState } from 'preact/hooks';
import { decodeProfile } from '../../../shared/core/profile';
import { createThrowStage, type ThrowStage, type ThrowState } from '../../three/throwStage';
import { Button, IconButton } from '../../ui/Button';
import { HintBubble } from '../../ui/HintBubble';
import { IconCheck, IconChevron, IconInfo, IconOpen, IconUndo } from '../../ui/icons';
import { useReducedMotion } from '../../ui/hooks';
import * as S from '../store';
import { completeHint, go, haptic, profileOf, startTour, submitThrow, throwStarted, updateHint } from '../controller';
import { tourStage } from '../Tour';
import { coach, type Coach } from '../coach';

const TOOLS = [
  { id: 'hands', label: 'Hands', tip: 'Drag up the wall to pull; sideways to push' },
  { id: 'push', label: 'Push', tip: 'Sideways drag pushes the clay in or out' },
  { id: 'thin', label: 'Thin', tip: 'Any drag along the wall thins it' },
] as const;

export function Throw() {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stageRef = useRef<ThrowStage | null>(null);
  const reduced = useReducedMotion();
  const c = S.commission.value;
  const live = S.live.value;
  const [warn, setWarn] = useState<'thin' | 'slump' | 'limit' | null>(null);
  const [more, setMore] = useState(false);
  const [frame, setFrame] = useState<{ x: number; top: number; mid: number; baseY: number; rimY: number; ppu: number } | null>(null);
  const [tip, setTip] = useState<Coach | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !c) return;
    const target = decodeProfile(c.target);
    const stage = createThrowStage({
      canvas: el,
      target,
      reducedMotion: reduced,
      skipCentering: !S.tour.value && S.hintsDone.value.has('drag'),
      onChange: (s: ThrowState) => {
        S.live.value = s;
        updateHint();
        const st = stageRef.current;
        const f = st?.getScreenFrame();
        if (f) setFrame({ x: f.axisX, top: f.topY, mid: (f.rimY + f.baseY) / 2, baseY: f.baseY, rimY: f.rimY, ppu: f.pxPerUnit });
        setTip(st && s.phase === 'throwing' ? coach(st.getProfile(), target, s.wetness, s.matchPreview) : null);
      },
      onEvent: (e) => {
        if (e === 'stroke-start' && (!S.tour.value || S.practice.value)) {
          throwStarted();
          completeHint('drag');
        }
        if (e === 'opened' && (!S.tour.value || S.practice.value)) completeHint('open');
        if (e === 'wobble-start') setWarn('thin');
        if (e === 'slumped') setWarn('slump');
        if (e === 'limit') setWarn('limit');
        if (e === 'centred') setWarn(null);
      },
    });
    stage.setTool(S.tool.value);
    stageRef.current = stage;
    tourStage.st = stage;
    tourStage.canvas = el;
    const onVis = () => stage.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stage.dispose();
      stageRef.current = null;
      if (tourStage.st === stage) {
        tourStage.st = null;
        tourStage.canvas = null;
      }
      S.live.value = null;
    };
  }, [c?.id, reduced, S.tour.value]);


  useEffect(() => {
    if (live && !live.unsafe && !live.slumped && warn === 'thin') setWarn(null);
  }, [live?.unsafe]);

  if (!c) return null;
  const stage = stageRef.current;
  const hint = S.activeHint.value;
  const submitting = S.submitting.value;
  const started = (live?.strokes ?? 0) > 0;
  const match = live?.matchPreview ?? null;
  const pass = c.bar;
  const focus = !S.tour.value;

  async function done() {
    const st = stageRef.current;
    if (!st) return;
    const log = st.finish();
    const prof = st.getProfile();
    st.setInputEnabled(false);
    try {
      S.lastThumb.value = await st.renderThumbnail(prof, 512);
    } catch {
      S.lastThumb.value = null;
    }
    const ok = await submitThrow(log, profileOf(prof));
    if (!ok) st.setInputEnabled(true);
  }

  return (
    <section class="throw" aria-label="Pottery wheel">
      <canvas ref={canvas} class="throw__canvas" aria-label="Wheel with clay. Drag on the clay to shape it." />

      <header class="throw__top">
        <div class="throw__brief pn-glass pn-radius-lg" data-tour="brief">
          {focus ? (
            <IconButton class="throw__leave" label={c.kind === 'level' ? 'Back to the level map' : 'Leave the wheel'} variant="ghost" onClick={() => go('levels')} icon={<IconChevron direction="left" />} />
          ) : null}
          <div class="throw__brief-main">
            <p class="pn-eyebrow">
              {c.kind === 'official'
                ? `Commission · ${c.origin}`
                : c.kind === 'level'
                  ? `${c.origin}${c.formatLabel === 'Master level' ? ' · Master level' : ''}`
                  : c.kind === 'tutorial'
                    ? 'Tutorial · practice pot'
                    : `Beat ${c.commissioner}`}
            </p>
            <h1 class="throw__title">{c.title}</h1>
          </div>
          <div class="throw__beat" title={c.kind === 'level' || c.kind === 'tutorial' ? 'Score to pass' : 'Score to beat'} data-tour="beat">
            <span class="throw__beat-label">{c.kind === 'level' || c.kind === 'tutorial' ? 'Pass' : 'Beat'}</span>
            <span class="throw__beat-num">{c.bar}</span>
          </div>
        </div>
        {c.constraintLabels.length ? (
          <ul class="throw__rules" aria-label="Constraints" data-tour="rules">
            {c.constraintLabels.map((l) => (
              <li key={l} class="pn-chip pn-chip--sm">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div class={`throw__gauges${more ? ' is-more' : ''}`} aria-live="polite" data-tour="gauges">
        <div class={`matchbar${match !== null && match >= pass ? ' is-pass' : ''}`} role="meter" aria-label="Shape match" aria-valuemin={0} aria-valuemax={100} aria-valuenow={match ?? 0}>
          <span class="matchbar__label">Match</span>
          <span class="matchbar__track">
            <span class="matchbar__fill" style={{ width: `${match ?? 0}%` }} />
            <span class="matchbar__pass" style={{ left: `${pass}%` }} title={`Pass ${pass}`} />
          </span>
          <span class="matchbar__num">{match === null ? '–' : `${match}%`}</span>
        </div>
        <Gauge label="Time" value={live ? fmtTime(live.secondsLeft) : '3:00'} tone={live && live.secondsLeft < 20 ? 'bad' : undefined} />
        <button type="button" class="throw__more" aria-expanded={more} aria-label={more ? 'Hide measurements' : 'Show measurements'} onClick={() => setMore(!more)}>
          <IconChevron direction={more ? 'up' : 'down'} size={16} />
        </button>
        {more || live?.unsafe ? (
          <div class="throw__measures">
            <Gauge label="Height" value={live ? `${live.heightMm} mm` : '–'} />
            <Gauge label="Wall" value={live?.opened ? `${live.minWallMm} mm` : 'solid'} tone={live?.unsafe ? 'bad' : undefined} />
            <Gauge label="Holds" value={live ? `${live.capacityMl} ml` : '–'} />
          </div>
        ) : null}
      </div>

      {live && live.phase === 'centering' && !S.tour.value ? (
        <div class="throw__center-tip pn-glass pn-radius-lg" role="status">
          <strong>Centre the clay</strong>
          <span>Press and hold on the clay until it runs true.</span>
          <button type="button" class="throw__link" onClick={() => stage?.skipCentering()}>
            Skip
          </button>
        </div>
      ) : null}

      {warn ? (
        <div class={`throw__alert throw__alert--${warn}`} role="alert">
          <strong class="throw__alert-title">{WARN[warn].title}</strong>
          <span class="throw__alert-body">{WARN[warn].body}</span>
          <div class="throw__alert-actions">
            {warn !== 'limit' ? (
              <button type="button" class="throw__alert-btn" onClick={() => (stage?.undo(), setWarn(null))}>
                <IconUndo size={16} /> Undo last stroke
              </button>
            ) : null}
            {warn !== 'thin' ? (
              <button type="button" class="throw__alert-btn" onClick={() => (stage?.reset(), setWarn(null))}>
                Start again
              </button>
            ) : null}
            {warn === 'limit' ? (
              <button type="button" class="throw__alert-btn is-primary" onClick={() => void done()}>
                Done, score it
              </button>
            ) : null}
            {warn === 'thin' ? (
              <button type="button" class="throw__alert-btn is-ghost" onClick={() => setWarn(null)}>
                Keep going
              </button>
            ) : null}
          </div>
        </div>
      ) : tip && !hint && !S.tour.value && live?.phase === 'throwing' ? (
        <div class={`throw__coach throw__coach--${tip.tone}`} role="status" key={tip.text}>
          <span class="throw__coach-dot" aria-hidden="true" />
          {tip.text}
        </div>
      ) : null}

      {tip?.arrow && frame && !warn && !hint && !S.tour.value && live?.phase === 'throwing' ? (
        <CoachArrows tip={tip} frame={frame} />
      ) : null}

      {hint && !warn && !S.tour.value && frame && live?.phase === 'throwing' ? (
        <HintBubble
          x={frame.x}
          y={frame.top - 8}
          placement="top"
          step={{ index: hint === 'drag' ? 0 : 1, total: 2 }}
          title={hint === 'drag' ? 'Shape the clay' : hint === 'open' ? 'Open the clay' : 'Pull up the walls'}
          showTarget={hint === 'open'}
          onDismiss={() => completeHint(hint)}
        >
          {hint === 'drag'
            ? 'Drag sideways on the clay: toward the middle narrows it, away widens it.'
            : hint === 'open'
              ? 'Tap the top of the clay to open a hollow (or use Open below).'
              : 'Drag slowly upward along the wall to pull it up thinner and taller. Keep the walls even.'}
        </HintBubble>
      ) : null}

      <footer class="throw__dock">
        <div class="throw__tools" role="radiogroup" aria-label="Hands" data-tour="tools">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              data-tour={`tool-${t.id}`}
              role="radio"
              aria-checked={S.tool.value === t.id}
              title={t.tip}
              class={`throw__tool${S.tool.value === t.id ? ' is-on' : ''}`}
              onClick={() => {
                haptic(6);
                S.tool.value = t.id;
                stage?.setTool(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div class="throw__actions">
          <IconButton data-tour="undo" label="Undo last stroke" variant="glass" disabled={!started} onClick={() => stage?.undo()} icon={<IconUndo />} />
          {live && !live.opened ? (
            <Button data-tour="open" variant="secondary" icon={<IconOpen />} onClick={() => stage?.open()}>
              Open
            </Button>
          ) : (
            <Button
              data-tour="water"
              variant="secondary"
              class={live && live.wetness < 0.35 ? 'is-dry' : undefined}
              onClick={() => stage?.addWater()}
              aria-label={`Add water (clay is ${Math.round((live?.wetness ?? 1) * 100)}% wet)`}
            >
              <WaterDrop wet={live?.wetness ?? 1} />
              Water
            </Button>
          )}
          <Button data-tour="done" variant="primary" icon={<IconCheck />} disabled={!started || submitting} loading={submitting} onClick={() => void done()}>
            Done
          </Button>
          <IconButton data-tour="info" label="How to play" variant="ghost" onClick={() => startTour()} icon={<IconInfo />} />
        </div>
        {focus ? <span class="throw__dock-spacer" aria-hidden="true" /> : null}
      </footer>
    </section>
  );
}

const WARN = {
  thin: { title: 'The walls are too thin', body: 'The pot is wobbling. Stop thinning: undo that stroke, or push a little clay back in.' },
  slump: { title: 'Your pot collapsed', body: 'The walls got too thin to hold up the clay above them. Undo the stroke that did it, or start with a fresh lump.' },
  limit: { title: 'Time is up for this throw', body: 'The clay has been worked as far as it can go. Score it as it is, or start again.' },
} as const;

/** Glowing chevrons on the clay: where to drag next, and which way. */
function CoachArrows({ tip, frame }: { tip: Coach; frame: { x: number; baseY: number; rimY: number; ppu: number } }) {
  const a = tip.arrow!;
  const y = frame.baseY - a.frac * (frame.baseY - frame.rimY);
  const r = a.radius * frame.ppu;
  if (a.dir === 'up') {
    return (
      <div class="coach-arrow coach-arrow--up" style={{ left: `${frame.x + r + 22}px`, top: `${y}px` }} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    );
  }
  return (
    <>
      <div class={`coach-arrow coach-arrow--${a.dir}`} style={{ left: `${frame.x + r + 26}px`, top: `${y}px` }} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
      <div class={`coach-arrow coach-arrow--${a.dir} coach-arrow--left`} style={{ left: `${frame.x - r - 26}px`, top: `${y}px` }} aria-hidden="true">
        <i />
        <i />
        <i />
      </div>
    </>
  );
}

/** A droplet that drains as the clay dries. */
function WaterDrop({ wet }: { wet: number }) {
  const h = 19 * Math.max(0, Math.min(1, wet));
  const d = 'M8 1.2C8 1.2 2 8.6 2 12.6a6 6 0 0 0 12 0C14 8.6 8 1.2 8 1.2z';
  return (
    <svg class="water-drop" viewBox="0 0 16 20" width="15" height="19" aria-hidden="true">
      <clipPath id="water-drop-clip">
        <path d={d} />
      </clipPath>
      <rect clip-path="url(#water-drop-clip)" x="0" y={19.5 - h} width="16" height={h} fill="#7cc4ff" />
      <path d={d} fill="none" stroke="currentColor" stroke-width="1.6" />
    </svg>
  );
}

function Gauge({ label, value, tone }: { label: string; value: string; tone?: 'good' | 'bad' | undefined }) {
  return (
    <div class={`gauge${tone ? ` gauge--${tone}` : ''}`}>
      <span class="gauge__label">{label}</span>
      <span class="gauge__value">{value}</span>
    </div>
  );
}

function fmtTime(s: number): string {
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
