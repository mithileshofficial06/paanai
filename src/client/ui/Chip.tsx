import type { ComponentChildren, TargetedMouseEvent } from 'preact';
import { cx } from './cx';

export type Tone = 'neutral' | 'accent' | 'gold' | 'success' | 'warning' | 'danger' | 'info';

export type ChipProps = {
  tone?: Tone | undefined;
  /** Leading icon (decorative). */
  icon?: ComponentChildren;
  /** sm: 28px label chip. md: 36px. Interactive chips are always at least 44px tall. */
  size?: 'sm' | 'md' | undefined;
  /** For toggle chips: sets aria-pressed. */
  selected?: boolean | undefined;
  /** Makes the chip a button. */
  onClick?: ((e: TargetedMouseEvent<HTMLButtonElement>) => void) | undefined;
  disabled?: boolean | undefined;
  title?: string | undefined;
  class?: string | undefined;
  children?: ComponentChildren;
};

/** Small labelled pill: formats, constraints, atmosphere, filters. */
export function Chip({
  tone = 'neutral',
  icon,
  size = 'md',
  selected,
  onClick,
  disabled = false,
  title,
  class: className,
  children,
}: ChipProps) {
  const classes = cx(
    'pn-chip',
    `pn-chip--${tone}`,
    `pn-chip--${size}`,
    onClick && 'pn-chip--interactive',
    selected && 'is-selected',
    className,
  );
  const body = (
    <>
      {icon ? (
        <span class="pn-chip__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span class="pn-chip__label">{children}</span>
    </>
  );
  if (onClick) {
    return (
      <button
        type="button"
        class={classes}
        title={title}
        disabled={disabled}
        aria-pressed={selected === undefined ? undefined : selected ? 'true' : 'false'}
        onClick={onClick}
      >
        {body}
      </button>
    );
  }
  return (
    <span class={classes} title={title}>
      {body}
    </span>
  );
}

/** Alias: some screens call these tags. */
export const Tag = Chip;

export type BadgeProps = {
  /** solid: filled red count badge. Others: tinted label badges. */
  tone?: Tone | 'solid' | undefined;
  /** Just a dot (e.g. "something new here"). Provide aria-label if it carries meaning. */
  dot?: boolean | undefined;
  'aria-label'?: string | undefined;
  class?: string | undefined;
  children?: ComponentChildren;
};

/** Compact status or count: "New", "Ranked", "Practice", "3". */
export function Badge({ tone = 'accent', dot = false, class: className, children, ...aria }: BadgeProps) {
  return (
    <span
      class={cx('pn-badge', `pn-badge--${tone}`, dot && 'pn-badge--dot', className)}
      role={aria['aria-label'] ? 'img' : undefined}
      aria-label={aria['aria-label']}
    >
      {dot ? null : children}
    </span>
  );
}
