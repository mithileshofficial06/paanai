// First visit (starter pot from "an old potter"), How to play, and What's in Paanai.
import { useEffect, useState } from 'preact/hooks';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { Stepper } from '../../ui/Stepper';
import { IconCodex, IconCommission, IconFlame, IconKiln, IconRank, IconShelf, IconWheel } from '../../ui/icons';
import { PotView } from '../parts';
import * as S from '../store';
import { back, finishOnboarding, go, openStarter } from '../controller';

export function Welcome() {
  const pot = S.revealing.value;
  const [opening, setOpening] = useState(false);
  async function open() {
    setOpening(true);
    await openStarter();
    setOpening(false);
  }
  return (
    <section class="sc sc--center welcome" aria-labelledby="welcome-title">
      <p class="pn-eyebrow">Paanai · a daily pottery studio</p>
      <h1 id="welcome-title" class="pn-display welcome__title">
        {pot ? 'Still warm from the kiln.' : 'Someone left a pot in the kiln for you.'}
      </h1>
      <div class={`welcome__kiln${pot ? ' is-open' : ''}`} aria-hidden={!pot}>
        <div class="welcome__glow" />
        {pot ? <PotView pot={pot} width={150} height={190} /> : <div class="welcome__door" />}
      </div>
      {pot ? (
        <>
          <p class="pn-lead welcome__text">
            An old potter fired this for you. Every day there is a new commission: throw it on the wheel, glaze it, and
            open the kiln tomorrow to see what the fire made of it.
          </p>
          <div class="sc__actions">
            <Button variant="primary" size="lg" block onClick={() => go('howto')}>
              How to play
            </Button>
            <Button variant="ghost" block onClick={() => void finishOnboarding()}>
              Skip, go to the wheel
            </Button>
          </div>
        </>
      ) : (
        <div class="sc__actions">
          <Button variant="primary" size="lg" block loading={opening} onClick={() => void open()}>
            Open the kiln
          </Button>
          <Button variant="ghost" block onClick={() => go('howto')}>
            How to play
          </Button>
        </div>
      )}
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
