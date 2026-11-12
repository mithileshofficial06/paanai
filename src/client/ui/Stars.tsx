import { useId } from 'preact/hooks';
import { cx, safeId } from './cx';
import { useReducedMotion } from './hooks';

export type StarsProps = {
  /** Stars earned, 0..max (1 at 70, 2 at 85, 3 at 95 in Paanai). */
  value: number;
  max?: number | undefined;
  /** px per star. Default 28. */
  size?: number | undefined;
  /** Pop the earned stars in one after another. Default true. */
  animate?: boolean | undefined;
  /** ms before the first star. */
  delay?: number | undefined;
  /** Accessible label. Default "2 of 3 stars". */
  label?: string | undefined;
  class?: string | undefined;
};

const STAR = 'M12 3.6l2.53 5.52 6.03.7-4.47 4.11 1.2 5.95L12 16.9l-5.29 2.98 1.2-5.95-4.47-4.11 6.03-.7z';

export function Stars({ value, max = 3, size = 28, animate = true, delay = 0, label, class: className }: StarsProps) {
  const reduced = useReducedMotion();
  const gid = safeId(`pn-star-${useId()}`);
  const earned = Math.max(0, Math.min(max, Math.round(value)));
  const items = Array.from({ length: max }, (_, i) => i);
  return (
    <div
      class={cx('pn-stars', animate && !reduced && 'pn-stars--animate', className)}
      role="img"
      aria-label={label ?? `${earned} of ${max} stars`}
      style={{ '--star-size': `${size}px`, '--star-delay': `${delay}ms` }}
    >
      <svg width="0" height="0" class="pn-stars__defs" aria-hidden="true" focusable="false">
        <defs>
          <linearGradient id={gid} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#ffe3a3" />
            <stop offset="0.55" stop-color="#f0b957" />
            <stop offset="1" stop-color="#c98a2c" />
          </linearGradient>
        </defs>
      </svg>
      {items.map((i) => (
        <span key={i} class={cx('pn-star', i < earned && 'is-on')} style={{ '--i': i }} aria-hidden="true">
          <svg class="pn-star__empty" viewBox="0 0 24 24" width={size} height={size}>
            <path d={STAR} fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round" />
          </svg>
          {i < earned ? (
            <svg class="pn-star__fill" viewBox="0 0 24 24" width={size} height={size}>
              <path
                d={STAR}
                fill={`url(#${gid})`}
                stroke="#ffd98a"
                stroke-opacity="0.9"
                stroke-width="1"
                stroke-linejoin="round"
              />
            </svg>
          ) : null}
        </span>
      ))}
    </div>
  );
}
