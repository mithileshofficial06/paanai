// All studio actions: data loading, routing, throw submission, glazing, kiln, sharing.
// Screens call these and render from store.ts. Errors become toasts, never crashes.
import { showLoginPrompt, navigateTo } from '@devvit/web/client';
import { encodeLog } from '../../shared/core/strokes';
import { encodeProfile } from '../../shared/core/profile';
import type { StrokeLog } from '../../shared/core/shape';
import type { LevelsResponse, PotSummary } from '../../shared/api/types';
import { LEVEL_COUNT, levelDTO, levelData, levelGhost, tutorialData } from '../../shared/content/levels';
import { type Decor, emptyDecor, isEmptyDecor } from '../../shared/core/decor';
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

const TABS: Route[] = ['levels', 'throw', 'showcase', 'kiln', 'mypots', 'codex'];
/** The Studio tab remembers which of its three rooms you were in. */
let studioRoom: Route = 'kiln';

export function go(r: Route): void {
  if (S.route.value === r) return;
  if (TABS.includes(r)) S.routeStack.value = [];
  const tab = r === 'kiln' || r === 'mypots' || r === 'codex' ? 'studio' : r;
  if (S.newTabs.value.has(tab)) S.newTabs.value = new Set([...S.newTabs.value].filter((x) => x !== tab));
  else S.routeStack.value = [...S.routeStack.value, S.route.value];
  S.route.value = r;
  if (r === 'kiln' || r === 'mypots' || r === 'codex') studioRoom = r;
  if (r === 'kiln') void loadKiln();
  if (r === 'mypots') void loadMyPots();
  if (r === 'levels') void loadLevels();
  if (r === 'showcase') void loadShowcase(true);
  if (r === 'codex') {
    journeys.interaction('codex_open');
    void loadCodex();
  }
}

