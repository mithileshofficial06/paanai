"""Turn each recorded clip (JPEG frames + timestamps) into a constant 30 fps MP4 for the edit.

Frames arrive at uneven times (screencast only sends a frame when the page changes), so each frame
is held for exactly as long as it was on screen, then resampled to 30 fps.
Usage: python encode.py [clip ...]
"""
import json
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.join(os.path.dirname(__file__), '..', 'footage')
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'footage')
os.makedirs(OUT, exist_ok=True)

clips = sys.argv[1:] or sorted(d for d in os.listdir(ROOT) if d.startswith('c') and os.path.isdir(os.path.join(ROOT, d)))
for c in clips:
    src = os.path.join(ROOT, c)
    meta = json.load(open(os.path.join(src, 'frames.json')))
    fr = meta['frames']
    lines = []
    for i, f in enumerate(fr):
        dur = (fr[i + 1]['t'] - f['t']) if i + 1 < len(fr) else 0.5
        lines.append(f"file '{f['name']}'\nduration {max(dur, 0.001):.4f}")
    lines.append(f"file '{fr[-1]['name']}'")
    lst = os.path.join(src, 'list.txt')
    open(lst, 'w').write('\n'.join(lines))
    out = os.path.join(OUT, f'{c}.mp4')
    cmd = [FF, '-y', '-loglevel', 'error', '-f', 'concat', '-safe', '0', '-i', lst,
           '-vf', 'fps=30,scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p',
           '-c:v', 'libx264', '-preset', 'slow', '-crf', '14', out]
    subprocess.run(cmd, check=True, cwd=src)
    json.dump(meta['touches'], open(os.path.join(OUT, f'{c}.touches.json'), 'w'))
    print(f'{c}: {len(fr)} frames, {fr[-1]["t"]:.1f} s -> {out}')
