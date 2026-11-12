import { h, type ComponentChildren } from 'preact';
import { useId } from 'preact/hooks';
import { Avatar } from './Avatar';
import { Chip } from './Chip';
import { cx, safeId } from './cx';
import { GlassPanel } from './GlassPanel';
import { IconCalendar, IconCommission } from './icons';
import { PotSilhouette } from './PotSilhouette';

export type BeatBarProps = {
  /** The commissioner's score: the bar to beat. */
  beat: number;
  /** The player's score, once they have thrown. */
  score?: number | undefined;
  commissioner?: string | undefined;
  /** Show "set by {commissioner}" next to the number. Default true. */
  showCommissioner?: boolean | undefined;
  max?: number | undefined;
  class?: string | undefined;
};

/** "Beat 88": the commissioner's score as a bar, with the player's score marked once known. */
export function BeatBar({
  beat,
  score,
  commissioner,
  showCommissioner = true,
  max = 100,
  class: className,
}: BeatBarProps) {
  const clamp = (v: number): number => Math.max(0, Math.min(100, (v / max) * 100));
  const beaten = score !== undefined && score > beat;
  const tied = score !== undefined && score === beat;
  const status =
    score === undefined ? '' : beaten ? `You scored ${score}: beaten.` : tied ? `You scored ${score}: tied.` : `You scored ${score}: not beaten yet.`;
  return (
    <div class={cx('pn-beat', beaten && 'is-beaten', className)}>
      <div class="pn-beat__head">
        <span class="pn-beat__label">Beat</span>
        <span class="pn-beat__num">{beat}</span>
        {commissioner && showCommissioner ? <span class="pn-beat__by">set by {commissioner}</span> : null}
        {score !== undefined ? (
          <span class={cx('pn-beat__you', beaten && 'is-beaten')}>
            You <span class="pn-num">{score}</span>
          </span>
        ) : null}
      </div>
      <div
        class="pn-beat__track"
        role="img"
        aria-label={`Score to beat: ${beat} out of ${max}${commissioner ? `, set by ${commissioner}` : ''}. ${status}`}
      >
        <span class="pn-beat__fill" style={{ width: `${clamp(beat)}%` }} />
        <span class="pn-beat__notch" style={{ left: `${clamp(beat)}%` }} />
        {score !== undefined ? <span class="pn-beat__marker" style={{ left: `${clamp(score)}%` }} /> : null}
      </div>
    </div>
  );
}

export type CommissionCardProps = {
  title: string;
  /** Already formatted, e.g. "12 Nov". */
  dateLabel: string;
  /** "the Master" for the official daily, or "u/maker". */
  commissioner: string;
  /** The commissioner's score to beat. */
  beat: number;
  /** Target outline: outer radii from base to rim (48 rings), same units as heightUnits. */
  outline: ArrayLike<number>;
  heightUnits: number;
  /** Format label, e.g. "Match + capacity" or "Blind throw". */
  format?: string | undefined;
  /** Up to two constraints, already worded, e.g. "Holds 1.0 L, within 5%". */
  constraints?: string[] | undefined;
  commissionerAvatar?: string | undefined;
  /** Small heading above the title. Default "Today's commission". */
  eyebrow?: string | undefined;
  /** The player's score, if they have thrown. */
  yourScore?: number | undefined;
  /** Call to action, e.g. a Throw button. */
  action?: ComponentChildren;
  /** Heading level for the title. Default 2. */
  headingLevel?: 2 | 3 | undefined;
  /** Tighter layout for lists and the inline splash. */
  compact?: boolean | undefined;
  class?: string | undefined;
};

/**
 * The commission at a glance: what to make, who set it, the bar to beat, and the target
 * silhouette drawn from the commission's own profile.
 */
export function CommissionCard({
  title,
  dateLabel,
  commissioner,
  beat,
  outline,
  heightUnits,
  format,
  constraints = [],
  commissionerAvatar,
  eyebrow = "Today's commission",
  yourScore,
  action,
  headingLevel = 2,
  compact = false,
  class: className,
}: CommissionCardProps) {
  const titleId = safeId(`pn-cc-${useId()}`);
  const figure = compact ? { w: 76, h: 96 } : { w: 104, h: 132 };
  return (
    <GlassPanel
      as="article"
      tone="default"
      glow
      padding={compact ? 'sm' : 'md'}
      class={cx('pn-commission', compact && 'pn-commission--compact', className)}
      aria-labelledby={titleId}
    >
      <div class="pn-commission__top">
        <span class="pn-eyebrow">{eyebrow}</span>
        <span class="pn-commission__date">
          <IconCalendar size={16} />
          <span>{dateLabel}</span>
        </span>
      </div>
      <div class="pn-commission__main">
        <div class="pn-commission__figure">
          <PotSilhouette
            radii={outline}
            heightUnits={heightUnits}
            width={figure.w}
            height={figure.h}
            variant="target"
            title={`Target shape for ${title}`}
          />
        </div>
        <div class="pn-commission__info">
          {h(`h${headingLevel}`, { id: titleId, class: cx('pn-commission__title', compact ? 'pn-title' : 'pn-headline') }, title)}
          <div class="pn-commission__by">
            <Avatar name={commissioner} src={commissionerAvatar} size="sm" ring="gold" decorative />
            <span>
              by <strong>{commissioner}</strong>
            </span>
          </div>
          {format ? (
            <Chip size="sm" tone="accent" icon={<IconCommission size={16} />}>
              {format}
            </Chip>
          ) : null}
        </div>
      </div>
      {constraints.length > 0 ? (
        <ul class="pn-commission__rules" aria-label="Constraints">
          {constraints.map((c) => (
            <li key={c} class="pn-commission__rule">
              {c}
            </li>
          ))}
        </ul>
      ) : null}
      <BeatBar beat={beat} score={yourScore} commissioner={commissioner} showCommissioner={false} />
      {action ? <div class="pn-commission__action">{action}</div> : null}
    </GlassPanel>
  );
}
