// Local harness: runs the client with Vite dev server and the REAL server routes
// (src/server/app.ts) against an in-memory platform (Redis + Reddit + media mocks).
// The Devvit backend does not run locally, so this is how we play and screenshot.
//   npm run harness   ->  http://localhost:5173/studio.html?user=alice
import { defineConfig, type Plugin, type ViteDevServer } from 'vite';
import preact from '@preact/preset-vite';
import path from 'node:path';
import type { IncomingMessage, ServerResponse } from 'node:http';

const root = path.resolve(import.meta.dirname, 'src/client');

function readBody(req: IncomingMessage): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (c: Buffer) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}

function mockServer(): Plugin {
  return {
    name: 'paanai-mock-server',
    configureServer(server: ViteDevServer) {
      // Server and shared code live outside the client root: watch them and drop the SSR
      // module cache on change so the next /api request runs the new code.
      const watched = [path.resolve(import.meta.dirname, 'src/server'), path.resolve(import.meta.dirname, 'src/shared')];
      server.watcher.add(watched);
      server.watcher.on('change', (file) => {
        if (watched.some((w) => path.resolve(file).startsWith(w))) server.environments.ssr.moduleGraph.invalidateAll();
      });
      server.middlewares.use(async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
        const url = req.url ?? '';
        if (!url.startsWith('/api/') && !url.startsWith('/internal/') && !url.startsWith('/__harness/')) return next();
        try {
          const mod = (await server.ssrLoadModule(path.resolve(import.meta.dirname, 'src/server/harness.ts'))) as {
            handle: (r: Request) => Promise<Response>;
          };
          const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
          const headers = new Headers();
          for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
          const request = new Request(`http://localhost${url}`, {
            method: req.method ?? 'GET',
            headers,
            ...(body ? { body } : {}),
          });
          const response = await mod.handle(request);
          res.statusCode = response.status;
          response.headers.forEach((v, k) => res.setHeader(k, v));
          res.end(Buffer.from(await response.arrayBuffer()));
        } catch (err) {
          server.config.logger.error(String(err instanceof Error ? err.stack : err));
          res.statusCode = 500;
          res.setHeader('content-type', 'application/json');
          res.end(JSON.stringify({ error: { code: 'harness', message: String(err) } }));
        }
      });
    },
  };
}

export default defineConfig({
  root,
  publicDir: path.resolve(import.meta.dirname, 'public'),
  plugins: [preact(), mockServer()],
  resolve: {
    alias: {
      '@devvit/web/client': path.resolve(root, 'harness/devvit-client-mock.ts'),
    },
  },
  server: { port: 5173, strictPort: true, host: '127.0.0.1' },
});
