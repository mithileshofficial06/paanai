// Studio shell: background, top bar, the current screen, bottom navigation, More menu, toasts.
import type { ComponentChildren } from 'preact';
import { useEffect, useState } from 'preact/hooks';
import { AppBackground } from '../ui/AppBackground';
import { Button, IconButton } from '../ui/Button';
import { Sheet } from '../ui/Sheet';
import { BottomNav } from '../ui/Tabs';
import { pushToast, ToastHost } from '../ui/Toast';
import { ErrorState } from '../ui/States';
import {
  IconCodex,
  IconCommission,
  IconInfo,
  IconKiln,
  IconPaanai,
  IconShelf,
  IconSoundOff,
  IconSoundOn,
  IconSparkle,
  IconTrophy,
  IconWheel,
} from '../ui/icons';
import * as S from './store';
import type { Route } from './store';
import { boot, go, login, setMuted, startTour } from './controller';
import { Tour } from './Tour';
import { Welcome, Features } from './screens/Onboarding';
import { Throw } from './screens/Throw';
import { Result, Glaze } from './screens/Result';
import { Kiln } from './screens/Kiln';
import { Shelf, Codex, Commissions, Create, Leaderboard } from './screens/Community';

const NAV: { id: Route; label: string }[] = [
  { id: 'throw', label: 'Wheel' },
  { id: 'kiln', label: 'Kiln' },
  { id: 'shelf', label: 'Shelf' },
  { id: 'codex', label: 'Codex' },
  { id: 'commissions', label: 'Commissions' },
];
const NAV_ICONS: Record<string, ComponentChildren> = {
  throw: <IconWheel />,
  kiln: <IconKiln />,
  shelf: <IconShelf />,
  codex: <IconCodex />,
  commissions: <IconCommission />,
};

function Screen({ r }: { r: Route }) {
  switch (r) {
    case 'loading':
      return (
        <section class="sc sc--center" aria-busy="true" />
      );
    case 'error':
      return (
        <section class="sc sc--center">
          <ErrorState title="The studio is closed" description={S.loadError.value ?? 'Please try again.'} onRetry={() => void boot()} />
        </section>
      );
    case 'welcome':
      return <Welcome />;
    case 'features':
      return <Features />;
    case 'throw':
      return <Throw />;
    case 'result':
      return <Result />;
    case 'glaze':
      return <Glaze />;
    case 'kiln':
      return <Kiln />;
    case 'shelf':
      return <Shelf />;
    case 'codex':
      return <Codex />;
    case 'commissions':
      return <Commissions />;
    case 'create':
      return <Create />;
    case 'leaderboard':
      return <Leaderboard />;
  }
}

export function App() {
  const r = S.route.value;
  const me = S.me.value;
  const [more, setMore] = useState(false);
  const t = S.toast.value;
  useEffect(() => {
    // Hand over from the inline loading screen in studio.html once the first real screen is up.
    if (r !== 'loading') (window as unknown as { __boot?: { done: () => void } }).__boot?.done();
  }, [r]);
  useEffect(() => {
    if (t) pushToast({ title: t.text, tone: t.tone === 'neutral' ? 'neutral' : t.tone });
  }, [t?.id]);
  const chrome = !['loading', 'error', 'welcome'].includes(r);
  const navValue = NAV.some((n) => n.id === r) ? r : r === 'result' || r === 'glaze' ? 'throw' : r === 'create' ? 'commissions' : '';
  return (
    <div class={`app app--${r}`}>
      <AppBackground variant={r === 'kiln' ? 'kiln' : 'studio'} />
      {chrome ? (
        <header class="topbar">
          <div class="topbar__brand">
            <IconPaanai size={26} />
            <span class="topbar__name">Paanai</span>
            {S.today.value ? <span class="topbar__day">Day {S.today.value.dayNumber}</span> : null}
          </div>
          <div class="topbar__right">
            {me ? (
              <span class="pn-chip pn-chip--sm topbar__rank" title={`${me.rankPoints} rank points`}>
                {me.rankLabel}
                {me.streakDays > 1 ? ` · ${me.streakDays}-day streak` : ''}
              </span>
            ) : (
              <Button variant="secondary" size="sm" onClick={() => login()}>
                Log in
              </Button>
            )}
            <IconButton label="More" variant="glass" icon={<IconSparkle />} onClick={() => setMore(true)} />
          </div>
        </header>
      ) : null}
      <main class="app__main" id="main">
        <Screen r={r} />
      </main>
      {chrome ? (
        <BottomNav
          fixed
          value={navValue}
          onChange={(id) => go(id as Route)}
          items={NAV.map((n) => ({ id: n.id, label: n.label, icon: NAV_ICONS[n.id], badge: n.id === 'kiln' && S.kilnBadge.value > 0 ? S.kilnBadge.value : undefined }))}
        />
      ) : null}
      {S.tour.value && r === 'throw' ? <Tour /> : null}
      <ToastHost placement="top" />
      <Sheet open={more} onClose={() => setMore(false)} title="More" eyebrow="Paanai">
        <div class="more">
          <Button variant="secondary" block icon={<IconTrophy />} onClick={() => (setMore(false), go('leaderboard'))}>
            Today's leaderboard
          </Button>
          <Button variant="secondary" block icon={<IconInfo />} onClick={() => (setMore(false), startTour())}>
            How to play
          </Button>
          <Button variant="secondary" block icon={<IconSparkle />} onClick={() => (setMore(false), go('features'))}>
            What's in Paanai
          </Button>
          <Button variant="secondary" block icon={S.muted.value ? <IconSoundOff /> : <IconSoundOn />} onClick={() => setMuted(!S.muted.value)}>
            {S.muted.value ? 'Sound off' : 'Sound on'}
          </Button>
          {me ? (
            <dl class="more__stats">
              <div>
                <dt>Rank</dt>
                <dd>{me.rankLabel}</dd>
              </div>
              <div>
                <dt>Points</dt>
                <dd>
                  {me.rankPoints}
                  {me.nextRankAt ? ` / ${me.nextRankAt}` : ''}
                </dd>
              </div>
              <div>
                <dt>Throws</dt>
                <dd>{me.throws}</dd>
              </div>
              <div>
                <dt>Stars</dt>
                <dd>{me.stars}</dd>
              </div>
              <div>
                <dt>Fired</dt>
                <dd>{me.potsFired}</dd>
              </div>
              <div>
                <dt>Discoveries</dt>
                <dd>{me.discoveries}</dd>
              </div>
            </dl>
          ) : null}
        </div>
      </Sheet>
    </div>
  );
}
