"""Rough music analysis without extra libraries: tempo from onset autocorrelation, a loudness
curve per second, brightness, and the strongest beat grid. Usage: python analyze_music.py file.mp3 ..."""
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
SR = 22050


def load(path):
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', str(SR), '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, dtype=np.float32)


def analyse(path):
    x = load(path)
    hop = 512
    n = len(x) // hop
    frames = x[: n * hop].reshape(n, hop)
    rms = np.sqrt((frames ** 2).mean(axis=1) + 1e-12)
    # Spectral flux onset strength.
    win = 2048
    spec_prev = None
    flux = np.zeros(n)
    cent = np.zeros(n)
    freqs = np.fft.rfftfreq(win, 1 / SR)
    for i in range(n):
        seg = x[i * hop: i * hop + win]
        if len(seg) < win:
            break
        s = np.abs(np.fft.rfft(seg * np.hanning(win)))
        if spec_prev is not None:
            flux[i] = np.maximum(s - spec_prev, 0).sum()
        cent[i] = (s * freqs).sum() / (s.sum() + 1e-9)
        spec_prev = s
    fps = SR / hop
    o = flux - flux.mean()
    ac = np.correlate(o, o, 'full')[len(o) - 1:]
    lo, hi = int(fps * 60 / 180), int(fps * 60 / 60)
    lag = lo + int(np.argmax(ac[lo:hi]))
    bpm = 60 * fps / lag
    sec = int(len(x) / SR)
    per_sec = [20 * np.log10(rms[int(s * fps): int((s + 1) * fps)].mean() + 1e-9) for s in range(sec)]
    perc = flux.std() / (flux.mean() + 1e-9)
    print(f'\n{path.split("/")[-1][:60]}\n  {sec} s, ~{bpm:.1f} BPM, percussiveness {perc:.2f}, brightness {np.median(cent[cent > 0]):.0f} Hz')
    line = ''.join('▁▂▃▄▅▆▇█'[min(7, max(0, int((v + 40) / 5)))] for v in per_sec)
    for k in range(0, len(line), 60):
        print(f'  {k:>3}s {line[k:k + 60]}')


for p in sys.argv[1:]:
    analyse(p)
