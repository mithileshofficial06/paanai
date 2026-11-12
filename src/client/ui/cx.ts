export type ClassValue = string | false | null | undefined | 0;

/** Joins truthy class names: cx('a', on && 'b') -> 'a b'. */
export function cx(...parts: ClassValue[]): string {
  let out = '';
  for (const part of parts) {
    if (part) out = out ? `${out} ${part}` : part;
  }
  return out;
}

/** Makes a string safe for use as an SVG/HTML id (useId output can contain ':' on some setups). */
export function safeId(raw: string): string {
  return raw.replace(/[^a-zA-Z0-9_-]/g, '');
}
