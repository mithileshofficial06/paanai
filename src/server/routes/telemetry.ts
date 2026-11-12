// Journeys analytics (Reddit's "stand out" item). Hono port of @devvit/analytics' Express
// router: the client (`telemetry` from @devvit/analytics/client/reddit) posts to
// /api/telemetry/journey/*. Mounted only in the Devvit build (index.ts). No personal data
// is ever sent: only progress fractions, action names and game {win, score}.
import { Hono } from 'hono';
import { telemetry } from '@devvit/analytics/server/reddit';

export const telemetryRoutes = new Hono();

const str = (v: unknown): v is string => typeof v === 'string' && v.trim().length > 0;
const num = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);

telemetryRoutes.post('/journey/start', async (c) => c.json(await telemetry.startJourney()));

telemetryRoutes.post('/journey/app-ready', async (c) => c.json(await telemetry.appReady()));

telemetryRoutes.post('/journey/progress', async (c) => {
  const b = await c.req.json<Record<string, unknown>>();
  if (!str(b.journeyId) || !num(b.progress)) return c.json({ error: 'bad request' }, 400);
  return c.json(
    await telemetry.journeyProgress({
      journeyId: b.journeyId,
      progress: Math.max(0, Math.min(1, b.progress)),
      ...(str(b.action) ? { action: b.action } : {}),
    })
  );
});

telemetryRoutes.post('/journey/interaction', async (c) => {
  const b = await c.req.json<Record<string, unknown>>();
  if (!str(b.action)) return c.json({ error: 'bad request' }, 400);
  return c.json(await telemetry.journeyInteraction({ journeyId: str(b.journeyId) ? b.journeyId : '', action: b.action, actionDetails: '' }));
});

telemetryRoutes.post('/journey/end', async (c) => {
  const b = await c.req.json<Record<string, unknown>>();
  if (!str(b.journeyId)) return c.json({ error: 'bad request' }, 400);
  const g = typeof b.game === 'object' && b.game !== null ? (b.game as Record<string, unknown>) : null;
  return c.json(
    await telemetry.endJourney({
      journeyId: b.journeyId,
      complete: b.complete === true,
      ...(g ? { game: { win: g.win === true, score: num(g.score) ? g.score : 0 } } : {}),
    })
  );
});
