import type { ComponentChildren, TargetedKeyboardEvent } from 'preact';
import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import { cx } from './cx';

export type TabItem = {
  id: string;
  label: string;
  icon?: ComponentChildren;
  badge?: ComponentChildren;
  disabled?: boolean | undefined;
};

export type TabsProps = {
  items: TabItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name of the tab list. */
  label: string;
  /** Wire tabs to panels: returns the panel element id for a tab (sets aria-controls). */
  panelIdFor?: ((id: string) => string) | undefined;
  /** Returns the tab element id (so panels can use aria-labelledby). */
  tabIdFor?: ((id: string) => string) | undefined;
  /** Equal-width tabs filling the row. */
  fitted?: boolean | undefined;
  class?: string | undefined;
};

/**
 * Segmented tabs with a sliding glass indicator. WAI-ARIA tabs pattern: roving tabindex,
 * Left/Right/Home/End move and select.
 */
export function Tabs({ items, value, onChange, label, panelIdFor, tabIdFor, fitted = false, class: className }: TabsProps) {
  const listRef = useRef<HTMLDivElement>(null);
  const [indicator, setIndicator] = useState<{ x: number; w: number } | null>(null);
  const [ready, setReady] = useState(false);

  useLayoutEffect(() => {
    const list = listRef.current;
    if (!list) return;
    const measure = (): void => {
      const el = list.querySelector<HTMLElement>('[aria-selected="true"]');
      setIndicator(el ? { x: el.offsetLeft, w: el.offsetWidth } : null);
    };
    measure();
    const raf = requestAnimationFrame(() => setReady(true));
    const ro = new ResizeObserver(measure);
    ro.observe(list);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
    };
  }, [value, items]);

  const onKeyDown = (e: TargetedKeyboardEvent<HTMLDivElement>): void => {
    const enabled = items.filter((i) => !i.disabled);
    const at = enabled.findIndex((i) => i.id === value);
    let next = -1;
    if (e.key === 'ArrowRight') next = (at + 1) % enabled.length;
    else if (e.key === 'ArrowLeft') next = (at - 1 + enabled.length) % enabled.length;
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = enabled.length - 1;
    const item = enabled[next];
    if (!item) return;
    e.preventDefault();
    onChange(item.id);
    const index = items.indexOf(item);
    requestAnimationFrame(() => {
      listRef.current?.querySelectorAll<HTMLElement>('[role="tab"]')[index]?.focus();
    });
  };

  return (
    <div
      ref={listRef}
      class={cx('pn-tabs', fitted && 'pn-tabs--fitted', ready && 'is-ready', className)}
      role="tablist"
      aria-label={label}
      onKeyDown={onKeyDown}
    >
      {indicator ? (
        <span
          class="pn-tabs__indicator"
          aria-hidden="true"
          style={{ transform: `translateX(${indicator.x}px)`, width: `${indicator.w}px` }}
        />
      ) : null}
      {items.map((item) => {
        const selected = item.id === value;
        return (
          <button
            key={item.id}
            type="button"
            role="tab"
            id={tabIdFor?.(item.id)}
            aria-controls={panelIdFor?.(item.id)}
            aria-selected={selected ? 'true' : 'false'}
            tabIndex={selected ? 0 : -1}
            disabled={item.disabled}
            class={cx('pn-tab', selected && 'is-selected')}
            onClick={() => onChange(item.id)}
          >
            {item.icon ? (
              <span class="pn-tab__icon" aria-hidden="true">
                {item.icon}
              </span>
            ) : null}
            <span class="pn-tab__label">{item.label}</span>
            {item.badge !== undefined && item.badge !== null ? <span class="pn-tab__badge">{item.badge}</span> : null}
          </button>
        );
      })}
    </div>
  );
}

export type NavItem = {
  id: string;
  label: string;
  icon: ComponentChildren;
  /** Count or dot shown on the icon. Give it visible meaning in the label if it matters. */
  badge?: ComponentChildren;
};

export type BottomNavProps = {
  items: NavItem[];
  value: string;
  onChange: (id: string) => void;
  /** Accessible name. Default "Main". */
  label?: string | undefined;
  /** Pin to the bottom of the viewport (respects the safe area). */
  fixed?: boolean | undefined;
  class?: string | undefined;
};

/** Floating glass navigation bar with an ember glow under the active item. */
export function BottomNav({ items, value, onChange, label = 'Main', fixed = false, class: className }: BottomNavProps) {
  return (
    <nav class={cx('pn-bottomnav', fixed && 'pn-bottomnav--fixed', className)} aria-label={label}>
      <ul class="pn-bottomnav__list">
        {items.map((item) => {
          const active = item.id === value;
          return (
            <li key={item.id} class="pn-bottomnav__cell">
              <button
                type="button"
                class={cx('pn-bottomnav__item', active && 'is-active')}
                aria-current={active ? 'page' : undefined}
                onClick={() => onChange(item.id)}
              >
                <span class="pn-bottomnav__icon" aria-hidden="true">
                  {item.icon}
                  {item.badge !== undefined && item.badge !== null ? (
                    <span class="pn-bottomnav__badge">{item.badge}</span>
                  ) : null}
                </span>
                <span class="pn-bottomnav__label">{item.label}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
