import { cx } from './cx';

export type AppBackgroundVariant = 'studio' | 'kiln' | 'night';

export type AppBackgroundProps = {
  /** studio: default black to red. kiln: stronger ember from below. night: calmer, darker. */
  variant?: AppBackgroundVariant | undefined;
  /** Film grain layer. Default true. */
  grain?: boolean | undefined;
  /** Slow ember drift. Default true; always off with reduced motion. */
  animated?: boolean | undefined;
  class?: string | undefined;
};

/**
 * Full-viewport backdrop: deep black falling into oxblood red, two slow ember glows, a
 * vignette and fine film grain. Fixed, behind everything (z-index 0), never interactive.
 * Cheap by design: only transform/opacity animate, on their own compositor layers.
 * Put the 3D canvas above it (z-index 1) with a transparent clear colour to let it show.
 */
export function AppBackground({ variant = 'studio', grain = true, animated = true, class: className }: AppBackgroundProps) {
  return (
    <div class={cx('pn-bg', `pn-bg--${variant}`, animated && 'pn-bg--animated', className)} aria-hidden="true">
      <div class="pn-bg__ember pn-bg__ember--low" />
      <div class="pn-bg__ember pn-bg__ember--high" />
      <div class="pn-bg__vignette" />
      {grain ? <div class="pn-bg__grain" /> : null}
    </div>
  );
}
