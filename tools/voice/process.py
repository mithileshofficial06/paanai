"""Turn Mithilesh's raw tutorial recordings into the game's voice clips.

Put the recordings in voice/raw/. Either name them by line number (01.mp3 ... 12.mp3), or keep the
recorder's names ("Standard recording 11.mp3" ...): files ending in a number are taken in number
order as lines 01, 02, 03 ... Any format ffmpeg reads works (mp3, m4a, ogg, opus, wav).
Run:  python tools/voice/process.py

Each clip is trimmed to the voice (found from loudness, with a short margin), cleaned (rumble cut,
noise reduction tuned to the room's hiss, gentle fades), levelled to the same loudness, and written
to public/voice/tour-NN.mp3 (mono, 96 kbps). Only the lines the tutorial speaks are written.
"""
import glob
import os
import re
import subprocess
import sys

import imageio_ffmpeg
import numpy as np

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
RAW = os.path.join(ROOT, 'voice', 'raw')
OUT = os.path.join(ROOT, 'public', 'voice')
LINES = 12  # the tutorial speaks lines 01-12 (see src/client/studio/narration.ts)
AUDIO = ('.mp3', '.m4a', '.ogg', '.opus', '.wav', '.aac', '.flac', '.webm')


def recordings() -> dict:
    files = [f for f in glob.glob(os.path.join(RAW, '*')) if f.lower().endswith(AUDIO)]
    named = {}
    for f in files:
        m = re.fullmatch(r'(\d{1,2})', os.path.splitext(os.path.basename(f))[0])
        if m:
            named[int(m.group(1))] = f
    if named:
        return named
    numbered = [f for f in files if re.search(r'(\d+)\s*$', os.path.splitext(os.path.basename(f))[0])]
    numbered.sort(key=lambda f: int(re.search(r'(\d+)\s*$', os.path.splitext(os.path.basename(f))[0]).group(1)))
    return {i + 1: f for i, f in enumerate(numbered)}


def voice_span(path: str) -> tuple:
    """Where the voice starts and ends (seconds), and the room's noise floor (dB)."""
    raw = subprocess.run([FF, '-loglevel', 'error', '-i', path, '-ac', '1', '-ar', '16000', '-f', 'f32le', '-'], capture_output=True, check=True).stdout
    x = np.frombuffer(raw, np.float32)
    win = 320  # 20 ms
    e = np.sqrt(np.convolve(x ** 2, np.ones(win) / win, 'valid'))
    db = 20 * np.log10(e + 1e-9)
    floor = float(np.percentile(db, 8))
    on = np.where(db > floor + 15)[0]
    if not len(on):
        return 0.0, len(x) / 16000, floor
    start = max(0.0, on[0] / 16000 - 0.12)
    end = min(len(x) / 16000, on[-1] / 16000 + 0.25)
    return start, end, floor


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    rec = recordings()
    for n in range(1, LINES + 1):
        nn = f'{n:02d}'
        src = rec.get(n)
        if not src:
            print(f'{nn}  missing (the game uses the browser voice for this line)')
            continue
        start, end, floor = voice_span(src)
        dur = end - start
        chain = ','.join([
            'highpass=f=85',
            f'afftdn=nr=14:nf={max(-60, min(-20, round(floor)))}:tn=1',
            'lowpass=f=11000',
            f'afade=t=in:d=0.04,afade=t=out:st={max(0, dur - 0.12):.3f}:d=0.12',
            'loudnorm=I=-16:TP=-1.5:LRA=7',
            'apad=pad_dur=0.15',
        ])
        dst = os.path.join(OUT, f'tour-{nn}.mp3')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-ss', f'{start:.3f}', '-t', f'{dur:.3f}', '-i', src,
                        '-ac', '1', '-ar', '44100', '-af', chain, '-c:a', 'libmp3lame', '-b:a', '96k', dst], check=True)
        print(f'{nn}  {os.path.basename(src)}  voice {start:.2f}-{end:.2f}s  room {floor:.0f} dB  ->  public/voice/tour-{nn}.mp3')
    return 0


if __name__ == '__main__':
    sys.exit(main())
