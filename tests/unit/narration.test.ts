import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { clipFor, NARRATION } from '../../src/client/studio/narration';

// Every line the tutorial speaks must have a recorded clip, word for word. Tour.tsx speaks the first
// beat of each step as "<title>. <say>", and every other beat as its say.
function spokenLines(): string[] {
  const src = readFileSync(resolve(__dirname, '../../src/client/studio/Tour.tsx'), 'utf8');
  const steps = src.slice(src.indexOf('const STEPS'), src.indexOf('// ---------- narration'));
  const lines: string[] = [];
  for (const block of steps.split(/\n\s*\{\n\s*title: /).slice(1)) {
    const title = block.match(/^'([^']+)'/)![1]!;
    const says = [...block.matchAll(/say: '([^']+)'/g)].map((m) => m[1]!);
    says.forEach((s, i) => lines.push(i === 0 ? `${title}. ${s}` : s));
  }
  return lines;
}

describe('tutorial narration', () => {
  it('has a recorded clip for every spoken line, in order', () => {
    const lines = spokenLines();
    expect(lines.length).toBe(NARRATION.length);
    for (const l of lines) expect(clipFor(l), l).not.toBeNull();
    expect(lines).toEqual(NARRATION.map((n) => n.text));
  });
});
