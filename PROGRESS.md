# Paanai: build progress

> Read this file first on every run. Resume from **Next action**. Update it after every step.

## Status

- **Current milestone:** M1-M4 server + core DONE; client in progress. PAUSED 07:15 IST by Mithilesh (5-hour usage hit 79%); auto-resume via the watchdog task from 10:55 IST.
- **Next action (in order, ONE subagent at a time, see USAGE RULES):**
  1. Finish the 3D throw stage TO THE REALISM SPEC below (top priority). Committed WIP (unreviewed) in `src/client/three/` (renderer, cameraRig, environment, wheel, potMesh, displayProfile, clayMaterial, textures, overlays) and `src/client/input/` (oneEuro, pointerMapper). Still missing: `src/client/three/throwStage.ts` (the public API spec is in the "3D stage spec" section below), studio scene assembly, `src/client/dev/throw-lab.html/.ts`, `tools/shoot.mjs`. Read the WIP files first, then finish (opus, effort high), typecheck, at most 3 screenshot rounds.
  2. Finish the UI kit. Committed WIP in `src/client/ui/` (AppBackground, Avatar, Button, Chip, CommissionCard, GlassPanel, HintBubble, PotSilhouette, ProgressBar, ScoreRing, Sheet, Skeleton, Stars, StatRow, States, Stepper, Tabs, Toast, icons, hooks) and `src/client/styles/` (tokens.css, base.css; components.css may be missing). Still missing: `ui/screens/HowToPlay.tsx`, `ui/screens/Features.tsx`, `src/client/dev/ui-lab.*`. Fonts are in `public/fonts` (done).
  3. Build `src/client/studio/App.tsx` + `src/client/studio/screens/*` on top of `studio/store.ts` + `studio/controller.ts` (routes: welcome/starter reveal, howto, features, throw, result, glaze, kiln, shelf, codex, commissions, create, leaderboard; bottom nav: Wheel, Kiln, Shelf, Codex, Commissions; More: leaderboard, how to play, features, sound).
  4. 3D additions: glaze material driven by `app/glazeLook.ts`, kiln reveal scene, ghost replay pot, thumbnails with glaze.
  5. 35 official commissions (content task was stopped before it changed anything): see the "Content task" section below.
  6. `npm run build`, harness play-through, `npm run dev` (devvit playtest), then M5 polish + README.
- **Last updated:** 2026-11-12 07:20 IST

## USAGE RULES (Mithilesh, 2026-11-12, after the 5-hour window hit 79% in about an hour)

- Two max-effort subagents running in parallel with screenshot loops burned the session window. From now on:
  - at most ONE subagent at a time;
  - visual/3D work at effort **high** (not max), simple work at **medium**; never max;
  - at most 3 screenshot review rounds per task; screenshots at 1x device scale;
  - prefer doing small things in the main session instead of spawning agents.

## REALISM SPEC (Mithilesh, 2026-11-12 07:40: "make the 3D and shaping look more realistic; people should feel like they are actually doing it")

This is the top priority of step 1. The throw must look and feel like real wheel throwing, not a 3D toy. Build the core feel first, check it in 3 screenshot rounds max, then add the rest.

