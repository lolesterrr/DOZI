#!/bin/bash
# Render every composition, then make the small 720p files the app ships.
S="$(cd "$(dirname "$0")" && pwd)"
mkdir -p "$S/render" "$S/final"
for d in "$S"/out/*/; do
  id=$(basename "$d")
  [ -n "$ONLY" ] && [[ "$id" != $ONLY ]] && continue
  (cd "$d" && npx hyperframes render -o "$S/render/$id.mp4" --quality standard >"$S/render/$id.log" 2>&1) || { echo "FAIL $id"; continue; }
  ffmpeg -y -loglevel error -i "$S/render/$id.mp4" -vf scale=720:1280:flags=lanczos -c:v libx264 -preset slow -crf 28 \
    -pix_fmt yuv420p -profile:v high -movflags +faststart -an "$S/final/$id.mp4"
  ffmpeg -y -loglevel error -ss 0.5 -i "$S/final/$id.mp4" -frames:v 1 -vf scale=360:640 -q:v 4 "$S/final/$id.jpg"
  echo "done $id $(du -h "$S/final/$id.mp4" | cut -f1)"
done