/** The Studio tab: kiln, my pots and the codex in one place. */
export function goStudio(): void {
  go(studioRoom);
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
    const [t] = await Promise.all([api.today(), loadLevels()]);
    (window as unknown as { __boot?: { to: (n: number) => void } }).__boot?.to(86);
    S.today.value = t;
    S.commission.value = t.commission;
    if (t.me) S.hintsDone.value = new Set([...S.hintsDone.value, ...(t.me.hintsDone as HintId[])]);
    void loadGhost(t.commission.id);
    journeys.appReady();
    const lv = S.levels.value;
    // New players: the welcome kiln, then the tutorial, then level 1. Returning players: the level map.
    if (t.me && !t.me.onboarded && !lv?.tutorialDone) S.route.value = 'welcome';
    else if (!t.me && !lv?.tutorialDone && !S.hintsDone.value.has('drag')) S.route.value = 'welcome';
    else if (t.kilnWaiting > 0) go('kiln');
    // Still on the first run: back to the daily loop (the kiln once today's pot is thrown).
    else if (t.me?.firstRun) {
      if (t.myThrow) go('kiln');
      else playDaily();
    }
    else S.route.value = 'levels';
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

/**
 * The tutorial: four narrated steps that throw a practice cup by themselves, then a fifth
 * where the player throws it with a guide. It ends with "Enter level 1". Separate from level 1.
 */
export function startTour(): void {
  sfx.unlock();
  const d = tutorialData();
  S.commission.value = levelDTO(d);
  S.ghostLog.value = levelGhost(d);
  S.ghostOn.value = false;
  S.tool.value = 'hands';
  S.lastThrow.value = null;
  S.practice.value = false;
  S.practiceDone.value = false;
  S.tour.value = true;
  S.route.value = 'throw';
  S.routeStack.value = [];
}

/** Leave the tutorial (finished or skipped) and go to the next level to play. */
export async function finishTutorial(): Promise<void> {
  const firstTime = !S.levels.value?.tutorialDone;
  S.tour.value = false;
  S.practice.value = false;
  S.practiceDone.value = false;
  const lv = S.levels.value ?? emptyLevels();
  S.levels.value = { ...lv, tutorialDone: true };
  saveLocalLevels();
  // First time through: straight to today's commission (the daily loop: throw, paint, kiln).
  if (firstTime && S.today.value && !S.today.value.myThrow) playDaily();
  else playLevel(firstTime ? 1 : lv.unlocked);
  if (S.loggedIn.value) {
    await Promise.all([api.tutorialDone().catch(() => undefined), S.me.value?.onboarded ? null : api.onboarded().catch(() => undefined)]);
  }
}

// ---------- Levels ----------

const LOCAL_LEVELS = 'paanai.levels';

function emptyLevels(): LevelsResponse {
  return { unlocked: 1, best: Array.from({ length: LEVEL_COUNT }, () => 0), tutorialDone: false, saved: false };
}

function saveLocalLevels(): void {
  const lv = S.levels.value;
  if (!lv || lv.saved) return;
  try {
    localStorage.setItem(LOCAL_LEVELS, JSON.stringify({ unlocked: lv.unlocked, best: lv.best, tutorialDone: lv.tutorialDone }));
  } catch {
    /* storage unavailable */
  }
}

export async function loadLevels(): Promise<void> {
  try {
    const lv = await api.levels();
    if (!lv.saved) {
      // Logged out: progress lives in this browser.
      try {
        const raw = JSON.parse(localStorage.getItem(LOCAL_LEVELS) ?? 'null') as Partial<LevelsResponse> | null;
        if (raw) {
          lv.unlocked = Math.max(1, Math.min(LEVEL_COUNT, Number(raw.unlocked) || 1));
          if (Array.isArray(raw.best)) lv.best = lv.best.map((_, i) => Number(raw.best?.[i]) || 0);
          lv.tutorialDone = !!raw.tutorialDone;
        }
      } catch {
        /* storage unavailable */
      }
    }
    S.levels.value = lv;
  } catch {
    S.levels.value ??= emptyLevels();
  }
}

/** Load level n onto the wheel. */
export function playLevel(n: number): void {
  const d = levelData(n);
  S.commission.value = levelDTO(d);
  S.ghostLog.value = levelGhost(d);
  S.ghostOn.value = false;
  S.tool.value = 'hands';
  S.decor.value = emptyDecor();
  S.lastThrow.value = null;
  S.lastLevel.value = null;
  S.route.value = 'throw';
  S.routeStack.value = ['levels'];
}

/** The Daily tab: today's commission on the wheel. */
export function playDaily(): void {
  const t = S.today.value;
  if (t && S.commission.value?.id !== t.commission.id) {
    S.commission.value = t.commission;
    S.lastThrow.value = null;
    void loadGhost(t.commission.id);
  }
  go('throw');
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
  // After opening, the live coach (coach.ts) takes over from the one-off hints.
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
  if (c.kind === 'tutorial') {
    // The practice cup is not scored on the server: the guide just congratulates you.
    S.practiceDone.value = true;
    sfx.chime();
    return true;
  }
  S.submitting.value = true;
  const strokeLog = encodeLog(log);
  S.decor.value = emptyDecor();
  S.decorSaved.value = false;
  if (c.kind === 'level') {
    const n = Number(c.id.slice('level-'.length));
    try {
      const res = await api.levelThrow({ level: n, strokeLog });
      S.lastLevel.value = { res, profile, commission: c };
      const lv = S.levels.value ?? emptyLevels();
      const best = lv.best.slice();
      best[n - 1] = Math.max(best[n - 1] ?? 0, res.score.total);
      S.levels.value = { ...lv, unlocked: Math.max(lv.unlocked, res.unlocked), best };
      saveLocalLevels();
      if (res.passed) haptic([12, 50, 24]);
      go('levelResult');
      return true;
    } catch (err) {
      fail(err);
      return false;
    } finally {
      S.submitting.value = false;
    }
  }
  try {
    const res = await api.throw({ commissionId: c.id, strokeLog, idemKey: `${c.id}:${strokeLog.length}:${log.endTick}:${Date.now() % 100000}` });
    S.lastThrow.value = { res, profile, strokeLog, commission: c };
    journeys.progress(0.33, 'shaped');
    if (!res.potId) journeys.end(true, res.beatBar, res.score.total);
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
  S.decor.value = emptyDecor();
  S.lastThrow.value = null;
  S.lastLevel.value = null;
  go('throw');
}

// ---------- Decorate ----------

/**
 * Keep the paint on the pot just thrown. Daily pots save it with the pot (it shows on the shelf
 * and in the kiln); level pots keep it for the result card. Then move on.
 */
export async function finishDecorating(decor: Decor, snapshot: string | null): Promise<void> {
  S.decor.value = decor;
  if (snapshot && !isEmptyDecor(decor)) S.lastThumb.value = snapshot;
  const potId = currentPotId();
  if (potId && S.loggedIn.value && !(isEmptyDecor(decor) && !S.decorSaved.value)) {
    try {
      await api.decorate(potId, decor);
      S.decorSaved.value = !isEmptyDecor(decor);
    } catch (err) {
      fail(err);
      return;
    }
  }
  if (S.mode.value === 'daily' && potId) await placeInKiln(potId);
  else back();
}

/** The kept pot just thrown (daily or level), if the player is logged in. */
export function currentPotId(): string | null {
  return (S.mode.value === 'daily' ? S.lastThrow.value?.res.potId : S.lastLevel.value?.res.potId) ?? null;
}

// ---------- Kiln ----------

/** Into the next kiln. The kiln master glazes it: every firing is a surprise. */
export async function placeInKiln(potId: string): Promise<boolean> {
  try {
    const res = await api.fire(potId);
    journeys.progress(0.66, 'glazed');
    journeys.progress(1, 'in-kiln');
    const lt = S.lastThrow.value;
    if (lt) journeys.end(true, lt.res.beatBar, lt.res.score.total);
    sfx.whoosh();
    say(res.quickAt ? 'Your first pot gets a quick test firing. It will be ready to open in about 90 seconds.' : 'In the kiln. It fires at 00:00 UTC. Come back to open it.', 'success');
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

/** The tabs that open up after the first run, minus the one the player is on. */
function unlockedTabs(): Set<string> {
  const r = S.route.value;
  const here = r === 'kiln' || r === 'mypots' || r === 'codex' ? 'studio' : r;
  return new Set(['levels', 'showcase', 'studio'].filter((x) => x !== here));
}

/** End the first run: show the bottom tabs, with a "New" badge on each until it is visited. */
export function graduate(): void {
  if (!S.firstRun.value) return;
  S.graduated.value = true;
  S.newTabs.value = unlockedTabs();
  if (S.loggedIn.value) void api.graduate().catch(() => undefined);
}

/** Mark a fired pot as opened after its reveal animation. */
export async function markOpened(potId: string): Promise<void> {
  S.kilnItems.value = S.kilnItems.value.map((i) => (i.potId === potId ? { ...i, opened: true } : i));
  // The server records the end of the first run when the pot is opened.
  if (S.firstRun.value) {
    S.graduated.value = true;
    S.newTabs.value = unlockedTabs();
  }
  try {
    await api.openKiln(potId);
    void refreshToday();
  } catch {
    /* non-critical */
  }
}

// ---------- Community ----------

export async function loadShowcase(reset: boolean, sort = S.showcaseSort.value): Promise<void> {
  try {
    if (sort !== S.showcaseSort.value) {
      S.showcaseSort.value = sort;
      S.showcase.value = null;
      reset = true;
    }
    const cur = reset ? null : S.showcase.value;
    const page = await api.showcase(sort, cur?.next ?? 0);
    if (sort !== S.showcaseSort.value) return;
    S.showcase.value = cur ? { pots: [...cur.pots, ...page.pots], next: page.next, total: page.total } : page;
  } catch (err) {
    fail(err);
  }
}

function patchShowcasePot(potId: string, patch: Partial<PotSummary>): void {
  const s = S.showcase.value;
  if (s) S.showcase.value = { ...s, pots: s.pots.map((p) => (p.potId === potId ? { ...p, ...patch } : p)) };
}

export async function like(potId: string): Promise<void> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return;
  }
  const was = S.showcase.value?.pots.find((p) => p.potId === potId);
  if (was) patchShowcasePot(potId, { myLike: !was.myLike, likes: Math.max(0, was.likes + (was.myLike ? -1 : 1)) });
  haptic(8);
  try {
    const r = await api.like(potId);
    patchShowcasePot(potId, { likes: r.likes, myLike: r.liked });
  } catch (err) {
    if (was) patchShowcasePot(potId, { myLike: !!was.myLike, likes: was.likes });
    fail(err);
  }
}

/** Rate someone else's pot in the Showcase. */
export async function ratePot(potId: string, stars: number): Promise<void> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return;
  }
  const was = S.showcase.value?.pots.find((p) => p.potId === potId);
  patchShowcasePot(potId, { myRating: stars });
  haptic(10);
  sfx.tink(0.7 + stars * 0.06);
  try {
    const r = await api.rate(potId, stars);
    patchShowcasePot(potId, { rating: r.rating, ratings: r.ratings, myRating: r.myRating });
  } catch (err) {
    if (was) patchShowcasePot(potId, { myRating: was.myRating ?? 0 });
    fail(err);
  }
}