Feel (input), highest priority:
- **Pulling up = an upward drag along the wall** (like a real potter's pull). Default "hands" mode infers the gesture by angle: mostly upward along the wall after opening = THIN (pull), mostly sideways = PUSH. Push/Thin tool buttons stay as overrides. dr comes from finger speed.
- **Resistance and momentum:** the clay lags the finger slightly (spring-damper on the displayed contact point, One-Euro on input); a resting finger does nothing; fast jerks are clamped. Wheel speed ramps up while touching and coasts down after.
- **Water / dryness (client-side, deterministic-safe):** clay slowly dries during a throw; dry clay scales the recorded dr down (more resistance) and loses its sheen. An "Add water" button (or a two-finger tap) re-wets it with a splash, sheen and sound. Scaling happens BEFORE recording, so replay stays exact.
- **Centering intro (cosmetic, about 2 s, skippable):** the lump starts slightly off-centre and wobbling; pressing and holding centres it (wobble decays, a "centred" chime). It doesn't touch the profile.
- **Haptics:** `navigator.vibrate` pulses scaled to pressure and speed while shaping (guarded); a stronger pulse at the unsafe threshold.
- **Sound:** use `app/audio.ts`: `wheel(speed)` continuously, `squelch(intensity)` on movement, `thump()` on open, `flop()` on slump, plus a water splash.

Look:
- **Wet clay:** a darker wet-stoneware colour with a glossy slip film; moving specular highlights as it spins; grog speckles and slurry streaks that visibly ROTATE so the spin is readable; subtle subsurface warmth; wet patches darker where touched.
- **Throwing rings you made:** a cosmetic per-display-ring "ridge" buffer deepened where the finger passed and slowly relaxed; rendered as spiral ridges in the normal map. Your marks should stay on the pot.
- **Contact:** a visible fingertip (or rib/sponge tool) at the contact point pressing into the clay, a small slurry lip building above it, slip droplets/spray particles flung outward at speed, water drips running down the wall.
- **Wheel and studio:** a wet cast-metal wheel head with a slurry ring, a splash pan with slip, a water bowl and sponge as props, a soft contact shadow, window key light plus warm fill plus a red brand rim light, a gentle camera sway, background depth of field (cheap), and an ember glow.
- **Physics read:** wobble is a real off-axis precession with a growing amplitude; slump is an animated sag where the rim folds and the walls bulge, then settle.
- **Performance stays:** 60 fps target on a mid-range Android, adaptive DPR, everything cosmetic on the client only. The core (`src/shared/core`) never changes for looks.

## 3D stage spec (for step 1)

`src/client/three/throwStage.ts` must export `createThrowStage(opts): ThrowStage` with:
`setTool('push'|'thin')`, `open()`, `undo(): boolean`, `reset()`, `finish(): StrokeLog`, `getProfile(): Profile`, `setInputEnabled(on)`, `setPaused(p)`, `setTarget(profile|null)`, `renderThumbnail(profile, size): Promise<string>` (PNG data URL), `dispose()`; options `{ canvas, target?, reducedMotion?, onChange?(ThrowState) (<=10 Hz), onEvent?('opened'|'wobble-start'|'slumped'|'stroke-start'|'stroke-end'|'limit') }`; `ThrowState = { heightMm, capacityMl, minWallMm, maxDiameterMm, opened, unsafe, wobble, slumped, strokes, ticks, secondsLeft, matchPreview }`.
Determinism contract: fixed 30 Hz sim via accumulator; every tick `recorder.record(inputOrNull)` then `step()` or `idle()` exactly like `replay()`; `recorder.endStroke()` on pointer up; stop at `recorder.full`. Input: vertical finger position -> ring (0..47 over the pot's on-screen height); Push tool = horizontal drag (toward axis narrows, away widens), dr clamped -64..63, One-Euro filtered, dead zone; Thin tool = drag along the wall thins it; tap on the lump top (or `open()`) opens. `touch-action: none` only on this canvas. Visual bar: realistic wet clay with throwing rings and sheen, metal wheel head + splash pan, dark studio with red rim light and ember glow, target outline glow, wobble shake, cosmetic slump droop.

## Content task (for step 5)

Expand `OFFICIAL` in `src/shared/content/commissions.ts` from 6 to 35 (keep the first 6 unchanged). Each: unique id, real symmetric historical vessel (no handles/spouts), origin, factual note <= 110 chars, 0-2 constraints; the Master's own pot must not slump, must have no kiln defects and must pass its own constraints (check with `npx tsx tools/try-recipes.ts`). Add `tests/unit/commissions.test.ts` asserting those plus variety (no two silhouettes with silhouetteMatch >= 92). Tuning notes: 4-5 pulls of dr 8 give 150-195 mm pots with 6-8 mm walls; a 6th pass slumps; big outward pushes (dr > ~14 mid-height on thin walls) cause kiln-slump.

## Done

- Template cloned from github.com/reddit/devvit-template-threejs (Devvit Web 0.15.2, three 0.187, Hono 4.13, Vite 8, TS 6). Fresh git repo.
- Deterministic core (`src/shared/core`): profile, shape (push/thin/open, clay conservation, wobble -> slump), stroke codec + recorder with undo, survival (kiln defects), score (IoU match, evenness, constraints, efficiency, stars). Property + unit tests.
- Content: 6 official commissions as scripted Master throws (`src/shared/content`), tuned with `npx tsx tools/try-recipes.ts`; each passes its own constraints and survives the kiln.
- Server (`src/server`): Platform interface (`platform/devvit.ts` real, `platform/memory.ts` harness/tests), keys, daily (calendar, atmosphere, idempotent rollover + post), commissions, throws (server replay scoring, ranked/practice, idempotency, rate limit, logged-out), leaderboard, users (ranks, streak, flair), routes `/api/today|throw|leaderboard|commission/:id|me/hints`, `/internal/cron/daily-rollover`, menu, install trigger.
- Local harness: `npm run harness` -> http://127.0.0.1:5173 (Vite dev server running the REAL server routes on the in-memory platform; `?user=alice`, `?user=anon`; `/__harness/advance-day`, `/__harness/state`, `/__harness/reset`).
- `devvit.json`: entries `default` (splash.html, tall) + `studio` (studio.html); permissions redis/media/journeys/reddit(scope user); daily-rollover cron; settings minRankToCommission, journeymanPoints (default 3), reportsToHide.
- Tests: 24 passing (`npx vitest run`). Server typecheck clean.

- Kiln + glazes: `glazes.ts` (8 glazes, 3 applications, 24 effects, shape facts; all 24 proven reachable), `fire.ts`; server kiln (glaze -> queue -> 00:00 UTC; batch + fire-on-read identical; Codex first-discoverer transaction; Kiln Report comment), Shelf (Pot of the Week), likes, reports auto-hide, delete, share-as-user, starter pot.
- Player commissions (Beat the Commissioner): rank-gated, 1/day, word-list titles, constraints derived from the maker's own pot (always solvable), posted as user; ghost log served; patron points; mod remove.
- Fair bar: `barFor()` = commissioner's real evenness/constraints/efficiency with shape match fixed at 85% (a pot matches itself 100%, so the raw self-score ~96 was unbeatable). Official bars ~85-88.
- Journeys telemetry (Hono port of the analytics router, Devvit build only) + client wrapper.
- Client infra: `app/api.ts`, `app/audio.ts` (procedural Web Audio SFX, no files), `app/glazeLook.ts`, `app/silhouette.ts`, `app/journeys.ts`; inline splash (`splash.html/ts/css`, no three.js) screenshot-verified; studio `store.ts` + `controller.ts`, `studio.html`, `studio/main.tsx`.
- Tests: 36 passing.

## In flight (subagents)

- None. All three helpers were stopped at 07:15 IST to save usage; their partial work is committed as WIP (commit dcfdb1f).

## Needs Mithilesh

- **Watchdog: INSTALLED 2026-11-12 07:22 IST.** Windows task "Paanai Build Watchdog" runs `tools/watchdog/watchdog.ps1` hourly from 10:55 IST. If nothing has been committed for 75+ minutes and PROGRESS.md does not contain "ALL MILESTONES DONE", it starts a headless Claude run (opus, effort high, `--permission-mode auto`) that resumes from this file. Logs: `.paanai/watchdog-<date>.log`. Remove with `Unregister-ScheduledTask 'Paanai Build Watchdog' -Confirm:$false`.
- Devvit login: done (u/mithileshofficial06).

## Known issues

- (none yet)

## Decisions log

- 2026-11-12: UI = Preact + @preact/signals (build guide §6.6), single `studio` expanded entry + `default` inline splash.
- 2026-11-12: Gestures = horizontal drag pushes clay in/out at that height with smooth falloff; fixed clay volume auto-adjusts height; separate "Thin walls" tool; tap centre to open; wobble then slump; undo.
- 2026-11-12: Kiln atmosphere is shown before glazing.
- 2026-11-12: Practice throws can be glazed and fired but are not ranked; one ranked throw per commission.
- 2026-11-12: Copy says "the next kiln", not "tonight".
- 2026-11-12: Journeyman gate for commissioning is a subreddit setting with low default thresholds.
- 2026-11-12: Dark (black-red) theme is forced everywhere (`data-theme="dark"`); the light tokens exist but are unused. Mithilesh asked for black-red glass.
- 2026-11-12: Bar to beat = `barFor()` (85% assumed shape match), not the raw self-score.
- 2026-11-12: Audio is synthesised (Web Audio), so no licensing or download weight.
- 2026-11-12: Kiln atmosphere for a date = hash of the date (shown before glazing); the kiln for date D fires at 00:00 UTC on D+1.
- 2026-11-12: Rank points = ranked throws + stars + fired pots + 5 x Codex discoveries. Journeyman at 3 (setting), Artisan 30, Master Potter 100.
- 2026-11-12: Devvit `reddit.scope: "user"` is how apps post as the user (`asUser` is unused per the schema).

---

## The brief (verbatim from Mithilesh, 2026-11-12)

Build the Paanai Reddit daily game autonomously. Do not wait for Mithilesh or ask questions; make sensible decisions and record them.

**Sources** (read first, every time you resume):
- `D:\Projects\3-Ideas-and-Research\reddit-daily-games\Paanai_Project_Report_v1.md` (what/why)
- `D:\Projects\3-Ideas-and-Research\reddit-daily-games\Paanai_Build_Guide_v1.md` (how; it wins over the report on conflicts)
- this file

**Rules:** commit after every meaningful step. NEVER push. NEVER run `devvit publish` or any launch/publish script (the launch script is renamed `launch:AFTER-DEC-9-ONLY`). `devvit upload` and `devvit playtest` are OK. If a real-Reddit step can't be done, test locally with mocks and list it under "Needs Mithilesh".

**Visual direction** (overrides the report's terracotta UI):
- Very polished, modern UI: deep black to red gradient background, glassmorphism panels (frosted blur, subtle borders, soft red glow), refined typography (bundled woff2: Fraunces display + Atkinson Hyperlegible or Inter for UI), no emojis, no generic component-library look, light/dark consideration, 44px touch targets, 16px+ text, reduced-motion support.
- Clay and glazes stay realistic ceramic colours. High-quality realistic 3D in three.js: wheel, pot, kiln, studio; PBR materials, environment lighting, CC0 textures/HDRIs (e.g. Poly Haven) downloaded and bundled locally (client cannot make external requests). Smooth animations, satisfying kiln reveal.
- Clear explanation: animated "How to play" onboarding, 3 contextual first-throw hints, a "What's in Paanai" features screen (Commissions, Kiln, Glaze Codex, Shelf, Beat the Commissioner), clear labels everywhere.

**Build order** (finish and commit each before the next):
1. Setup + safety rails + repo CLAUDE.md (guide §17) + shared core shaping with tests + wheel/pot rendering with input + local dev harness page with mocked API.
2. Scoring, server replay, /api/today, daily rollover job, inline splash, result card, onboarding/hints.
3. Glaze picker, fire() + 24-effect table, kiln queue/batch + fire-on-read, kiln reveal scene, Shelf, share-to-comments, report/hide.
4. Commissions + validation + ghost replay, patron points/badges, Codex + Kiln Report, flair ranks, logged-out play, Journeys events.
5. 35 commissions content, glaze balance simulation, art/audio polish (placeholder or CC0 audio with CREDITS.md), performance budgets, accessibility, mod tools, judge-facing README.md.

**Model / effort delegation** (explicitly requested by Mithilesh):
- Complex work stays in the main session: deterministic core, architecture, server logic, integration, debugging.
- Simpler tasks (setup chores, content data, README, simple screens, routine tests/fixes) go to Agent subagents with model "opus" and effort "medium".
- 3D assets, materials, shaders, glass UI styling, kiln reveal and visual polish go to Agent subagents with model "opus" and effort "max".
- Give subagents precise file paths and specs; review and verify their output before committing.

**Quality:** run typecheck, lint, tests and build after each milestone; fix failures before moving on. Render screens in a local browser (Playwright; the laptop has a dedicated RTX GPU, use it) and look at screenshots; iterate until it looks premium.

**Pacing:** after each step, continue. If a usage limit or error stops the run, the next run reads this file and continues from **Next action**. Stop only when all 5 milestones are done, then write a final summary at the top of this file.
