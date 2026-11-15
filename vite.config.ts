import { copyFileSync, existsSync, mkdirSync, readdirSync, statSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { defineConfig, type Plugin } from 'vite';
import { devvit } from '@devvit/start/vite';
import preact from '@preact/preset-vite';

/**
 * Copy public/ into the client output after every build. In watch mode (devvit playtest) Vite only
 * copies public/ on the first build, so a rebuild dropped boot.js and the loader stuck at 0%.
 */
function keepPublicFiles(): Plugin {
  const pub = resolve(import.meta.dirname, 'public');
  const copyDir = (from: string, to: string) => {
    mkdirSync(to, { recursive: true });
    for (const name of readdirSync(from)) {
      const src = join(from, name);
      const dst = join(to, name);
      if (statSync(src).isDirectory()) copyDir(src, dst);
      else if (!existsSync(dst)) copyFileSync(src, dst);
    }
  };
  return {
    name: 'paanai-keep-public-files',
    apply: 'build',
    writeBundle(options) {
      const dir = (options.dir ?? '').replace(/[\\/]+$/, '');
      if (existsSync(pub) && /client$/.test(dir)) copyDir(pub, dir);
    },
  };
}

export default defineConfig({
  plugins: [preact(), devvit(), keepPublicFiles()],
});
