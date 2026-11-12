// All studio actions: data loading, routing, throw submission, glazing, kiln, sharing.
// Screens call these and render from store.ts. Errors become toasts, never crashes.
import { showLoginPrompt, navigateTo } from '@devvit/web/client';
import { encodeLog } from '../../shared/core/strokes';
import { encodeProfile } from '../../shared/core/profile';
import type { StrokeLog } from '../../shared/core/shape';
import type { PotSummary } from '../../shared/api/types';
import { api, ApiFailure } from '../app/api';
import { journeys } from '../app/journeys';
import { sfx } from '../app/audio';
import * as S from './store';
import type { HintId, Route } from './store';

let toastSeq = 0;
export function say(text: string, tone: 'neutral' | 'success' | 'danger' = 'neutral'): void {
  S.toast.value = { id: ++toastSeq, text, tone };
}

function fail(err: unknown): void {
  const msg = err instanceof ApiFailure ? err.message : 'Something went wrong. Please try again.';
  if (err instanceof ApiFailure && err.status === 401) {
    say(msg);
    showLoginPrompt();
    return;
  }
  say(msg, 'danger');
}

// ---------- Routing ----------

const TABS: Route[] = ['throw', 'kiln', 'shelf', 'codex', 'commissions'];

export function go(r: Route): void {
  if (S.route.value === r) return;
  if (TABS.includes(r)) S.routeStack.value = [];
  else S.routeStack.value = [...S.routeStack.value, S.route.value];
  S.route.value = r;
  if (r === 'kiln') void loadKiln();
  if (r === 'shelf') void loadShelf(true);
  if (r === 'codex') {
    journeys.interaction('codex_open');
    void loadCodex();
  }
  if (r === 'commissions') {
    journeys.interaction('commission_open');
    void loadCommissions();
  }
  if (r === 'howto') journeys.interaction('how_to_play');
}

export function back(): void {
  const stack = S.routeStack.value;
  const prev = stack[stack.length - 1];
  S.routeStack.value = stack.slice(0, -1);
  S.route.value = prev ?? 'throw';
}

// ---------- Boot ----------

const LOCAL_HINTS = 'paanai.hints';

export async function boot(): Promise<void> {
  try {
    const raw = localStorage.getItem(LOCAL_HINTS);
    if (raw) S.hintsDone.value = new Set(raw.split(',').filter(Boolean) as HintId[]);
  } catch {
    /* storage unavailable */
  }
  S.muted.value = sfx.muted;
  try {
    const t = await api.today();
    S.today.value = t;
    S.commission.value = t.commission;
    if (t.me) S.hintsDone.value = new Set([...S.hintsDone.value, ...(t.me.hintsDone as HintId[])]);
    void loadGhost(t.commission.id);
    journeys.appReady();
    if (t.me && !t.me.onboarded) S.route.value = 'welcome';
    else if (!t.me && !S.hintsDone.value.has('drag')) S.route.value = 'welcome';
    else if (t.kilnWaiting > 0) go('kiln');
    else S.route.value = 'throw';
  } catch (err) {
    S.loadError.value = err instanceof ApiFailure ? err.message : 'Could not reach the studio.';
    S.route.value = 'error';
  }
}

export async function refreshToday(): Promise<void> {
  try {
    const t = await api.today();
    S.today.value = t;
  } catch {
    /* keep stale data */
  }
}

async function loadGhost(id: string): Promise<void> {
  try {
    const r = await api.commission(id);
    S.ghostLog.value = r.ghostLog;
  } catch {
    S.ghostLog.value = null;
  }
}

/** First-visit flow: reveal the starter pot, then How to play, then the wheel. */
export async function openStarter(): Promise<PotSummary | null> {
  try {
    const pot = await api.starter();
    S.revealing.value = pot;
    return pot;
  } catch (err) {
    fail(err);
    return null;
  }
}

/** Start the guided tour: it runs on the wheel and plays a throw by itself. */
export function startTour(): void {
  sfx.unlock();
  S.tour.value = true;
  S.route.value = 'throw';
  S.routeStack.value = [];
}

export async function finishOnboarding(): Promise<void> {
  S.route.value = 'throw';
  S.routeStack.value = [];
  if (S.loggedIn.value) {
    try {
      await api.onboarded();
    } catch {
      /* non-critical */
    }
  }
}

// ---------- Hints ----------

export function completeHint(h: HintId): void {
  if (S.hintsDone.value.has(h)) return;
  S.hintsDone.value = new Set([...S.hintsDone.value, h]);
  if (S.activeHint.value === h) S.activeHint.value = null;
  try {
    localStorage.setItem(LOCAL_HINTS, [...S.hintsDone.value].join(','));
  } catch {
    /* storage unavailable */
  }
  if (S.loggedIn.value) void api.hint(h).catch(() => undefined);
}

/** Decide which first-throw hint (if any) to show, given the live state. */
export function updateHint(): void {
  const l = S.live.value;
  const done = S.hintsDone.value;
  let next: HintId | null = null;
  if (!done.has('drag')) next = 'drag';
  else if (l && !l.opened && !done.has('open')) next = 'open';
  else if (l?.opened && !done.has('even')) next = 'even';
  S.activeHint.value = next;
}

// ---------- Throw ----------

let journeyStarted = false;

