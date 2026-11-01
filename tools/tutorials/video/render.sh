#!/bin/bash
# Render every composition, then make the small 720p files the app ships, with the music bed.
# Music: ../music/calm-master.wav (tutorials) and bright-master.wav (trailers), made by ../music/make.sh
S="$(cd "$(dirname "$0")" && pwd)"
M="$S/../music"
mkdir -p "$S/render" "$S/final"
for d in "$S"/out/*/; do
  id=$(basename "$d")
  [ -n "$ONLY" ] && [[ "$id" != $ONLY ]] && continue
  (cd "$d" && npx hyperframes render -o "$S/render/$id.mp4" --quality standard >"$S/render/$id.log" 2>&1) || { echo "FAIL $id"; continue; }
  dur=$(ffprobe -v error -show_entries format=duration -of csv=p=0 "$S/render/$id.mp4")
  music="$M/calm-master.wav"; [[ "$id" == *soon* ]] && music="$M/bright-master.wav"
  fo=$(python3 -c "print(max(0, $dur - 2.5))")
  ffmpeg -y -loglevel error -i "$S/render/$id.mp4" -i "$music" \
    -filter_complex "[1:a]atrim=0:$dur,asetpts=PTS-STARTPTS,afade=t=in:d=0.8,afade=t=out:st=$fo:d=2.5,pan=mono|c0=0.5*c0+0.5*c1[a]" \
    -map 0:v -map "[a]" -vf scale=720:1280:flags=lanczos -c:v libx264 -preset slow -crf 28 \
    -pix_fmt yuv420p -profile:v high -c:a aac -b:a 64k -ar 44100 -movflags +faststart -shortest "$S/final/$id.mp4"
  ffmpeg -y -loglevel error -ss 0.5 -i "$S/final/$id.mp4" -frames:v 1 -vf scale=360:640 -q:v 4 "$S/final/$id.jpg"
  echo "done $id $(du -h "$S/final/$id.mp4" | cut -f1)"
done
