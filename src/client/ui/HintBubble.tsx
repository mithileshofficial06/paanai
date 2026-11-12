import type { ComponentChildren } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from './cx';

export type HintPlacement = 'top' | 'bottom' | 'left' | 'right';

export type HintBubbleProps = {
  /** Anchor point in px: relative to the nearest positioned ancestor, or the viewport when `fixed`. */
  x: number;
  y: number;
  /** Side of the anchor the bubble sits on; the arrow points back at the anchor. Default 'top'. */
  placement?: HintPlacement | undefined;
  title?: string | undefined;
  /** The hint, one short sentence. */
  children: ComponentChildren;
  /** "Hint 1 of 3". */
  step?: { index: number; total: number } | undefined;
  onDismiss: () => void;
  dismissLabel?: string | undefined;
  /** Pulsing ring on the anchor (e.g. "tap the centre"). */
  showTarget?: boolean | undefined;
  /** Position against the viewport instead of the positioned ancestor. */
  fixed?: boolean | undefined;
  /** Max bubble width, px. Default 280. */
  maxWidth?: number | undefined;
  /** Leading icon (decorative). */
  icon?: ComponentChildren;
  class?: string | undefined;
};

const EDGE = 12;

/**
 * A contextual first-throw hint: a glass bubble with a pointer arrow, positioned by props.
 * It slides along its edge to stay inside its container while the arrow keeps pointing at
 * the anchor. Non-modal; announced politely.
 */
export function HintBubble({
  x,
  y,
  placement = 'top',
  title,
  children,
  step,
  onDismiss,
  dismissLabel = 'Got it',
  showTarget = false,
  fixed = false,
  maxWidth = 280,
  icon,
  class: className,
}: HintBubbleProps) {
  const bubbleRef = useRef<HTMLDivElement>(null);
  const [shift, setShift] = useState(0);
  const vertical = placement === 'top' || placement === 'bottom';

  useLayoutEffect(() => {
    const bubble = bubbleRef.current;
    if (!bubble) return;
    const measure = (): void => {
      const parent = fixed ? null : bubble.closest('.pn-hint')?.parentElement;
      const bounds = parent
        ? parent.getBoundingClientRect()
        : { left: 0, top: 0, right: window.innerWidth, bottom: window.innerHeight };
      const rect = bubble.getBoundingClientRect();
      setShift((prev) => {
        // Undo the current shift to get the natural (centred) position, then clamp.
        const lo = vertical ? rect.left - prev : rect.top - prev;
        const hi = vertical ? rect.right - prev : rect.bottom - prev;
        const min = (vertical ? bounds.left : bounds.top) + EDGE;
        const max = (vertical ? bounds.right : bounds.bottom) - EDGE;
        let next = 0;
        if (lo < min) next = min - lo;
        else if (hi > max) next = max - hi;
        const size = vertical ? rect.width : rect.height;
        const limit = Math.max(0, size / 2 - 22);
        return Math.max(-limit, Math.min(limit, next));
      });
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [x, y, placement, fixed, vertical, maxWidth]);

  return (
    <div
      class={cx('pn-hint', `pn-hint--${placement}`, fixed && 'pn-hint--fixed', className)}
      style={{ left: `${x}px`, top: `${y}px`, '--hint-max': `${maxWidth}px`, '--hint-shift': `${shift}px` }}
    >
      {showTarget ? <span class="pn-hint__target" aria-hidden="true" /> : null}
      <div ref={bubbleRef} class="pn-hint__bubble" role="status">
        <span class="pn-hint__arrow" aria-hidden="true" />
        <div class="pn-hint__content">
          {icon ? (
            <span class="pn-hint__icon" aria-hidden="true">
              {icon}
            </span>
          ) : null}
          <div class="pn-hint__text">
            {step ? (
              <span class="pn-hint__step">
                Hint {step.index + 1} of {step.total}
              </span>
            ) : null}
            {title ? <strong class="pn-hint__title">{title}</strong> : null}
            <p class="pn-hint__body">{children}</p>
          </div>
        </div>
        <button type="button" class="pn-hint__dismiss" onClick={() => onDismiss()}>
          {dismissLabel}
        </button>
      </div>
    </div>
  );
}
