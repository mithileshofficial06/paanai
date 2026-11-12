import type { ComponentChildren } from 'preact';
import { Button } from './Button';
import { cx } from './cx';
import { IconCrackedPot, IconRetry, IconShelf } from './icons';

export type EmptyStateProps = {
  /** Icon inside the glass medallion. Default: the shelf. */
  icon?: ComponentChildren;
  title: string;
  description?: string | undefined;
  /** Usually one Button. */
  action?: ComponentChildren;
  /** Smaller version for use inside cards. */
  compact?: boolean | undefined;
  class?: string | undefined;
};

/** Nothing to show yet: an empty shelf, no discoveries, no commissions. */
export function EmptyState({ icon, title, description, action, compact = false, class: className }: EmptyStateProps) {
  return (
    <div class={cx('pn-state', compact && 'pn-state--compact', className)}>
      <div class="pn-medallion" aria-hidden="true">
        {icon ?? <IconShelf size={28} />}
      </div>
      <h3 class="pn-state__title pn-title">{title}</h3>
      {description ? <p class="pn-state__text pn-body">{description}</p> : null}
      {action ? <div class="pn-state__action">{action}</div> : null}
    </div>
  );
}

export type ErrorStateProps = {
  title?: string | undefined;
  description?: string | undefined;
  onRetry: () => void;
  /** Spinner on the retry button while the retry runs. */
  retrying?: boolean | undefined;
  retryLabel?: string | undefined;
  compact?: boolean | undefined;
  class?: string | undefined;
};

/** Something failed to load. Always offers a retry. Announced to screen readers. */
export function ErrorState({
  title = "This didn't load",
  description = 'Check your connection, then try again.',
  onRetry,
  retrying = false,
  retryLabel = 'Try again',
  compact = false,
  class: className,
}: ErrorStateProps) {
  return (
    <div class={cx('pn-state pn-state--error', compact && 'pn-state--compact', className)} role="alert">
      <div class="pn-medallion pn-medallion--danger" aria-hidden="true">
        <IconCrackedPot size={28} />
      </div>
      <h3 class="pn-state__title pn-title">{title}</h3>
      {description ? <p class="pn-state__text pn-body">{description}</p> : null}
      <div class="pn-state__action">
        <Button
          variant="secondary"
          icon={<IconRetry size={20} />}
          loading={retrying}
          loadingLabel="Retrying"
          onClick={() => onRetry()}
        >
          {retryLabel}
        </Button>
      </div>
    </div>
  );
}
