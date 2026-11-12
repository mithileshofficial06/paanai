// Journeys analytics wrapper. Every call is fire-and-forget and can never break the game
// (events are dropped by Reddit until the app is approved, and the local harness has no route).
import { telemetry } from '@devvit/analytics/client/reddit';

let journeyId: string | null = null;
let readySent = false;

function swallow(p: Promise<unknown>): void {
  p.catch(() => undefined);
}

export const journeys = {
  appReady(): void {
    if (readySent) return;
    readySent = true;
    swallow(telemetry.appReady());
  },
  /** Start on Throw, never on view. */
  start(): void {
    swallow(
      telemetry.startJourney().then((r) => {
        journeyId = r.journeyId || null;
      })
    );
  },
  progress(progress: 0.33 | 0.66 | 1, action: 'shaped' | 'glazed' | 'in-kiln'): void {
    if (!journeyId) return;
    swallow(telemetry.progress({ progress, action }));
  },
  interaction(action: 'ghost_toggle' | 'codex_open' | 'commission_open' | 'shelf_open' | 'share' | 'how_to_play'): void {
    swallow(telemetry.interaction({ action }));
  },
  end(complete: boolean, win: boolean, score: number): void {
    if (!journeyId) return;
    swallow(telemetry.endJourney({ complete, game: { win, score } }));
    journeyId = null;
  },
  id(): string | null {
    return journeyId;
  },
};
