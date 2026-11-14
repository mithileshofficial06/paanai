// After a daily throw: the score, then paint it and fire it (or put it on show, or share it).
import { useEffect } from 'preact/hooks';
import { sfx } from '../../app/audio';
import { Button } from '../../ui/Button';
import { BeatBar } from '../../ui/CommissionCard';
import { GlassPanel } from '../../ui/GlassPanel';
import { ScoreRing } from '../../ui/ScoreRing';
import { Stars } from '../../ui/Stars';
import { IconBrush, IconRetry } from '../../ui/icons';
import { EmptyState } from '../../ui/States';
import { PotActions, PotView, TargetView } from '../parts';

import * as S from '../store';
import { go, login, newThrow } from '../controller';

const VERDICT = ['Rough, but every potter starts here.', 'A fair pot. The order wanted more.', 'A good pot. The buyer will be pleased.', 'A master’s pot. Put it on show.'];


export function Result() {
  const lt = S.lastThrow.value;
  const thumb = S.lastThumb.value;
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
            Paint it and fire it
          </Button>
        ) : (
          <Button variant="primary" size="lg" block onClick={() => login()}>
            Log in to keep and fire your pots
          </Button>
        )}
        {res.potId ? <PotActions pot={{ potId: res.potId, profile: lt.profile, glaze: null, fired: null, decor: S.decor.value }} thumb={thumb} /> : null}
        <Button variant="ghost" block icon={<IconRetry />} onClick={() => newThrow()}>
          Throw again
        </Button>
      </div>
    </section>
  );
}
