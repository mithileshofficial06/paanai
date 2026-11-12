// First visit (starter pot from "an old potter"), How to play, and What's in Paanai.
import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { Stepper } from '../../ui/Stepper';
import { IconCodex, IconCommission, IconFlame, IconKiln, IconRank, IconShelf, IconWheel } from '../../ui/icons';
import { fmtCountdown, PotView, TargetView, useNow } from '../parts';
import { KilnHero, type KilnState } from '../KilnHero';
import { sfx } from '../../app/audio';
import * as S from '../store';
import { back, finishOnboarding, go, openStarter } from '../controller';

export function Welcome() {
  const pot = S.revealing.value;
  const today = S.today.value;
  const now = useNow(30_000);
  const [state, setState] = useState<KilnState>(pot ? 'open' : 'closed');
  async function open() {
    setState('opening');
    sfx.thump();
    const started = Date.now();
    const got = await openStarter();
    // Let the doors finish swinging before the pot comes out.
    await new Promise((r) => setTimeout(r, Math.max(0, 1100 - (Date.now() - started))));
    if (got) {
      setState('open');
      sfx.whoosh();
    } else setState('closed');
  }
  const c = today?.commission;
  return (
    <section class={`welcome welcome--${state}`} aria-labelledby="welcome-title">
      <div class="welcome__copy">
        <p class="pn-eyebrow welcome__eyebrow">
          <span class="welcome__flame" aria-hidden="true" />
          Paanai · a daily pottery studio
        </p>
        <h1 id="welcome-title" class="welcome__title" key={pot ? 'b' : 'a'}>
          {pot ? (
            <>
              Still warm from the <em>kiln</em>.
            </>
          ) : (
            <>
              Someone left a pot in the <em>kiln</em> for you.
            </>
          )}
        </h1>
        <p class="welcome__text">
          {pot
            ? 'An old potter fired this for you. Now make your own: throw today’s vessel on the wheel, glaze it, and open the kiln tomorrow to see what the fire made of it.'
            : 'Every day the studio gets one commission: a real vessel from a real tradition. Throw it with your finger on a spinning wheel, glaze it, and fire it with everyone else overnight.'}
        </p>
        {c && today ? (
          <div class="welcome__today">
            <div class="welcome__target">
              <TargetView profile={c.target} width={56} height={72} />
            </div>
            <div class="welcome__todayText">
              <span class="welcome__todayLabel">Day {today.dayNumber} · today’s commission</span>
              <strong class="welcome__todayTitle">{c.title}</strong>
              <span class="welcome__todayMeta">
                {c.origin} · beat <b>{c.bar}</b>
              </span>
            </div>
          </div>
        ) : null}
        <ul class="welcome__facts">
          <li>
            <b>35</b> vessels
          </li>
          <li>
            <b>24</b> glazes
          </li>
          <li>
            Fires in <b>{today ? fmtCountdown(today.nextKilnAt - now) : '…'}</b>
          </li>
        </ul>
        <div class="welcome__actions">
          {pot ? (
            <>
              <Button variant="primary" size="lg" block onClick={() => go('howto')}>
                How to play
              </Button>
              <Button variant="ghost" block onClick={() => void finishOnboarding()}>
                Skip, go to the wheel
              </Button>
            </>
          ) : (
            <>
              <Button variant="primary" size="lg" block loading={state === 'opening'} onClick={() => void open()}>
                Open the kiln
              </Button>
              <Button variant="ghost" block onClick={() => go('howto')}>
                How to play
              </Button>
            </>
          )}
        </div>
      </div>
      <div class="welcome__stage">
        <KilnHero
          state={state}
          label={pot ? 'The kiln door is open and a fired pot sits in the glow.' : 'A brick kiln with its iron doors shut and fire glowing through the seams.'}
          pot={pot && state === 'open' ? <PotView pot={pot} width={180} height={180} /> : null}
        />
      </div>
    </section>
  );
}

type Step = { title: string; body: string; demo: 'centre' | 'pull' | 'match' | 'kiln' };
const STEPS: Step[] = [
  { title: 'Centre and open', body: 'Hold the clay to centre it on the spinning wheel. Then tap the top to open a hollow.', demo: 'centre' },
  { title: 'Pull up the walls', body: 'Drag upward along the wall to pull the clay up thinner and taller. Drag sideways to push it in or out.', demo: 'pull' },
  { title: 'Match the commission', body: 'Shape your pot to the glowing outline. Even walls score higher; walls that are too thin wobble and collapse.', demo: 'match' },
  { title: 'Glaze and fire', body: 'Pick glazes, place the pot in the kiln, and open it after the next firing (00:00 UTC). Rare effects go in the Codex.', demo: 'kiln' },
];

