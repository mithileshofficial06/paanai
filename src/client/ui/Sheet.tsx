import { createPortal, type ComponentChildren, type TargetedPointerEvent } from 'preact';
import { useEffect, useId, useRef, useState } from 'preact/hooks';
import { IconButton } from './Button';
import { cx, safeId } from './cx';
import { useBodyHost, useFocusTrap, useInertOutside, useReducedMotion } from './hooks';
import { IconClose } from './icons';

export type SheetProps = {
  open: boolean;
  /** Called on Esc, backdrop tap, close button or drag-down. The parent sets open={false}. */
  onClose: () => void;
  title: string;
  eyebrow?: string | undefined;
  description?: string | undefined;
  children?: ComponentChildren;
  /** Sticky actions at the bottom, e.g. a primary Button. */
  footer?: ComponentChildren;
  /** auto: as tall as its content (max 88%). tall: always 88% of the viewport. */
  size?: 'auto' | 'tall' | undefined;
  /** Esc, backdrop, close button and drag-to-dismiss. Default true. */
  dismissible?: boolean | undefined;
  /** Keep the title for screen readers but hide it visually. */
  hideTitle?: boolean | undefined;
  closeLabel?: string | undefined;
  class?: string | undefined;
};

type Drag = { id: number; startY: number; lastY: number; lastT: number; v: number };

const EXIT_MS = 260;
const EXIT_MS_REDUCED = 130;

/**
 * Bottom sheet on phones, centred dialog from 720px. Modal: renders into a <body>-level
 * portal, marks the rest of the page inert, traps focus, closes on Esc, backdrop tap or a
 * downward drag on the handle, and returns focus to whatever opened it.
 */
export function Sheet({
  open,
  onClose,
  title,
  eyebrow,
  description,
  children,
  footer,
  size = 'auto',
  dismissible = true,
  hideTitle = false,
  closeLabel = 'Close',
  class: className,
}: SheetProps) {
  const reduced = useReducedMotion();
  const host = useBodyHost('pn-portal');
  const panelRef = useRef<HTMLDivElement>(null);
  const drag = useRef<Drag | null>(null);
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  const uid = safeId(`pn-sheet-${useId()}`);

  useEffect(() => {
    if (open) {
      setMounted(true);
      setClosing(false);
      return;
    }
    if (!mounted) return;
    setClosing(true);
    const t = window.setTimeout(
      () => {
        setMounted(false);
        setClosing(false);
      },
      reduced ? EXIT_MS_REDUCED : EXIT_MS,
    );
    return () => window.clearTimeout(t);
  }, [open, reduced]);

  const active = mounted && !closing;
  useInertOutside(host, active);
  useFocusTrap(panelRef, active, { onEscape: dismissible ? onClose : undefined, initialFocus: 'container' });

  const onPointerDown = (e: TargetedPointerEvent<HTMLDivElement>): void => {
    if (!dismissible || (e.pointerType === 'mouse' && e.button !== 0)) return;
    if (e.target instanceof Element && e.target.closest('button, a, input, select, textarea')) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, startY: e.clientY, lastY: e.clientY, lastT: e.timeStamp, v: 0 };
    panelRef.current?.classList.add('is-dragging');
  };
  const onPointerMove = (e: TargetedPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    const dt = Math.max(1, e.timeStamp - d.lastT);
    d.v = (e.clientY - d.lastY) / dt;
    d.lastY = e.clientY;
    d.lastT = e.timeStamp;
    panelRef.current?.style.setProperty('--drag-y', `${Math.max(0, e.clientY - d.startY)}px`);
  };
  const onPointerEnd = (e: TargetedPointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    const panel = panelRef.current;
    if (!panel) return;
    panel.classList.remove('is-dragging');
    const dy = Math.max(0, e.clientY - d.startY);
    if (e.type !== 'pointercancel' && (dy > Math.min(140, panel.offsetHeight * 0.3) || (dy > 24 && d.v > 0.6))) {
      onClose();
    } else {
      panel.style.setProperty('--drag-y', '0px');
    }
  };

  if (!mounted || !host) return null;

  return createPortal(
    <div class={cx('pn-sheet', `pn-sheet--${size}`, closing && 'is-closing', className)}>
      <div class="pn-sheet__backdrop" aria-hidden="true" onClick={dismissible ? () => onClose() : undefined} />
      <div
        ref={panelRef}
        class="pn-sheet__panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby={`${uid}-title`}
        aria-describedby={description ? `${uid}-desc` : undefined}
        tabIndex={-1}
      >
        <div
          class="pn-sheet__grip"
          onPointerDown={onPointerDown}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerEnd}
          onPointerCancel={onPointerEnd}
        >
          <span class="pn-sheet__handle" aria-hidden="true" />
          <header class="pn-sheet__header">
            <div class="pn-sheet__titles">
              {eyebrow ? <span class="pn-eyebrow">{eyebrow}</span> : null}
              <h2 id={`${uid}-title`} class={cx('pn-sheet__title pn-headline', hideTitle && 'pn-sr-only')}>
                {title}
              </h2>
              {description ? (
                <p id={`${uid}-desc`} class="pn-sheet__desc pn-body">
                  {description}
                </p>
              ) : null}
            </div>
            {dismissible ? (
              <IconButton
                class="pn-sheet__close"
                label={closeLabel}
                icon={<IconClose size={22} />}
                variant="ghost"
                onClick={() => onClose()}
              />
            ) : null}
          </header>
        </div>
        <div class="pn-sheet__body pn-scroll">{children}</div>
        {footer ? <footer class="pn-sheet__footer">{footer}</footer> : null}
      </div>
    </div>,
    host,
  );
}
