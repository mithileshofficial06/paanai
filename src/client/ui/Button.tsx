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
    // A tiny pot turning on a wheel: the clay's throwing lines slide across it.
    <svg class={cx('pn-spinner', className)} width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <clipPath id="pn-spin-pot">
          <path d="M8.2 4.5h7.6c-.6 1.3-.4 2.4.6 3.6 1.4 1.7 2.2 3.6 1.6 6-.4 1.7-1.3 3-2.3 3.9H8.3c-1-.9-1.9-2.2-2.3-3.9-.6-2.4.2-4.3 1.6-6 1-1.2 1.2-2.3.6-3.6Z" />
        </clipPath>
      </defs>
      <ellipse cx="12" cy="19.6" rx="8.5" ry="2" fill="currentColor" opacity="0.28" />
      <path d="M8.2 4.5h7.6c-.6 1.3-.4 2.4.6 3.6 1.4 1.7 2.2 3.6 1.6 6-.4 1.7-1.3 3-2.3 3.9H8.3c-1-.9-1.9-2.2-2.3-3.9-.6-2.4.2-4.3 1.6-6 1-1.2 1.2-2.3.6-3.6Z" fill="currentColor" opacity="0.4" />
      <g clip-path="url(#pn-spin-pot)">
        <g class="pn-spinner__lines">
          <path d="M-6 6v14M-2 6v14M2 6v14M6 6v14M10 6v14M14 6v14M18 6v14M22 6v14M26 6v14" stroke="currentColor" stroke-width="1.4" />
        </g>
      </g>
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
