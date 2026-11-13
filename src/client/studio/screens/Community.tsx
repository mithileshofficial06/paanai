// The Showcase (pots players chose to show, rated and liked by everyone), the Studio rooms
// (My pots, Glaze Codex; the kiln lives in Kiln.tsx), player commissions and the leaderboard.
import { useEffect, useState } from 'preact/hooks';
import type { LeaderboardResponse, PotSummary } from '../../../shared/api/types';
import { ADJECTIVES, VESSELS } from '../../../shared/content/words';
import { api } from '../../app/api';
import { effectColour } from '../../app/glazeLook';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/States';
import { Tabs } from '../../ui/Tabs';
import { IconCommission, IconFlag, IconHeart, IconShowcase, IconSparkle, IconStar, IconTrophy, IconWheel } from '../../ui/icons';
import { PotActions, PotView } from '../parts';
import * as S from '../store';
import type { Route } from '../store';
import { createCommission, go, isOnShow, like, loadMyPots, loadShowcase, login, placeInKiln, playDaily, ratePot, reportTarget } from '../controller';

// ---------- Showcase ----------

/** Average rating (x10) as "4.5". */
function fmtRating(r: number): string {
  return (r / 10).toFixed(1);
}

function RateStars({ pot }: { pot: PotSummary }) {
  const mine = pot.myRating ?? 0;
  const [hover, setHover] = useState(0);
  const shown = hover || mine;
  return (
    <div class="rate" role="radiogroup" aria-label={`Rate ${pot.title}`} onPointerLeave={() => setHover(0)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          role="radio"
          aria-checked={mine === n}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          class={`rate__star${n <= shown ? ' is-on' : ''}${mine === n ? ' is-mine' : ''}`}
          onPointerEnter={(e) => e.pointerType === 'mouse' && setHover(n)}
          onClick={() => void ratePot(pot.potId, n)}
        >
          <IconStar size={22} filled={n <= shown} />
        </button>
      ))}
    </div>
  );
}

function ShowcaseCard({ pot, top }: { pot: PotSummary; top: boolean }) {
  const own = S.me.value?.username === pot.owner;
  return (
    <GlassPanel padding="sm" radius="lg" class={`show__card${top ? ' is-top' : ''}`}>
      {top ? <span class="pn-badge pn-badge--gold show__badge">{S.showcaseSort.value === 'top' ? 'Top rated' : 'Pot of the week'}</span> : null}
      <div class="show__plinth">
        <span class="show__light" aria-hidden="true" />
        <PotView pot={pot} width={128} height={140} />
        <span class="show__base" aria-hidden="true" />
      </div>
      <div class="show__meta">
        <p class="show__title">{pot.title}</p>
        <p class="pn-meta">u/{pot.owner}</p>
      </div>
      <div class="show__score" aria-label={pot.ratings ? `Rated ${fmtRating(pot.rating ?? 0)} by ${pot.ratings}` : 'Not rated yet'}>
        <IconStar size={16} filled />
        <b class="pn-num">{pot.ratings ? fmtRating(pot.rating ?? 0) : '–'}</b>
        <span class="pn-meta">{pot.ratings ? `${pot.ratings} rating${pot.ratings > 1 ? 's' : ''}` : 'No ratings yet'}</span>
      </div>
      {own ? <p class="show__own pn-meta">Your pot</p> : <RateStars pot={pot} />}
      <div class="show__row">
        <button
          type="button"
          class={`show__like${pot.myLike ? ' is-on' : ''}`}
          aria-pressed={!!pot.myLike}
          aria-label={`Like ${pot.title}, ${pot.likes} likes`}
          onClick={() => void like(pot.potId)}
        >
          <IconHeart size={18} filled={!!pot.myLike} /> <span class="pn-num">{pot.likes}</span>
        </button>
        {own ? null : (
          <button type="button" class="show__report" aria-label={`Report ${pot.title}`} onClick={() => void reportTarget(pot.potId)}>
            <IconFlag size={16} />
          </button>
        )}
      </div>
    </GlassPanel>
  );
}

