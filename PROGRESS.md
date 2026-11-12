# Paanai: build progress

> Read this file first on every run. Resume from **Next action**. Update it after every step.

## Status

- **Current milestone:** M1 (setup + shaping core + wheel/pot rendering + local harness)
- **Next action:** finish M1 setup: placeholders, scripts, deps, CLAUDE.md, then `src/shared/core` shaping.
- **Last updated:** 2026-11-12 06:25 IST

## Done

- Template cloned from github.com/reddit/devvit-template-threejs (Devvit Web 0.15.2, three 0.187, Hono 4.13, Vite 8, TS 6). Fresh git repo.

## Needs Mithilesh

- (none yet: Devvit login reported done on 2026-11-12)

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
