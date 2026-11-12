import type { ComponentChildren } from 'preact';
import { cx } from './cx';

export type StatTone = 'default' | 'accent' | 'gold' | 'success' | 'danger';

export type StatListProps = {
  'aria-label'?: string | undefined;
  /** Hairlines between rows. Default true. */
  divided?: boolean | undefined;
  class?: string | undefined;
  children?: ComponentChildren;
};

/** A <dl> of StatRows, e.g. the score breakdown. */
export function StatList({ divided = true, class: className, children, ...aria }: StatListProps) {
  return (
    <dl class={cx('pn-stats', divided && 'pn-stats--divided', className)} aria-label={aria['aria-label']}>
      {children}
    </dl>
  );
}

export type StatRowProps = {
  label: string;
  value: ComponentChildren;
  /** Leading icon (decorative). */
  icon?: ComponentChildren;
  /** Second line under the label, e.g. "60% of your score". */
  hint?: string | undefined;
  /** 0..100: draws a slim meter under the row. */
  meter?: number | undefined;
  tone?: StatTone | undefined;
  /** Bigger value, for the total. */
  emphasis?: boolean | undefined;
  class?: string | undefined;
};

/** One label-value row. Must sit inside StatList. */
export function StatRow({ label, value, icon, hint, meter, tone = 'default', emphasis = false, class: className }: StatRowProps) {
  return (
    <div class={cx('pn-stat', `pn-stat--${tone}`, emphasis && 'pn-stat--emphasis', className)}>
      <dt class="pn-stat__label">
        {icon ? (
          <span class="pn-stat__icon" aria-hidden="true">
            {icon}
          </span>
        ) : null}
        <span class="pn-stat__text">
          <span>{label}</span>
          {hint ? <span class="pn-stat__hint">{hint}</span> : null}
        </span>
      </dt>
      <dd class="pn-stat__value pn-num">{value}</dd>
      {meter !== undefined ? (
        <dd class="pn-stat__meter" aria-hidden="true">
          <span style={{ width: `${Math.max(0, Math.min(100, meter))}%` }} />
        </dd>
      ) : null}
    </div>
  );
}
