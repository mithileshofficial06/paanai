/**
 * Paanai icon set. Hand-drawn on a 24-unit grid: 1.75 stroke, round caps and joins,
 * currentColor. Icons are decorative (aria-hidden) unless a `title` is given, in which
 * case they become role="img" with that accessible name.
 */
import type { ComponentChildren, FunctionComponent } from 'preact';
import { cx } from './cx';

export type IconProps = {
  /** px number or any CSS length. Default 24. */
  size?: number | string | undefined;
  /** Accessible name. Leave empty for decorative icons next to visible text. */
  title?: string | undefined;
  class?: string | undefined;
  strokeWidth?: number | undefined;
};

type SvgProps = IconProps & { children: ComponentChildren; name: string };

function Svg({ size = 24, title, class: className, strokeWidth = 1.75, children, name }: SvgProps) {
  return (
    <svg
      class={cx('pn-icon', `pn-icon--${name}`, className)}
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width={strokeWidth}
      stroke-linecap="round"
      stroke-linejoin="round"
      focusable="false"
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      {children}
    </svg>
  );
}

/** Potter's wheel: wheel head with a lump of clay, pedestal and base. */
export function IconWheel(p: IconProps) {
  return (
    <Svg {...p} name="wheel">
      <path d="M3.5 9.6a8.5 2.75 0 0 0 17 0" />
      <path d="M3.5 9.6A8.5 2.75 0 0 1 9.55 6.97M14.45 6.97A8.5 2.75 0 0 1 20.5 9.6" />
      <path d="M3.5 9.6v1.4a8.5 2.75 0 0 0 17 0V9.6" />
      <path d="M9.55 9.35c-.35-2.7.75-4.35 2.45-4.35s2.8 1.65 2.45 4.35" />
      <path d="M9.9 13.75 9.05 19.75M14.1 13.75l.85 6" />
      <path d="M5.75 19.75h12.5" />
    </Svg>
  );
}

/** Domed kiln with an arched firing door and a chimney. */
/** Levels: a staircase with a small pot on the top step. */
export function IconLevels(p: IconProps) {
  return (
    <Svg {...p} name="levels">
      <path d="M2.75 20.25h18.5" />
      <path d="M2.75 20.25v-4.5h5.5v-4.5h5.5v-4.5h7.5v13.5" />
      <path d="M16.6 2.9h2.3M17.75 6.5c-1.25 0-1.9-.7-1.9-1.55 0-.7.45-1.25.75-2.05h2.3c.3.8.75 1.35.75 2.05 0 .85-.65 1.55-1.9 1.55z" />
    </Svg>
  );
}

export function IconKiln(p: IconProps) {
  return (
    <Svg {...p} name="kiln">
      <path d="M4 20.25V12a8 8 0 0 1 16 0v8.25" />
      <path d="M2.75 20.25h18.5" />
      <path d="M9.25 20.25V17a2.75 2.75 0 0 1 5.5 0v3.25" />
      <path d="M15.6 4.9V2.75H18v3.9" />
    </Svg>
  );
}

export function IconFlame(p: IconProps) {
  return (
    <Svg {...p} name="flame">
      <path d="M12 21c3.3 0 5.75-2.35 5.75-5.6 0-2.55-1.4-4.45-2.9-5.95-.2 1.5-.9 2.55-2.05 3.05.45-3.65-.55-6.65-2.55-8.75.1 2.85-1.15 4.85-2.85 6.55-1.7 1.7-3.15 3.35-3.15 5.1C6.25 18.65 8.7 21 12 21z" />
      <path d="M12 21c-1.5 0-2.6-1.05-2.6-2.5 0-1.4.95-2.4 2.6-4.1 1.65 1.7 2.6 2.7 2.6 4.1 0 1.45-1.1 2.5-2.6 2.5z" />
    </Svg>
  );
}

/** Glaze Codex: an open book with a ribbon marker. */
export function IconCodex(p: IconProps) {
  return (
    <Svg {...p} name="codex">
      <path d="M12 6.6C10 5.1 7.2 4.6 3.5 5v13.4c3.7-.4 6.5.1 8.5 1.6 2-1.5 4.8-2 8.5-1.6V5c-3.7-.4-6.5.1-8.5 1.6z" />
      <path d="M12 6.6V20" />
      <path d="M15.25 5.35V10.5l1.6-1.15 1.6 1.15V5.05" />
    </Svg>
  );
}

