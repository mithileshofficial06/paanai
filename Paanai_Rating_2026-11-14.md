# Paanai: rating and rules check (14 Nov 2026)

This report updates the 15 Nov odds report, `Paanai_Win_Odds_2026-11-15.md`, which was written before Paanai had run inside Reddit. Since then the game has been tested in r/paanai_game_dev with two accounts, and six bugs that only appeared inside Reddit were fixed.

## Overall: 8.0 / 10 (was 7.5)

| Criterion | Score | Change | Why |
| --- | --- | --- | --- |
| Delightful UX | 7.5 | +0.5 | First visit works inside Reddit: kiln welcome, starter pot, tutorial. No overflow at 360px. Still many systems (levels, daily, paint, kiln, showcase, codex, challenges) to take in during a 3-minute judge visit. |
| Polish | 8.5 | +0.5, and no longer at risk of falling | It runs in the Reddit webview. App ready 3–5 s after the game frame starts loading. 45–58 fps on the wheel at 4× CPU throttle; levels map about 45 fps. Sharing works as the player. Checks: 57 unit tests, 21/21 e2e steps, lint, type check. Not yet tested on a real phone in the Reddit app. |
| Reddit-y | 8 | same | Showcase ratings and likes tested across 2 accounts, comment sharing as the player with flair, Pot of the Week, Codex discoverer names, mod tools. The player-made challenges, which are the strongest Reddit-y feature, are locked until Journeyman rank, so **a judge will never see them** unless the demo subreddit already has challenge posts. |
| Daily Content | 8 | same | A real historical vessel each day plus a shared overnight kiln. The 100 levels can make it look like a level game; lead with the daily commission. |

## Rules check (official rules, redditgameofday2026.devpost.com)

| Requirement | Status |
| --- | --- |
| Built on Devvit Web and runs on Reddit | Pass. Verified in r/paanai_game_dev |
| New project, or significantly updated during the hackathon | Pass. Built from 12 Nov |
| App listing link (developers.reddit.com/apps/paanai-game) | Pass. Created by upload or playtest |
| **Demo post in a PUBLIC subreddit with fewer than 200 members** | **Fail.** r/paanai_game_dev is private. Make a public demo subreddit, or install the dr-admin-approve app. |
| Detailed README.md at the repo root, describing the game and how to play | **Fixed 14 Nov** (commit f4e4e77). It now covers painting, the kiln master's glaze, Levels, Showcase ratings and likes, Share on Reddit, and the correct fonts. |
| Video under 1 minute, public on YouTube or Vimeo | Not made (optional, but judges may score from the write-up and video alone) |
| Do not publish the app | Pass. Upload and playtest only |
| Assets owned or licensed | Pass. OFL fonts with licence files, synthesised audio, CREDITS-UI.md |
| English | Pass |
| Devvit Rules (posting as the player is a labelled tap; app-account fallback) | Pass |
| "AI slop" and fitting the viewport | Pass. Fits at 360px, has its own visual identity; don't mention AI tools in the write-up |
| "Common ideas" penalty | Pass. 0 pottery games in about 2,400 past Reddit hackathon entries |
| Developer survey (Feedback Award) | To do |

## Comparison with the field

**This hackathon:** 1,127 registered participants (up from 1,020). Devpost hides the project gallery until judging, so the current entries can't be seen yet. The previous identical contest drew about 520 entries for 1 grand prize and 10 honourable mentions.

**Past winners closest to Paanai:**
- **BridgeDit! (won Best Daily Game, Daily Games 2026):** cosy 3D crafting, level builder for player levels, cost and time leaderboards. This is Paanai's archetype: 3D, hand-made, cosy, crafted, community. BridgeDit's player-made levels were front and centre. Paanai's player challenges are hidden behind a rank, which is the biggest gap.
- **krawlings (won Best Use of User Contributions):** hand-modelled 3D, daily care, comments posted as GIFs. Paanai's comment sharing with a pot image is the same move.
- **SerpenTiles (won Best Mobile Game Play):** a meditative puzzle with sharable "pretty result" images. Paanai's painted pot plays the same role.

