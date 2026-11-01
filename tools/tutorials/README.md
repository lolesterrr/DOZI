# Tutorial videos

These scripts make the videos in `assets/tutorials/` (Me → Tutorials in the app). They are not
part of the app build. You only need them when a screen changes enough that a video looks wrong.

How it works, in short:

1. **Capture.** A web build of Dozi runs in a headless browser (Playwright). Each scene script
   taps through the real app with SAMPLE data and saves a screenshot after every step, plus
   where each tap landed (`shots/<scene>/NN.png` + `steps.json`).
2. **Compose.** `video/gen.py` + `video/videos.py` turn the screenshots into one
   [HyperFrames](https://github.com/heygen-com/hyperframes) project per video (HTML + GSAP):
   phone frame, Monsieur Pierre with caption bubbles, a finger showing each tap, zooms.
   `video/trailers.py` makes the three "Coming soon" trailers (no app screens).
3. **Render.** `video/render.sh` renders each project to MP4, then shrinks it to the 720×1280
   file the app ships (H.264, CRF 28, no sound) plus a poster JPG.

Everything the scripts make (`shots/`, browser profiles, `video/out`, `video/render`,
`video/final`, `video/assets`) is git-ignored.

## Needs

Linux or macOS with Node 20+, Python 3 with Pillow, ffmpeg, Chromium for Playwright
(`npx playwright install chromium` if you don't have one), and the HyperFrames CLI
(`npx hyperframes`, downloaded on first use).

## Re-render everything

```bash
cd tools/tutorials

# 1. A web build with the capture-only patches (never commit these to the app)
rsync -a --exclude node_modules --exclude .git ../../ webapp/
ln -s ../../../node_modules webapp/node_modules
cp capture/webview-web-shim.tsx webapp/
(cd webapp && patch -p1 < ../capture/web-build.patch && npx expo export -p web --output-dir ../web)

# 2. Serve it (needs the COOP/COEP headers that expo-sqlite's web worker uses)
node capture/serve.js web &                # http://localhost:8099

# 3. Capture. Run the scenes in this order in ONE profile, so later scenes find the
#    deck, quiz and note the earlier ones made.
for s in welcome welcome-b notes notes-c decks decks-b decks-c import makecard review \
         quiz quiz-b quiz-c tt-b progress badges; do
  CSV=$PWD/capture/sample-terms.csv node capture/ex.js capture/scenes/$s.js $s final
done
python3 capture/sheet.py shots/notes      # optional: a contact sheet to eyeball a scene

# 4. Compose and render
video/prepare_assets.sh                    # Pierre's frames, fonts, GSAP, icons
python3 video/videos.py && python3 video/trailers.py
video/render.sh                            # ~3 min per video; ONLY='06-*' to do one
cp video/final/*.mp4 video/final/*.jpg ../../assets/tutorials/
```

Then update the seconds in `src/features/tutorials/catalog.ts`
(`ffprobe -v error -show_entries format=duration -of csv=p=0 video/final/<id>.mp4`).

## Capture-only patches (`capture/web-build.patch`)

The web build is only a camera for screenshots. These changes make it run in a browser and are
never applied to the real app:

- `metro.config.js`: swap `react-native-webview` for `webview-web-shim.tsx` (an iframe), so the
  note editor works.
- `0004_notes_search.sql`: the browser's SQLite has no FTS5, so search uses a plain table.
- `export/device.ts`: read picked CSV files with `fetch()`.
- `NoteEditor.tsx`: the editor page is served from `/` on web.

Things that still don't work on web, and how the videos handle them:

- The drawing canvas (Skia), so image occlusion and image annotation are shown as drawn
  "Illustration" cards in `videos.py`.
- expo-sqlite's first sync call times out in headless Chromium. `capture/lib.js` removes
  `Atomics.pause`, waits ~20 s and taps **Try again**. Don't reload the page mid-scene
  (`page.goto`); navigate inside the app.

## Editing a video

- Captions, timings, zooms and Pierre's mood per step are in `video/videos.py`
  (`F(...)` = one screenshot, `T(...)` = a typing run, `card(...)` = an explainer card).
  Use British spelling and keep every on-screen example SAMPLE-labelled with no drug facts.
- Look before rendering: `cd video/out/<id> && npx hyperframes check --json` and
  `npx hyperframes snapshot --at 5,12,20`.
- Trailers only name features that are already in `docs/ROADMAP.md`, with no dates.
