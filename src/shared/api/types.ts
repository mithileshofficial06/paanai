// Request/response types shared by client and server.
import type { Constraint, ScoreBreakdown } from '../core/score';
import type { Format } from '../content/commissions';

export type Atmosphere = 'oxidation' | 'reduction';
export type RankId = 'apprentice' | 'journeyman' | 'artisan' | 'master';

export type ApiError = { error: { code: string; message: string } };

export type CommissionDTO = {
  id: string;
  kind: 'official' | 'player';
  title: string;
  note: string;
  origin: string;
  /** "the Master" for official commissions, otherwise the maker's username. */
  commissioner: string;
  bar: number;
  barStrokes: number;
  constraints: Constraint[];
  constraintLabels: string[];
  /** encodeProfile() of the target pot. */
  target: number[];
  format: Format;
  formatLabel: string;
  postId: string | null;
};

export type MeDTO = {
  username: string;
  rank: RankId;
  rankLabel: string;
  rankPoints: number;
  nextRankAt: number | null;
  throws: number;
  stars: number;
  potsFired: number;
  discoveries: number;
  streakDays: number;
  patron: number;
  hintsDone: string[];
  onboarded: boolean;
  canCommission: boolean;
};

export type PotSummary = {
  potId: string;
  owner: string;
  commissionId: string;
  title: string;
  profile: number[];
  score: number;
  ranked: boolean;
  glaze: GlazeChoice | null;
  fired: FiredResultDTO | null;
  likes: number;
  createdAt: number;
};

export type GlazeChoice = {
  glazes: string[];
  application: 'dip' | 'pour' | 'double-dip';
};

export type FiredResultDTO = {
  survived: boolean;
  defects: string[];
  effects: string[];
  newDiscoveries: string[];
  atmosphere: Atmosphere;
  kilnScore: number;
  seed: number;
};

export type MyThrowDTO = {
  potId: string;
  score: ScoreBreakdown;
  ranked: boolean;
  beatBar: boolean;
  glazed: boolean;
};

export type LeaderRow = { rank: number; username: string; score: number; isMe: boolean };

export type TodayResponse = {
  date: string;
  dayNumber: number;
  commission: CommissionDTO;
  atmosphere: Atmosphere;
  nextKilnAt: number;
  me: MeDTO | null;
  myThrow: MyThrowDTO | null;
  throwsToday: number;
  top: LeaderRow[];
  /** Pots of mine that were fired and not yet opened. */
  kilnWaiting: number;
};

export type ThrowRequest = { commissionId: string; strokeLog: string; idemKey: string };

export type ThrowResponse = {
  potId: string | null;
  ranked: boolean;
  practiceReason: 'already-ranked' | 'logged-out' | null;
  score: ScoreBreakdown;
  bar: number;
  beatBar: boolean;
  rank: number | null;
  players: number;
  starsEarned: number;
};

export type LeaderboardResponse = { rows: LeaderRow[]; me: LeaderRow | null; players: number };
