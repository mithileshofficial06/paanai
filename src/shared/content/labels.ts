import type { Constraint } from '../core/score';

/** Human label for a constraint chip (shared by the server DTOs and the client's level builder). */
export function constraintLabel(c: Constraint): string {
  switch (c.kind) {
    case 'capacity':
      return `Holds ${(c.ml / 1000).toFixed(c.ml % 1000 === 0 ? 1 : 2)} L (within ${c.tolPct}%)`;
    case 'rim':
      return c.rule === 'narrower' ? 'Rim narrower than the base' : 'Rim wider than the base';
    case 'height':
      return `Height ${Math.round(c.min / 10)}-${Math.round(c.max / 10)} mm`;
    case 'survive':
      return 'Must survive the kiln';
    case 'maxStrokes':
      return `At most ${c.n} strokes`;
  }
}
