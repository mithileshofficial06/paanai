import { useEffect, useState } from 'preact/hooks';
import { cx } from './cx';
import { useReducedMotion } from './hooks';

export type ProgressBarProps = {
  value: number;
  max?: number | undefined;
  /** Accessible name. Shown above the bar when showLabel is true. */
  label: string;
  showLabel?: boolean | undefined;
  /** Show the value at the right of the label row. */
  showValue?: boolean | undefined;
  /** Text for the value (and aria-valuetext), e.g. "11 of 24". Defaults to the number. */
  valueText?: string | undefined;
  tone?: 'accent' | 'gold' | 'success' | 'neutral' | undefined;
  /** sm 4px, md 8px, lg 12px track. */
  size?: 'sm' | 'md' | 'lg' | undefined;
  /** A tick on the track, e.g. the commissioner's score to beat. */
  marker?: number | undefined;
  markerLabel?: string | undefined;
  /** Grow from zero on mount. Default true (skipped with reduced motion). */
  animate?: boolean | undefined;
  class?: string | undefined;
};

function pct(v: number, max: number): number {
  if (!(max > 0)) return 0;
  return Math.min(100, Math.max(0, (v / max) * 100));
}

export function ProgressBar({
  value,
  max = 100,
  label,
  showLabel = false,
  showValue = false,
  valueText,
  tone = 'accent',
  size = 'md',
  marker,
  markerLabel,
  animate = true,
  class: className,
}: ProgressBarProps) {
  const reduced = useReducedMotion();
  const [grown, setGrown] = useState(!animate || reduced);
  useEffect(() => {
    if (grown) return;
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setGrown(true)));
    return () => cancelAnimationFrame(id);
  }, [grown]);

  const fill = grown ? pct(value, max) : 0;
  const text = valueText ?? String(Math.round(value));
  return (
    <div class={cx('pn-progress', `pn-progress--${tone}`, `pn-progress--${size}`, className)}>
      {showLabel || showValue ? (
        <div class="pn-progress__head">
          {showLabel ? <span class="pn-progress__label">{label}</span> : <span />}
          {showValue ? <span class="pn-progress__value pn-num">{text}</span> : null}
        </div>
      ) : null}
      <div
        class="pn-progress__track"
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={max}
        aria-valuenow={Math.round(value)}
        aria-valuetext={valueText}
      >
        <div class="pn-progress__fill" style={{ width: `${fill}%` }} />
        {marker !== undefined ? (
          <div class="pn-progress__marker" style={{ left: `${pct(marker, max)}%` }} title={markerLabel}>
            {markerLabel ? <span class="pn-sr-only">{markerLabel}</span> : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}
