// Production build of the local harness, for sharing a preview link through a tunnel.
//   npm run share        -> builds dist-share/ and serves it on http://0.0.0.0:5174
// Client: the studio bundled and minified (a few files instead of hundreds of dev modules).
// Server: src/server/harness.ts bundled for Node; tools/serve-share.mjs serves both.
import { defineConfig } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';

const root = path.resolve(import.meta.dirname, 'src/client');

export default defineConfig(({ isSsrBuild }) =>
  isSsrBuild || process.env.SHARE_SSR
    ? {
        build: {
          ssr: path.resolve(import.meta.dirname, 'src/server/harness.ts'),
          outDir: path.resolve(import.meta.dirname, 'dist-share/server'),
          emptyOutDir: true,
          rollupOptions: { output: { entryFileNames: 'harness.mjs' } },
        },
      }
    : {
        root,
        publicDir: path.resolve(import.meta.dirname, 'public'),
        plugins: [preact()],
        resolve: { alias: { '@devvit/web/client': path.resolve(root, 'harness/devvit-client-mock.ts') } },
        build: {
          outDir: path.resolve(import.meta.dirname, 'dist-share/client'),
          emptyOutDir: true,
          rollupOptions: { input: path.resolve(root, 'studio.html') },
        },
      },
);
