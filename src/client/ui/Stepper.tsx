import { cx } from './cx';

export type StepperProps = {
  count: number;
  /** Current step, 0-based. */
  index: number;
  /** Makes each dot a button (44px touch target). */
  onSelect?: ((index: number) => void) | undefined;
  /** Accessible name for the group. Default "Steps". */
  label?: string | undefined;
  class?: string | undefined;
};

/** Progress dots; the current one stretches into a glowing pill. */
export function Stepper({ count, index, onSelect, label = 'Steps', class: className }: StepperProps) {
  const dots = Array.from({ length: count }, (_, i) => i);
  if (!onSelect) {
    return (
      <div
        class={cx('pn-stepper', className)}
        role="img"
        aria-label={`${label}: ${index + 1} of ${count}`}
      >
        {dots.map((i) => (
          <span key={i} class={cx('pn-stepper__dot', i === index && 'is-current', i < index && 'is-done')} />
        ))}
      </div>
    );
  }
  return (
    <div class={cx('pn-stepper pn-stepper--interactive', className)} role="group" aria-label={label}>
      {dots.map((i) => (
        <button
          key={i}
          type="button"
          class={cx('pn-stepper__hit', i === index && 'is-current', i < index && 'is-done')}
          aria-label={`Step ${i + 1} of ${count}`}
          aria-current={i === index ? 'step' : undefined}
          onClick={() => onSelect(i)}
        >
          <span class="pn-stepper__dot" />
        </button>
      ))}
    </div>
  );
}
