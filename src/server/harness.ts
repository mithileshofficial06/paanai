// Local harness entry (loaded by vite.harness.config.ts via ssrLoadModule). Runs the real
// app routes against the in-memory platform. ?user=<name> sets the logged-in user
// (omit or ?user=anon for logged-out). /__harness/* controls the fake world.
import { createApp } from './app';
import { setPlatform } from './platform';
import { createMemoryPlatform, type MemoryPlatform } from './platform/memory';

type HarnessGlobal = { __paanaiHarness?: { p: MemoryPlatform; app: ReturnType<typeof createApp> } };
const g = globalThis as HarnessGlobal;
// Keep the fake world (Redis, posts) across hot reloads, but always rebuild the app so
// route changes take effect.
const state = { p: g.__paanaiHarness?.p ?? createMemoryPlatform(), app: createApp() };
g.__paanaiHarness = state;
setPlatform(state.p);

export async function handle(req: Request): Promise<Response> {
  setPlatform(state.p);
  const url = new URL(req.url);
  const referer = req.headers.get('referer');
  const refUser = referer ? new URL(referer).searchParams.get('user') : null;
  const user = url.searchParams.get('user') ?? refUser ?? 'alice';
  const anon = user === 'anon';
  state.p.setCtx({
    userId: anon ? undefined : `t2_${user}`,
    username: anon ? undefined : user,
    postId: req.headers.get('x-harness-post') ?? 't3_harness',
  });

  if (url.pathname === '/__harness/advance-day') {
    state.p.shiftDays(Number(url.searchParams.get('n') ?? '1'));
    const r = await state.app.fetch(new Request('http://localhost/internal/cron/daily-rollover', { method: 'POST' }));
    return new Response(await r.text(), { headers: { 'content-type': 'application/json' } });
  }
  if (url.pathname === '/__harness/state') {
    return Response.json({
      keys: state.p.kv.size(),
      posts: state.p.posts,
      comments: state.p.comments.map((c) => ({ ...c, imageUrl: c.imageUrl ? '(image)' : undefined })),
      flairs: Object.fromEntries(state.p.flairs),
      now: new Date(state.p.now()).toISOString(),
    });
  }
  if (url.pathname === '/__harness/reset') {
    state.p = createMemoryPlatform();
    g.__paanaiHarness = state;
    setPlatform(state.p);
    return Response.json({ ok: true });
  }
  return state.app.fetch(req);
}
