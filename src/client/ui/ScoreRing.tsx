import { useEffect, useId, useState } from 'preact/hooks';
import { cx, safeId } from './cx';
import { useReducedMotion } from './hooks';
import { IconCheck } from './icons';

export type ScoreRingProps = {
  /** Score, 0..max. */
  value: number;
  max?: number | undefined;
  /** Diameter in px. Default 132. */
  size?: number | undefined;
  /** Ring thickness in px. Default 10. */
  thickness?: number | undefined;
  /** Small caption under the number, e.g. "Score" or "Match". */
  label?: string | undefined;
  /** The bar to beat (the commissioner's score). Drawn as a tick on the ring. */
  target?: number | undefined;
  /** Caption for the target. Default "Beat {target}". */
  targetLabel?: string | undefined;
  /** auto: red while counting, gold once the target is beaten. */
  tone?: 'auto' | 'accent' | 'gold' | undefined;
  /** Count up and sweep the arc. Default true (off with reduced motion). */
  animate?: boolean | undefined;
  delay?: number | undefined;
  duration?: number | undefined;
  'aria-label'?: string | undefined;
  class?: string | undefined;
};

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export function ScoreRing({
  value,
  max = 100,
  size = 132,
  thickness = 10,
  label,
  target,
  targetLabel,
  tone = 'auto',
  animate = true,
  delay = 0,
  duration = 1200,
  class: className,
  ...aria
}: ScoreRingProps) {
  const reduced = useReducedMotion();
  const still = !animate || reduced;
  const final = Math.max(0, Math.min(max, value));
  const [shown, setShown] = useState(still ? final : 0);
  const gid = safeId(`pn-ring-${useId()}`);

  useEffect(() => {
    if (still) {
      setShown(final);
      return;
    }
    let raf = 0;
    let start = 0;
    const from = 0;
    const step = (now: number): void => {
      if (!start) start = now;
      const t = Math.min(1, (now - start) / duration);
      setShown(from + (final - from) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    const timer = window.setTimeout(() => {
      raf = requestAnimationFrame(step);
    }, delay);
    return () => {
      window.clearTimeout(timer);
      cancelAnimationFrame(raf);
    };
  }, [final, still, delay, duration]);

  const c = size / 2;
  const r = (size - thickness) / 2 - 3;
  const circ = 2 * Math.PI * r;
  const offset = circ * (1 - shown / max);
  const done = Math.abs(shown - final) < 0.01;
  const beaten = target !== undefined && final >= target;
  const gold = tone === 'gold' || (tone === 'auto' && beaten && done);

  let tick: { x1: number; y1: number; x2: number; y2: number } | null = null;
  if (target !== undefined) {
    const a = (Math.max(0, Math.min(max, target)) / max) * 2 * Math.PI - Math.PI / 2;
    const r1 = r - thickness / 2 - 3;
    const r2 = r + thickness / 2 + 3;
    tick = {
      x1: c + r1 * Math.cos(a),
      y1: c + r1 * Math.sin(a),
      x2: c + r2 * Math.cos(a),
      y2: c + r2 * Math.sin(a),
    };
  }

  const name =
    aria['aria-label'] ??
    `${label ?? 'Score'} ${Math.round(final)} out of ${max}` +
      (target !== undefined ? `. Bar to beat ${target}: ${beaten ? 'beaten' : 'not beaten'}` : '');

  return (
    <div
      class={cx('pn-ring', gold && 'is-gold', beaten && done && 'is-beaten', className)}
      style={{ '--ring-size': `${size}px` }}
      role="img"
      aria-label={name}
    >
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <defs>
          <linearGradient id={`${gid}-red`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
            <stop offset="0" style="stop-color: var(--color-accent-hi)" />
            <stop offset="1" style="stop-color: var(--color-accent-lo)" />
          </linearGradient>
          <linearGradient id={`${gid}-gold`} gradientUnits="userSpaceOnUse" x1="0" y1="0" x2={size} y2={size}>
            <stop offset="0" stop-color="#ffe3a3" />
            <stop offset="0.6" stop-color="#efb755" />
            <stop offset="1" stop-color="#b9781f" />
          </linearGradient>
        </defs>
        <circle class="pn-ring__track" cx={c} cy={c} r={r} stroke-width={thickness} />
        <circle
          class="pn-ring__arc"
          cx={c}
          cy={c}
          r={r}
          stroke-width={thickness}
          stroke={`url(#${gid}-${gold ? 'gold' : 'red'})`}
          stroke-dasharray={`${circ} ${circ}`}
          stroke-dashoffset={offset}
          transform={`rotate(-90 ${c} ${c})`}
          opacity={shown > 0.2 ? 1 : 0}
        />
        {tick ? <line class="pn-ring__tick" {...tick} /> : null}
      </svg>
      <div class="pn-ring__center">
        <span class="pn-ring__value">{Math.round(shown)}</span>
        {label ? <span class="pn-ring__label">{label}</span> : null}
        {target !== undefined ? (
          <span class={cx('pn-ring__target', beaten && done && 'is-beaten')}>
            {beaten && done ? <IconCheck size={14} strokeWidth={2.5} /> : null}
            {targetLabel ?? `Beat ${target}`}
          </span>
        ) : null}
      </div>
    </div>
  );
}
