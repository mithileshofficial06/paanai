// The kiln: pots waiting for the next firing, and fired pots to open (the reveal).
import { useState } from 'preact/hooks';
import { EFFECTS } from '../../../shared/core/glazes';
import type { KilnItem } from '../../app/api';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/States';
import { IconCrackedPot, IconFlame, IconKiln, IconSparkle } from '../../ui/icons';
import { sfx } from '../../app/audio';
import { fmtCountdown, PotActions, PotView, titleCase, useNow } from '../parts';
import { StudioRooms } from './Community';
import * as S from '../store';
import { login, markOpened, playDaily } from '../controller';
import { KilnHero, type KilnState } from '../KilnHero';

const DEFECT_TEXT: Record<string, string> = {
  collapsed: 'Collapsed in the fire.',
  'thin-crack': 'Cracked where the wall was too thin.',
  'uneven-crack': 'Cracked: the walls were too uneven.',
  'base-split': 'The base split.',
  'kiln-slump': 'Slumped in the heat: too much weight overhanging.',
};

function effectName(id: string): string {
  return EFFECTS.find((e) => e.id === id)?.name ?? titleCase(id);
}

export function Kiln() {
  const now = useNow();
  const items = S.kilnItems.value;
  const [revealing, setRevealing] = useState<KilnItem | null>(null);
  if (!S.loggedIn.value)
    return (
      <section class="sc">
        <StudioRooms />
        <EmptyState
          icon={<IconKiln />}
          title="Your kiln"
          description="Log in to fire your pots in the shared kiln. It fires once a day at 00:00 UTC."
          action={<Button variant="primary" onClick={() => login()}>Log in</Button>}
        />
      </section>
    );
  if (revealing) return <Reveal item={revealing} onDone={() => setRevealing(null)} />;
  const waiting = items.filter((i) => !i.fired);
  const ready = items.filter((i) => i.fired && !i.opened);
  const opened = items.filter((i) => i.fired && i.opened);
  return (
    <section class="sc kiln" aria-labelledby="kiln-title">
      <StudioRooms />
      <h1 id="kiln-title" class="pn-headline">{ready.length ? `${ready.length} pot${ready.length > 1 ? 's' : ''} ready to open` : 'Your kiln'}</h1>
      {S.today.value ? (
        <div class={`kiln__hero${waiting.length ? ' is-loaded' : ''}`}>
          <div class="kiln__heroArt">
            <KilnHero
              state="closed"
              heat={waiting.length ? 'hot' : 'cool'}
              label={waiting.length ? 'The kiln, loaded and waiting for tonight’s firing.' : 'The kiln, cooling.'}
            />
          </div>
          <div class="kiln__heroInfo">
            <span class="kiln__heroLabel">{waiting.length ? 'Fires in' : 'Next firing in'}</span>
            <strong class="kiln__countdown">{fmtCountdown(S.today.value.nextKilnAt - now)}</strong>
            <span class="pn-meta">
              {waiting.length ? `${waiting.length} pot${waiting.length > 1 ? 's' : ''} loaded` : 'Nothing loaded yet'} · {S.today.value.atmosphere} · 00:00 UTC
            </span>
          </div>
        </div>
      ) : null}
      {S.kilnLoading.value && !items.length ? <Skeleton shape="rect" height={160} /> : null}
      {!S.kilnLoading.value && !items.length ? (
        <EmptyState icon={<IconKiln />} title="The kiln is empty" description="Throw today's pot, paint it and put it in. The kiln glazes it and fires at 00:00 UTC." action={<Button variant="primary" onClick={() => playDaily()}>Throw today's pot</Button>} />
      ) : null}
      {ready.map((it) => (
        <GlassPanel key={it.potId} tone="accent" padding="md" radius="xl" glow class="kiln__ready">
          <div class="kiln__door" aria-hidden="true">
            <span class="kiln__fire" />
          </div>
          <div class="kiln__info">
            <h2 class="pn-title">{it.title}</h2>
            <p class="pn-meta">Fired {it.kilnDate} · {it.fired?.atmosphere}</p>
          </div>
          <Button
            variant="primary"
            icon={<IconFlame />}
            onClick={() => {
              sfx.unlock();
              setRevealing(it);
            }}
          >
            Open
          </Button>
        </GlassPanel>
      ))}
      {waiting.length ? <h2 class="pn-eyebrow kiln__h">Waiting for the fire</h2> : null}
      {waiting.map((it) => (
        <GlassPanel key={it.potId} padding="md" radius="lg" class="kiln__row">
          <PotView pot={it} width={52} height={68} />
          <div class="kiln__info">
            <h3 class="pn-title">{it.title}</h3>
            <p class="pn-meta">Glazed by the kiln master · fires in {fmtCountdown((it.firesAt ?? now) - now)}</p>
          </div>
        </GlassPanel>
      ))}
      {opened.length ? <h2 class="pn-eyebrow kiln__h">Fired</h2> : null}
      <ul class="kiln__grid">
        {opened.map((it) => (
          <li key={it.potId}>
            <button type="button" class="kiln__fired pn-glass pn-radius-lg" onClick={() => setRevealing({ ...it, opened: true })}>
              <PotView pot={it} width={84} height={104} />
              <span class="kiln__fired-title">{it.title}</span>
              <span class="pn-meta">{it.fired?.survived ? (it.fired.effects.length ? effectName(it.fired.effects[0]!) : 'Plain') : 'Cracked'}</span>
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Opening the kiln: door glow, heat shimmer, then the pot and what the fire did. */
function Reveal({ item, onDone }: { item: KilnItem; onDone: () => void }) {
  const [phase, setPhase] = useState<KilnState>(item.opened ? 'open' : 'closed');
  const f = item.fired;
  function open() {
    sfx.thump();
    setPhase('opening');
    setTimeout(() => {
      setPhase('open');
      sfx.whoosh();
      if (f?.newDiscoveries.length) setTimeout(() => sfx.chime(), 1400);
      else setTimeout(() => sfx.tink(1), 1200);
    }, 1500);
    if (!item.opened) void markOpened(item.potId);
  }
  return (
    <section class={`sc reveal reveal--${phase}`} aria-labelledby="reveal-title">
      <div class="reveal__stage">
        <KilnHero
          state={phase}
          heat="cool"
          label={phase === 'open' ? `The kiln is open: ${item.title}.` : 'The kiln, cooled overnight, with its iron doors shut.'}
          pot={phase === 'open' ? <PotView pot={item} width={200} height={200} /> : null}
        />
      </div>
      {phase !== 'open' ? (
        <div class="sc__actions">
          <h1 id="reveal-title" class="pn-headline">{item.title}</h1>
          <p class="pn-body">The kiln has cooled. Ready?</p>
          <Button variant="primary" size="lg" block icon={<IconFlame />} loading={phase === 'opening'} onClick={open}>
            Open the kiln
          </Button>
        </div>
      ) : (
        <div class="reveal__result">
          <h1 id="reveal-title" class="pn-headline">{f?.survived ? item.title : 'The fire won this one.'}</h1>
          {f && !f.survived ? (
            <p class="pn-body reveal__bad">
              <IconCrackedPot size={18} /> {f.defects.map((d) => DEFECT_TEXT[d] ?? titleCase(d)).join(' ')}
            </p>
          ) : null}
          {f?.effects.length ? (
            <ul class="reveal__effects">
              {f.effects.map((e) => (
                <li key={e} class={`pn-chip ${f.newDiscoveries.includes(e) ? 'pn-chip--gold' : ''}`}>
                  {f.newDiscoveries.includes(e) ? <IconSparkle size={14} /> : null}
                  {effectName(e)}
                  {f.newDiscoveries.includes(e) ? ' · new in the Codex' : ''}
                </li>
              ))}
            </ul>
          ) : null}
          {f ? <p class="pn-meta">Kiln score {f.kilnScore} · {f.atmosphere} firing</p> : null}
          {f?.survived ? <PotActions pot={item} /> : null}
          <div class="sc__actions">
            <Button variant="primary" size="lg" block onClick={() => playDaily()}>
              Throw today's pot
            </Button>
            <Button variant="ghost" block onClick={onDone}>
              Back to the kiln
            </Button>
          </div>
        </div>
      )}
    </section>
  );
}
