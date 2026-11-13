// After a throw: the score, then glazing for the kiln.
import { useEffect, useState } from 'preact/hooks';
import { sfx } from '../../app/audio';
import { GLAZES, GLAZE_INFO, APPLICATIONS, type GlazeId } from '../../../shared/core/glazes';
import { Button } from '../../ui/Button';
import { BeatBar } from '../../ui/CommissionCard';
import { GlassPanel } from '../../ui/GlassPanel';
import { ScoreRing } from '../../ui/ScoreRing';
import { Stars } from '../../ui/Stars';
import { IconBrush, IconFlame, IconRetry, IconShare } from '../../ui/icons';
import { EmptyState } from '../../ui/States';
import { PotView, TargetView } from '../parts';

import * as S from '../store';
import { go, login, newThrow, placeInKiln, sharePot } from '../controller';

const VERDICT = ['Rough, but every potter starts here.', 'A fair pot. The order wanted more.', 'A good pot. The buyer will be pleased.', 'A master’s pot. Worthy of the shelf.'];


export function Result() {
  const lt = S.lastThrow.value;
  const thumb = S.lastThumb.value;
  const [sharing, setSharing] = useState(false);
  const [shared, setShared] = useState(false);
  const win = lt?.res.beatBar ?? false;
  useEffect(() => {
    if (!lt) return;
    const id = setTimeout(() => {
      sfx.stamp();
      if (win) setTimeout(() => sfx.chime(), 120);
    }, 1900);
    return () => clearTimeout(id);
  }, [lt]);
  if (!lt) return <EmptyState title="No throw yet" description="Throw today's commission first." action={<Button onClick={() => go('throw')}>Go to the wheel</Button>} />;
  const { res, commission } = lt;
  const sc = res.score;
  const parts = [
    { label: 'Shape match', v: sc.match, w: '60%' },
    { label: 'Even walls', v: sc.evenness, w: '20%' },
    { label: 'Constraints', v: sc.constraints, w: '10%' },
    { label: 'Few strokes', v: sc.efficiency, w: '10%' },
  ];
  return (
    <section class="sc result" aria-labelledby="result-title">
      <p class="pn-eyebrow">{res.ranked ? 'Ranked throw' : res.practiceReason === 'logged-out' ? 'Practice (log in to rank)' : 'Practice throw'}</p>
      <h1 id="result-title" class="pn-headline">{res.beatBar ? 'You beat the bar.' : sc.total >= res.bar - 5 ? 'So close.' : 'Fired up for another go?'}</h1>
      <div class={`result__stage${res.beatBar ? ' is-win' : ''}`}>
        <div class="result__spot" aria-hidden="true" />
        <div class="result__wheel" aria-hidden="true" />
        <div class="result__pot">{thumb ? <img src={thumb} alt="Your pot" width={200} height={200} /> : <PotView pot={{ profile: lt.profile, glaze: null, fired: null }} width={130} height={170} />}</div>
        <div class="result__order" aria-label={`${commission.commissioner}'s order`}>
          <TargetView profile={commission.target} width={44} height={56} />
          <span>The order</span>
        </div>
        {res.beatBar ? (
          <div class="result__sparks" aria-hidden="true">
            {Array.from({ length: 16 }, (_, i) => (
              <i key={i} style={{ '--i': i }} />
            ))}
          </div>
        ) : null}
        <div class={`result__stamp ${res.beatBar ? 'is-ok' : 'is-no'}`} aria-hidden="true">
          {res.beatBar ? 'Accepted' : 'Not yet'}
        </div>
      </div>
      <GlassPanel tone="raised" padding="md" radius="xl" glow class="result__hero">
        <ScoreRing value={sc.total} size={128} label="Score" target={res.bar} targetLabel={`Beat ${res.bar}`} delay={500} />
        <div class="result__score">
          <Stars value={sc.stars} size={26} label={`${sc.stars} of 3 stars`} delay={1500} />
          <p class="result__verdict">{VERDICT[sc.stars] ?? VERDICT[0]}</p>
          {res.rank !== null ? (
            <p class="result__rank">
              <span class="pn-num">#{res.rank}</span> of {res.players} potters today
            </p>
          ) : null}
        </div>
      </GlassPanel>
      <BeatBar beat={res.bar} score={sc.total} commissioner={commission.commissioner} showCommissioner />
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
                {r.pass ? 'Met' : 'Missed'}: {commission.constraintLabels[i] ?? r.detail}
              </li>
            ))}
          </ul>
        ) : null}
      </GlassPanel>
      <div class="sc__actions">
        {res.potId ? (
          <Button variant="primary" size="lg" block icon={<IconBrush />} onClick={() => go('decorate')}>
            Decorate and fire it
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={() => login()}>
            Log in to keep and fire your pots
          </Button>
        )}
        <div class="sc__actions--row">
          <Button variant="secondary" icon={<IconRetry />} onClick={() => newThrow()}>
            Throw again
          </Button>
          {res.potId && thumb ? (
            <Button
              variant="secondary"
              icon={<IconShare />}
              loading={sharing}
              disabled={shared}
              onClick={async () => {
                setSharing(true);
                setShared(await sharePot(res.potId!, thumb));
                setSharing(false);
              }}
            >
              {shared ? 'Shared' : 'Share to comments'}
            </Button>
          ) : null}
        </div>
      </div>
    </section>
  );
}