/** Put one of your pots on show for everyone (or take it down). */
export async function setOnShow(potId: string, on: boolean): Promise<boolean> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return false;
  }
  try {
    await api.setShowcase(potId, on);
    S.onShow.value = new Map(S.onShow.value).set(potId, on);
    const mine = S.myPots.value;
    if (mine) S.myPots.value = mine.map((p) => (p.potId === potId ? { ...p, showcased: on } : p));
    haptic(on ? [10, 40, 18] : 8);
    if (on) sfx.chime();
    say(on ? 'On show. Everyone can now rate and like it.' : 'Taken off show.', on ? 'success' : 'neutral');
    if (S.showcase.value) void loadShowcase(true);
    return true;
  } catch (err) {
    fail(err);
    return false;
  }
}

export function isOnShow(p: { potId: string; showcased?: boolean | undefined }): boolean {
  return S.onShow.value.get(p.potId) ?? !!p.showcased;
}

/** Phone buzz, where supported (Android). Never on iOS Safari, which has no vibrate. */
export function haptic(pattern: number | number[]): void {
  try {
    if ('vibrate' in navigator && !matchMedia('(prefers-reduced-motion: reduce)').matches) navigator.vibrate(pattern);
  } catch {
    /* not supported */
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

/**
 * Share a pot on Reddit: its photo goes into the comments of the game post, as the player.
 * Only ever called from an explicit, labelled tap.
 */
export async function sharePot(potId: string, pngDataUrl: string | null): Promise<boolean> {
  if (!S.loggedIn.value) {
    showLoginPrompt();
    return false;
  }
  if (!pngDataUrl) {
    say('The pot photo could not be made on this device.', 'danger');
    return false;
  }
  journeys.interaction('share');
  try {
    await api.share(potId, pngDataUrl);
    S.sharedPots.value = new Set([...S.sharedPots.value, potId]);
    haptic([10, 40, 18]);
    say('Shared on Reddit. Your pot is in the comments.', 'success');
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
