import type {
  ApiError,
  CommissionDTO,
  LeaderboardResponse,
  LevelThrowRequest,
  LevelThrowResponse,
  LevelsResponse,
  PotSummary,
  ThrowRequest,
  ThrowResponse,
  TodayResponse,
} from '../../shared/api/types';

export class ApiFailure extends Error {
  constructor(
    readonly code: string,
    message: string,
    readonly status: number
  ) {
    super(message);
  }
}

async function req<T>(method: 'GET' | 'POST', path: string, body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(`/api/${path}`, {
      method,
      headers: body === undefined ? {} : { 'content-type': 'application/json' },
      ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    });
  } catch {
    throw new ApiFailure('network', 'No connection to the studio. Check your network and try again.', 0);
  }
  const text = await res.text();
  let json: unknown;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = null;
  }
  if (!res.ok) {
    const e = (json as ApiError | null)?.error;
    throw new ApiFailure(e?.code ?? 'http', e?.message ?? `Request failed (${res.status}).`, res.status);
  }
  return json as T;
}

export type KilnItem = PotSummary & { opened: boolean; kilnDate: string; firesAt: number | null };
export type CodexEntry = { id: string; name: string; blurb: string; kind: string; rare: boolean; discoverer: string | null; date: string | null };
export type CommissionListItem = { id: string; title: string; maker: string; bar: number; completions: number; postId: string; constraintLabels: string[] };

export const api = {
  today: () => req<TodayResponse>('GET', 'today'),
  throw: (r: ThrowRequest) => req<ThrowResponse>('POST', 'throw', r),
  leaderboard: (id: string) => req<LeaderboardResponse>('GET', `leaderboard?id=${encodeURIComponent(id)}`),
  commission: (id: string) => req<{ commission: CommissionDTO; ghostLog: string }>('GET', `commission/${encodeURIComponent(id)}`),
  hint: (hint: string) => req<{ ok: true }>('POST', 'me/hints', { hint }),
  onboarded: () => req<{ ok: true }>('POST', 'me/hints', { onboarded: true }),
  glaze: (potId: string, glazes: string[], application: string) =>
    req<{ kilnDate: string; atmosphere: string }>('POST', 'glaze', { potId, glazes, application }),
  kiln: () => req<{ items: KilnItem[]; today?: string }>('GET', 'kiln'),
  openKiln: (potId: string) => req<{ ok: true }>('POST', 'kiln/open', { potId }),
  starter: () => req<PotSummary>('GET', 'starter'),
  codex: () => req<{ effects: CodexEntry[]; discovered: number; total: number }>('GET', 'codex'),
  shelf: (cursor = 0) => req<{ pots: PotSummary[]; next: number | null; total: number }>('GET', `shelf?cursor=${cursor}`),
  like: (potId: string) => req<{ liked: boolean; likes: number }>('POST', 'like', { potId }),
  report: (targetId: string) => req<{ hidden: boolean }>('POST', 'report', { targetId }),
  deletePot: (potId: string) => req<{ ok: true }>('POST', 'pot/delete', { potId }),
  share: (potId: string, pngDataUrl: string) => req<{ commentId: string }>('POST', 'share', { potId, pngDataUrl }),
  createCommission: (potId: string, adjective: string, vessel: string, constraints: string[]) =>
    req<{ id: string; postId: string; bar: number; url: string }>('POST', 'commission', { potId, adjective, vessel, constraints }),
  commissions: () => req<{ commissions: CommissionListItem[] }>('GET', 'commissions'),
  myPots: () => req<{ pots: PotSummary[] }>('GET', 'mypots'),
  levels: () => req<LevelsResponse>('GET', 'levels'),
  levelThrow: (r: LevelThrowRequest) => req<LevelThrowResponse>('POST', 'level/throw', r),
  tutorialDone: () => req<{ ok: true }>('POST', 'tutorial/done', {}),
  deleteCommission: (id: string) => req<{ ok: true }>('POST', 'commission/delete', { id }),
};
