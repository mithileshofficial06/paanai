"""Turn Mithilesh's raw tutorial recordings into the game's voice clips.

Put the recordings in voice/raw/, named by line number: 01.m4a, 02.m4a ... 18.m4a (any format ffmpeg
reads: m4a, mp3, ogg, opus, wav, aac). Run:  python tools/voice/process.py
Each clip is cleaned (rumble cut, light noise reduction), trimmed of silence at both ends, levelled
to the same loudness, and written to public/voice/tour-NN.mp3 (mono, 96 kbps).
"""
import glob
import os
import subprocess
import sys

import imageio_ffmpeg

FF = imageio_ffmpeg.get_ffmpeg_exe()
ROOT = os.path.join(os.path.dirname(__file__), '..', '..')
RAW = os.path.join(ROOT, 'voice', 'raw')
OUT = os.path.join(ROOT, 'public', 'voice')
LINES = 18

TRIM = 'silenceremove=start_periods=1:start_threshold=-45dB:start_silence=0.08'
CHAIN = ','.join([
    'highpass=f=80',
    'afftdn=nf=-30',
    TRIM, 'areverse', TRIM, 'areverse',          # trim silence at the start, then at the end
    'loudnorm=I=-16:TP=-1.5:LRA=7',
    'apad=pad_dur=0.12',                         # a breath of silence after the line
])


def main() -> int:
    os.makedirs(OUT, exist_ok=True)
    missing = []
    for n in range(1, LINES + 1):
        nn = f'{n:02d}'
        found = sorted(glob.glob(os.path.join(RAW, f'{nn}.*')) + glob.glob(os.path.join(RAW, f'{n}.*')))
        if not found:
            missing.append(nn)
            continue
        dst = os.path.join(OUT, f'tour-{nn}.mp3')
        subprocess.run([FF, '-y', '-loglevel', 'error', '-i', found[0], '-ac', '1', '-ar', '44100',
                        '-af', CHAIN, '-c:a', 'libmp3lame', '-b:a', '96k', dst], check=True)
        print(f'{nn}  {os.path.basename(found[0])}  ->  public/voice/tour-{nn}.mp3')
    if missing:
        print('missing lines:', ', '.join(missing), '(the game uses the phone voice for these)')
    return 0


if __name__ == '__main__':
    sys.exit(main())
