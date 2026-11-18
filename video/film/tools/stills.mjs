// Render sample frames of the film for review: node film/tools/stills.mjs 1.5 9 12 ...  (seconds)
import { bundle } from '@remotion/bundler';
import { renderStill, selectComposition } from '@remotion/renderer';
import path from 'node:path';
import { mkdirSync } from 'node:fs';
const secs = process.argv.slice(2).map(Number);
const out = path.resolve('out/stills');
mkdirSync(out, { recursive: true });
const serveUrl = await bundle({ entryPoint: path.resolve('film/src/index.ts'), publicDir: path.resolve('public') });
const composition = await selectComposition({ serveUrl, id: 'PaanaiFilm', port: 3456 });
for (const s of secs) {
  const frame = Math.min(composition.durationInFrames - 1, Math.round(s * 60));
  await renderStill({ composition, serveUrl, frame, output: `${out}/s${String(s).replace('.', '_')}.jpg`, imageFormat: 'jpeg', jpegQuality: 85, chromiumOptions: { gl: 'angle' }, port: 3456 });
  console.log('still', s);
}
