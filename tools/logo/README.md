# App logo: Monsieur Pierre, engraved

The app icon is an engraving-style drawing of Monsieur Pierre: a tuxedo cat in a red beret, gold
round glasses and a scarf, holding a mug with a green pharmacy cross, on a Dozi-teal tile. The
developer edited the photo themselves (`source-photo-v2.jpg` in the project files, under
`dozi/logo-experiment/`); these scripts turn it into ink hatching on cream, keeping the photo's
red, gold, amber and green as flat spot colours.

They need Python 3 with `numpy` and `opencv-python-headless`:

```bash
W=/tmp/logo && mkdir -p $W/out && cp source-photo-v2.jpg $W/cat.jpg
python3 tools/logo/engrave.py $W        # photo -> subj.npy (colour drawing), sil.npy, ink.npy
python3 tools/logo/export.py $W $W/out  # icon, adaptive, themed, splash, favicon
cp $W/out/*.png assets/images/
```

- `engrave.py`: the cat's outline and the mug (traced by hand on the 1024 × 1024 photo), colour
  masks for the spot colours, hatching per area (beret, scarf, mug, fur), outlines.
- `export.py`: crops and sizes for each icon slot (Android launchers show only the middle of the
  adaptive icon, so the cat is smaller there).