/** The Shelf: a plank on brackets holding a bottle and a round jar. */
export function IconShelf(p: IconProps) {
  return (
    <Svg {...p} name="shelf">
      <path d="M3 16h18" />
      <path d="M5.75 16v4.25M18.25 16v4.25" />
      <path d="M6.6 16c-1.65-.9-1.85-3.65-.45-4.95.7-.65 1-1.05 1-1.9V7.75h2.1v1.4c0 .85.3 1.25 1 1.9 1.4 1.3 1.2 4.05-.45 4.95" />
      <path d="M14.1 16c-1.35-.75-1.85-2.05-1.5-3.3.3-1.15 1.05-1.85 1.55-2.25h3.4c.5.4 1.25 1.1 1.55 2.25.35 1.25-.15 2.55-1.5 3.3" />
    </Svg>
  );
}

/** Commission: a written order with a wax seal and ribbons. */
export function IconCommission(p: IconProps) {
  return (
    <Svg {...p} name="commission">
      <path d="M17.25 11V5.75a2 2 0 0 0-2-2h-8.5a2 2 0 0 0-2 2v12.5a2 2 0 0 0 2 2h6" />
      <path d="M8.25 8h6M8.25 11.25h4" />
      <circle cx="17" cy="16.25" r="3" />
      <path d="M15.6 18.9 15 21.25l2-.95 2 .95-.6-2.35" />
    </Svg>
  );
}

