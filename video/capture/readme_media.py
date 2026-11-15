"""README screenshots from the stills (brand/howto/*.png, 1075x2330) -> docs/media/*.jpg at 780 px wide."""
import os
from PIL import Image

ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
SRC = os.path.join(ROOT, 'brand', 'howto')
OUT = os.path.join(ROOT, 'docs', 'media')
MAP = {'0-welcome': 'welcome', '1-shape': 'throw', '1b-score': 'score', '2-paint': 'paint', '3-fire': 'kiln',
       '4-open': 'reveal', '5-showcase': 'showcase', '6-codex': 'codex', '7-levels': 'levels'}
for src, dst in MAP.items():
    im = Image.open(os.path.join(SRC, f'{src}.png')).convert('RGB')
    w = 780
    im = im.resize((w, round(im.height * w / im.width)), Image.LANCZOS)
    im.save(os.path.join(OUT, f'{dst}.jpg'), quality=86, optimize=True, progressive=True)
    print(dst, im.size)


# ---- The README GIF (frames from video/capture/throw_gif.mjs) ----
import glob as _glob

frames = sorted(_glob.glob(os.path.join(ROOT, 'video', 'footage', 'gif', 'f*.png')))
if frames:
    imgs = []
    for f in frames[::2] if len(frames) > 60 else frames:
        im = Image.open(f).convert('RGB')
        s = im.width / 390  # device pixel ratio
        im = im.crop((0, int(168 * s), im.width, int(798 * s))).resize((280, 452), Image.LANCZOS)
        imgs.append(im.convert('P', palette=Image.ADAPTIVE, colors=128))
    imgs[0].save(os.path.join(OUT, 'throw.gif'), save_all=True, append_images=imgs[1:], duration=90, loop=0, optimize=True)
    print('throw.gif', len(imgs), 'frames')
