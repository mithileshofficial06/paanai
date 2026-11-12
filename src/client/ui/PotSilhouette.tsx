import { useId } from 'preact/hooks';
import { cx, safeId } from './cx';

type Point = { x: number; y: number };

export type SilhouetteBox = {
  width: number;
  height: number;
  /** Horizontal padding (px). Default 6. */
  padX?: number | undefined;
  padTop?: number | undefined;
  padBottom?: number | undefined;
};

export type SilhouetteGeometry = {
  /** Closed outline: rim, down the left wall, across the base, up the right wall. */
  d: string;
  cx: number;
  baseY: number;
  rimY: number;
  /** Half-width at the widest ring, px. */
  halfWidth: number;
  /** px per unit. */
  scale: number;
};

function fmt(n: number): string {
  return (Math.round(n * 10) / 10).toString();
}

/** Catmull-Rom spline through pts as cubic Bezier segments (no leading M). */
function smooth(pts: Point[]): string {
  let d = '';
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    if (!p0 || !p1 || !p2 || !p3) continue;
    const c1x = p1.x + (p2.x - p0.x) / 6;
    const c1y = p1.y + (p2.y - p0.y) / 6;
    const c2x = p2.x - (p3.x - p1.x) / 6;
    const c2y = p2.y - (p3.y - p1.y) / 6;
    d += `C${fmt(c1x)} ${fmt(c1y)} ${fmt(c2x)} ${fmt(c2y)} ${fmt(p2.x)} ${fmt(p2.y)}`;
  }
  return d;
}

/**
 * Turns a pot profile (outer radii from base to rim, ring i at height (i + 0.5) / n of the
 * pot, the same layout as src/shared/core/profile.ts) into a smooth closed SVG outline that
 * fits the box. Units are arbitrary but radii and height must share them (0.1 mm in core).
 */
export function silhouetteGeometry(radii: ArrayLike<number>, heightUnits: number, box: SilhouetteBox): SilhouetteGeometry {
  const n = radii.length;
  const padX = box.padX ?? 6;
  const padTop = box.padTop ?? 6;
  const padBottom = box.padBottom ?? 6;
  let maxR = 1;
  for (let i = 0; i < n; i++) maxR = Math.max(maxR, radii[i] ?? 0);
  const h = Math.max(1, heightUnits);
  const scale = Math.min((box.width - 2 * padX) / (2 * maxR), (box.height - padTop - padBottom) / h);
  const cx = box.width / 2;
  const baseY = box.height - padBottom;

  const right: Point[] = [];
  const r0 = radii[0] ?? 0;
  right.push({ x: cx + r0 * scale, y: baseY });
  for (let i = 0; i < n; i++) {
    const r = radii[i] ?? 0;
    right.push({ x: cx + r * scale, y: baseY - ((i + 0.5) / n) * h * scale });
  }
  const rTop = radii[n - 1] ?? r0;
  right.push({ x: cx + rTop * scale, y: baseY - h * scale });

  const left = right.map((p) => ({ x: 2 * cx - p.x, y: p.y })).reverse();
  const start = left[0];
  const baseRight = right[0];
  if (!start || !baseRight) {
    return { d: '', cx, baseY, rimY: baseY, halfWidth: 0, scale };
  }
  const d = `M${fmt(start.x)} ${fmt(start.y)}${smooth(left)}L${fmt(baseRight.x)} ${fmt(baseRight.y)}${smooth(right)}Z`;
  return { d, cx, baseY, rimY: baseY - h * scale, halfWidth: maxR * scale, scale };
}

export type PotSilhouetteProps = {
  /** Outer radii from base to rim (48 in Paanai; any length of 2 or more works). */
  radii: ArrayLike<number>;
  /** Pot height, same units as radii. */
  heightUnits: number;
  /** Box size in px. Default 96 x 120. */
  width?: number | undefined;
  height?: number | undefined;
  /** target: the commission outline. clay: wet clay. glaze: fired colour (see `color`). ghost: a rival's replay. */
  variant?: 'target' | 'clay' | 'glaze' | 'ghost' | undefined;
  /** Glaze colour for variant="glaze". */
  color?: string | undefined;
  /** Dotted centre axis. Default true for target. */
  showAxis?: boolean | undefined;
  /** Ground line under the base. Default true. */
  showBase?: boolean | undefined;
  /** Accessible name; omit when the silhouette is decorative. */
  title?: string | undefined;
  class?: string | undefined;
};

/** A pot's side silhouette as inline SVG, drawn from its profile radii. */
export function PotSilhouette({
  radii,
  heightUnits,
  width = 96,
  height = 120,
  variant = 'target',
  color,
  showAxis,
  showBase = true,
  title,
  class: className,
}: PotSilhouetteProps) {
  const uid = safeId(`pn-pot-${useId()}`);
  const geo = silhouetteGeometry(radii, heightUnits, { width, height, padX: 4, padTop: 6, padBottom: showBase ? 8 : 4 });
  const axis = showAxis ?? variant === 'target';
  const baseHalf = Math.min(width / 2 - 2, geo.halfWidth + 10);
  return (
    <svg
      class={cx('pn-pot', `pn-pot--${variant}`, className)}
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      role={title ? 'img' : undefined}
      aria-label={title}
      aria-hidden={title ? undefined : 'true'}
    >
      <defs>
        <linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stop-color="#000" stop-opacity="0.42" />
          <stop offset="0.3" stop-color="#fff" stop-opacity="0.16" />
          <stop offset="0.42" stop-color="#fff" stop-opacity="0.22" />
          <stop offset="0.7" stop-color="#000" stop-opacity="0.08" />
          <stop offset="1" stop-color="#000" stop-opacity="0.5" />
        </linearGradient>
        <linearGradient id={`${uid}-target`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" class="pn-pot__target-top" />
          <stop offset="1" class="pn-pot__target-bottom" />
        </linearGradient>
      </defs>
      {showBase ? (
        <line
          class="pn-pot__base"
          x1={geo.cx - baseHalf}
          x2={geo.cx + baseHalf}
          y1={geo.baseY + 0.5}
          y2={geo.baseY + 0.5}
        />
      ) : null}
      {variant === 'target' ? (
        <path class="pn-pot__body" d={geo.d} fill={`url(#${uid}-target)`} />
      ) : variant === 'ghost' ? (
        <path class="pn-pot__body" d={geo.d} />
      ) : (
        <>
          <path
            class="pn-pot__body"
            d={geo.d}
            style={variant === 'glaze' && color ? { fill: color } : undefined}
          />
          <path class="pn-pot__shade" d={geo.d} fill={`url(#${uid}-shade)`} />
        </>
      )}
      {axis ? <line class="pn-pot__axis" x1={geo.cx} x2={geo.cx} y1={geo.rimY - 4} y2={geo.baseY} /> : null}
    </svg>
  );
}