export function Showcase() {
  const sc = S.showcase.value;
  const sort = S.showcaseSort.value;
  return (
    <section class="sc show" aria-labelledby="show-title">
      <p class="pn-eyebrow">The Showcase</p>
      <h1 id="show-title" class="pn-headline">Pots on show</h1>
      <p class="pn-body sc__lead">Pots their makers chose to show. Rate them out of five and like your favourites.</p>
      <Tabs
        label="Sort the Showcase"
        fitted
        value={sort}
        onChange={(id) => void loadShowcase(true, id as 'new' | 'top')}
        items={[
          { id: 'new', label: 'Newest' },
          { id: 'top', label: 'Top rated' },
        ]}
      />
      {!sc ? (
        <div class="show__grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} shape="rect" height={260} />)}</div>
      ) : sc.pots.length === 0 ? (
        <div class="show__empty">
          <div class="show__ghosts" aria-hidden="true">
            {[0, 1, 2].map((i) => (
              <span key={i} class="show__ghost" style={{ '--i': i }} />
            ))}
          </div>
          <EmptyState
            icon={<IconShowcase />}
            title="Nothing on show yet"
            description="Throw a pot, then tap Put on show. Yours could be the first one everyone sees."
            action={
              <Button variant="primary" icon={<IconWheel />} onClick={() => go('levels')}>
                Throw a pot
              </Button>
            }
          />
        </div>
      ) : (
        <>
          <ul class="show__grid">
            {sc.pots.map((p, i) => (
              <li key={p.potId} style={{ '--i': Math.min(i, 8) }}>
                <ShowcaseCard pot={p} top={i === 0 && (sort === 'top' ? (p.ratings ?? 0) > 0 : p.likes > 0)} />
              </li>
            ))}
          </ul>
          {sc.next !== null ? (
            <Button variant="secondary" block onClick={() => void loadShowcase(false)}>
              Show more
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

// ---------- Studio rooms ----------

const ROOMS: { id: Route; label: string }[] = [
  { id: 'kiln', label: 'Kiln' },
  { id: 'mypots', label: 'My pots' },
  { id: 'codex', label: 'Codex' },
];

/** The switcher at the top of the Studio tab. */
export function StudioRooms() {
  return (
    <div class="rooms">
      <Tabs label="Studio" fitted value={S.route.value} onChange={(id) => go(id as Route)} items={ROOMS.map((r) => ({ ...r, badge: r.id === 'kiln' && S.kilnBadge.value ? S.kilnBadge.value : undefined }))} />
    </div>
  );
}

function potStatus(p: PotSummary): string {
  if (p.fired) return p.fired.survived ? 'Fired' : 'Cracked in the kiln';
  if (p.glaze) return 'In the kiln';
  return p.commissionId.startsWith('level-') ? 'Level pot' : 'Not fired yet';
}

export function MyPots() {
  const pots = S.myPots.value;
  const [firing, setFiring] = useState<string | null>(null);
  if (!S.loggedIn.value)
    return (
      <section class="sc">
        <StudioRooms />
        <EmptyState icon={<IconShowcase />} title="Your pots" description="Log in to keep every pot you throw, show them off and share them on Reddit." action={<Button variant="primary" onClick={() => login()}>Log in</Button>} />
      </section>
    );
  return (
    <section class="sc mypots" aria-labelledby="mypots-title">
      <StudioRooms />
      <h1 id="mypots-title" class="pn-headline">Your pots</h1>
      {!pots ? (
        <Skeleton shape="rect" height={220} />
      ) : pots.length === 0 ? (
        <EmptyState icon={<IconWheel />} title="No pots yet" description="Every pot you throw is kept here for 30 days." action={<Button variant="primary" onClick={() => go('levels')}>Throw your first</Button>} />
      ) : (
        <ul class="mypots__list">
          {pots.map((p, i) => (
            <li key={p.potId} style={{ '--i': Math.min(i, 8) }}>
              <GlassPanel padding="md" radius="lg" class={`mypot${isOnShow(p) ? ' is-onshow' : ''}`}>
                <div class="mypot__fig">
                  <PotView pot={p} width={96} height={110} />
                </div>
                <div class="mypot__body">
                  <h2 class="pn-title mypot__title">{p.title}</h2>
                  <p class="pn-meta">
                    {potStatus(p)} · {p.commissionId.startsWith('level-') ? `match ${p.score}%` : `score ${p.score}`}
                    {isOnShow(p) && p.ratings ? ` · ${fmtRating(p.rating ?? 0)} stars` : ''}
                  </p>
                  <PotActions pot={p} compact />
                  {!p.glaze && !p.fired ? (
                    <Button
                      variant="ghost"
                      size="sm"
                      loading={firing === p.potId}
                      onClick={async () => {
                        setFiring(p.potId);
                        if (await placeInKiln(p.potId)) void loadMyPots();
                        setFiring(null);
                      }}
                    >
                      Fire it in the kiln
                    </Button>
                  ) : null}
                </div>
              </GlassPanel>
            </li>
          ))}
        </ul>
      )}
      {S.me.value?.canCommission ? (
        <Button variant="secondary" block icon={<IconCommission />} onClick={() => go('create')}>
          Turn a pot into a challenge
        </Button>
      ) : null}
    </section>
  );
}

/** What each effect needs, told as a riddle (the kiln picks glazes; your shape and luck do the rest). */
const CODEX_HINTS: Record<string, string> = {
  'gold-luster': 'Rare. Only walls of near-perfect evenness, in a smoky fire.',
  'moon-white': 'Rare. A round, full jar, thrown true, in a smoky fire.',
  'peach-bloom': 'Copper and tin poured together, in a smoky fire.',
  'shino-blush': 'Tin and iron poured together, in a smoky fire.',
  'blue-and-white': 'Cobalt and tin, in a clean, airy fire.',
  'copper-red': 'Copper starved of air.',
  'copper-green': 'Copper given plenty of air.',
  celadon: 'A single dip of iron, in a smoky fire.',
  amber: 'Iron in a clean, airy fire.',
  'cobalt-blue': 'Cobalt, in any fire.',
  'temmoku-black': 'Tenmoku, in any fire.',
  'satin-matte': 'A single dip of tin in a clean fire.',
  'oil-spot': 'A wide form, thick tenmoku, smoky fire.',
  'hares-fur': 'A tall, steep form, thick tenmoku, smoky fire.',
  'rutile-float': 'Thick rutile in a smoky fire.',
  crawl: 'A bellied form under thick ash, in a clean fire.',
  crackle: 'Tin laid over iron.',
  'rutile-break': 'Rutile poured over a sharp turn in the form.',
  'ash-runs': 'A tall form under thick ash.',
  'glass-pool': 'A clear glaze in a bowl.',
  'iron-speckle': 'Iron and ash in a clean fire.',
  'craze-net': 'A clear glaze over thin walls.',
  pinholes: 'A flaw: clear glaze over uneven walls.',
  'drip-curtain': 'A tall, steep form under a thick coat.',
};

export function Codex() {
  const cx = S.codex.value;
  const [pick, setPick] = useState<string | null>(null);
  const effects = cx ? [...cx.effects].sort((x, y) => Number(!!y.discoverer) - Number(!!x.discoverer)) : [];
  const sel = effects.find((e) => e.id === pick) ?? effects.find((e) => e.discoverer) ?? null;
  return (
    <section class="sc codex" aria-labelledby="codex-title">
      <StudioRooms />
      <h1 id="codex-title" class="pn-headline">{cx ? `${cx.discovered} of ${cx.total} discovered` : 'Glaze Codex'}</h1>
      {cx ? (
        <div class="codex__meter" role="progressbar" aria-label="Effects discovered" aria-valuemin={0} aria-valuemax={cx.total} aria-valuenow={cx.discovered}>
          <span style={{ width: `${(cx.discovered / Math.max(1, cx.total)) * 100}%` }} />
        </div>
      ) : null}
      <p class="pn-body sc__lead">Every effect the kiln can make. The kiln master glazes each pot; your shape and the fire decide the rest. The first potter here to fire one gets their name on it.</p>
      {sel ? (
        <div class={`codex__detail${sel.discoverer ? '' : ' is-locked'}`} key={sel.id}>
          <span class="codex__bigtile" style={sel.discoverer ? { '--sw': effectColour(sel.id) ?? '#8a5a3c' } : undefined} aria-hidden="true">
            {sel.discoverer ? null : <span class="codex__q">?</span>}
          </span>
          <div>
            <h2 class="codex__detailName">
              {sel.discoverer ? sel.name : `Undiscovered ${sel.kind}`} {sel.rare ? <span class="pn-badge pn-badge--gold">Rare</span> : null}
            </h2>
            <p class="pn-meta">{sel.discoverer ? `First fired by u/${sel.discoverer}` : 'Nobody here has fired this yet.'}</p>
            <p class="codex__blurb">{sel.discoverer ? sel.blurb : (CODEX_HINTS[sel.id] ?? 'The kiln keeps this one secret.')}</p>
          </div>
        </div>
      ) : null}
      {!cx ? (
        <Skeleton shape="rect" height={240} />
      ) : (
        <ul class="codex__grid">
          {effects.map((e, i) => {
            const found = !!e.discoverer;
            return (
              <li key={e.id} style={{ '--i': Math.min(i, 12) }}>
                <button
                  type="button"
                  class={`codex__item${found ? ' is-found' : ''}${e.rare ? ' is-rare' : ''}${sel?.id === e.id ? ' is-on' : ''}`}
                  onClick={() => setPick(e.id)}
                  aria-label={found ? `${e.name}, first fired by u/${e.discoverer}` : `Undiscovered ${e.kind} effect${e.rare ? ', rare' : ''}. Show the hint.`}
                >
                  <span class="codex__tile" style={found ? { '--sw': effectColour(e.id) ?? '#8a5a3c' } : undefined} aria-hidden="true">
                    {found ? null : <span class="codex__q">?</span>}
                  </span>
                  <span class="codex__name">{found ? e.name : e.rare ? 'Rare' : e.kind === 'colour' ? 'Colour' : 'Surface'}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

// ---------- Player commissions ----------

const CONSTRAINTS = [
  { id: 'capacity', label: 'Same capacity' },
  { id: 'rim', label: 'Same rim (narrower or wider)' },
  { id: 'height', label: 'Same height' },
  { id: 'survive', label: 'Must survive the kiln' },
  { id: 'maxStrokes', label: 'Few strokes' },
];

export function Create() {
  const pots = S.myPots.value?.filter((p) => !p.commissionId.startsWith('level-')) ?? null;
  const [potId, setPotId] = useState<string | null>(null);
  const [adj, setAdj] = useState<string>(ADJECTIVES[0]!);
  const [noun, setNoun] = useState<string>(VESSELS[0]!);
  const [cons, setCons] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    void loadMyPots();
  }, []);
  return (
    <section class="sc" aria-labelledby="create-title">
      <p class="pn-eyebrow">New challenge</p>
      <h1 id="create-title" class="pn-headline">Challenge the subreddit</h1>
      <h2 class="pn-eyebrow">1 · Pick one of your daily pots</h2>
      {!pots ? (
        <Skeleton shape="rect" height={120} />
      ) : pots.length === 0 ? (
        <EmptyState title="No daily pots yet" description="Throw today's pot first." compact action={<Button onClick={() => playDaily()}>Go to the wheel</Button>} />
      ) : (
        <ul class="create__pots">
          {pots.map((p) => (
            <li key={p.potId}>
              <button type="button" class={`create__pot pn-glass pn-radius-md${potId === p.potId ? ' is-on' : ''}`} aria-pressed={potId === p.potId} onClick={() => setPotId(p.potId)}>
                <PotView pot={p} width={64} height={80} />
                <span class="pn-meta">{p.score}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      <h2 class="pn-eyebrow">2 · Name it</h2>
      <div class="create__name">
        <select class="field" value={adj} onChange={(e) => setAdj((e.target as HTMLSelectElement).value)} aria-label="Adjective">
          {ADJECTIVES.map((a) => (
            <option key={a}>{a}</option>
          ))}
        </select>
        <select class="field" value={noun} onChange={(e) => setNoun((e.target as HTMLSelectElement).value)} aria-label="Vessel">
          {VESSELS.map((v) => (
            <option key={v}>{v}</option>
          ))}
        </select>
      </div>
      <h2 class="pn-eyebrow">3 · Up to two rules</h2>
      <div class="create__cons">
        {CONSTRAINTS.map((c) => {
          const on = cons.includes(c.id);
          return (
            <button
              key={c.id}
              type="button"
              aria-pressed={on}
              class={`pn-chip pn-chip--interactive${on ? ' is-selected' : ''}`}
              onClick={() => setCons(on ? cons.filter((x) => x !== c.id) : cons.length >= 2 ? [cons[1]!, c.id] : [...cons, c.id])}
            >
              {c.label}
            </button>
          );
        })}
      </div>
      <p class="pn-meta">Rules are measured from your own pot, so your challenge is always possible.</p>
      <div class="sc__actions">
        <Button
          variant="primary"
          size="lg"
          block
          loading={busy}
          disabled={!potId}
          onClick={async () => {
            if (!potId) return;
            setBusy(true);
            await createCommission(potId, adj, noun, cons);
            setBusy(false);
          }}
        >
          Post "{adj} {noun}"
        </Button>
      </div>
    </section>
  );
}

// ---------- Leaderboard ----------

export function Leaderboard() {
  const c = S.today.value?.commission ?? S.commission.value;
  const [data, setData] = useState<LeaderboardResponse | null>(null);
  const [err, setErr] = useState(false);
  useEffect(() => {
    if (!c) return;
    api
      .leaderboard(c.id)
      .then(setData)
      .catch(() => setErr(true));
  }, [c?.id]);
  return (
    <section class="sc" aria-labelledby="lb-title">
      <p class="pn-eyebrow">Today · {c?.title}</p>
      <h1 id="lb-title" class="pn-headline">Leaderboard</h1>
      {err ? <EmptyState title="Could not load the leaderboard" description="Try again in a moment." compact /> : null}
      {!data && !err ? <Skeleton shape="rect" height={200} /> : null}
      {data && data.rows.length === 0 ? (
        <EmptyState icon={<IconTrophy />} title="No ranked throws yet" description="Be the first on the board today." action={<Button variant="primary" onClick={() => playDaily()}>Throw now</Button>} />
      ) : null}
      {data && data.rows.length ? (
        <GlassPanel padding="sm" radius="lg">
          <ol class="lb">
            {data.rows.map((r) => (
              <li key={r.rank} class={`lb__row${r.isMe ? ' is-me' : ''}${r.rank <= 3 ? ` is-top${r.rank}` : ''}`}>
                <span class="lb__rank">{r.rank}</span>
                <Avatar name={r.username} size="sm" />
                <span class="lb__name">u/{r.username}</span>
                <span class="lb__score pn-num">{r.score}</span>
              </li>
            ))}
          </ol>
        </GlassPanel>
      ) : null}
      {data?.me && !data.rows.some((r) => r.isMe) ? (
        <p class="pn-body">
          You are #{data.me.rank} of {data.players} with {data.me.score}.
        </p>
      ) : null}
      {!S.loggedIn.value ? (
        <Button variant="secondary" block onClick={() => login()}>
          Log in to get ranked
        </Button>
      ) : null}
      <p class="pn-meta">
        <IconSparkle size={14} /> Only your first throw of each daily pot is ranked.
      </p>
    </section>
  );
}
