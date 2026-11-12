# Paanai: rules for agents

Read `PROGRESS.md` first; it has the brief, current state and the exact next action.

- NEVER run `devvit publish` or the `launch:AFTER-DEC-9-ONLY` script before 9 Dec 2026 (hackathon rule). `devvit upload` and `devvit playtest` are OK. NEVER `git push`.
- `src/shared/core` must stay deterministic: integers only; no Math.exp/sin/cos/pow/log/atan; no Date/Math.random. Division via `rdiv`/`fdiv`.
- The server never trusts client scores: it replays stroke logs with the shared core. Any change to shape/score/fire must keep `npx vitest run` green and update tests intentionally (explain why in the commit).
- All Redis keys come from `src/server/store/keys.ts` with a TTL policy. No plain sets/lists (unsupported on Devvit Redis).
- All Devvit access goes through `src/server/platform` (devvit.ts real, memory.ts harness/tests). Routes must work on both.
- Inline splash: no three.js, no `touch-action:none`, no `preventDefault` on wheel/touch, no inner scroll. Expanded mode only from a click (`requestExpandedMode`).
- Client makes no external requests; bundle fonts, audio and textures locally (`public/`).
- User actions (comment/post/subscribe) only from an explicit, labelled tap.
- UI copy: no emojis; say "the next kiln", not "tonight". No AI-tool mentions in README or description.
- Visual direction: black-to-red gradient, glassmorphism panels, Fraunces + Atkinson Hyperlegible, 44px targets, 16px+ text, reduced motion.
- Local play: `npm run harness` then http://127.0.0.1:5173/studio.html?user=alice. Screenshots: `node tools/shoot.mjs <url> <out.png> [w] [h] [waitMs]`.
- Budgets (build guide §13): splash JS <= 40 KB gz, studio JS <= 350 KB gz, textures <= 1.5 MB, audio <= 500 KB, fonts <= 120 KB.
