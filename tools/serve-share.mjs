// Serves the production harness build (dist-share/) for a shared preview link.
// Static files are gzip-compressed and cached; /api, /internal and /__harness go to the
// real server routes running on the in-memory platform.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';
import { pathToFileURL } from 'node:url';

const ROOT = path.resolve('dist-share/client');
const PORT = Number(process.env.PORT ?? 5174);
const { handle } = await import(pathToFileURL(path.resolve('dist-share/server/harness.mjs')).href);

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.woff2': 'font/woff2',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.json': 'application/json',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
};
const cache = new Map();

async function readBody(req) {
  const chunks = [];
  for await (const c of req) chunks.push(c);
  return Buffer.concat(chunks);
}

http
  .createServer(async (req, res) => {
    const url = req.url ?? '/';
    try {
      if (url.startsWith('/api/') || url.startsWith('/internal/') || url.startsWith('/__harness/')) {
        const body = req.method === 'GET' || req.method === 'HEAD' ? undefined : await readBody(req);
        const headers = new Headers();
        for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') headers.set(k, v);
        const r = await handle(new Request(`http://localhost${url}`, { method: req.method, headers, ...(body ? { body: new Uint8Array(body) } : {}) }));
        res.statusCode = r.status;
        r.headers.forEach((v, k) => res.setHeader(k, v));
        res.end(Buffer.from(await r.arrayBuffer()));
        return;
      }
      let p = decodeURIComponent(url.split('?')[0]);
      if (p === '/' || p === '') p = '/studio.html';
      const file = path.join(ROOT, path.normalize(p));
      if (!file.startsWith(ROOT)) {
        res.statusCode = 403;
        res.end();
        return;
      }
      let entry = cache.get(file);
      if (!entry) {
        const raw = await readFile(file);
        const type = TYPES[path.extname(file)] ?? 'application/octet-stream';
        const gz = /text|javascript|json|svg/.test(type) ? zlib.gzipSync(raw, { level: 9 }) : null;
        entry = { raw, gz, type };
        cache.set(file, entry);
      }
      res.setHeader('content-type', entry.type);
      res.setHeader('cache-control', p.startsWith('/assets/') ? 'public, max-age=31536000, immutable' : 'no-cache');
      if (entry.gz && /gzip/.test(req.headers['accept-encoding'] ?? '')) {
        res.setHeader('content-encoding', 'gzip');
        res.end(entry.gz);
      } else res.end(entry.raw);
    } catch (err) {
      res.statusCode = err?.code === 'ENOENT' ? 404 : 500;
      res.end(res.statusCode === 404 ? 'Not found' : String(err));
    }
  })
  .listen(PORT, '0.0.0.0', () => console.log(`Paanai share server on http://0.0.0.0:${PORT}/studio.html`));
