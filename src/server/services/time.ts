import { platform } from '../platform';

/** Day 1 of Paanai (used for "Day N" titles). */
const EPOCH_MS = Date.UTC(2026, 10, 12);
const DAY_MS = 86_400_000;

export function dateOf(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}

export function today(): string {
  return dateOf(platform().now());
}

export function addDays(date: string, n: number): string {
  return dateOf(Date.parse(`${date}T00:00:00Z`) + n * DAY_MS);
}

export function dayNumber(date: string): number {
  return Math.floor((Date.parse(`${date}T00:00:00Z`) - EPOCH_MS) / DAY_MS) + 1;
}

/** 0 = Sunday ... 6 = Saturday (UTC). */
export function weekday(date: string): number {
  return new Date(`${date}T00:00:00Z`).getUTCDay();
}

/** The next 00:00 UTC after now: when the next kiln fires. */
export function nextKilnAt(): number {
  const now = platform().now();
  return (Math.floor(now / DAY_MS) + 1) * DAY_MS;
}

export function minuteBucket(): number {
  return Math.floor(platform().now() / 60_000);
}

export function prettyDate(date: string): string {
  const d = new Date(`${date}T00:00:00Z`);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' });
}
