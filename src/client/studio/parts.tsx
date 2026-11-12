// Small shared pieces for the studio screens.
import { useEffect, useState } from 'preact/hooks';
import type { PotSummary } from '../../shared/api/types';
import { PotSilhouette } from '../ui/PotSilhouette';
import { decodeOutline } from '../app/silhouette';
import { clayLook, firedLook, rawLook } from '../app/glazeLook';

/** A pot as a flat silhouette, coloured by its glaze (fired look once fired). */
export function PotView({ pot, width, height }: { pot: Pick<PotSummary, 'profile' | 'glaze' | 'fired'>; width: number; height: number }) {
  const o = decodeOutline(pot.profile);
  const look = pot.glaze && pot.fired ? firedLook(pot.glaze, pot.fired) : pot.glaze ? rawLook(pot.glaze) : clayLook();
  return <PotSilhouette radii={o.outer} heightUnits={o.height} width={width} height={height} variant="glaze" color={look.base} showBase />;
}

/** The target outline of a commission (encoded profile). */
export function TargetView({ profile, width, height }: { profile: number[]; width: number; height: number }) {
  const o = decodeOutline(profile);
  return <PotSilhouette radii={o.outer} heightUnits={o.height} width={width} height={height} variant="target" />;
}

export function fmtCountdown(ms: number): string {
  if (ms <= 0) return 'now';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m ${s % 60}s`;
}

export function useNow(periodMs = 1000): number {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), periodMs);
    return () => clearInterval(t);
  }, [periodMs]);
  return now;
}

export function titleCase(id: string): string {
  return id.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}