export function Glaze() {
  const lt = S.lastThrow.value;
  const today = S.today.value;
  const [picked, setPicked] = useState<GlazeId[]>([]);
  const [app, setApp] = useState<(typeof APPLICATIONS)[number]>('dip');
  const [busy, setBusy] = useState(false);
  if (!lt?.res.potId) return <EmptyState title="Nothing to glaze" description="Throw a pot first." action={<Button onClick={() => go('throw')}>Go to the wheel</Button>} />;
  const potId = lt.res.potId;
  function toggle(g: GlazeId) {
    sfx.tink(picked.includes(g) ? 0.62 : 0.74 + GLAZES.indexOf(g) * 0.03);
    setPicked((p) => (p.includes(g) ? p.filter((x) => x !== g) : p.length >= 2 ? [p[1]!, g] : [...p, g]));
  }
  const raw = picked.length ? GLAZE_INFO[picked[picked.length - 1]!].raw : '#9a6b52';
  const atm = today?.atmosphere ?? 'oxidation';
  return (
    <section class="sc glaze" aria-labelledby="glaze-title">
      <p class="pn-eyebrow">Glaze</p>
      <h1 id="glaze-title" class="pn-headline">Choose up to two glazes</h1>
      <GlassPanel tone="raised" padding="md" radius="xl" class="glaze__preview">
        <div class="glaze__pot" style={{ '--raw': raw }}>
          <PotView pot={{ profile: lt.profile, glaze: picked.length ? { glazes: picked, application: app } : null, fired: null, decor: S.decor.value }} width={130} height={170} />
        </div>
        <div class="glaze__kiln">
          <span class={`pn-chip ${atm === 'reduction' ? 'pn-chip--accent' : 'pn-chip--gold'}`}>
            <IconFlame size={14} /> Next kiln: {atm}
          </span>
          <p class="pn-body">
            {atm === 'reduction'
              ? 'A smoky, starved fire: copper turns red, iron turns celadon green.'
              : 'A clean, airy fire: copper turns green, iron turns amber brown.'}
          </p>
          <p class="pn-meta">Raw glaze looks nothing like the fired result. The kiln decides.</p>
        </div>
      </GlassPanel>
      <ul class="glaze__grid" aria-label="Glazes">
        {GLAZES.map((g) => {
          const info = GLAZE_INFO[g];
          const on = picked.includes(g);
          return (
            <li key={g}>
              <button type="button" class={`swatch${on ? ' is-on' : ''}`} aria-pressed={on} onClick={() => toggle(g)}>
                <span class="swatch__chip" style={{ backgroundColor: info.raw }} />
                <span class="swatch__name">{info.name}</span>
                <span class="swatch__hint">{info.hint}</span>
                {on ? <span class="swatch__order">{picked.indexOf(g) + 1}</span> : null}
              </button>
            </li>
          );
        })}
      </ul>
      <div class="glaze__apps" role="radiogroup" aria-label="Application">
        {APPLICATIONS.map((a) => (
          <button key={a} type="button" role="radio" aria-checked={app === a} class={`pn-chip pn-chip--interactive${app === a ? ' is-selected' : ''}`} onClick={() => setApp(a)}>
            {a === 'dip' ? 'Dip (even coat)' : a === 'pour' ? 'Pour (streaky)' : 'Double dip (thick, drips)'}
          </button>
        ))}
      </div>
      <div class="sc__actions">
        <Button
          variant="primary"
          size="lg"
          block
          icon={<IconFlame />}
          loading={busy}
          disabled={picked.length === 0}
          onClick={async () => {
            setBusy(true);
            await placeInKiln(potId, picked, app);
            setBusy(false);
          }}
        >
          Place in the kiln
        </Button>
        <Button variant="ghost" block onClick={() => go('decorate')}>
          Back to painting
        </Button>
      </div>
    </section>
  );
}
