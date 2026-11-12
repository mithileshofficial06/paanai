# Paanai

**A daily pottery game that lives inside a Reddit post.** Every day the subreddit gets a new commission: a real vessel from a real tradition, such as a Korean moon jar, a Tamil paanai or a Song dynasty meiping. You throw it on a spinning wheel with your finger, glaze it, and put it in the shared kiln. The next day you open the kiln to find out whether your pot survived and what the fire did to the glaze.

Built with Devvit Web for Reddit's Daily Games Hackathon.

## How a day plays

1. **See the commission.** The post shows today's vessel, where it comes from, its target silhouette and the score to beat.
2. **Throw it.** Press and hold to centre the clay, tap to open it, then drag up the wall to pull it taller and thinner. Drag sideways to push the clay in or out. A glowing outline shows the target shape, and you can turn on a ghost of the Master's own throw to see it form beside yours.
3. **Get scored.** The server replays your strokes and scores shape match (60%), even walls (20%), constraints (10%) and efficiency (10%). Your first throw of each commission is ranked; later throws are practice.
4. **Glaze and fire.** Choose up to two of eight glazes and an application. The kiln's atmosphere (oxidation or reduction) is shown before you choose, because it changes every glaze.
5. **Open the kiln tomorrow.** All pots fire together at 00:00 UTC. Thin or uneven walls can crack, and overhangs can slump. Glaze, wall thickness, shape and atmosphere decide which of 24 effects appear, from celadon to oil spots.

## Features

| Feature | What it does |
|---|---|
| Daily Commission | 35 real vessels in rotation, each with a scripted Master throw that sets the target and the bar |
| Realistic wheel | Wet clay that dries as you work (add water), throwing rings that keep your finger marks, slip spray, wheel spin-up, wobble before a collapse, haptics and sound |
| The Kiln | A shared overnight firing; the result depends on your skill, not luck alone |
| Glaze Codex | 24 effects to discover; the first potter to fire each one gets their name on it |
| The Shelf | Every fired pot in the community; likes and Pot of the Week |
| Beat the Commissioner | Journeymen post their own pot as a commission; others try to beat it, with the maker's ghost |
| Ranks and flair | Apprentice, Journeyman, Artisan, Master Potter |
| Share to comments | Post a 3D render of your pot to the thread with one labelled tap |
| Onboarding | A starter pot from "an old potter", an animated How to play, three first-throw hints, and a What's in Paanai screen |

## Fair play

- The shaping core is **integer-only and deterministic**. The client sends only a compact stroke log. The server replays it from a fresh lump, so the score cannot be faked.
- The bar to beat assumes an 85% shape match, so the Master's own score is beatable.
- One ranked throw per commission, rate limits, and idempotent submits.
- Reports auto-hide a pot or commission after a moderator-set threshold. Mods also get menu items to post today's commission, fire the kiln now, view stats and remove a commission.

## Tech

- Devvit Web 0.15, Hono server, Redis. Scheduler jobs handle the daily rollover, kiln batches, the Kiln Report comment and the weekly tally.
- Client: Preact with signals, and three.js for the wheel, wet clay shader, glazed pots and the ghost replay. The inline post preview (`splash.html`) has no three.js, so the feed stays fast.
- Audio is synthesised with Web Audio, so there are no sound files to license.
- Fonts: Fraunces and Atkinson Hyperlegible Next, bundled.

## Run it

```bash
npm install
npm test               # core, server and content tests (vitest)
npm run harness        # local studio at http://127.0.0.1:5173/studio.html?user=alice (in-memory server)
npm run build
npm run dev            # devvit playtest
```

Dev pages in the harness:
- `/dev/throw-lab.html?target=moon-jar` shows the wheel on its own.
- `node tools/shoot.mjs` runs a scripted throw and takes screenshots.
- `node tools/playthrough.mjs` clicks through every screen.
- `npx tsx tools/check-commissions.ts` validates all 35 commissions.

## Project layout

```
src/shared/core      deterministic shaping, strokes codec, survival, scoring, glazes, firing
src/shared/content   the 35 commissions and the gesture DSL for Master throws
src/server           routes, services (daily, throws, kiln, community, commissions), platform (Devvit / memory)
src/client/three     throw stage, wet clay and glaze shaders, wheel, offscreen pot renderer
src/client/studio    the expanded app: screens, store, controller
src/client/ui        glass UI kit
```
