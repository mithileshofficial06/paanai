# Paanai: build progress

> Read this file first on every run. Resume from **Next action**. Update it after every step.

## Status

- **Current milestone:** M1-M4 server + core DONE; client in progress (3D stage + glass UI kit by subagents; studio store/controller + splash done by lead)
- **Next action:** when the 3D and UI subagents report: review screenshots, commit their work; then (a) SendMessage the UI agent to build `src/client/studio/App.tsx` + `src/client/studio/screens/*` on top of `studio/store.ts` + `studio/controller.ts` (routes: welcome/starter reveal, howto, features, throw, result, glaze, kiln, shelf, codex, commissions, create, leaderboard; bottom nav); (b) SendMessage the 3D agent to add glaze material (`app/glazeLook.ts` params), kiln reveal scene, ghost replay pot, thumbnails with glaze; then `npm run build`, harness play-through, `devvit playtest`.
- **Last updated:** 2026-11-12 07:05 IST

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

- Content (opus, medium): 35 official commissions in `src/shared/content/commissions.ts` + `tests/unit/commissions.test.ts`.

- 3D throw stage (opus, max): `src/client/three/**`, `src/client/input/**`, `src/client/dev/throw-lab.*`, `tools/shoot.mjs`, `public/textures`, `public/env`.
- Glass UI design system + HowToPlay + Features screens (opus, max): `src/client/styles/**`, `src/client/ui/**`, `src/client/dev/ui-lab.*`, `public/fonts`.

## Needs Mithilesh

- **Watchdog (auto-resume after usage limits):** auto mode blocked me from registering the Windows scheduled task. To enable it, run this once in PowerShell:
  `Register-ScheduledTask -TaskName 'Paanai Build Watchdog' -Action (New-ScheduledTaskAction -Execute 'powershell.exe' -Argument '-NoProfile -WindowStyle Hidden -ExecutionPolicy Bypass -File "D:\Projects\2-In-Progress\paanai\tools\watchdog\watchdog.ps1"') -Trigger (New-ScheduledTaskTrigger -Once -At (Get-Date).AddMinutes(5) -RepetitionInterval (New-TimeSpan -Hours 1) -RepetitionDuration (New-TimeSpan -Days 30)) -Settings (New-ScheduledTaskSettingsSet -StartWhenAvailable -MultipleInstances IgnoreNew -ExecutionTimeLimit (New-TimeSpan -Hours 6))`
  It runs hourly; if nothing has been committed for 75+ minutes it starts a headless Claude run (`--permission-mode auto`) that resumes from this file. Remove it with `Unregister-ScheduledTask 'Paanai Build Watchdog'`.
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