/** Call on the first touch of the clay. */
export function throwStarted(): void {
  sfx.unlock();
  if (!journeyStarted) {
    journeyStarted = true;
    journeys.start();
  }
}

export async function submitThrow(log: StrokeLog, profile: number[]): Promise<boolean> {
  const c = S.commission.value;
  if (!c || S.submitting.value) return false;
  S.submitting.value = true;
  const strokeLog = encodeLog(log);
  try {
    const res = await api.throw({ commissionId: c.id, strokeLog, idemKey: `${c.id}:${strokeLog.length}:${log.endTick}:${Date.now() % 100000}` });
    S.lastThrow.value = { res, profile, strokeLog, commission: c };
    journeys.progress(0.33, 'shaped');
    if (!res.potId) journeys.end(true, res.beatBar, res.score.total);
    sfx.chime();
    go('result');
    void refreshToday();
    return true;
  } catch (err) {
    fail(err);
    return false;
  } finally {
    S.submitting.value = false;
  }
}

export function profileOf(p: Parameters<typeof encodeProfile>[0]): number[] {
  return encodeProfile(p);
}

export function newThrow(): void {
  S.lastThrow.value = null;
  go('throw');
}

/** Throw a different commission (from the commissions list). */
export async function playCommission(id: string): Promise<void> {
  try {
    const r = await api.commission(id);
    S.commission.value = r.commission;
    S.ghostLog.value = r.ghostLog;
    S.lastThrow.value = null;
    go('throw');
  } catch (err) {
    fail(err);
  }
}

export function toggleGhost(): void {
  S.ghostOn.value = !S.ghostOn.value;
  journeys.interaction('ghost_toggle');
}

// ---------- Glaze + kiln ----------

export async function placeInKiln(potId: string, glazes: string[], application: string): Promise<boolean> {
  try {
    await api.glaze(potId, glazes, application);
    journeys.progress(0.66, 'glazed');
    journeys.progress(1, 'in-kiln');
    const lt = S.lastThrow.value;
    if (lt) journeys.end(true, lt.res.beatBar, lt.res.score.total);
    sfx.whoosh();
    say('In the kiln. It fires at 00:00 UTC. Come back to open it.', 'success');
    go('kiln');
    return true;
  } catch (err) {
    fail(err);
    return false;
  }
}

export async function loadKiln(): Promise<void> {
  if (!S.loggedIn.value) {
    S.kilnItems.value = [];
    return;
  }
  S.kilnLoading.value = true;
  try {
    S.kilnItems.value = (await api.kiln()).items;
  } catch (err) {
    fail(err);
  } finally {
    S.kilnLoading.value = false;
  }
}

/** Mark a fired pot as opened after its reveal animation. */
export async function markOpened(potId: string): Promise<void> {
  S.kilnItems.value = S.kilnItems.value.map((i) => (i.potId === potId ? { ...i, opened: true } : i));
  try {
    await api.openKiln(potId);
    void refreshToday();
  } catch {
    /* non-critical */
  }
}

// ---------- Community ----------

export async function loadShelf(reset: boolean): Promise<void> {
  try {
    const cur = reset ? null : S.shelf.value;
    const page = await api.shelf(cur?.next ?? 0);
    S.shelf.value = cur ? { pots: [...cur.pots, ...page.pots], next: page.next, total: page.total } : page;
  } catch (err) {
    fail(err);
  }
}

export async function like(potId: string): Promise<void> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return;
  }
  try {
    const r = await api.like(potId);
    const s = S.shelf.value;
    if (s) S.shelf.value = { ...s, pots: s.pots.map((p) => (p.potId === potId ? { ...p, likes: r.likes } : p)) };
  } catch (err) {
    fail(err);
  }
}

export async function reportTarget(targetId: string): Promise<void> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return;
  }
  try {
    const r = await api.report(targetId);
    say(r.hidden ? 'Thanks. It has been hidden for moderators to review.' : 'Thanks. Moderators will take a look.');
  } catch (err) {
    fail(err);
  }
}

export async function loadCodex(): Promise<void> {
  try {
    S.codex.value = await api.codex();
  } catch (err) {
    fail(err);
  }
}

export async function loadCommissions(): Promise<void> {
  try {
    S.commissions.value = (await api.commissions()).commissions;
  } catch (err) {
    fail(err);
  }
}

export async function loadMyPots(): Promise<void> {
  try {
    S.myPots.value = (await api.myPots()).pots;
  } catch (err) {
    fail(err);
  }
}

export async function createCommission(potId: string, adjective: string, vessel: string, constraints: string[]): Promise<boolean> {
  try {
    const r = await api.createCommission(potId, adjective, vessel, constraints);
    say(`Commission posted. Beat ${r.bar}.`, 'success');
    navigateTo(r.url);
    return true;
  } catch (err) {
    fail(err);
    return false;
  }
}

/** Share a pot photo to the comments. Only ever called from an explicit, labelled tap. */
export async function sharePot(potId: string, pngDataUrl: string): Promise<boolean> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return false;
  }
  journeys.interaction('share');
  try {
    await api.share(potId, pngDataUrl);
    say('Posted to the comments.', 'success');
    return true;
  } catch (err) {
    fail(err);
    return false;
  }
}

export function login(): void {
  showLoginPrompt();
}

export function setMuted(m: boolean): void {
  sfx.setMuted(m);
  S.muted.value = m;
}
