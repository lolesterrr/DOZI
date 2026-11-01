#!/bin/bash
# Fills video/assets/: Monsieur Pierre's frames (from the app's sprite sheet), fonts, GSAP, icons.
# Run from anywhere; needs node, python3 + Pillow.
set -e
V="$(cd "$(dirname "$0")" && pwd)"; R="$(cd "$V/../../.." && pwd)"
mkdir -p "$V/assets/pierre"
cd "$R"
node -e "
const ts=require('typescript');const fs=require('fs');
const src=fs.readFileSync('src/features/mascot/art/sprites.ts','utf8');
const js=ts.transpileModule(src,{compilerOptions:{module:ts.ModuleKind.CommonJS}}).outputText;
const m={exports:{}};new Function('module','exports','require',js)(m,m.exports,()=>({}));
fs.writeFileSync('$V/assets/pierre.json',JSON.stringify(m.exports));"
python3 - "$V" <<'PY'
import json, sys
from PIL import Image
V = sys.argv[1]
d = json.load(open(f'{V}/assets/pierre.json')); pal = d['pierrePalette']
def rgba(h): h = h.lstrip('#'); return tuple(int(h[i:i + 2], 16) for i in (0, 2, 4)) + (255,)
for i, f in enumerate(d['pierreFrames']):
    im = Image.new('RGBA', (32, 32), (0, 0, 0, 0))
    for y, row in enumerate(f):
        for x, c in enumerate(row):
            if c != '.': im.putpixel((x, y), rgba(pal[c]))
    im.resize((384, 384), Image.NEAREST).save(f'{V}/assets/pierre/f{i}.png')
json.dump(d['pierreAnimations'], open(f'{V}/assets/pierre/anims.json', 'w'))
PY
F=node_modules/@expo-google-fonts
cp $F/nunito/800ExtraBold/Nunito_800ExtraBold.ttf $F/nunito/700Bold/Nunito_700Bold.ttf \
   $F/inter/400Regular/Inter_400Regular.ttf $F/inter/600SemiBold/Inter_600SemiBold.ttf "$V/assets/"
# GSAP is not an app dependency; fetch the browser build from npm without installing it.
T=$(mktemp -d); (cd "$T" && npm pack gsap@3 --silent >/dev/null && tar xzf gsap-*.tgz)
cp "$T/package/dist/gsap.min.js" "$V/assets/"; rm -rf "$T"
# Lucide icons used by the trailers (add a name here when trailers.py uses a new one)
OUT="$V/assets/icons.json" node "$V/icons.mjs" book-open calculator calendar-check cloud file-text gauge headphones library link map pill star stethoscope sun swords timer trophy users
echo "assets ready"
