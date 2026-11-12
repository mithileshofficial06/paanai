import type { RefObject } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/**
 * True when motion should be minimal: the OS asks for reduced motion, or the page sets
 * <html data-motion="static"> (used for deterministic screenshots).
 */
export function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  if (document.documentElement.getAttribute('data-motion') === 'static') return true;
  return window.matchMedia(REDUCED_QUERY).matches;
}

/** Reactive version of prefersReducedMotion(). */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(prefersReducedMotion);
  useEffect(() => {
    const mq = window.matchMedia(REDUCED_QUERY);
    const update = (): void => setReduced(prefersReducedMotion());
    mq.addEventListener('change', update);
    const mo = new MutationObserver(update);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-motion'] });
    return () => {
      mq.removeEventListener('change', update);
      mo.disconnect();
    };
  }, []);
  return reduced;
}

/** Keeps a ref pointing at the latest value, for callbacks used inside long-lived effects. */
export function useLatest<T>(value: T): RefObject<T> {
  const ref = useRef(value);
  ref.current = value;
  return ref;
}

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'iframe',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

/** Visible, enabled, tabbable elements inside root, in DOM order. */
export function focusableWithin(root: HTMLElement): HTMLElement[] {
  const out: HTMLElement[] = [];
  root.querySelectorAll<HTMLElement>(FOCUSABLE).forEach((el) => {
    if (!el.closest('[inert]') && el.getClientRects().length > 0) out.push(el);
  });
  return out;
}

type FocusTrapOptions = {
  onEscape?: (() => void) | undefined;
  restoreFocus?: boolean | undefined;
  /** Where focus goes on activation when nothing has [data-autofocus]. Default 'first'. */
  initialFocus?: 'first' | 'container' | undefined;
};

/** Only the most recently activated trap handles keys (nested sheets). */
const trapStack: symbol[] = [];

/**
 * While `active`, keeps keyboard focus inside `ref`:
 * - moves focus in on activation: [data-autofocus], else the first focusable (or the
 *   container itself with initialFocus: 'container', so screen readers read the dialog title)
 * - wraps Tab and Shift+Tab
 * - calls onEscape on Esc
 * - restores the previously focused element when released
 */
export function useFocusTrap(
  ref: RefObject<HTMLElement | null>,
  active: boolean,
  options: FocusTrapOptions = {},
): void {
  const onEscape = useLatest(options.onEscape);
  const restore = options.restoreFocus !== false;
  const toContainer = options.initialFocus === 'container';

  useEffect(() => {
    if (!active) return;
    const root = ref.current;
    if (!root) return;
    const token = Symbol('focus-trap');
    trapStack.push(token);
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const initial =
      root.querySelector<HTMLElement>('[data-autofocus]') ?? (toContainer ? root : focusableWithin(root)[0]) ?? root;
    initial.focus({ preventScroll: true });

    const onKey = (e: KeyboardEvent): void => {
      if (trapStack[trapStack.length - 1] !== token) return;
      if (e.key === 'Escape') {
        const cb = onEscape.current;
        if (cb) {
          e.preventDefault();
          e.stopPropagation();
          cb();
        }
        return;
      }
      if (e.key !== 'Tab') return;
      const items = focusableWithin(root);
      const first = items[0];
      const last = items[items.length - 1];
      if (!first || !last) {
        e.preventDefault();
        root.focus();
        return;
      }
      const current = document.activeElement;
      const outside = !(current instanceof Node) || !root.contains(current);
      if (e.shiftKey && (current === first || outside)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (current === last || outside)) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', onKey, true);
    return () => {
      document.removeEventListener('keydown', onKey, true);
      const at = trapStack.indexOf(token);
      if (at >= 0) trapStack.splice(at, 1);
      if (restore && previous && previous.isConnected) previous.focus({ preventScroll: true });
    };
  }, [active, ref, restore, toContainer, onEscape]);
}

/**
 * While `active`, marks every other child of <body> as inert so screen readers and the
 * keyboard cannot reach content behind a modal. `keep` is the modal's own body-level host.
 */
export function useInertOutside(keep: HTMLElement | null, active: boolean): void {
  useEffect(() => {
    if (!active || !keep) return;
    const changed: HTMLElement[] = [];
    for (const child of Array.from(document.body.children)) {
      if (child === keep || !(child instanceof HTMLElement)) continue;
      if (child.inert || child.tagName === 'SCRIPT' || child.tagName === 'STYLE') continue;
      child.inert = true;
      changed.push(child);
    }
    return () => {
      for (const el of changed) el.inert = false;
    };
  }, [keep, active]);
}

/** Creates a <div> appended to <body> for the component's lifetime (portal target). */
export function useBodyHost(className: string): HTMLElement | null {
  const [host] = useState<HTMLElement | null>(() => {
    if (typeof document === 'undefined') return null;
    const el = document.createElement('div');
    el.className = className;
    return el;
  });
  useLayoutEffect(() => {
    if (!host) return;
    document.body.appendChild(host);
    return () => {
      host.remove();
    };
  }, [host]);
  return host;
}
