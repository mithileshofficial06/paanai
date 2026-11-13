// The painting table: the finished pot turns on a banding wheel; pick a brush and a colour,
// then tap the pot where the paint should go. Body and rim paint at once.
import { useEffect, useRef, useState } from 'preact/hooks';
import { DECOR_PALETTE, MAX_BANDS, MAX_MOTIFS, MOTIFS, type Decor, type Motif, emptyDecor, isEmptyDecor } from '../../../shared/core/decor';
import { clayLook } from '../../app/glazeLook';
import { sfx } from '../../app/audio';
import { createPotPreview, type PotPreview } from '../../three/potPreview';
import { useReducedMotion } from '../../ui/hooks';
import { Button } from '../../ui/Button';
import { IconBrush, IconUndo } from '../../ui/icons';
import { EmptyState } from '../../ui/States';
import * as S from '../store';
import { back, finishDecorating, go, say } from '../controller';

type Tool = 'band' | 'pattern' | 'body' | 'rim';
type Size = 's' | 'm' | 'l';
const TOOLS: { id: Tool; label: string; hint: string }[] = [
  { id: 'band', label: 'Bands', hint: 'Tap the pot to paint a band there.' },
  { id: 'pattern', label: 'Patterns', hint: 'Tap the pot to paint a ring of the pattern there.' },
  { id: 'body', label: 'Body', hint: 'Pick a colour to paint the whole pot.' },
  { id: 'rim', label: 'Rim', hint: 'Pick a colour for the rim.' },
];
const MOTIF_NAME: Record<Motif, string> = { dots: 'Dots', waves: 'Waves', zigzag: 'Zigzag', leaves: 'Leaves', flowers: 'Flowers', stars: 'Stars', fish: 'Fish', stripes: 'Stripes' };
const BAND_W: Record<Size, number> = { s: 0.025, m: 0.05, l: 0.1 };
const MOTIF_SIZE: Record<Size, { size: number; count: number }> = { s: { size: 0.12, count: 12 }, m: { size: 0.19, count: 8 }, l: { size: 0.28, count: 6 } };

function MotifIcon({ kind }: { kind: Motif }) {
  const p = { fill: 'currentColor', stroke: 'currentColor', 'stroke-width': 0 } as const;
  switch (kind) {
    case 'dots':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <circle cx="6" cy="12" r="2.6" {...p} />
          <circle cx="12" cy="12" r="2.6" {...p} />
          <circle cx="18" cy="12" r="2.6" {...p} />
        </svg>
      );
    case 'waves':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M2 12c2.5-4 5-4 7.5 0s5 4 7.5 0 3.5-3 5-2" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" />
        </svg>
      );
    case 'zigzag':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M2 15l4-6 4 6 4-6 4 6 4-6" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linejoin="round" stroke-linecap="round" />
        </svg>
      );
    case 'leaves':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 20V11M12 11c-4-1-6-4-6-7 3 0 6 2 6 7zm0 0c4-1 6-4 6-7-3 0-6 2-6 7z" {...p} />
        </svg>
      );
    case 'flowers':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx="12" cy="7" rx="2.6" ry="4.4" transform={`rotate(${a} 12 12)`} {...p} />
          ))}
        </svg>
      );
    case 'stars':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M12 3l2.6 5.6 6.1.7-4.5 4.2 1.2 6L12 16.6 6.6 19.5l1.2-6-4.5-4.2 6.1-.7z" {...p} />
        </svg>
      );
    case 'fish':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          <path d="M3 12c3-4.5 8-5 12-2l5-3v10l-5-3c-4 3-9 2.5-12-2z" {...p} />
        </svg>
      );
    case 'stripes':
      return (
        <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
          {[5, 10, 15, 20].map((x) => (
            <rect key={x} x={x - 1.3} y="4" width="2.6" height="16" rx="1.2" {...p} />
          ))}
        </svg>
      );
  }
}