export function HowToPlay() {
  const [i, setI] = useState(0);
  const step = STEPS[i]!;
  const last = i === STEPS.length - 1;
  const onboarding = S.me.value ? !S.me.value.onboarded : !S.hintsDone.value.has('drag');
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'ArrowRight') setI((v) => Math.min(STEPS.length - 1, v + 1));
      if (e.key === 'ArrowLeft') setI((v) => Math.max(0, v - 1));
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  return (
    <section class="sc sc--center howto" aria-labelledby="howto-title">
      <p class="pn-eyebrow">How to play · {i + 1} of {STEPS.length}</p>
      <GlassPanel tone="raised" padding="lg" radius="xl" class="howto__card" glow>
        <div class={`demo demo--${step.demo}`} key={step.demo} aria-hidden="true">
          <div class="demo__wheel" />
          <div class="demo__pot" />
          {step.demo === 'match' ? <div class="demo__target" /> : null}
          {step.demo === 'kiln' ? <div class="demo__flame" /> : <div class="demo__finger" />}
        </div>
        <h1 id="howto-title" class="pn-headline howto__title">{step.title}</h1>
        <p class="pn-body howto__body">{step.body}</p>
      </GlassPanel>
      <Stepper count={STEPS.length} index={i} onSelect={setI} label="How to play steps" />
      <div class="sc__actions sc__actions--row">
        <Button variant="secondary" onClick={() => (i === 0 ? back() : setI(i - 1))}>
          {i === 0 ? 'Back' : 'Previous'}
        </Button>
        {last ? (
          <Button variant="primary" onClick={() => (onboarding ? void finishOnboarding() : go('throw'))}>
            Start throwing
          </Button>
        ) : (
          <Button variant="primary" onClick={() => setI(i + 1)}>
            Next
          </Button>
        )}
      </div>
      <Button variant="ghost" size="sm" onClick={() => go('features')}>
        What's in Paanai
      </Button>
    </section>
  );
}

const FEATURES = [
  { icon: <IconWheel />, title: 'Daily Commission', body: 'One new vessel a day, from a real tradition: Korean moon jars, Tamil paanai, Song meiping. Everyone throws the same one.' },
  { icon: <IconFlame />, title: 'Beat the bar', body: "Each commission has a score to beat. Your first throw each day is ranked; after that you can practise freely." },
  { icon: <IconKiln />, title: 'The Kiln', body: 'Glazed pots fire together at 00:00 UTC. Come back to open the kiln: thin walls can crack, and the fire changes every glaze.' },
  { icon: <IconCodex />, title: 'Glaze Codex', body: '24 effects to discover, from celadon to oil spots. The first potter to fire a new effect has their name on it.' },
  { icon: <IconShelf />, title: 'The Shelf', body: "Every fired pot in this community. Like the best ones; the most liked becomes Pot of the Week." },
  { icon: <IconCommission />, title: 'Beat the Commissioner', body: 'Journeymen can post their own pot as a commission. Others try to beat it, and you earn patron points.' },
  { icon: <IconRank />, title: 'Ranks', body: 'Apprentice, Journeyman, Artisan, Master Potter: earned by throwing, stars, fired pots and discoveries. Shown as your flair.' },
];

export function Features() {
  return (
    <section class="sc features" aria-labelledby="features-title">
      <p class="pn-eyebrow">Features</p>
      <h1 id="features-title" class="pn-headline">What's in Paanai</h1>
      <ul class="features__list">
        {FEATURES.map((f) => (
          <li key={f.title}>
            <GlassPanel padding="md" radius="lg" class="feature">
              <span class="feature__icon">{f.icon}</span>
              <div>
                <h2 class="pn-title feature__title">{f.title}</h2>
                <p class="pn-body feature__body">{f.body}</p>
              </div>
            </GlassPanel>
          </li>
        ))}
      </ul>
      <div class="sc__actions">
        <Button variant="primary" block onClick={() => go('throw')}>
          Go to the wheel
        </Button>
        <Button variant="ghost" block onClick={() => back()}>
          Back
        </Button>
      </div>
    </section>
  );
}
