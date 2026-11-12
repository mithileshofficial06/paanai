// App state for the expanded studio (Preact signals). Screens read these; only the
// controller (controller.ts) writes them.
import { computed, signal } from '@preact/signals';
import type { CommissionDTO, PotSummary, ThrowResponse, TodayResponse } from '../../shared/api/types';
import type { CodexEntry, CommissionListItem, KilnItem } from '../app/api';

export type Route =
  | 'loading'
  | 'error'
  | 'welcome' // first visit: "an old potter left a pot in the kiln for you"
  | 'howto'
  | 'features'
  | 'throw'
  | 'result'
  | 'glaze'
  | 'kiln'
  | 'shelf'
  | 'codex'
  | 'commissions'
  | 'create'
  | 'leaderboard';

export type LiveThrow = {
  heightMm: number;
  capacityMl: number;
  minWallMm: number;
  maxDiameterMm: number;
  opened: boolean;
  unsafe: boolean;
  wobble: number;
  slumped: boolean;
  strokes: number;
  ticks: number;
  secondsLeft: number;
  matchPreview: number | null;
  /** 1 = freshly wet, 0 = dry (drier clay resists). */
  wetness: number;
  phase: 'centering' | 'throwing';
};

export type LastThrow = {
  res: ThrowResponse;
  /** encodeProfile() of the thrown pot (for previews, glaze, share). */
  profile: number[];
  strokeLog: string;
  commission: CommissionDTO;
};

export type HintId = 'drag' | 'open' | 'even';

export const route = signal<Route>('loading');
/** The guided tour is running on the wheel. */
export const tour = signal(false);
export const routeStack = signal<Route[]>([]);
export const today = signal<TodayResponse | null>(null);
export const loadError = signal<string | null>(null);
/** The commission being thrown (today's, or a player commission opened from the list). */
export const commission = signal<CommissionDTO | null>(null);
export const ghostLog = signal<string | null>(null);
export const ghostOn = signal(false);
export const live = signal<LiveThrow | null>(null);
export const tool = signal<'hands' | 'push' | 'thin'>('hands');
export const submitting = signal(false);
export const lastThrow = signal<LastThrow | null>(null);
export const hintsDone = signal<Set<HintId>>(new Set());
export const activeHint = signal<HintId | null>(null);
export const kilnItems = signal<KilnItem[]>([]);
export const kilnLoading = signal(false);
/** The pot currently being revealed in the kiln (or the starter pot). */
export const revealing = signal<PotSummary | null>(null);
export const shelf = signal<{ pots: PotSummary[]; next: number | null; total: number } | null>(null);
export const codex = signal<{ effects: CodexEntry[]; discovered: number; total: number } | null>(null);
export const commissions = signal<CommissionListItem[] | null>(null);
export const myPots = signal<PotSummary[] | null>(null);
export const toast = signal<{ id: number; text: string; tone: 'neutral' | 'success' | 'danger' } | null>(null);
export const muted = signal(false);
/** PNG data URL of the last thrown pot (3D render), for the result card and sharing. */
export const lastThumb = signal<string | null>(null);

export const me = computed(() => today.value?.me ?? null);
export const loggedIn = computed(() => !!today.value?.me);
export const kilnBadge = computed(() => today.value?.kilnWaiting ?? 0);
