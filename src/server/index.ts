import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { createApp } from './app';
import { setPlatform } from './platform';
import { devvitPlatform } from './platform/devvit';
import { telemetryRoutes } from './routes/telemetry';

setPlatform(devvitPlatform);

const app = createApp();
app.route('/api/telemetry', telemetryRoutes);

serve({
  fetch: app.fetch,
  createServer,
  port: getServerPort(),
});
