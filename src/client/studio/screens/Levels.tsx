// The level map (100 kiln-sealed boxes, opened one by one) and the result of a level throw.
import { useEffect, useMemo, useRef, useState } from 'preact/hooks';
import { LEVEL_COUNT, levelData, levelPreview, levelStars } from '../../../shared/content/levels';
import type { ScoreBreakdown } from '../../../shared/core/score';
import { sfx } from '../../app/audio';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { ScoreRing } from '../../ui/ScoreRing';
import { Stars } from '../../ui/Stars';
import { EmptyState } from '../../ui/States';
import { IconBrush, IconChevron, IconInfo, IconRetry, IconWheel } from '../../ui/icons';
import { isEmptyDecor } from '../../../shared/core/decor';
import { PotView, TargetView } from '../parts';
import * as S from '../store';
import { go, playDaily, playLevel, say, startTour } from '../controller';

const TIER_NAMES = ['River', 'Clay', 'Ember', 'Ash', 'Copper', 'Saffron', 'Monsoon', 'Jade', 'Obsidian', 'Starfire'];

/** The level's fired pot, rendered only once its box scrolls into view. */
function LevelPot({ n, size }: { n: number; size: number }) {
  const ref = useRef<HTMLSpanElement>(null);
  const [seen, setSeen] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      setSeen(true);
      return;
    }
    const io = new IntersectionObserver((es) => {
      if (es.some((e) => e.isIntersecting)) {
        setSeen(true);
        io.disconnect();
      }
    }, { rootMargin: '240px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, []);
  const pv = useMemo(() => (seen ? levelPreview(n) : null), [seen, n]);
  return (
    <span ref={ref} class="lv__pot">
      {pv ? <PotView pot={{ potId: `level-${n}`, profile: pv.profile, glaze: pv.glaze, fired: pv.fired }} width={size} height={size} /> : null}
    </span>
  );
}

function Padlock({ size }: { size: number }) {
  return (
    <svg viewBox="0 0 32 36" width={size} height={size * 1.12} aria-hidden="true">
      <defs>
        <linearGradient id="lv-lock-body" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#ffe29a" />
          <stop offset="0.45" stop-color="#d6982c" />
          <stop offset="1" stop-color="#7a4a10" />
        </linearGradient>
        <linearGradient id="lv-lock-shackle" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#6b6f76" />
          <stop offset="0.5" stop-color="#e9edf2" />
          <stop offset="1" stop-color="#5b5f66" />
        </linearGradient>
      </defs>
      <path d="M9 16v-5a7 7 0 0 1 14 0v5" fill="none" stroke="url(#lv-lock-shackle)" stroke-width="3.6" stroke-linecap="round" />
      <rect x="4" y="15" width="24" height="19" rx="4.5" fill="url(#lv-lock-body)" stroke="#4a2a06" stroke-width="1.2" />
      <rect x="6" y="16.6" width="20" height="2.2" rx="1.1" fill="#fff4cf" opacity="0.55" />
      <circle cx="16" cy="24" r="2.6" fill="#3a2006" />
      <path d="M15 25.5h2l.6 4.2h-3.2z" fill="#3a2006" />
    </svg>
  );
}

function Tile({ n, unlocked, best }: { n: number; unlocked: number; best: number }) {
  const d = levelData(n);
  const locked = n > unlocked;
  const cleared = !locked && best >= d.spec.pass;
  const current = !locked && !cleared && n === unlocked;
  const [shake, setShake] = useState(false);
  const cls = ['lv__tile', locked ? 'is-locked' : cleared ? 'is-cleared' : current ? 'is-current' : 'is-open', d.spec.boss ? 'is-boss' : '', shake ? 'is-shake' : '']
    .filter(Boolean)
    .join(' ');
  return (
    <li>
      <button
        type="button"
        class={cls}
        data-level={n}
        aria-label={locked ? `Level ${n}, locked` : `Level ${n}, ${d.spec.title}${cleared ? `, best match ${best}%` : ''}`}
        onClick={() => {
          if (locked) {
            sfx.thump();
            setShake(true);
            setTimeout(() => setShake(false), 450);
            say(`Level ${n} is sealed. Clear level ${unlocked} to open the next box.`);
            return;
          }
          playLevel(n);
        }}
      >
        <LevelPot n={n} size={88} />
        <span class="lv__embers" aria-hidden="true">
          {[0, 1, 2, 3, 4].map((k) => (
            <i key={k} style={{ '--k': k, '--x': `${((n * 37 + k * 23) % 80) + 10}%` }} />
          ))}
        </span>
        {locked ? (
          <>
            <span class="lv__bands" aria-hidden="true">
              <i class="lv__band lv__band--t" />
              <i class="lv__band lv__band--b" />
              <i class="lv__band lv__band--l" />
              <i class="lv__band lv__band--r" />
            </span>
            <span class="lv__lock" aria-hidden="true">
              <Padlock size={30} />
            </span>
          </>
        ) : null}
        <span class="lv__num">{n}</span>
        {d.spec.boss ? <span class="lv__boss">Master</span> : null}
        {cleared ? (
          <span class="lv__stars" aria-hidden="true">
            {[1, 2, 3].map((k) => (
              <i key={k} class={k <= levelStars(best, d.spec.pass) ? 'is-on' : ''} />
            ))}
          </span>
        ) : current ? (
          <span class="lv__play">Play</span>
        ) : null}
        <span class="lv__name">{locked ? 'Sealed' : d.spec.title}</span>
      </button>
    </li>
  );
}

export function Levels() {
  const lv = S.levels.value;
  const today = S.today.value;
  const unlocked = lv?.unlocked ?? 1;
  const best = lv?.best ?? [];
  const cleared = best.filter((b, i) => b >= levelData(i + 1).spec.pass).length;
  const stars = best.reduce((s, b, i) => s + levelStars(b, levelData(i + 1).spec.pass), 0);
  const grid = useRef<HTMLDivElement>(null);
  useEffect(() => {
    // Bring the next box to play into view.
    const el = grid.current?.querySelector<HTMLElement>(`[data-level="${unlocked}"]`);
    if (el && unlocked > 3) el.scrollIntoView({ block: 'center' });
  }, []);
  return (
    <section class="sc lv" aria-labelledby="lv-title">
      <p class="pn-eyebrow">One hundred kilns</p>
      <h1 id="lv-title" class="pn-headline">Levels</h1>
      <div class="lv__summary">
        <span>
          <b class="pn-num">{cleared}</b> of {LEVEL_COUNT} cleared
        </span>
        <span>
          <b class="pn-num">{stars}</b> / {LEVEL_COUNT * 3} stars
        </span>
        <div class="lv__meter" aria-hidden="true">
          <span style={{ width: `${(cleared / LEVEL_COUNT) * 100}%` }} />
        </div>
      </div>
      <div class="lv__row">
        <Button variant="primary" icon={<IconWheel />} onClick={() => playLevel(unlocked)}>
          Play level {unlocked}
        </Button>
        <Button variant="secondary" icon={<IconInfo />} onClick={() => startTour()}>
          Tutorial
        </Button>
      </div>
      {today ? (
        <button type="button" class="lv__daily pn-glass" onClick={() => playDaily()}>
          <span class="lv__daily-art">
            <TargetView profile={today.commission.target} width={40} height={50} />
          </span>
          <span class="lv__daily-copy">
            <span class="lv__daily-label">Today’s commission</span>
            <b>{today.commission.title}</b>
            <span>
              {today.commission.origin} · beat {today.commission.bar}
            </span>
          </span>
          <IconChevron direction="right" />
        </button>
      ) : null}
      {lv && !lv.saved ? <p class="lv__note">Log in to keep your progress on every device. For now it is saved in this browser.</p> : null}
      <div class="lv__grid" ref={grid}>
        {TIER_NAMES.map((t, ti) => (
          <section key={t} class="lv__tier" aria-label={`Levels ${ti * 10 + 1} to ${ti * 10 + 10}`}>
            <h2 class="lv__tier-title">
              <span>{t}</span>
              <small>
                Levels {ti * 10 + 1}–{ti * 10 + 10}
              </small>
            </h2>
            <ol class="lv__tiles">
              {Array.from({ length: 10 }, (_, k) => ti * 10 + k + 1).map((n) => (
                <Tile key={n} n={n} unlocked={unlocked} best={best[n - 1] ?? 0} />
              ))}
            </ol>
          </section>
        ))}
      </div>
    </section>
  );
}

const VERDICT = ['Rough, but every potter starts here.', 'A fair pot. Close to the mark.', 'A good pot. The kiln will be proud.', 'A master’s pot. Flawless.'];

function Breakdown({ sc, labels }: { sc: ScoreBreakdown; labels: string[] }) {
  const parts = [
    { label: 'Shape match', v: sc.match, w: '60%' },
    { label: 'Even walls', v: sc.evenness, w: '20%' },
    { label: 'Rules', v: sc.constraints, w: '10%' },
    { label: 'Few strokes', v: sc.efficiency, w: '10%' },
  ];
  return (
    <GlassPanel padding="md" radius="lg" class="result__breakdown">
      <h2 class="pn-eyebrow">How it scored</h2>
      <ul>
        {parts.map((p, i) => (
          <li key={p.label} style={{ '--i': i }}>
            <span>{p.label}</span>
            <span class="result__weight">{p.w}</span>
            <span class="result__bar">
              <span class={p.v >= 80 ? 'is-high' : p.v < 50 ? 'is-low' : ''} style={{ width: `${p.v}%` }} />
            </span>
            <span class="pn-num">{p.v}</span>
          </li>
        ))}
      </ul>
      {sc.results.length ? (
        <ul class="result__rules">
          {sc.results.map((r, i) => (
            <li key={i} class={`pn-chip pn-chip--sm ${r.pass ? 'pn-chip--success' : 'pn-chip--danger'}`}>
              {r.pass ? 'Met' : 'Missed'}: {labels[i] ?? r.detail}
            </li>
          ))}
        </ul>
      ) : null}
    </GlassPanel>
  );
}

export function LevelResult() {
  const ll = S.lastLevel.value;
  const thumb = S.lastThumb.value;
  const passed = ll?.res.passed ?? false;
  useEffect(() => {
    if (!ll) return;
    const id = setTimeout(() => {
      sfx.stamp();
      if (passed) setTimeout(() => sfx.chime(), 120);
    }, 1900);
    return () => clearTimeout(id);
  }, [ll]);
  if (!ll) return <EmptyState title="No level thrown yet" description="Pick a level to throw." action={<Button onClick={() => go('levels')}>Open the level map</Button>} />;
  const { res, commission } = ll;
  const n = res.level;
  const sc = res.score;
  const next = n < LEVEL_COUNT ? levelData(n + 1) : null;
  return (
    <section class="sc result lvr" aria-labelledby="lvr-title">
      <p class="pn-eyebrow">
        Level {n} · {commission.title}
      </p>
      <h1 id="lvr-title" class="pn-headline">
        {passed ? (res.firstClear ? 'Level cleared!' : 'Cleared again.') : sc.total >= res.pass - 5 ? 'So close.' : 'Not this time.'}
      </h1>
      <div class={`result__stage${passed ? ' is-win' : ''}`}>
        <div class="result__spot" aria-hidden="true" />
        <div class="result__wheel" aria-hidden="true" />
        <div class="result__pot">{thumb ? <img src={thumb} alt="Your pot" width={200} height={200} /> : <PotView pot={{ profile: ll.profile, glaze: null, fired: null }} width={130} height={170} />}</div>
        <div class="result__order" aria-label="The target shape">
          <TargetView profile={commission.target} width={44} height={56} />
          <span>Level {n}</span>
        </div>
        {passed ? (
          <div class="result__sparks" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} style={{ '--i': i }} />
            ))}
          </div>
        ) : null}
        <div class={`result__stamp ${passed ? 'is-ok' : 'is-no'}`} aria-hidden="true">
          {passed ? 'Cleared' : 'Not yet'}
        </div>
      </div>
      <GlassPanel tone="raised" padding="md" radius="xl" glow class="result__hero">
        <ScoreRing value={sc.match} size={128} label="Match" target={res.pass} targetLabel={`Pass ${res.pass}`} delay={500} />
        <div class="result__score">
          <Stars value={res.stars} size={26} label={`${res.stars} of 3 stars`} delay={1500} />
          <p class="result__verdict">
            {passed
              ? (VERDICT[res.stars] ?? VERDICT[1])
              : sc.match >= res.pass
                ? 'The shape is there, but a rule was missed. Check the chips below.'
                : `A ${res.pass}% match clears this level. Tap the ghost to copy the Master’s moves.`}
          </p>
          <p class="result__rank">
            Best match here: <span class="pn-num">{res.best}%</span>
          </p>
        </div>
      </GlassPanel>
      {res.firstClear && next ? (
        <button type="button" class="lvr__unlock" onClick={() => playLevel(n + 1)}>
          <span class="lvr__unlock-pot">
            <LevelPot n={n + 1} size={64} />
          </span>
          <span class="lvr__unlock-copy">
            <span class="lvr__unlock-label">Box {n + 1} unsealed</span>
            <b>{next.spec.title}</b>
            <span>Match {next.spec.pass}% to clear</span>
          </span>
          <IconChevron direction="right" />
        </button>
      ) : null}
      <Breakdown sc={sc} labels={commission.constraintLabels} />
      {!res.saved ? <p class="lv__note">Saved in this browser. Log in to keep your levels everywhere.</p> : null}
      <div class="sc__actions">
        {passed && next ? (
          <Button variant="primary" size="lg" block icon={<IconWheel />} onClick={() => playLevel(n + 1)}>
            Next level: {n + 1}
          </Button>
        ) : passed ? (
          <Button variant="primary" size="lg" block onClick={() => go('levels')}>
            All 100 cleared. See your map
          </Button>
        ) : (
          <Button variant="primary" size="lg" block icon={<IconRetry />} onClick={() => playLevel(n)}>
            Try level {n} again
          </Button>
        )}
        <div class="sc__actions--row">
          {passed ? (
            <Button variant="secondary" icon={<IconRetry />} onClick={() => playLevel(n)}>
              Replay for stars
            </Button>
          ) : null}
          <Button variant="secondary" icon={<IconBrush />} onClick={() => go('decorate')}>
            {isEmptyDecor(S.decor.value) ? 'Decorate it' : 'Repaint'}
          </Button>
          <Button variant="secondary" onClick={() => go('levels')}>
            Level map
          </Button>
        </div>
      </div>
    </section>
  );
}
