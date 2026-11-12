# Paanai: build progress

> Read this file first on every run. Resume from **Next action**. Update it after every step.

## Status

- **Current milestone:** M1/M2 in parallel (core + server done; 3D stage and glass UI being built by subagents)
- **Next action:** when the subagents report, review their work (throw-lab + ui-lab screenshots), commit; then build the app shell (`src/client/studio.html` + `src/client/app/`), splash, Throw screen, result card, onboarding wiring; then `npm run build` and a playtest upload.
- **Last updated:** 2026-11-12 06:40 IST

## Done

- Template cloned from github.com/reddit/devvit-template-threejs (Devvit Web 0.15.2, three 0.187, Hono 4.13, Vite 8, TS 6). Fresh git repo.
- Deterministic core (`src/shared/core`): profile, shape (push/thin/open, clay conservation, wobble -> slump), stroke codec + recorder with undo, survival (kiln defects), score (IoU match, evenness, constraints, efficiency, stars). Property + unit tests.
- Content: 6 official commissions as scripted Master throws (`src/shared/content`), tuned with `npx tsx tools/try-recipes.ts`; each passes its own constraints and survives the kiln.
- Server (`src/server`): Platform interface (`platform/devvit.ts` real, `platform/memory.ts` harness/tests), keys, daily (calendar, atmosphere, idempotent rollover + post), commissions, throws (server replay scoring, ranked/practice, idempotency, rate limit, logged-out), leaderboard, users (ranks, streak, flair), routes `/api/today|throw|leaderboard|commission/:id|me/hints`, `/internal/cron/daily-rollover`, menu, install trigger.
- Local harness: `npm run harness` -> http://127.0.0.1:5173 (Vite dev server running the REAL server routes on the in-memory platform; `?user=alice`, `?user=anon`; `/__harness/advance-day`, `/__harness/state`, `/__harness/reset`).
- `devvit.json`: entries `default` (splash.html, tall) + `studio` (studio.html); permissions redis/media/journeys/reddit(scope user); daily-rollover cron; settings minRankToCommission, journeymanPoints (default 3), reportsToHide.
- Tests: 24 passing (`npx vitest run`). Server typecheck clean.

## In flight (subagents)

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