**Against all 1,225 past entries** (Daily Games Jan 2026, Games with a Hook Jun 2026 and earlier; 28 winners, 2.3%), scored on the 13 traits recorded for each:
- Paanai has all 13 traits once the video exists (12 without it). No past entry had more than 11.
- Traits that went with a higher win rate: tutorial (4.7% vs 1.9%), share (4.5% vs 1.3%), flair (4.3% vs 2.0%), 3D (4.0% vs 2.1%), async (3.7%), Journeys (3.6%), hand-made art (3.1%).
- **But stacking traits stops helping.** Entries with 6 traits won 4.3% (7 of 161), with 8 traits 8.5% (4 of 47), and with 9–11 traits only 2 of 34. RailDit!, made by BridgeDit's developer with 10 traits, didn't win. Past a point, judges reward a clear core and a quick payoff, not a feature count.
- Only 5 past winners were 3D: BridgeDit!, Hearthvale, Iso Chess, krawlings and XO Math Puzzles. 20 entries combined 3D, player-made content and sharing, and 2 of them won (10%).

**This hackathon's visible field** (posts on r/Devvit and r/GamesOnReddit in Oct–Nov 2026; Devpost shows no entries until judging, so this is only a sample):
- Mostly 2D daily puzzles, sorting and number games, and trivia or guessing games: Goods Sort, Snuggit, Sortello, Blind Number, Tilt, Orbitals, STARSEEK, Arrow Grove, Daily Trivia, Mystery Hooper, Upvote or Not, CrowdClash, Split Hairs, Rally Sleuth, TYPEBURST, Name That Part, Barn Find Daily.
- Strongest visible rivals on the "Reddit-y" criterion are community-shared worlds: **Uncharted** (the subreddit maps one treasure island together), **Jungle Knots** (a shared community boss), and a daily climber where everyone's falls rebuild the tower.
- The only other 3D entry seen is **Daily Cube**, a three.js Rubik's Cube race. The rules mark "clones of popular games" as a common idea, which hurts it.
- No other crafting or sculpting game appears. Paanai is the only entry seen where the player makes a physical object.
- r/Devvit has threads saying judging feels inconsistent ("Everything wrong with the reddit games hackathons", "Ghost Winners"). Expect high variance between good entries.

**Where Paanai stands:** I estimate it's in the top 5–10% of a typical field. Most entries are 2D Phaser or React boards, word or trivia games, or clones. Paanai has 7 of the 8 traits linked to winning in past contests, a 3D look, a concept new to Reddit, and server-checked scores. It trails the best past winners only on how quickly a judge reaches the payoff and on visible player-made content.

## Odds (estimates, not measurements)

| Outcome | As it is now | With the 4 fixes below |
| --- | --- | --- |
| $15,000 Best Daily Game | 5–7% | 8–12% |
| $1,000 Honorable Mention (and not the grand prize) | 15–22% | 22–32% |
| Any game prize | 20–28% | 30–42% |

Expected cash with the fixes is about $1,100–$1,600. The most likely single result is still no prize, because 11 game prizes are shared among about 500 entries, but a prize is now a realistic outcome.

## Fixes ranked by impact

1. **Critical: a public demo subreddit with fewer than 200 members.** Without it, judges can't open the game and the entry can't place. Seed it with 15–30 rated pots on show, a few fired pots, a Kiln Report comment and 2–3 player challenge posts.
2. **High: make player challenges visible to judges.** Seed challenge posts, or let anyone create one on the demo subreddit. This is what made BridgeDit win.
3. Done: README.md rewritten 14 Nov.
4. **High: a video under 60 seconds** showing throw, score, paint, kiln reveal, Showcase and comment share, filmed on a phone in the Reddit app (which also covers the real-phone test).
5. Medium: a 90-second path for judges from opening the post to seeing a fired pot. Lead the write-up with the daily commission and the shared kiln, with levels as practice.
6. Low: fill in the developer survey ($200 Feedback Award).
