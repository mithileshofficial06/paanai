import { Hono } from 'hono';
import { api } from './routes/api';
import { internal } from './routes/internal';
import { ApiErr } from './services/errors';

/** Builds the Hono app. Platform-agnostic: index.ts (Devvit) and harness.ts (local) set the platform. */
export function createApp(): Hono {
  const app = new Hono();
  app.route('/api', api);
  app.route('/internal', internal);
  app.onError((err, c) => {
    if (err instanceof ApiErr) return c.json({ error: { code: err.code, message: err.message } }, err.status);
    console.error('unhandled', err);
    return c.json({ error: { code: 'server', message: 'Something went wrong in the studio. Please try again.' } }, 500);
  });
  app.notFound((c) => c.json({ error: { code: 'not-found', message: 'No such route.' } }, 404));
  return app;
}
