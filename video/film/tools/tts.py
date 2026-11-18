"""AI narration for the film (placeholder until Mithilesh records his own).
Reads film/narration.json, writes public/film/vo/<id>.mp3 and film/vo.json with each line's length
and word timings (for the captions). Usage: python film/tools/tts.py [voice]
"""
import asyncio
import json
import os
import subprocess
import sys

import edge_tts
import imageio_ffmpeg

HERE = os.path.dirname(os.path.abspath(__file__))
FILM = os.path.dirname(HERE)
OUT = os.path.join(FILM, '..', 'public', 'film', 'vo')
FF = imageio_ffmpeg.get_ffmpeg_exe()
os.makedirs(OUT, exist_ok=True)
spec = json.load(open(os.path.join(FILM, 'narration.json'), encoding='utf8'))
voice = sys.argv[1] if len(sys.argv) > 1 else spec['voice']


def duration(path: str) -> float:
    r = subprocess.run([FF, '-i', path, '-f', 'null', '-'], capture_output=True, text=True)
    t = [l for l in r.stderr.splitlines() if 'time=' in l][-1]
    hh, mm, ss = t.split('time=')[1].split()[0].split(':')
    return int(hh) * 3600 + int(mm) * 60 + float(ss)


async def one(line: dict) -> dict:
    raw = os.path.join(OUT, f"{line['id']}.raw.mp3")
    words = []
    com = edge_tts.Communicate(line.get('say', line['text']), voice, rate=spec['rate'], boundary='WordBoundary')
    with open(raw, 'wb') as fh:
        async for ch in com.stream():
            if ch['type'] == 'audio':
                fh.write(ch['data'])
            elif ch['type'] == 'WordBoundary':
                words.append({'w': ch['text'], 't': ch['offset'] / 1e7, 'd': ch['duration'] / 1e7})
    dst = os.path.join(OUT, f"{line['id']}.mp3")
    # Warm it up a little: gentle low shelf, de-harsh the top, even loudness.
    subprocess.run([FF, '-y', '-loglevel', 'error', '-i', raw, '-af',
                    'highpass=f=70,bass=g=2.5:f=140,treble=g=-1.5:f=7000,acompressor=threshold=-20dB:ratio=2.5:attack=8:release=120,loudnorm=I=-16:TP=-1.5:LRA=8',
                    '-ar', '48000', '-ac', '2', '-b:a', '192k', dst], check=True)
    os.remove(raw)
    d = duration(dst)
    print(f"{line['id']:8s} {d:5.2f}s  {line['text'][:60]}")
    return {'id': line['id'], 'text': line['text'], 'dur': round(d, 3), 'words': words}


async def main():
    res = []
    for line in spec['lines']:
        for attempt in range(3):
            try:
                res.append(await one(line))
                break
            except Exception as e:  # network hiccup
                print('retry', line['id'], e)
                await asyncio.sleep(2)
    json.dump({'voice': voice, 'lines': res}, open(os.path.join(FILM, 'vo.json'), 'w'), indent=1)
    print('total', round(sum(r['dur'] for r in res), 1), 's')


asyncio.run(main())
