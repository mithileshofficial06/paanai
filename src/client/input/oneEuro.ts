// One-Euro filter (Casiez, Roussel, Vogel 2012): adaptive low-pass that removes jitter when the
// finger is slow and keeps lag low when it moves fast. Client-only; its float output is quantised
// before it ever reaches the deterministic core.

export type OneEuroParams = {
  /** Cutoff (Hz) at rest. Lower = smoother but laggier. */
  minCutoff: number;
  /** Speed coefficient: how quickly the cutoff opens up with speed (per px/s). */
  beta: number;
  /** Cutoff (Hz) for the derivative estimate. */
  dCutoff: number;
};

function smoothingFactor(cutoffHz: number, dt: number): number {
  const tau = 1 / (2 * Math.PI * cutoffHz);
  return 1 / (1 + tau / dt);
}

export class OneEuroFilter {
  private prevRaw: number | null = null;
  private filtered = 0;
  private dxFiltered = 0;

  constructor(private readonly params: OneEuroParams) {}

  reset(value?: number): void {
    if (value === undefined) {
      this.prevRaw = null;
      this.filtered = 0;
    } else {
      this.prevRaw = value;
      this.filtered = value;
    }
    this.dxFiltered = 0;
  }

  get value(): number {
    return this.filtered;
  }

  filter(value: number, dt: number): number {
    if (this.prevRaw === null || !(dt > 0)) {
      this.prevRaw = value;
      this.filtered = value;
      this.dxFiltered = 0;
      return value;
    }
    const dx = (value - this.prevRaw) / dt;
    this.dxFiltered += smoothingFactor(this.params.dCutoff, dt) * (dx - this.dxFiltered);
    const cutoff = this.params.minCutoff + this.params.beta * Math.abs(this.dxFiltered);
    this.filtered += smoothingFactor(cutoff, dt) * (value - this.filtered);
    this.prevRaw = value;
    return this.filtered;
  }
}
