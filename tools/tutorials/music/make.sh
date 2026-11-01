#!/bin/bash
# Writes the two music beds (original compositions, played with the free FluidR3 GM soundfont).
# Needs: pip install mido; apt install fluidsynth fluid-soundfont-gm; ffmpeg.
set -e
cd "$(dirname "$0")"
SF=/usr/share/sounds/sf2/FluidR3_GM.sf2
python3 compose.py calm.mid calm 130
python3 compose.py bright.mid bright 30
for m in calm bright; do
  fluidsynth -ni -g 0.8 -r 44100 -F $m.wav $SF $m.mid >/dev/null
  ffmpeg -y -loglevel error -i $m.wav \
    -af "lowpass=f=7500,acompressor=threshold=-24dB:ratio=2:attack=20:release=250,loudnorm=I=-19:TP=-2:LRA=7" \
    -ar 44100 $m-master.wav
done