/** Ghost replay of another potter's throw. */
export function IconGhost(p: IconProps) {
  return (
    <Svg {...p} name="ghost">
      <path d="M5.5 20V11a6.5 6.5 0 0 1 13 0v9l-2.15-1.6L14.15 20 12 18.4 9.85 20 7.7 18.4z" />
      <circle cx="9.75" cy="11" r="1.1" fill="currentColor" stroke="none" />
      <circle cx="14.25" cy="11" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconTrophy(p: IconProps) {
  return (
    <Svg {...p} name="trophy">
      <path d="M8 3.75h8v5.5a4 4 0 0 1-8 0z" />
      <path d="M8 5.75H5.25a.25.25 0 0 0-.25.25c0 2.35 1.4 4.05 3.4 4.65" />
      <path d="M16 5.75h2.75a.25.25 0 0 1 .25.25c0 2.35-1.4 4.05-3.4 4.65" />
      <path d="M12 13.25v3.25" />
      <path d="M8.5 20.25h7M9.4 20.25c.15-2.05 1.15-3.75 2.6-3.75s2.45 1.7 2.6 3.75" />
    </Svg>
  );
}

const STAR = 'M12 3.6l2.53 5.52 6.03.7-4.47 4.11 1.2 5.95L12 16.9l-5.29 2.98 1.2-5.95-4.47-4.11 6.03-.7z';

export function IconStar(p: IconProps & { filled?: boolean | undefined }) {
  const { filled = false, ...rest } = p;
  return (
    <Svg {...rest} name={filled ? 'star-filled' : 'star'}>
      <path d={STAR} fill={filled ? 'currentColor' : 'none'} />
    </Svg>
  );
}

export function IconUndo(p: IconProps) {
  return (
    <Svg {...p} name="undo">
      <path d="M9 14.5 4.5 10 9 5.5" />
      <path d="M4.5 10h10a5 5 0 0 1 0 10h-3" />
    </Svg>
  );
}

/** Push tool, inward: walls squeezed toward the centre (narrows, and the pot grows taller). */
export function IconPushIn(p: IconProps) {
  return (
    <Svg {...p} name="push-in">
      <path d="M8.75 3.75c1.05 2.6 1.75 5 1.75 8.25s-.7 5.65-1.75 8.25" />
      <path d="M15.25 3.75c-1.05 2.6-1.75 5-1.75 8.25s.7 5.65 1.75 8.25" />
      <path d="M2.25 12H6.5M4.5 9.75 6.75 12 4.5 14.25" />
      <path d="M21.75 12H17.5M19.5 9.75 17.25 12l2.25 2.25" />
    </Svg>
  );
}

/** Push tool, outward: walls pressed away from the centre (widens, and the pot gets shorter). */
export function IconPushOut(p: IconProps) {
  return (
    <Svg {...p} name="push-out">
      <path d="M10.25 3.75C9.2 6.35 8.25 8.75 8.25 12s.95 5.65 2 8.25" />
      <path d="M13.75 3.75c1.05 2.6 2 5 2 8.25s-.95 5.65-2 8.25" />
      <path d="M5.75 12H1.75M3.75 9.75 1.5 12l2.25 2.25" />
      <path d="M18.25 12h4M20.25 9.75 22.5 12l-2.25 2.25" />
    </Svg>
  );
}

/** Push tool with a direction. */
export function IconPush(p: IconProps & { direction: 'in' | 'out' }) {
  const { direction, ...rest } = p;
  return direction === 'in' ? <IconPushIn {...rest} /> : <IconPushOut {...rest} />;
}

/** Thin tool: a potter's rib (kidney-shaped scraper) used to thin and raise walls. */
export function IconThin(p: IconProps) {
  return (
    <Svg {...p} name="thin">
      <path d="M4.4 16.6C3 12.4 5.8 7 11.1 5.4c4.5-1.35 8.7.45 8.7 3.6 0 2.5-2.7 3.3-4.9 4.8-2.4 1.6-3.1 4.9-5.6 5.6-2.1.6-4.05-.5-4.9-2.8z" />
      <circle cx="14.4" cy="8.85" r="1.35" />
    </Svg>
  );
}

/** Open: tap the centre (a target). */
export function IconOpen(p: IconProps) {
  return (
    <Svg {...p} name="open">
      <circle cx="12" cy="12" r="8.25" />
      <circle cx="12" cy="12" r="4.25" />
      <circle cx="12" cy="12" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

const SPEAKER = 'M4 9.5h2.75L11 5.75v12.5L6.75 14.5H4a.75.75 0 0 1-.75-.75v-3.5A.75.75 0 0 1 4 9.5z';

export function IconSoundOn(p: IconProps) {
  return (
    <Svg {...p} name="sound-on">
      <path d={SPEAKER} />
      <path d="M14.75 9.25a3.9 3.9 0 0 1 0 5.5" />
      <path d="M17.4 6.6a7.65 7.65 0 0 1 0 10.8" />
    </Svg>
  );
}

export function IconSoundOff(p: IconProps) {
  return (
    <Svg {...p} name="sound-off">
      <path d={SPEAKER} />
      <path d="M15.25 9.5l5 5M20.25 9.5l-5 5" />
    </Svg>
  );
}

export function IconInfo(p: IconProps) {
  return (
    <Svg {...p} name="info">
      <circle cx="12" cy="12" r="8.75" />
      <path d="M12 11v5.25" />
      <circle cx="12" cy="7.9" r="1.1" fill="currentColor" stroke="none" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p} name="close">
      <path d="M6.5 6.5l11 11M17.5 6.5l-11 11" />
    </Svg>
  );
}

export function IconShare(p: IconProps) {
  return (
    <Svg {...p} name="share">
      <path d="M12 14.5V3.75M8.25 7.5 12 3.75l3.75 3.75" />
      <path d="M8 10.5H6.75a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h10.5a2 2 0 0 0 2-2v-6a2 2 0 0 0-2-2H16" />
    </Svg>
  );
}

/** Flag, for reporting a pot or commission. */
export function IconFlag(p: IconProps) {
  return (
    <Svg {...p} name="flag">
      <path d="M5.5 21V4.5" />
      <path d="M5.5 4.75h11.25l-2.5 4.25 2.5 4.25H5.5" />
    </Svg>
  );
}

const CHEVRONS = {
  right: 'M9.5 5.5 16 12l-6.5 6.5',
  left: 'M14.5 5.5 8 12l6.5 6.5',
  down: 'M5.5 9.5 12 16l6.5-6.5',
  up: 'M5.5 14.5 12 8l6.5 6.5',
} satisfies Record<string, string>;

export type ChevronDirection = keyof typeof CHEVRONS;

export function IconChevron(p: IconProps & { direction?: ChevronDirection | undefined }) {
  const { direction = 'right', ...rest } = p;
  return (
    <Svg {...rest} name={`chevron-${direction}`}>
      <path d={CHEVRONS[direction]} />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p} name="check">
      <path d="M4.75 12.75 9.5 17.5l9.75-11" />
    </Svg>
  );
}

export function IconLock(p: IconProps) {
  return (
    <Svg {...p} name="lock">
      <rect x="5" y="10.5" width="14" height="10" rx="2.25" />
      <path d="M8 10.5V8a4 4 0 0 1 8 0v2.5" />
      <path d="M12 14.25v2.5" />
    </Svg>
  );
}

export function IconUser(p: IconProps) {
  return (
    <Svg {...p} name="user">
      <circle cx="12" cy="8.25" r="3.75" />
      <path d="M4.75 20.25c.9-3.7 3.7-5.75 7.25-5.75s6.35 2.05 7.25 5.75" />
    </Svg>
  );
}

export function IconCalendar(p: IconProps) {
  return (
    <Svg {...p} name="calendar">
      <rect x="3.75" y="5.25" width="16.5" height="15" rx="2.25" />
      <path d="M3.75 9.75h16.5M8 3.25v4M16 3.25v4" />
      <path d="M8.25 13.75h.01M12 13.75h.01M15.75 13.75h.01M8.25 17h.01M12 17h.01" stroke-width="2.25" />
    </Svg>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p} name="sparkle">
      <path d="M10.5 4.5c.75 4.75 2.5 6.5 7.25 7.25-4.75.75-6.5 2.5-7.25 7.25-.75-4.75-2.5-6.5-7.25-7.25 4.75-.75 6.5-2.5 7.25-7.25z" />
      <path d="M18.75 2.75v3.5M17 4.5h3.5" />
    </Svg>
  );
}

/** Paanai mark: a round-bellied clay pot with a flared rim and one glaze drip. */
export function IconPaanai(p: IconProps) {
  return (
    <Svg {...p} name="paanai">
      <path d="M8.75 3.75h6.5" />
      <path d="M9.75 3.75c0 1.6-.9 2.4-2.1 3.4C5.9 8.6 4.75 10.6 4.75 13.25c0 4.1 3.2 7 7.25 7s7.25-2.9 7.25-7c0-2.65-1.15-4.65-2.9-6.1-1.2-1-2.1-1.8-2.1-3.4" />
      <path d="M6.2 10.6c1.75.85 3.65 1.25 5.8 1.25s4.05-.4 5.8-1.25" />
      <path d="M14.25 11.75v2.5" />
    </Svg>
  );
}

/** A drop of glaze. */
export function IconGlaze(p: IconProps) {
  return (
    <Svg {...p} name="glaze">
      <path d="M12 3.5c3 3.9 5.75 7 5.75 10.5a5.75 5.75 0 0 1-11.5 0C6.25 10.5 9 7.4 12 3.5z" />
      <path d="M9.4 14.6a2.75 2.75 0 0 0 2.6 2.4" />
    </Svg>
  );
}

export function IconRetry(p: IconProps) {
  return (
    <Svg {...p} name="retry">
      <path d="M19.25 12a7.25 7.25 0 1 1-2.12-5.13" />
      <path d="M19.5 4.25v4.25h-4.25" />
    </Svg>
  );
}

/** A pot with a crack: used for errors. */
export function IconCrackedPot(p: IconProps) {
  return (
    <Svg {...p} name="cracked-pot">
      <path d="M8.75 3.75h6.5" />
      <path d="M9.75 3.75c0 1.6-.9 2.4-2.1 3.4C5.9 8.6 4.75 10.6 4.75 13.25c0 4.1 3.2 7 7.25 7s7.25-2.9 7.25-7c0-2.65-1.15-4.65-2.9-6.1-1.2-1-2.1-1.8-2.1-3.4" />
      <path d="M12.75 8.5l-1.9 3.1 2.3 1.65-1.65 3.25" />
    </Svg>
  );
}

export function IconClock(p: IconProps) {
  return (
    <Svg {...p} name="clock">
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}

/** A comment bubble, for sharing to the post's comments. */
export function IconComment(p: IconProps) {
  return (
    <Svg {...p} name="comment">
      <path d="M5 4.75h14a1.75 1.75 0 0 1 1.75 1.75v9A1.75 1.75 0 0 1 19 17.25h-7.25L7.25 20.5v-3.25H5a1.75 1.75 0 0 1-1.75-1.75v-9A1.75 1.75 0 0 1 5 4.75z" />
      <path d="M8 9.25h8M8 12.75h5" />
    </Svg>
  );
}

/** Potter rank: a shield with a rising chevron. */
export function IconRank(p: IconProps) {
  return (
    <Svg {...p} name="rank">
      <path d="M12 3.25l7 2.9v5.35c0 4.35-2.95 7.65-7 9.25-4.05-1.6-7-4.9-7-9.25V6.15z" />
      <path d="M8.75 13.25 12 10.25l3.25 3" />
    </Svg>
  );
}

/** Registry used by the UI lab and by data-driven menus. */
export const ICONS: Record<string, FunctionComponent<IconProps>> = {
  wheel: IconWheel,
  kiln: IconKiln,
  flame: IconFlame,
  codex: IconCodex,
  shelf: IconShelf,
  commission: IconCommission,
  ghost: IconGhost,
  trophy: IconTrophy,
  star: IconStar,
  'star-filled': (p: IconProps) => <IconStar {...p} filled />,
  undo: IconUndo,
  'push-in': IconPushIn,
  'push-out': IconPushOut,
  thin: IconThin,
  open: IconOpen,
  'sound-on': IconSoundOn,
  'sound-off': IconSoundOff,
  info: IconInfo,
  close: IconClose,
  share: IconShare,
  flag: IconFlag,
  chevron: IconChevron,
  check: IconCheck,
  lock: IconLock,
  user: IconUser,
  calendar: IconCalendar,
  sparkle: IconSparkle,
  paanai: IconPaanai,
  glaze: IconGlaze,
  retry: IconRetry,
  'cracked-pot': IconCrackedPot,
  clock: IconClock,
  comment: IconComment,
  rank: IconRank,
};
