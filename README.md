# Paanai

**A daily pottery game that lives inside a Reddit post.** Every day the subreddit gets a new commission: a real vessel from a real tradition, such as a Korean moon jar, a Tamil paanai or a Song dynasty meiping. You throw it on a spinning wheel with your finger, paint it, and put it in the shared kiln. Every pot fires together overnight, and the next day you open the kiln to see what the fire made.

Built with Devvit Web for Reddit's Game of the Day Hackathon.

## How to play

1. **See the commission.** The post shows today's vessel, where it comes from, and the score to beat.
2. **Throw it.** Tap **Open** to open the clay, then drag up the wall to pull it taller and thinner, or sideways to push it in or out. A glowing outline shows the target shape. Tap **Done** when it matches.
3. **Get scored.** The server replays your strokes and scores how well the shape matches, how even the walls are, and the commission's constraints. Your first throw of each commission is ranked; later throws are practice.
4. **Paint it.** Turn the pot and tap to paint with a brush, colours and patterns, or leave it bare.
5. **Fire it.** Painted pots fire together at 00:00 UTC. The kiln master picks the glaze, so every firing is a surprise. Thin or uneven walls can crack. Come back the next day to open the kiln.
6. **Show it off.** Put any pot on show in the Showcase, or share it as a comment on the day's post with one tap.

New players get a starter pot fresh from the kiln, a short tutorial, and hints during their first throw.

## Features

| Feature | What it does |
|---|---|
| Daily Commission | 35 real vessels in rotation. Everyone throws the same one each day, against a score to beat |
| 100 Levels | A hundred sealed boxes, each a vessel to match. Clear one to unseal the next and earn up to three stars |
| Realistic wheel | Wet clay that dries as you work, throwing rings, wheel spin-up, wobble before a collapse, haptics and sound |
| Painting | Brush, colours and patterns painted straight onto the 3D pot |
| The Kiln | A shared overnight firing for the whole subreddit; your shape and the fire decide the result |
| Glaze Codex | 24 effects to discover, from celadon to oil spots; the first potter to fire each one gets their name on it |
| The Showcase | Put pots on show; everyone can rate them out of five and like them; the most liked becomes Pot of the Week |
| Share on Reddit | Posts your pot as a comment on today's post, with its picture and score |
| Beat the Commissioner | Journeymen post their own pot as a commission; others try to beat it, and the maker earns patron points |
| Ranks and flair | Apprentice, Journeyman, Artisan, Master Potter, shown as user flair |
| Leaderboard | Today's ranked throws for the commission |

## Fair play

- The shaping core is **integer-only and deterministic**. The client sends only a compact stroke log. The server replays it from a fresh lump of clay, so scores can't be faked.
- One ranked throw per commission, rate limits, and duplicate submissions are ignored.
- Reports auto-hide a pot or commission after a moderator-set threshold. Moderators also get menu items to post today's commission, fire the kiln now, view stats and remove a commission.

## Tech

- Devvit Web 0.15, Hono server, Redis. Scheduler jobs handle the daily rollover, kiln firings, the Kiln Report comment and the weekly tally.
- Client: Preact with signals, and three.js for the wheel, wet clay, painted and glazed pots, and the ghost replay. The inline post preview (`splash.html`) doesn't use three.js, so the feed stays fast.
- Audio is synthesised with Web Audio, so there are no sound files to license.
- Fonts: Bagel Fat One, Fraunces and Outfit (SIL Open Font License, bundled with their licence files).

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
