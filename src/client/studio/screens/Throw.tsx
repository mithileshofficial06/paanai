// The wheel: full-screen 3D throw stage with a glass HUD.
import { useEffect, useRef, useState } from 'preact/hooks';
import { decodeProfile } from '../../../shared/core/profile';
import { createThrowStage, type ThrowStage, type ThrowState } from '../../three/throwStage';
import { Button, IconButton } from '../../ui/Button';
import { HintBubble } from '../../ui/HintBubble';
import { IconCheck, IconInfo, IconOpen, IconUndo } from '../../ui/icons';
import { useReducedMotion } from '../../ui/hooks';
import * as S from '../store';
import { completeHint, go, profileOf, submitThrow, throwStarted, updateHint } from '../controller';

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
  const [warn, setWarn] = useState<string | null>(null);
  const [frame, setFrame] = useState<{ x: number; top: number; mid: number } | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !c) return;
    const target = decodeProfile(c.target);
    const stage = createThrowStage({
      canvas: el,
      target,
      reducedMotion: reduced,
      skipCentering: S.hintsDone.value.has('drag'),
      onChange: (s: ThrowState) => {
        S.live.value = s;
        updateHint();
        const f = stageRef.current?.getScreenFrame();
        if (f) setFrame({ x: f.axisX, top: f.topY, mid: (f.rimY + f.baseY) / 2 });
      },
      onEvent: (e) => {
        if (e === 'stroke-start') {
          throwStarted();
          completeHint('drag');
        }
        if (e === 'opened') completeHint('open');
        if (e === 'wobble-start') setWarn('Too thin! Stop thinning or add clay back with a push.');
        if (e === 'slumped') setWarn('It collapsed. Undo the last stroke or start again.');
        if (e === 'limit') setWarn('Time is up for this throw. Submit it or start again.');
        if (e === 'centred') setWarn(null);
      },
    });
    stage.setTool(S.tool.value);
    stageRef.current = stage;
    const onVis = () => stage.setPaused(document.hidden);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      stage.dispose();
      stageRef.current = null;
      S.live.value = null;
    };
  }, [c?.id, reduced]);

  useEffect(() => {
    if (live && !live.unsafe && !live.slumped && warn?.startsWith('Too thin')) setWarn(null);
  }, [live?.unsafe]);

  if (!c) return null;
  const stage = stageRef.current;
  const hint = S.activeHint.value;
  const submitting = S.submitting.value;
  const started = (live?.strokes ?? 0) > 0;
  const match = live?.matchPreview ?? null;

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
        <div class="throw__brief pn-glass pn-radius-lg">
          <div class="throw__brief-main">
            <p class="pn-eyebrow">{c.kind === 'official' ? `Commission · ${c.origin}` : `Beat ${c.commissioner}`}</p>
            <h1 class="throw__title">{c.title}</h1>
          </div>
          <div class="throw__beat" title="Score to beat">
            <span class="throw__beat-label">Beat</span>
            <span class="throw__beat-num">{c.bar}</span>
          </div>
        </div>
        {c.constraintLabels.length ? (
          <ul class="throw__rules" aria-label="Constraints">
            {c.constraintLabels.map((l) => (
              <li key={l} class="pn-chip pn-chip--sm">
                {l}
              </li>
            ))}
          </ul>
        ) : null}
      </header>

      <div class="throw__gauges" aria-live="polite">
        <Gauge label="Match" value={match === null ? '–' : `${match}%`} tone={match !== null && match >= 85 ? 'good' : undefined} />
        <Gauge label="Height" value={live ? `${live.heightMm} mm` : '–'} />
        <Gauge label="Wall" value={live?.opened ? `${live.minWallMm} mm` : 'solid'} tone={live?.unsafe ? 'bad' : undefined} />
        <Gauge label="Holds" value={live ? `${live.capacityMl} ml` : '–'} />
        <Gauge label="Time" value={live ? fmtTime(live.secondsLeft) : '3:00'} tone={live && live.secondsLeft < 20 ? 'bad' : undefined} />
      </div>

      {live && live.phase === 'centering' ? (
        <div class="throw__center-tip pn-glass pn-radius-lg" role="status">
          <strong>Centre the clay</strong>
          <span>Press and hold on the clay until it runs true.</span>
          <button type="button" class="throw__link" onClick={() => stage?.skipCentering()}>
            Skip
          </button>
        </div>
      ) : null}

      {warn ? (
        <div class={`throw__warn${live?.slumped ? ' is-bad' : ''}`} role="alert">
          {warn}
        </div>
      ) : null}

      {hint && frame && live?.phase === 'throwing' ? (
        <HintBubble
          x={frame.x}
          y={frame.top - 8}
          placement="top"
          step={{ index: hint === 'drag' ? 0 : hint === 'open' ? 1 : 2, total: 3 }}
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
        <div class="throw__tools" role="radiogroup" aria-label="Hands">
          {TOOLS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={S.tool.value === t.id}
              title={t.tip}
              class={`throw__tool${S.tool.value === t.id ? ' is-on' : ''}`}
              onClick={() => {
                S.tool.value = t.id;
                stage?.setTool(t.id);
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div class="throw__actions">
          <IconButton label="Undo last stroke" variant="glass" disabled={!started} onClick={() => stage?.undo()} icon={<IconUndo />} />
          {live && !live.opened ? (
            <Button variant="secondary" icon={<IconOpen />} onClick={() => stage?.open()}>
              Open
            </Button>
          ) : (
            <Button
              variant="secondary"
              class={live && live.wetness < 0.35 ? 'is-dry' : undefined}
              onClick={() => stage?.addWater()}
              aria-label={`Add water (clay is ${Math.round((live?.wetness ?? 1) * 100)}% wet)`}
            >
              <span class="water-meter" style={{ '--wet': `${Math.round((live?.wetness ?? 1) * 100)}%` }} aria-hidden="true" />
              Water
            </Button>
          )}
          <Button variant="primary" icon={<IconCheck />} disabled={!started || submitting} loading={submitting} onClick={() => void done()}>
            Done
          </Button>
          <IconButton label="How to play" variant="ghost" onClick={() => go('howto')} icon={<IconInfo />} />
        </div>
      </footer>
    </section>
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
