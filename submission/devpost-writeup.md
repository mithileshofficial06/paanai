# Devpost submission: Paanai

Paste each part into the matching Devpost field.

---

## Project name

Paanai

## Elevator pitch (tagline, max 200 characters)

A daily pottery game inside a Reddit post. Throw a real vessel from history on a 3D wheel, paint it, and fire it in one kiln the whole subreddit shares.

## Try it out (links)

- https://www.reddit.com/r/paanai_game_dev/
- https://github.com/mithileshofficial06/paanai

## Video demo link

(YouTube link, once uploaded)

## Built with

devvit, typescript, three.js, preact, hono, redis, vite, vitest, playwright, webgl, web-audio

---

## About the project

### Inspiration

A *paanai* is the Tamil clay cooking pot, still made on a wheel the same way it was centuries ago. Pottery is one of the oldest things people make, yet almost every daily game asks you to guess a word or move a tile. I wanted a daily game where you **make** something with your hands, and where the community does something together instead of just comparing scores.

Real potters share a kiln. You put your pot in, the whole studio fires together overnight, and nobody knows what the fire will do until the door opens the next morning. That shared moment felt made for a subreddit.

### What it does

Every day the subreddit gets one **commission**: a real vessel from a real tradition, such as a Korean moon jar, a Tamil paanai or a Song dynasty meiping. Everyone throws the same pot.

1. **Shape it.** Open the clay on a spinning 3D wheel, then drag up the wall to pull it taller or sideways to push it in and out. A glowing outline shows the target, and the Done button lights up when your pot passes.
2. **Get scored.** The server replays your strokes and scores the shape, how even the walls are, and the commission's rules. Your first throw each day is ranked.
3. **Paint it.** Bands, patterns, a body colour or a painted rim, straight onto the 3D pot.
4. **Fire it with everyone.** Every pot in the subreddit fires together at 00:00 UTC. Thin or uneven walls can crack. The kiln master picks the glaze, so each firing is a surprise.
5. **Open the kiln.** Come back the next day to see what the fire made. The first potter to fire each of the 24 glaze effects gets their name in the Glaze Codex.
6. **Show it off.** Put pots on show for others to rate and like, share yours as a comment on the day's post, or turn one into a challenge for others to beat.

A new player's very first pot gets a 10-second test firing, so they see the whole loop on their first visit. Until that first pot comes out of the kiln, the game shows only the daily loop; then the rest of the studio opens: 100 levels, the Showcase, the Codex, the leaderboard and challenges.

### How I built it

- **Devvit Web** runs the game inside a Reddit post. A light feed card (no three.js) animates the loop and shows live numbers: potters at the wheel today, the score to beat, and the time until the kiln fires.
- **three.js** draws the wheel, the wet clay (it dries as you work, wobbles before it collapses, and shows throwing rings), and the painted and glazed pots.
- **Fair scores.** The shaping core is integer-only and deterministic and lives in shared code. The client sends only a compact log of strokes; the server replays it from a fresh lump of clay and scores it. Nobody can send a fake score.
- **Hono and Redis** on the server hold players, throws, the kiln queue, the Showcase, ratings and the Codex. Scheduler jobs run the daily rollover, the nightly firing, a Kiln Report comment and a weekly Pot of the Week.
- **Preact with signals** for the studio screens. Sound is synthesised live with Web Audio, so there are no audio files.
- **Testing.** I wrote an in-memory version of the Devvit platform so the whole game runs locally with a clock I can move forward by days. 59 unit tests cover the shaping core, scoring, the kiln and the server; a 21-step Playwright run plays the game as a brand-new player.

### Challenges I ran into

- **Making clay feel like clay** on a phone screen with one finger. Mapping a drag to pulling and pushing a wall, and making collapse feel fair, took many rounds.
- **Scores that can't be faked** while the wheel still feels instant. The answer was a deterministic core shared by client and server, with the server replaying every throw.
- **A daily game is hard to test,** because the interesting moments happen at midnight. The local platform with a movable clock made it possible to test the rollover and the kiln in seconds.
- **The first visit.** New players saw too much at once, and the overnight kiln meant they left before the best part. A simple first run and a 10-second first firing fixed both.

### Accomplishments that I'm proud of

- The kiln works as a community moment: everyone's pots fire together and open together.
- 35 real vessels from different cultures, each with its origin, and 100 levels.
- The feed card explains the game in about ten seconds without any text to read.
- The whole loop runs on Reddit's own platform, with nothing outside Reddit.

### What I learned

How to keep a game fair by sharing a deterministic core between client and server, how much the first sixty seconds decide whether someone stays, and how to design for a community instead of a single player.

### What's next for Paanai

- Seasonal commissions chosen by the community.
- Studio collaborations: two potters throw and paint one pot together.
- More glaze effects and kiln atmospheres, and a monthly exhibition post of the best pots.