/** A random, tasteful decoration: one or two bands, a pattern ring, sometimes a rim. */
function surprise(): Decor {
  const pick = <T,>(a: readonly T[]): T => a[Math.floor(Math.random() * a.length)]!;
  const colours = DECOR_PALETTE.map((c) => c.hex);
  const main = pick(colours);
  const accent = pick(colours.filter((c) => c !== main));
  const kind = pick(MOTIFS.filter((m) => m !== 'stripes'));
  const y = 0.35 + Math.random() * 0.3;
  const sz = pick(['s', 'm'] as const);
  return {
    base: Math.random() < 0.35 ? pick(['#f1ebdd', '#1d1a18', '#b5532e']) : null,
    rim: Math.random() < 0.6 ? accent : null,
    bands: [
      { y: Math.min(0.95, y + 0.16), w: 0.025, color: accent },
      { y: Math.max(0.05, y - 0.16), w: 0.025, color: accent },
    ],
    motifs: [{ kind, y, size: MOTIF_SIZE[sz].size, count: MOTIF_SIZE[sz].count, color: main }],
  };
}

export function Decorate() {
  const lt = S.lastThrow.value;
  const ll = S.lastLevel.value;
  const daily = S.mode.value === 'daily';
  const profile = daily ? lt?.profile : ll?.profile;
  const canvas = useRef<HTMLCanvasElement>(null);
  const preview = useRef<PotPreview | null>(null);
  const reduced = useReducedMotion();
  const [decor, setDecor] = useState<Decor>(S.decor.value);
  const [history, setHistory] = useState<Decor[]>([]);
  const [tool, setTool] = useState<Tool>('band');
  const [colour, setColour] = useState<string>(DECOR_PALETTE[0].hex);
  const [motif, setMotif] = useState<Motif>('dots');
  const [size, setSize] = useState<Size>('m');
  const [busy, setBusy] = useState(false);
  const [noGl, setNoGl] = useState(false);
  const down = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const el = canvas.current;
    if (!el || !profile) return;
    // Leather-hard clay: paint goes on before the glaze.
    const pv = createPotPreview(el, profile, clayLook(), reduced);
    if (!pv) setNoGl(true);
    preview.current = pv;
    pv?.setDecor(decor);
    return () => {
      pv?.dispose();
      preview.current = null;
    };
  }, [profile?.join(',')]);

  useEffect(() => {
    preview.current?.setDecor(decor);
  }, [decor]);

  if (!profile) return <EmptyState title="Nothing to decorate" description="Throw a pot first." action={<Button onClick={() => go('levels')}>Open the level map</Button>} />;

  function apply(next: Decor) {
    setHistory((h) => [...h.slice(-19), decor]);
    setDecor(next);
    sfx.squelch(0.35);
  }
  function pickColour(hex: string | null) {
    if (hex) setColour(hex);
    if (tool === 'body') apply({ ...decor, base: hex });
    else if (tool === 'rim') apply({ ...decor, rim: hex });
  }
  function paintAt(frac: number) {
    if (tool === 'band') {
      if (decor.bands.length >= MAX_BANDS) return say(`Up to ${MAX_BANDS} bands. Undo one first.`);
      apply({ ...decor, bands: [...decor.bands, { y: Math.round(frac * 1000) / 1000, w: BAND_W[size], color: colour }] });
    } else if (tool === 'pattern') {
      if (decor.motifs.length >= MAX_MOTIFS) return say(`Up to ${MAX_MOTIFS} patterns. Undo one first.`);
      const m = MOTIF_SIZE[size];
      apply({ ...decor, motifs: [...decor.motifs, { kind: motif, y: Math.round(frac * 1000) / 1000, size: m.size, count: m.count, color: colour }] });
    }
  }
  const active = TOOLS.find((t) => t.id === tool)!;
  const glazeNote = daily && lt?.res.potId ? 'The kiln master glazes under your paint, so the fire will not change it.' : null;

  return (
    <section class="sc deco" aria-labelledby="deco-title">
      <p class="pn-eyebrow">{daily ? 'Before the kiln' : `Level ${ll?.res.level ?? ''}`}</p>
      <h1 id="deco-title" class="pn-headline">
        Paint your pot
      </h1>
      <div class="deco__stage">
        <div class="deco__wheel" aria-hidden="true" />
        <canvas
          ref={canvas}
          class="deco__canvas"
          aria-label="Your pot. Tap it to paint, drag sideways to turn it."
          onPointerDown={(e) => (down.current = { x: e.clientX, y: e.clientY })}
          onPointerUp={(e) => {
            const d0 = down.current;
            down.current = null;
            if (!d0 || Math.hypot(e.clientX - d0.x, e.clientY - d0.y) > 8) return;
            if (tool === 'body' || tool === 'rim') return say(active.hint);
            const f = preview.current?.heightAt(e.clientY);
            if (f != null) paintAt(f);
          }}
        />
        {noGl ? <p class="deco__nogl">3D preview is not available on this device.</p> : null}
        <p class="deco__hint" key={tool}>
          <IconBrush size={16} /> {active.hint}
        </p>
      </div>

      <div class="deco__tools" role="tablist" aria-label="Brush">
        {TOOLS.map((t) => (
          <button key={t.id} type="button" role="tab" aria-selected={tool === t.id} class={`deco__tool${tool === t.id ? ' is-on' : ''}`} onClick={() => setTool(t.id)}>
            {t.label}
          </button>
        ))}
      </div>

      {tool === 'pattern' ? (
        <div class="deco__motifs" role="radiogroup" aria-label="Pattern">
          {MOTIFS.map((m) => (
            <button key={m} type="button" role="radio" aria-checked={motif === m} aria-label={MOTIF_NAME[m]} title={MOTIF_NAME[m]} class={`deco__motif${motif === m ? ' is-on' : ''}`} style={{ color: colour }} onClick={() => setMotif(m)}>
              <MotifIcon kind={m} />
            </button>
          ))}
        </div>
      ) : null}

      <div class="deco__palette" role="radiogroup" aria-label="Colour">
        {tool === 'body' || tool === 'rim' ? (
          <button type="button" role="radio" aria-checked={(tool === 'body' ? decor.base : decor.rim) === null} class="deco__swatch deco__swatch--none" aria-label="No paint" title="No paint" onClick={() => pickColour(null)} />
        ) : null}
        {DECOR_PALETTE.map((c) => {
          const on = tool === 'body' ? decor.base === c.hex : tool === 'rim' ? decor.rim === c.hex : colour === c.hex;
          return <button key={c.id} type="button" role="radio" aria-checked={on} aria-label={c.name} title={c.name} class={`deco__swatch${on ? ' is-on' : ''}`} style={{ '--sw': c.hex }} onClick={() => pickColour(c.hex)} />;
        })}
      </div>

      {tool === 'band' || tool === 'pattern' ? (
        <div class="deco__sizes" role="radiogroup" aria-label="Brush size">
          {(['s', 'm', 'l'] as const).map((s) => (
            <button key={s} type="button" role="radio" aria-checked={size === s} class={`pn-chip pn-chip--interactive${size === s ? ' is-selected' : ''}`} onClick={() => setSize(s)}>
              {s === 's' ? 'Fine' : s === 'm' ? 'Medium' : 'Bold'}
            </button>
          ))}
        </div>
      ) : null}

      <div class="deco__edit">
        <Button variant="secondary" size="sm" icon={<IconUndo />} disabled={!history.length} onClick={() => (setDecor(history[history.length - 1]!), setHistory((h) => h.slice(0, -1)))}>
          Undo
        </Button>
        <Button variant="secondary" size="sm" disabled={isEmptyDecor(decor)} onClick={() => apply(emptyDecor())}>
          Clear
        </Button>
        <Button variant="secondary" size="sm" onClick={() => apply(surprise())}>
          Surprise me
        </Button>
      </div>
      {glazeNote ? <p class="deco__note">{glazeNote}</p> : null}

      <div class="sc__actions">
        <Button
          variant="primary"
          size="lg"
          block
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await finishDecorating(decor, preview.current?.snapshot() ?? null);
            setBusy(false);
          }}
        >
          {daily && lt?.res.potId ? 'Fire it in the kiln' : 'Done painting'}
        </Button>
        <Button variant="ghost" block onClick={() => back()}>
          Back
        </Button>
      </div>
    </section>
  );
}
