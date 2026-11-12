import { serve } from '@hono/node-server';
import { createServer, getServerPort } from '@devvit/web/server';
import { createApp } from './app';
import { setPlatform } from './platform';
import { devvitPlatform } from './platform/devvit';

setPlatform(devvitPlatform);

serve({
  fetch: createApp().fetch,
  createServer,
  port: getServerPort(),
});
