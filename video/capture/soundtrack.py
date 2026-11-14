"""Mix the soundtrack: the music spliced to its real ending, plus real foley placed on the edit.
Reads src/plan.json for shot times and taps. Writes public/audio/soundtrack.wav (48 kHz stereo)."""
import json
import os
import subprocess

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 48000
HERE = os.path.dirname(__file__)
VIDEO = os.path.join(HERE, '..')
MUSIC = os.path.join(VIDEO, 'footage', 'music', 'upbeat-travel-vibes-241585.mp3')
SFX = os.path.join(VIDEO, 'footage', 'sfx')
plan = json.load(open(os.path.join(VIDEO, 'src', 'plan.json')))
BAR = 60 / 105 * 4
bar = lambda k: 0.284 + k * BAR


def load(path):
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', path, '-ac', '2', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32).reshape(-1, 2).copy()


def fade(x, fin=0.01, fout=0.01):
    n = len(x)
    a, b = int(fin * SR), int(fout * SR)
    if a:
        x[:a] *= np.linspace(0, 1, a)[:, None]
    if b:
        x[-b:] *= np.linspace(1, 0, b)[:, None]
    return x


total = int(plan['end'] * SR) + SR
mix = np.zeros((total, 2), dtype=np.float32)


def place(x, t, gain=1.0, fin=0.005, fout=0.02):
    x = fade(x.copy(), fin, fout) * gain
    i = int(t * SR)
    j = min(total, i + len(x))
    if j > i:
        mix[i:j] += x[: j - i]


# ---- Music: bars 0-22, then the song's own ending from bar 44 ----
music = load(MUSIC)
cut = int(bar(22) * SR)
tail_from = int(bar(44) * SR)
head = music[:cut].copy()
tail = music[tail_from:].copy()
xf = int(0.03 * SR)
head[-xf:] *= np.linspace(1, 0, xf)[:, None]
tail[:xf] *= np.linspace(0, 1, xf)[:, None]
song = np.concatenate([head[:-xf], head[-xf:] + tail[:xf], tail[xf:]])
end = int(plan['end'] * SR)
song = song[:end]
song[-int(0.6 * SR):] *= np.linspace(1, 0, int(0.6 * SR))[:, None]
# Duck the music a little under the kiln door and fire.
env = np.ones(len(song), dtype=np.float32)
d0, d1 = int((bar(12) + 0.2) * SR), int((bar(12) + 2.6) * SR)
env[d0:d1] = 0.62
env = np.convolve(env, np.ones(2400) / 2400, mode='same')
song *= env[:, None]
mix[: len(song)] += song * 0.9

# ---- Foley ----
whoosh = load(os.path.join(SFX, 'whoosh.mp3'))
tap = load(os.path.join(SFX, 'tap.mp3'))
ceramic = load(os.path.join(SFX, 'ceramic.mp3'))
wheel = load(os.path.join(SFX, 'wheel.mp3'))
pottery = load(os.path.join(SFX, 'pottery.mp3'))
furnace = load(os.path.join(SFX, 'furnace.mp3'))
firewhoosh = load(os.path.join(SFX, 'firewhoosh.mp3'))
door = load(os.path.join(SFX, 'door.mp3'))


def busiest(x, seconds):
    """Start of the most active stretch of a long recording."""
    n = int(seconds * SR)
    e = np.convolve((x[:, 0] ** 2), np.ones(SR // 10), 'same')
    step = SR // 4
    best = max(range(0, len(x) - n, step), key=lambda i: e[i:i + n].mean() - e[i:i + n].std() * 0.5)
    return x[best: best + n]


def first_hit(x, seconds):
    """Trim leading silence and keep `seconds` from the first loud moment."""
    a = np.abs(x[:, 0])
    i = int(np.argmax(a > a.max() * 0.2))
    return x[max(0, i - 200): i + int(seconds * SR)]


tink = first_hit(ceramic, 0.9)
for t, g in [(bar(2) - 0.12, 0.35), (bar(3) - 0.14, 0.45), (bar(16) - 0.1, 0.22), (bar(19) - 0.1, 0.22), (bar(22) - 0.12, 0.35)]:
    place(whoosh, t, g)
place(tink, bar(3) + 0.32, 0.38, fout=0.3)
# The wheel spins under the throw, with hands on wet clay.
spin = np.concatenate([wheel] * 2)[: int((bar(8) - bar(5) + 0.4) * SR)]
place(spin, bar(5) - 0.3, 0.32, fin=0.4, fout=0.6)
place(busiest(pottery, bar(8) - bar(5) - 0.4), bar(5) + 0.3, 0.42, fin=0.3, fout=0.5)
# Taps on the glass.
for s in plan['shots']:
    for u in s['taps']:
        place(tap, u['t'] - 0.02, 0.2)
# The kiln: the fire builds under "the shared kiln", the iron door, the whoosh of heat, the pot.
roar = busiest(furnace, 4.2)
x = roar.copy()
x *= np.linspace(0.35, 1.0, len(x))[:, None]
place(x, bar(11), 0.5, fin=0.3, fout=1.2)
place(first_hit(door, 1.2), bar(12) + 0.45, 0.55, fout=0.3)
place(first_hit(firewhoosh, 1.6), bar(12) + 0.6, 0.5, fout=0.6)
place(tink, bar(12) + 2.9, 0.32, fout=0.3)
place(tink, bar(14) + 0.35, 0.22, fout=0.3)
place(tink, bar(22) + 0.55, 0.3, fout=0.3)

# ---- Master: gentle limiter to -1 dBFS ----
mix = mix[:end]
# Loudness for YouTube: bring the RMS to about -15 dBFS, then a soft limiter keeps peaks under -1 dBFS.
rms0 = np.sqrt((mix ** 2).mean())
mix *= 10 ** (-15 / 20) / max(rms0, 1e-6)
mix = 0.89 * np.tanh(mix / 0.89)
out = os.path.join(VIDEO, 'public', 'audio', 'soundtrack.wav')
pcm = (mix * 32767).astype('<i2').tobytes()
subprocess.run([FF, '-y', '-loglevel', 'error', '-f', 's16le', '-ar', str(SR), '-ac', '2', '-i', '-', out], input=pcm, check=True)
rms = 20 * np.log10(np.sqrt((mix ** 2).mean()) + 1e-9)
print(f'wrote {out}: {len(mix) / SR:.2f} s, RMS {rms:.1f} dBFS')
