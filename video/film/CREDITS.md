# Paanai film: credits and how it is made

A 2 min 56 s demo film, 1920x1080 at 60 fps. Everything on screen is the real game, recorded from the local harness.

## Narration
Placeholder AI narration (Microsoft Edge neural voice "Andrew", via `edge-tts`) until Mithilesh records his own.
Script: `film/narration.json`. To swap in a real recording, put `<id>.mp3` files in `public/film/vo/` and re-run
`python film/tools/tts.py` only for the word timings, or keep the timings and replace the audio (keep each line
about the same length, or update `film/vo.json`).

## Music
- "Warm Rural Cinematic Background Music for Documentary & Nature" from Pixabay (Pixabay Content License: free for commercial use, no attribution required). https://pixabay.com/music/folk-warm-rural-cinematic-background-music-for-documentary-amp-nature-457762/

## Sound effects (Pixabay Content License)
- ceramics_wheel (freesound_community) https://pixabay.com/sound-effects/film-special-effects-ceramics-wheel-85102/
- Fire in furnace (AudioPapkin) https://pixabay.com/sound-effects/film-special-effects-fire-in-furnace-318347/
- fire-whoosh (freesound_community) https://pixabay.com/sound-effects/film-special-effects-fire-whoosh-85834/
- Whoosh Motion (DRAGON-STUDIO) https://pixabay.com/sound-effects/film-special-effects-whoosh-motion-405445/

## Fonts
Bagel Fat One, Fraunces, Outfit (SIL Open Font License), the same files the game ships.

## How it is made (run from `video/`)
1. Harness on :5174: `npx vite --config vite.harness.config.ts --port 5174 --strictPort` (from the repo root).
2. `node film/tools/seed.mjs 9 3` seeds ten potters over nine days, ending on the Paanai commission.
3. `node film/tools/shoot.mjs hero collapse hand vessels` records the 3D wheel frame by frame on a virtual clock
   (`film/tools/vrec.mjs`, exact 60 fps). Then move the harness day back with `/__harness/advance-day?n=3`
   (the vessels shoot moves it back 3 days) and run `node film/tools/shoot.mjs phone splash`, then `node film/tools/codex.mjs`.
4. `python film/tools/encode.py` turns frames into 60 fps clips in `public/film/clips/`.
5. `python film/tools/tts.py` makes the narration and its word timings (`film/vo.json`).
6. Preview frames: `node film/tools/stills.mjs 3 18 45` (seconds) writes `out/stills/`.
7. Render: `npx remotion render film/src/index.ts PaanaiFilm out/paanai-film.mp4 --codec=h264 --crf=17 --gl=angle --concurrency=6 --port=3456 --audio-bitrate=320k --public-dir=public`

8. Final pass (TV colour range, -14 LUFS for YouTube) writes `out/Paanai_Demo_Film.mp4`:
   `ffmpeg -i out/paanai-film.mp4 -vf scale=in_range=pc:out_range=tv,format=yuv420p -color_range tv -colorspace bt709 -color_primaries bt709 -color_trc bt709 -c:v libx264 -preset slow -crf 15 -movflags +faststart -af loudnorm=I=-14:TP=-1:LRA=9 -c:a aac -b:a 320k out/Paanai_Demo_Film.mp4`

Timing lives in `film/src/timeline.ts` (scene windows and when each narration line starts); every on-screen
word that matches the narration is placed from the voice's word timings, so a new voice re-syncs automatically.
