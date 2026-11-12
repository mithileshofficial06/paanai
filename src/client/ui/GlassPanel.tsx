import { h, type ComponentChildren, type HTMLAttributes } from 'preact';
import { cx } from './cx';

export type GlassTag = 'div' | 'section' | 'article' | 'aside' | 'header' | 'footer' | 'li' | 'figure';
export type GlassTone = 'default' | 'raised' | 'inset' | 'accent';
export type GlassPadding = 'none' | 'sm' | 'md' | 'lg';
export type GlassRadius = 'md' | 'lg' | 'xl';

export type GlassPanelProps = Omit<HTMLAttributes<HTMLElement>, 'class' | 'className'> & {
  as?: GlassTag | undefined;
  /** default: frosted panel. raised: denser, for sheets and dialogs. inset: recessed well.
   * accent: red-tinted glass for the one thing that matters on screen. */
  tone?: GlassTone | undefined;
  padding?: GlassPadding | undefined;
  radius?: GlassRadius | undefined;
  /** Soft red glow under the panel. */
  glow?: boolean | undefined;
  /** Hover and press feedback, for panels that are themselves clickable. */
  interactive?: boolean | undefined;
  class?: string | undefined;
  children?: ComponentChildren;
};

/**
 * Frosted black-red glass: backdrop blur, a gradient hairline edge (bright at the top,
 * ember-tinted at the bottom), an inner highlight and an optional soft red glow.
 * Falls back to a solid surface where backdrop-filter is missing or transparency is reduced.
 */
export function GlassPanel({
  as = 'div',
  tone = 'default',
  padding = 'md',
  radius = 'lg',
  glow = false,
  interactive = false,
  class: className,
  children,
  ...rest
}: GlassPanelProps) {
  return h(
    as,
    {
      ...rest,
      class: cx(
        'pn-glass',
        tone !== 'default' && `pn-glass--${tone}`,
        `pn-pad-${padding}`,
        `pn-radius-${radius}`,
        glow && 'pn-glass--glow',
        interactive && 'pn-glass--interactive',
        className,
      ),
    },
    children,
  );
}
