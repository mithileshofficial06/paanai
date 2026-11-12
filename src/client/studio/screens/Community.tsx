// Shelf, Glaze Codex, player Commissions (+ create), and today's leaderboard.
import { useEffect, useState } from 'preact/hooks';
import type { LeaderboardResponse } from '../../../shared/api/types';
import { ADJECTIVES, VESSELS } from '../../../shared/content/words';
import { api } from '../../app/api';
import { effectColour } from '../../app/glazeLook';
import { Avatar } from '../../ui/Avatar';
import { Button } from '../../ui/Button';
import { GlassPanel } from '../../ui/GlassPanel';
import { Skeleton } from '../../ui/Skeleton';
import { EmptyState } from '../../ui/States';
import { IconCodex, IconCommission, IconFlag, IconLock, IconShelf, IconSparkle, IconTrophy } from '../../ui/icons';
import { PotView } from '../parts';
import * as S from '../store';
import { createCommission, go, like, loadMyPots, loadShelf, login, playCommission, reportTarget } from '../controller';

export function Shelf() {
  const shelf = S.shelf.value;
  return (
    <section class="sc" aria-labelledby="shelf-title">
      <p class="pn-eyebrow">The Shelf</p>
      <h1 id="shelf-title" class="pn-headline">Fired by this community</h1>
      {!shelf ? (
        <div class="shelf__grid">{[0, 1, 2, 3].map((i) => <Skeleton key={i} shape="rect" height={190} />)}</div>
      ) : shelf.pots.length === 0 ? (
        <EmptyState icon={<IconShelf />} title="The shelf is empty" description="Pots appear here after their first firing. Yours could be the first." />
      ) : (
        <>
          <ul class="shelf__grid">
            {shelf.pots.map((p, i) => (
              <li key={p.potId}>
                <GlassPanel padding="sm" radius="lg" class={`shelf__pot${i === 0 ? ' is-top' : ''}`}>
                  {i === 0 && p.likes > 0 ? <span class="pn-badge pn-badge--gold shelf__badge">Pot of the week</span> : null}
                  <div class="shelf__figure">
                    <PotView pot={p} width={110} height={130} />
                  </div>
                  <p class="shelf__title">{p.title}</p>
                  <p class="pn-meta">u/{p.owner}</p>
                  <div class="shelf__row">
                    <button type="button" class="shelf__like" aria-label={`Like ${p.title}, ${p.likes} likes`} onClick={() => void like(p.potId)}>
                      <span aria-hidden="true">♥</span> {p.likes}
                    </button>
                    <button type="button" class="shelf__report" aria-label={`Report ${p.title}`} onClick={() => void reportTarget(p.potId)}>
                      <IconFlag size={16} />
                    </button>
                  </div>
                </GlassPanel>
              </li>
            ))}
          </ul>
          {shelf.next !== null ? (
            <Button variant="secondary" block onClick={() => void loadShelf(false)}>
              Show more
            </Button>
          ) : null}
        </>
      )}
    </section>
  );
}

export function Codex() {
  const cx = S.codex.value;
  return (
    <section class="sc" aria-labelledby="codex-title">
      <p class="pn-eyebrow">Glaze Codex</p>
      <h1 id="codex-title" class="pn-headline">{cx ? `${cx.discovered} of ${cx.total} discovered` : 'Glaze Codex'}</h1>
      <p class="pn-body sc__lead">Every glaze effect the kiln can make. The first potter in this community to fire one gets their name on it.</p>
      {!cx ? (
        <Skeleton shape="rect" height={240} />
      ) : (
        <ul class="codex__grid">
          {cx.effects.map((e) => {
            const found = !!e.discoverer;
            return (
              <li key={e.id} class={`codex__item pn-glass pn-radius-md${found ? ' is-found' : ''}${e.rare ? ' is-rare' : ''}`}>
                <span class="codex__swatch" style={found && effectColour(e.id) ? { '--sw': effectColour(e.id) } : undefined} aria-hidden="true">
                  {found ? null : <IconLock size={16} />}
                </span>
                <div class="codex__text">
                  <h2 class="codex__name">
                    {found ? e.name : 'Undiscovered'} {e.rare ? <span class="pn-badge pn-badge--gold">Rare</span> : null}
                  </h2>
                  <p class="pn-meta">{found ? `First fired by u/${e.discoverer}` : e.kind === 'colour' ? 'A colour effect' : 'A surface effect'}</p>
                  {found ? <p class="codex__blurb">{e.blurb}</p> : null}
                </div>
              </li>
            );
          })}
        </ul>
      )}
      <p class="pn-meta">
        <IconCodex size={14} /> Tip: glaze, wall thickness, shape and the kiln's atmosphere all decide what you get.
      </p>
    </section>
  );
}

