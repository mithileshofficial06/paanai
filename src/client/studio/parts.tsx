// Small shared pieces for the studio screens.
import { useEffect, useState } from 'preact/hooks';
import type { PotSummary } from '../../shared/api/types';
import { PotSilhouette } from '../ui/PotSilhouette';
import { decodeOutline } from '../app/silhouette';
import { clayLook, firedLook, rawLook } from '../app/glazeLook';
import { renderPotImage } from '../three/potRenderer';

/** A pot as a real 3D render (glaze, or fired look once fired); a flat silhouette while it renders. */
export function PotView({ pot, width, height }: { pot: Pick<PotSummary, 'profile' | 'glaze' | 'fired'> & { potId?: string | undefined }; width: number; height: number }) {
  const look = pot.glaze && pot.fired ? firedLook(pot.glaze, pot.fired) : pot.glaze ? rawLook(pot.glaze) : clayLook();
  const key = `${pot.potId ?? pot.profile.join(',')}|${pot.glaze?.glazes.join('+') ?? '-'}|${pot.glaze?.application ?? ''}|${pot.fired ? pot.fired.seed : 'raw'}`;
  const [src, setSrc] = useState<string | null>(null);
  useEffect(() => {
    let live = true;
    const size = Math.min(512, Math.ceil(Math.max(width, height) * 2));
    void renderPotImage(key, pot.profile, look, size, pot.fired?.seed ?? 7).then((u) => live && setSrc(u));
    return () => {
      live = false;
    };
  }, [key]);
  if (src) return <img class="pot3d" src={src} width={Math.max(width, height)} height={Math.max(width, height)} alt="" style={{ width: `${Math.max(width, height)}px`, height: `${Math.max(width, height)}px` }} />;
  const o = decodeOutline(pot.profile);
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
