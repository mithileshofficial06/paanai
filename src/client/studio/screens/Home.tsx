// Home: today's commission, the kiln, and a way into every part of the studio.
import type { ComponentChildren } from 'preact';
import { LEVEL_COUNT, levelData } from '../../../shared/content/levels';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { IconChevron, IconCodex, IconCommission, IconFlame, IconInfo, IconKiln, IconLevels, IconShowcase, IconTrophy, IconWheel } from '../../ui/icons';
import { fmtCountdown, TargetView, useNow } from '../parts';
import * as S from '../store';
import type { Route } from '../store';
import { go, goStudio, playDaily, startTour } from '../controller';

function Tile({ icon, title, text, onClick }: { icon: ComponentChildren; title: string; text: string; onClick: () => void }) {
  return (
    <li>
      <button type="button" class="home__tile pn-glass" onClick={onClick}>
        <span class="home__tile-icon" aria-hidden="true">
          {icon}
        </span>
        <b>{title}</b>
        <span class="home__tile-text">{text}</span>
      </button>
    </li>
  );
}

export function Home() {
  const now = useNow();
  const t = S.today.value;
  const me = S.me.value;
  const lv = S.levels.value;
  if (!t) return null;
  const c = t.commission;
  const mine = t.myThrow;
  const myRow = t.top.find((r) => r.isMe);
  const best = lv?.best ?? [];
  const cleared = best.filter((b, i) => b >= levelData(i + 1).spec.pass).length;
  const leader = t.top[0];
  const ready = t.kilnWaiting;
  const to = (r: Route) => () => go(r);
  return (
    <section class="sc home" aria-labelledby="home-title">
      <div class="home__hello">
        <p class="pn-eyebrow">Day {t.dayNumber} · {t.atmosphere} firing</p>
        <h1 id="home-title" class="pn-headline">{me ? `Welcome back, ${me.username}` : 'Welcome to the studio'}</h1>
      </div>

      <GlassPanel tone="accent" glow radius="xl" padding="md" class="home__today">
        <div class="home__today-top">
          <span class="home__today-art">
            <TargetView profile={c.target} width={84} height={104} />
          </span>
          <div class="home__today-copy">
            <span class="pn-eyebrow">Today’s commission</span>
            <h2 class="pn-title home__today-title">{c.title}</h2>
            <p class="pn-meta">{c.origin}</p>
            <p class="home__beat">
              Beat <b class="pn-num">{c.bar}</b> · set by {c.commissioner}
            </p>
          </div>
        </div>
        {mine ? (
          <p class="home__mine">
            Your score <b class="pn-num">{mine.score.total}</b>
            {myRow ? ` · #${myRow.rank} today` : ''}
            {mine.glazed ? ' · in the kiln' : mine.beatBar ? ' · you beat it' : ''}
          </p>
        ) : null}
        <Button variant={mine ? 'secondary' : 'primary'} size="lg" block icon={<IconWheel />} onClick={() => playDaily()}>
          {mine ? 'Throw it again for practice' : 'Throw today’s pot'}
        </Button>
      </GlassPanel>

      <button type="button" class={`home__kiln pn-glass${ready ? ' is-ready' : ''}`} onClick={() => goStudio()}>
        <span class="home__kiln-icon" aria-hidden="true">
          {ready ? <IconFlame /> : <IconKiln />}
        </span>
        <span class="home__kiln-copy">
          {ready ? (
            <>
              <b>
                {ready} pot{ready > 1 ? 's' : ''} ready to open
              </b>
              <span>The fire is done. Open the kiln to see what it made.</span>
            </>
          ) : (
            <>
              <b>The kiln fires in {fmtCountdown(t.nextKilnAt - now)}</b>
              <span>{mine?.glazed ? 'Your pot is loaded and waiting.' : 'Every pot fires together at 00:00 UTC.'}</span>
            </>
          )}
        </span>
        <IconChevron direction="right" />
      </button>

      <ul class="home__grid">
        <Tile icon={<IconLevels />} title="Levels" text={`Level ${lv?.unlocked ?? 1} next · ${cleared} of ${LEVEL_COUNT} cleared`} onClick={to('levels')} />
        <Tile icon={<IconShowcase />} title="Showcase" text="Rate and like other potters’ pots" onClick={to('showcase')} />
        <Tile icon={<IconCodex />} title="Glaze Codex" text={me?.discoveries ? `${me.discoveries} first discoveries are yours` : '24 glazes the fire can make'} onClick={to('codex')} />
        <Tile icon={<IconTrophy />} title="Leaderboard" text={leader ? `${leader.username} leads with ${leader.score}` : 'Be the first on the board today'} onClick={to('leaderboard')} />
        <Tile icon={<IconCommission />} title="Challenge" text="Post one of your pots for others to beat" onClick={to('create')} />
        <Tile icon={<IconInfo />} title="How to play" text="A short guided throw" onClick={() => startTour()} />
      </ul>
    </section>
  );
}