export function Commissions() {
  const list = S.commissions.value;
  const me = S.me.value;
  return (
    <section class="sc" aria-labelledby="comm-title">
      <p class="pn-eyebrow">Beat the Commissioner</p>
      <h1 id="comm-title" class="pn-headline">Player commissions</h1>
      <p class="pn-body sc__lead">Pots posted by Journeymen and above. Match their shape and beat their score. The maker earns patron points for every attempt.</p>
      {me?.canCommission ? (
        <Button variant="primary" block icon={<IconCommission />} onClick={() => go('create')}>
          Post one of your pots
        </Button>
      ) : (
        <GlassPanel tone="inset" padding="md" radius="lg" class="comm__locked">
          <IconLock size={18} />
          <span>{me ? `Reach Journeyman to post your own (${me.rankPoints}/${me.nextRankAt ?? '–'} points).` : 'Log in and reach Journeyman to post your own.'}</span>
        </GlassPanel>
      )}
      {!list ? (
        <Skeleton shape="rect" height={120} />
      ) : list.length === 0 ? (
        <EmptyState icon={<IconCommission />} title="No commissions yet" description="When a Journeyman posts a pot, it shows up here." compact />
      ) : (
        <ul class="comm__list">
          {list.map((c) => (
            <li key={c.id}>
              <GlassPanel padding="md" radius="lg" class="comm__item">
                <div class="comm__text">
                  <h2 class="pn-title">{c.title}</h2>
                  <p class="pn-meta">
                    u/{c.maker} · beat {c.bar} · {c.completions} tried
                  </p>
                  {c.constraintLabels.length ? <p class="pn-meta">{c.constraintLabels.join(' · ')}</p> : null}
                </div>
                <Button variant="secondary" size="sm" onClick={() => void playCommission(c.id)}>
                  Throw it
                </Button>
              </GlassPanel>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

const CONSTRAINTS = [
  { id: 'capacity', label: 'Same capacity' },
  { id: 'rim', label: 'Same rim (narrower or wider)' },
  { id: 'height', label: 'Same height' },
  { id: 'survive', label: 'Must survive the kiln' },
  { id: 'maxStrokes', label: 'Few strokes' },
];

export function Create() {
  const pots = S.myPots.value;
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
      <p class="pn-eyebrow">New commission</p>
      <h1 id="create-title" class="pn-headline">Challenge the subreddit</h1>
      <h2 class="pn-eyebrow">1 · Pick one of your pots</h2>
      {!pots ? (
        <Skeleton shape="rect" height={120} />
      ) : pots.length === 0 ? (
        <EmptyState title="No pots yet" description="Throw a ranked pot first." compact />
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
      <h2 class="pn-eyebrow">3 · Up to two constraints</h2>
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
      <p class="pn-meta">Constraints are measured from your own pot, so your commission is always possible.</p>
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

export function Leaderboard() {
  const c = S.commission.value;
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
        <EmptyState icon={<IconTrophy />} title="No ranked throws yet" description="Be the first on the board today." action={<Button variant="primary" onClick={() => go('throw')}>Throw now</Button>} />
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
        <IconSparkle size={14} /> Only your first throw of each commission is ranked.
      </p>
    </section>
  );
}

