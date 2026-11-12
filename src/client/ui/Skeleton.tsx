import { cx } from './cx';

export type SkeletonProps = {
  /** rect (default), text (one line, or `lines` lines), circle. */
  shape?: 'rect' | 'text' | 'circle' | undefined;
  /** px number or CSS length. */
  width?: number | string | undefined;
  height?: number | string | undefined;
  radius?: number | string | undefined;
  /** For shape="text": number of lines; the last is shorter. */
  lines?: number | undefined;
  class?: string | undefined;
};

function len(v: number | string | undefined): string | undefined {
  return typeof v === 'number' ? `${v}px` : v;
}

/**
 * Loading placeholder with a slow sheen. Decorative: put aria-busy="true" and a
 * visually hidden "Loading" label on the region that is loading.
 */
export function Skeleton({ shape = 'rect', width, height, radius, lines = 1, class: className }: SkeletonProps) {
  if (shape === 'text' && lines > 1) {
    return (
      <div class={cx('pn-skeleton-lines', className)} aria-hidden="true" style={{ width: len(width) }}>
        {Array.from({ length: lines }, (_, i) => (
          <span
            key={i}
            class="pn-skeleton pn-skeleton--text"
            style={{ width: i === lines - 1 ? '62%' : '100%', height: len(height) }}
          />
        ))}
      </div>
    );
  }
  return (
    <span
      class={cx('pn-skeleton', `pn-skeleton--${shape}`, className)}
      aria-hidden="true"
      style={{ width: len(width), height: len(height), borderRadius: len(radius) }}
    />
  );
}
