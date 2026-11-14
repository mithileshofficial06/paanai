# Demo video credits

All gameplay is real footage of Paanai, recorded from the game itself (local harness and the live Reddit feed).
The throwing shot replays the Master's recorded throw through the real wheel (dev-only `autoplay`).

## Music
- "Travel Vibes" by Universfield, from Pixabay (Pixabay Content License: free for commercial use, no attribution required). https://pixabay.com/music/upbeat-travel-vibes-241585/

## Sound effects (Pixabay Content License)
- ceramics_wheel (freesound_community) https://pixabay.com/sound-effects/film-special-effects-ceramics-wheel-85102/
- Pottery (freesound_community) https://pixabay.com/sound-effects/household-pottery-61691/
- Fire in furnace (AudioPapkin) https://pixabay.com/sound-effects/film-special-effects-fire-in-furnace-318347/
- fire-whoosh (freesound_community) https://pixabay.com/sound-effects/film-special-effects-fire-whoosh-85834/
- Opening Metal Door (Universfield) https://pixabay.com/sound-effects/opening-metal-door-199581/
- Ceramic Plate Set Down (freesound_community) https://pixabay.com/sound-effects/film-special-effects-ceramic-plate-set-down-71330/
- Whoosh Motion (DRAGON-STUDIO) https://pixabay.com/sound-effects/film-special-effects-whoosh-motion-405445/
- UI Tap Soft Short (SoundShelfStudio) https://pixabay.com/sound-effects/film-special-effects-ui-tap-soft-short-514599/

## Fonts
Bagel Fat One, Fraunces, Outfit (SIL Open Font License), the same files the game ships.

## How it is made
1. `node capture/seed.mjs 8` (harness on :5174) seeds a community of potters.
2. `node capture/shoot.mjs` records the gameplay clips; `capture/feed.mjs` records the real Reddit feed.
3. `python capture/encode.py` turns frames into 30 fps clips; `npx tsx src/export-plan.ts` builds the edit plan.
4. `python capture/backgrounds.py` and `python capture/soundtrack.py` make the backgrounds and the mix.
5. `npx remotion render src/index.ts Paanai out/paanai-demo.mp4 --codec=h264 --crf=16 --gl=angle`
