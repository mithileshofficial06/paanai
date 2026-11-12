import { signal } from '@preact/signals';
import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { IconButton } from './Button';
import { cx } from './cx';
import { IconCheck, IconClose, IconCrackedPot, IconInfo, IconSparkle } from './icons';

export type ToastTone = 'neutral' | 'success' | 'accent' | 'gold' | 'danger';

export type ToastInput = {
  title: string;
  description?: string | undefined;
  tone?: ToastTone | undefined;
  /** Replaces the tone's default icon. */
  icon?: ComponentChildren;
  /** ms before it leaves; 0 keeps it until dismissed. Default 3600. Paused on hover/focus. */
  duration?: number | undefined;
  action?: { label: string; onClick: () => void } | undefined;
};

type ToastItem = ToastInput & { id: number; leaving: boolean };

/** At most this many toasts show at once; older ones leave first. */
const MAX_TOASTS = 3;
const LEAVE_MS = 240;

const toasts = signal<ToastItem[]>([]);
let nextId = 1;

/** Shows an in-app toast (glass). Returns its id. Needs one <ToastHost /> mounted. */
export function pushToast(input: ToastInput): number {
  const id = nextId++;
  const kept = toasts.value.filter((t) => !t.leaving);
  const overflow = kept.length - (MAX_TOASTS - 1);
  for (let i = 0; i < overflow; i++) {
    const old = kept[i];
    if (old) dismissToast(old.id);
  }
  toasts.value = [...toasts.value, { ...input, id, leaving: false }];
  return id;
}

export function dismissToast(id: number): void {
  if (!toasts.value.some((t) => t.id === id && !t.leaving)) return;
  toasts.value = toasts.value.map((t) => (t.id === id ? { ...t, leaving: true } : t));
  window.setTimeout(() => {
    toasts.value = toasts.value.filter((t) => t.id !== id);
  }, LEAVE_MS);
}

export function clearToasts(): void {
  toasts.value = [];
}

export type ToastHostProps = {
  /** top: under the safe area (default). bottom: above a bottom nav. */
  placement?: 'top' | 'bottom' | undefined;
  class?: string | undefined;
};

/** Mount once near the root, outside any glass panel. A polite live region. */
export function ToastHost({ placement = 'top', class: className }: ToastHostProps) {
  const list = toasts.value;
  return (
    <section
      class={cx('pn-toasts', `pn-toasts--${placement}`, className)}
      aria-label="Notifications"
      aria-live="polite"
      aria-relevant="additions"
    >
      {list.map((t) => (
        <ToastView key={t.id} toast={t} />
      ))}
    </section>
  );
}

function toneIcon(tone: ToastTone): ComponentChildren {
  switch (tone) {
    case 'success':
      return <IconCheck size={20} />;
    case 'gold':
    case 'accent':
      return <IconSparkle size={20} />;
    case 'danger':
      return <IconCrackedPot size={20} />;
    default:
      return <IconInfo size={20} />;
  }
}

function ToastView({ toast }: { toast: ToastItem }) {
  const { id, title, description, tone = 'neutral', icon, duration = 3600, action, leaving } = toast;
  const timer = useRef({ handle: 0, remaining: duration, started: 0 });

  const stop = (): void => {
    const t = timer.current;
    if (!t.handle) return;
    window.clearTimeout(t.handle);
    t.handle = 0;
    t.remaining -= Date.now() - t.started;
  };
  const start = (): void => {
    const t = timer.current;
    if (duration <= 0 || t.handle) return;
    t.started = Date.now();
    t.handle = window.setTimeout(() => dismissToast(id), Math.max(800, t.remaining));
  };

  useEffect(() => {
    start();
    return stop;
    // start/stop only touch the ref; re-run only for a new toast.
  }, [id, duration]);

  return (
    <div
      class={cx('pn-toast', `pn-toast--${tone}`, leaving && 'is-leaving')}
      role={tone === 'danger' ? 'alert' : 'status'}
      onPointerEnter={stop}
      onPointerLeave={start}
      onFocusIn={stop}
      onFocusOut={start}
    >
      <span class="pn-toast__icon" aria-hidden="true">
        {icon ?? toneIcon(tone)}
      </span>
      <div class="pn-toast__text">
        <p class="pn-toast__title">{title}</p>
        {description ? <p class="pn-toast__desc">{description}</p> : null}
      </div>
      {action ? (
        <button
          type="button"
          class="pn-toast__action"
          onClick={() => {
            action.onClick();
            dismissToast(id);
          }}
        >
          {action.label}
        </button>
      ) : null}
      <IconButton
        class="pn-toast__close"
        label="Dismiss"
        variant="ghost"
        icon={<IconClose size={18} />}
        onClick={() => dismissToast(id)}
      />
    </div>
  );
}
