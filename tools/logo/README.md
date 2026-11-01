# App logo: Monsieur Pierre, engraved

The app icon is an engraving-style drawing of Monsieur Pierre (a tuxedo cat in a red beret, gold round
glasses and a scarf, holding a mug with a green pharmacy cross) on a Dozi-teal tile. It was made
on 2026-11-01 from a photo the developer supplied, by turning the photo into ink hatching lines.

The scripts here regenerate every icon file in `assets/images/`. They need Python 3 with
`numpy` and `opencv-python-headless`, and the source photo (`source-photo.jpg` in the project
files, under `dozi/logo-experiment/`), saved as `cat.jpg` in a work folder:

```bash
W=/tmp/logo && mkdir -p $W/out && cp source-photo.jpg $W/cat.jpg && cp tools/logo/*.py $W/
python3 $W/engrave.py $W                                  # photo -> ink lines (ink.npy)
python3 $W/compose.py $W $W/preview.png '#0B6B68' '#D23A3A' # colours: tile, beret
python3 $W/export.py $W $W/out                            # icon, adaptive, themed, splash, favicon
cp $W/out/*.png assets/images/
```

- `poly.py`: the outline of the cat, traced by hand on the 600 × 600 photo.
- `engrave.py`: tuxedo markings, hatching per area (beret, scarf, mug, fur), outlines.
- `compose.py`: spot colours (red beret, green eyes, green cross) and a rounded-tile preview.
- `export.py`: crops and sizes for each icon slot (Android launchers show only the middle of the
  adaptive icon, so the cat is smaller there).
