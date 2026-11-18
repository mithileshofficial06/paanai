"""Frames (footage/film/<clip>/) -> public/film/clips/<clip>.mp4 at a constant 60 fps, plus the touch log.
Screencast clips hold each frame for as long as it was on screen; virtual-clock clips are already 60 fps.
Usage: python film/tools/encode.py [clip ...]
"""
import json
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
HERE = os.path.dirname(os.path.abspath(__file__))
ROOT = os.path.join(HERE, '..', '..', 'footage', 'film')
OUT = os.path.join(HERE, '..', '..', 'public', 'film', 'clips')
os.makedirs(OUT, exist_ok=True)

clips = sys.argv[1:] or sorted(d for d in os.listdir(ROOT) if os.path.isfile(os.path.join(ROOT, d, 'frames.json')))
info = {}
info_path = os.path.join(OUT, 'clips.json')
if os.path.exists(info_path):
    info = json.load(open(info_path))
for c in clips:
    src = os.path.join(ROOT, c)
    meta = json.load(open(os.path.join(src, 'frames.json')))
    fr = meta['frames']
    if not fr:
        print(c, 'no frames')
        continue
    lines = []
    for i, f in enumerate(fr):
        dur = (fr[i + 1]['t'] - f['t']) if i + 1 < len(fr) else 1 / 60
        lines.append(f"file '{f['name']}'\nduration {max(dur, 0.001):.5f}")
    lines.append(f"file '{fr[-1]['name']}'")
    lst = os.path.join(src, 'list.txt')
    open(lst, 'w').write('\n'.join(lines))
    out = os.path.join(OUT, f'{c}.mp4')
    cmd = [FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
           '-vf', 'fps=60,setpts=PTS-STARTPTS,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p', '-fps_mode', 'cfr', '-bf', '0',
           '-c:v', 'libx264', '-preset', 'medium', '-crf', '15', '-g', '30', out]
    subprocess.run(cmd, check=True, cwd=src)
    vp = meta['viewport']
    secs = fr[-1]['t'] + 1 / 60
    info[c] = {'seconds': round(secs, 3), 'w': vp['width'], 'h': vp['height'], 'touches': meta['touches']}
    print(f'{c}: {len(fr)} frames, {secs:.2f} s')
json.dump(info, open(info_path, 'w'))
