"""Soft backgrounds for each shot: a frame of that shot's own footage, enlarged, blurred and darkened,
so the colour around the phone always comes from what is on the phone. Also a sharp kiln still for
the title and end cards. Writes public/bg/<shot>.jpg."""
import io
import json
import os
import subprocess

import imageio_ffmpeg
from PIL import Image, ImageEnhance, ImageFilter

FF = imageio_ffmpeg.get_ffmpeg_exe()
VIDEO = os.path.join(os.path.dirname(__file__), '..')
OUT = os.path.join(VIDEO, 'public', 'bg')
os.makedirs(OUT, exist_ok=True)
plan = json.load(open(os.path.join(VIDEO, 'src', 'plan.json')))


def grab(clip, t):
    raw = subprocess.run([FF, '-loglevel', 'error', '-ss', str(t), '-i', os.path.join(VIDEO, 'public', 'footage', f'{clip}.mp4'), '-frames:v', '1', '-f', 'image2pipe', '-vcodec', 'png', '-'], capture_output=True, check=True).stdout
    return Image.open(io.BytesIO(raw)).convert('RGB')


def cover(im, w=1920, h=1080, focus_y=0.45):
    s = max(w / im.width, h / im.height) * 1.15
    im = im.resize((int(im.width * s), int(im.height * s)), Image.LANCZOS)
    x = (im.width - w) // 2
    y = int((im.height - h) * focus_y)
    return im.crop((x, y, x + w, y + h))


for s in plan['shots']:
    if not s.get('pieces'):
        continue
    p = max(s['pieces'], key=lambda q: q['to'] - q['from'])
    im = cover(grab(p['clip'], (p['from'] + p['to']) / 2))
    im = im.filter(ImageFilter.GaussianBlur(60))
    im = ImageEnhance.Brightness(im).enhance(0.42)
    im = ImageEnhance.Color(im).enhance(1.25)
    im.save(os.path.join(OUT, f"{s['id']}.jpg"), quality=92)
    print('bg', s['id'])

# The kiln with its fire, from the welcome screen, for the title and end cards.
k = grab('c01_welcome', 6.2)
k = k.crop((0, int(k.height * 0.04), k.width, int(k.height * 0.40)))  # the kiln art only, no text
k.save(os.path.join(OUT, 'kiln_full.png'))
print('kiln still', k.size)
