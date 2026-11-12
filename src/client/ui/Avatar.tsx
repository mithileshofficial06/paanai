import { useEffect, useState } from 'preact/hooks';
import { cx } from './cx';

export type AvatarSize = 'sm' | 'md' | 'lg' | 'xl';

export type AvatarProps = {
  /** Display name, e.g. "u/potter_mithi" or "the Master". Used for initials and alt text. */
  name: string;
  /** Snoovatar or image URL. Falls back to initials when missing or when it fails to load. */
  src?: string | undefined;
  /** sm 28, md 36, lg 48, xl 72 px. */
  size?: AvatarSize | undefined;
  /** accent: the player. gold: the commissioner or a winner. */
  ring?: 'none' | 'accent' | 'gold' | undefined;
  /** Hide from screen readers when the name is already shown next to it. */
  decorative?: boolean | undefined;
  class?: string | undefined;
};

/** Initials backgrounds are real glaze colours, each paired with a text colour that passes AA. */
const GLAZE_SWATCHES: ReadonlyArray<{ bg: string; ink: string }> = [
  { bg: 'linear-gradient(160deg, #a5332c, #6f1414)', ink: '#fff4ef' }, // copper red
  { bg: 'linear-gradient(160deg, #4f8a69, #2c5a43)', ink: '#f2fbf5' }, // copper green
  { bg: 'linear-gradient(160deg, #3552a6, #1a2f6e)', ink: '#eef3ff' }, // cobalt
  { bg: 'linear-gradient(160deg, #3a2a21, #160d09)', ink: '#f6e6d6' }, // tenmoku
  { bg: 'linear-gradient(160deg, #c3d4bf, #93ae8f)', ink: '#1f2c1d' }, // celadon
  { bg: 'linear-gradient(160deg, #c07a32, #8a4e15)', ink: '#fff6ea' }, // amber
  { bg: 'linear-gradient(160deg, #f1ece2, #d8d0c2)', ink: '#3a2c22' }, // tin white
  { bg: 'linear-gradient(160deg, #c49562, #8e6234)', ink: '#fffaf2' }, // rutile
];

function hashName(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function initialsOf(name: string): string {
  const clean = name.replace(/^u\//i, '').trim();
  const words = clean.split(/[\s_\-.]+/).filter((w) => w.length > 0 && w.toLowerCase() !== 'the');
  const first = words[0]?.[0] ?? clean[0] ?? '?';
  const second = words.length > 1 ? (words[1]?.[0] ?? '') : '';
  return `${first}${second}`.toUpperCase();
}

export function Avatar({ name, src, size = 'md', ring = 'none', decorative = false, class: className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [src]);
  const swatch = GLAZE_SWATCHES[hashName(name) % GLAZE_SWATCHES.length] ?? GLAZE_SWATCHES[0];
  const showImage = Boolean(src) && !failed;
  return (
    <span
      class={cx('pn-avatar', `pn-avatar--${size}`, ring !== 'none' && `pn-avatar--ring-${ring}`, className)}
      role={decorative ? undefined : 'img'}
      aria-label={decorative ? undefined : name}
      aria-hidden={decorative ? 'true' : undefined}
      style={showImage || !swatch ? undefined : { background: swatch.bg, color: swatch.ink }}
    >
      {showImage ? (
        <img src={src} alt="" loading="lazy" decoding="async" draggable={false} onError={() => setFailed(true)} />
      ) : (
        <span class="pn-avatar__initials" aria-hidden="true">
          {initialsOf(name)}
        </span>
      )}
    </span>
  );
}
