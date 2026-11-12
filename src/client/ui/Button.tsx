import type { ButtonHTMLAttributes, ComponentChildren } from 'preact';
import { cx } from './cx';

export type ButtonVariant = 'primary' | 'secondary' | 'ghost';
export type ButtonSize = 'sm' | 'md' | 'lg';

type NativeButtonProps = Omit<
  ButtonHTMLAttributes<HTMLButtonElement>,
  'class' | 'className' | 'disabled' | 'type' | 'size' | 'icon' | 'loading' | 'label'
>;

export type ButtonProps = NativeButtonProps & {
  /** primary: glowing red (one per screen). secondary: glass. ghost: text only. */
  variant?: ButtonVariant | undefined;
  /** sm 44px, md 48px, lg 56px tall. Every size meets the 44px touch target. */
  size?: ButtonSize | undefined;
  /** Shows a spinner, keeps focus and width, ignores clicks, sets aria-busy. */
  loading?: boolean | undefined;
  /** Screen-reader text announced while loading. */
  loadingLabel?: string | undefined;
  disabled?: boolean | undefined;
  /** Leading icon (decorative). */
  icon?: ComponentChildren;
  /** Trailing icon (decorative), e.g. a chevron. */
  iconEnd?: ComponentChildren;
  /** Full width. */
  block?: boolean | undefined;
  type?: 'button' | 'submit' | 'reset' | undefined;
  class?: string | undefined;
  children?: ComponentChildren;
};

export function Spinner({ size = 20, class: className }: { size?: number | undefined; class?: string | undefined }) {
  return (
    <svg class={cx('pn-spinner', className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-opacity="0.22" stroke-width="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
    </svg>
  );
}

/**
 * Buttons. Pass the click event through untouched: Devvit's requestExpandedMode needs the
 * trusted event synchronously.
 */
export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  loadingLabel = 'Working',
  disabled = false,
  icon,
  iconEnd,
  block = false,
  type = 'button',
  class: className,
  children,
  onClick,
  ...rest
}: ButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      class={cx(
        'pn-btn',
        `pn-btn--${variant}`,
        `pn-btn--${size}`,
        block && 'pn-btn--block',
        loading && 'is-loading',
        className,
      )}
      disabled={disabled}
      aria-disabled={loading ? 'true' : undefined}
      aria-busy={loading ? 'true' : undefined}
      onClick={loading ? undefined : onClick}
    >
      {loading ? (
        <Spinner class="pn-btn__icon" />
      ) : icon ? (
        <span class="pn-btn__icon" aria-hidden="true">
          {icon}
        </span>
      ) : null}
      <span class="pn-btn__label">{children}</span>
      {iconEnd && !loading ? (
        <span class="pn-btn__icon pn-btn__icon--end" aria-hidden="true">
          {iconEnd}
        </span>
      ) : null}
      {loading ? <span class="pn-sr-only">{loadingLabel}</span> : null}
    </button>
  );
}

export type IconButtonVariant = 'glass' | 'ghost' | 'primary';

export type IconButtonProps = NativeButtonProps & {
  /** Accessible name (required: the button has no visible text). */
  label: string;
  icon: ComponentChildren;
  variant?: IconButtonVariant | undefined;
  /** md 44px, lg 52px. */
  size?: 'md' | 'lg' | undefined;
  /** Toggle state (sets aria-pressed), e.g. sound on/off or ghost on/off. */
  pressed?: boolean | undefined;
  disabled?: boolean | undefined;
  /** Small count or dot in the corner. */
  badge?: ComponentChildren;
  type?: 'button' | 'submit' | 'reset' | undefined;
  class?: string | undefined;
};

export function IconButton({
  label,
  icon,
  variant = 'glass',
  size = 'md',
  pressed,
  disabled = false,
  badge,
  type = 'button',
  class: className,
  ...rest
}: IconButtonProps) {
  return (
    <button
      {...rest}
      type={type}
      class={cx('pn-iconbtn', `pn-iconbtn--${variant}`, `pn-iconbtn--${size}`, pressed && 'is-pressed', className)}
      aria-label={label}
      aria-pressed={pressed === undefined ? undefined : pressed ? 'true' : 'false'}
      disabled={disabled}
    >
      <span class="pn-iconbtn__icon" aria-hidden="true">
        {icon}
      </span>
      {badge !== undefined && badge !== null && badge !== false ? (
        <span class="pn-iconbtn__badge" aria-hidden="true">
          {badge}
        </span>
      ) : null}
    </button>
  );
}
