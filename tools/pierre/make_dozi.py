"""Monsieur Pierre for Dozi: his pixel-art moods, in the pharmacy.

Builds on the developer's own sprite scripts, copied unchanged next to this file:
  makepierre.py      from oneko-woah (MIT, see LICENSE-makepierre): the 32x32 frame, palette and
                     outline pass, and the sitting and sleeping cat
  makepierre_mpa.py  from MPA: more faces, arms, the beret, paper, hearts and sparkles
This file dresses him as a pharmacist (white coat, green cross, mortar and pestle, capsules) and
draws one still frame for each of Dozi's 10 moods (src/features/mascot/moods.ts).

Usage (needs Python 3 and Pillow), from the repo root:
    npm run mascot:build
Writes src/features/mascot/art/sprites.ts (generated: don't edit it by hand) and
tools/pierre/preview.png (every mood at 8x on a light and a dark badge, for eyeballing).
"""
import os
import sys

from PIL import Image

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import makepierre as mp  # noqa: E402
import makepierre_mpa as mpa  # noqa: E402
from makepierre import Frame, ell, rect, tri  # noqa: E402
from makepierre_mpa import Scene, arm, beret, cap, cat, heart, marks, paper, paw, sparkle  # noqa: E402

mp.PAL.update({
    "x": (47, 164, 90, 255),     # pharmacy cross
    "s": (201, 194, 182, 255),   # mortar and pestle
    "S": (150, 141, 126, 255),   # stone shade
    "n": (232, 102, 79, 255),    # capsule half
    "G": (227, 167, 47, 255),    # trophy gold
    "H": (255, 214, 120, 255),   # gold highlight
    "v": (11, 107, 104, 255),    # pocket pen
    "C": (222, 232, 240, 255),   # coat (a cool white, so his own white chest shows in the V)
})

# ---------- the pharmacist's coat ----------

def coat(f, open_arms=False):
    """Paint the body as a white coat: lapels, buttons, a pocket with a pen, the green cross.
    Works on a Frame from cat(): the body is ell(16, 24, 11, 8.2), the head ends near row 19."""
    body = ell(16, 24, 11, 8.2)
    v_neck = tri((10.5, 18.5), (21.5, 18.5), (16, 24.5))
    f.paint(lambda x, y: body(x, y) and y >= 19 and not v_neck(x, y), "C")
    # lapels: a V from the shoulders to the middle of the chest
    f.px([(11, 19), (12, 20), (13, 21), (14, 22), (15, 23),
          (20, 19), (19, 20), (18, 21), (17, 22), (16, 23)], "g")
    f.px([(16, 26), (16, 29)], "g")                       # buttons
    f.px([(19, 26), (20, 26), (21, 26), (22, 26)], "g")   # pocket top
    f.px([(20, 24), (20, 25)], "v")                       # pen
    f.px([(10, 23), (9, 24), (10, 24), (11, 24), (10, 25)], "x")  # green cross
    # a shade line where the sitting paws meet the coat
    f.px([(9, 29), (10, 29), (11, 29), (12, 29), (13, 29), (14, 29),
          (18, 29), (19, 29), (20, 29), (21, 29), (22, 29), (23, 29)], "g")
    return f


def pierre(**kw):
    return coat(cat(**kw))


def sleeve(x0, y0, x1, y1):
    """A coat sleeve from the shoulder to a white paw, like makepierre_mpa.arm() but white."""
    f = Frame()
    f.add(cap(x0, y0, x1, y1, 1.9), "C")
    f.add(ell(x1, y1, 2.3, 2.3), "w")
    return f


def cuff(x, y):
    """A grey cuff ring so the paw shows against the white sleeve."""
    x, y = int(x), int(y)
    return marks([(x - 2, y + 1), (x - 1, y + 2), (x, y + 2), (x + 1, y + 1)], "g")

# ---------- props ----------

def mortar():
    """A stone mortar in front of him, with the green cross on it."""
    f = Frame()
    top, bot, wt, wb, cx = 23.0, 30.0, 8.5, 4.5, 16.0

    def bowl(x, y):
        py = y + .5
        if py < top or py > bot:
            return False
        t = (py - top) / (bot - top)
        return abs(x + .5 - cx) <= wt + (wb - wt) * t * t
    f.add(bowl, "s")
    f.add(rect(13, 30, 18, 31), "S")                       # foot
    f.paint(lambda x, y: bowl(x, y) and y + .5 < top + 1.4, "S")   # rim
    f.px([(16, 26), (15, 27), (16, 27), (17, 27), (16, 28)], "x")
    return f


def pestle():
    f = Frame()
    f.add(mpa.cap(17.5, 24.0, 23.5, 14.5, 1.4), "s")
    f.add(ell(23.8, 14.0, 1.7, 1.7), "s")
    return f


def capsule(x, y, flip=False):
    """A two-colour capsule, 4 x 2 pixels, with its top-left corner at (x, y)."""
    a, b = ("n", "w") if not flip else ("w", "n")
    return Frame().px([(x, y), (x + 1, y), (x, y + 1), (x + 1, y + 1)], a) \
        .px([(x + 2, y), (x + 3, y), (x + 2, y + 1), (x + 3, y + 1)], b)


def trophy(x, y):
    """A small gold cup whose base sits on row y, centred on x."""
    f = Frame()
    f.add(ell(x + .5, y - 7, 3.2, 2.8), "G")
    f.add(rect(x - 2, y - 10, x + 3, y - 8), "G")
    f.add(rect(x, y - 4, x + 1, y - 2), "G")
    f.add(rect(x - 2, y - 1, x + 3, y), "G")
    f.paint(rect(x - 1, y - 9, x - 1, y - 7), "H")
    return f


def zzz(n=1):
    small = [(22, 9), (23, 9), (24, 9), (23, 10), (22, 11), (23, 11), (24, 11)]
    big = [(25, 3), (26, 3), (27, 3), (28, 3), (27, 4), (26, 5), (25, 6), (26, 6), (27, 6), (28, 6)]
    return marks(small + (big if n else []))

# ---------- the 10 moods ----------

L_SH, R_SH = (9.5, 21.0), (22.5, 21.0)


def m_idle():
    return Scene(pierre(), beret())


def m_happy():
    return Scene(pierre(eyes="happy"), beret(), pestle(), mortar(),
                 sleeve(22.5, 21.0, 24.5, 17.0), cuff(24.5, 17.0), sparkle(5, 7), heart(26, 4, big=False))


def m_celebrating():
    up_l, up_r = (4.0, 9.0), (28.0, 9.0)
    return Scene(pierre(eyes="happy", mouth="open"), sleeve(*L_SH, *up_l), sleeve(*R_SH, *up_r),
                 cuff(*up_l), cuff(*up_r), beret(),
                 capsule(1, 2), capsule(27, 1, flip=True), capsule(13, 0),
                 sparkle(2, 16), sparkle(30, 15))


def m_thinking():
    dot = lambda x: [(x, 3), (x + 1, 3), (x, 4), (x + 1, 4)]
    return Scene(pierre(look=(1, -1), mouth="chew"), beret(),
                 sleeve(*R_SH, 19.0, 18.8), marks(dot(23) + dot(26) + dot(29)))


def m_encouraging():
    hand = (27.0, 12.0)
    return Scene(pierre(eyes="happy"), sleeve(*R_SH, *hand), cuff(*hand), beret(),
                 marks([(27, 8), (27, 9), (28, 9)], "w"),   # thumb up
                 sparkle(30, 5))


def m_concerned():
    return Scene(pierre(eyes="sad", ears=.8, mouth="frown"), beret(),
                 marks([(25, 9), (24, 10), (25, 10), (24, 11), (25, 11)], "t"))


def m_sleepy():
    s = mp.sleeping(1)
    return Scene(s, beret(-7, 7))


def m_studying():
    return Scene(pierre(look=(0, 1), glasses=True), beret(),
                 paper(9, 18, 22, 30), paw(9.4, 21.2), paw(22.6, 21.2),
                 marks([(15, 20), (14, 21), (15, 21), (16, 21), (15, 22)], "x"))


def m_proud():
    return Scene(pierre(eyes="happy"), beret(), trophy(26, 19), sleeve(*R_SH, 26.0, 16.5),
                 sparkle(29, 4), sparkle(4, 8))


def m_surprised():
    return Scene(pierre(eyes="wide", ears=1.25, mouth="o"), beret(0, -1),
                 marks([(3, 6), (4, 7), (28, 6), (27, 7), (3, 12), (4, 12), (28, 12), (27, 12)]))


MOODS = [
    ("idle", m_idle), ("happy", m_happy), ("celebrating", m_celebrating),
    ("thinking", m_thinking), ("encouraging", m_encouraging), ("concerned", m_concerned),
    ("sleepy", m_sleepy), ("studying", m_studying), ("proud", m_proud), ("surprised", m_surprised),
]

# ---------- output ----------

def hexa(rgba):
    return "#%02X%02X%02X" % rgba[:3]


def main(root):
    rgba_to_key = {}
    for k, v in mp.PAL.items():
        rgba_to_key.setdefault(v, k)
    images = {name: fn().render() for name, fn in MOODS}
    used = sorted({rgba_to_key[px] for img in images.values() for y in range(32) for x in range(32) for px in [img.getpixel((x, y))] if px[3]})
    lines = [
        "// GENERATED by tools/pierre/make_dozi.py (npm run mascot:build). Don't edit by hand.",
        "// Monsieur Pierre's pixel art: one 32 × 32 frame per mood. Each row is a string; each",
        "// character is a colour from `pierrePalette`, and '.' is transparent.",
        "import type { DoziMood } from '../moods';",
        "",
        "export const pierrePalette: Record<string, string> = {",
    ]
    lines += [f"  {k if k.isalnum() else repr(k)}: '{hexa(mp.PAL[k])}'," for k in used]
    lines += ["};", "", "export const pierreSprites: Record<DoziMood, readonly string[]> = {"]
    for name, img in images.items():
        lines.append(f"  {name}: [")
        for y in range(32):
            row = "".join(rgba_to_key[img.getpixel((x, y))] if img.getpixel((x, y))[3] else "."
                          for x in range(32))
            lines.append(f"    '{row}',")
        lines.append("  ],")
    lines += ["};", ""]
    out = os.path.join(root, "src", "features", "mascot", "art", "sprites.ts")
    with open(out, "w") as fh:
        fh.write("\n".join(lines))

    scale, pad = 8, 12
    size = 40 * scale
    prev = Image.new("RGBA", (len(MOODS) * (size + pad) + pad, 2 * (size + pad) + pad), (238, 240, 245, 255))
    for r, bg in enumerate(((214, 238, 236, 255), (22, 48, 47, 255))):
        for c, (name, _) in enumerate(MOODS):
            tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            from PIL import ImageDraw
            ImageDraw.Draw(tile).ellipse((0, 0, size - 1, size - 1), fill=bg)
            tile.alpha_composite(images[name].resize((32 * scale, 32 * scale), Image.NEAREST),
                                 (4 * scale, 4 * scale))
            prev.alpha_composite(tile, (pad + c * (size + pad), pad + r * (size + pad)))
    prev.save(os.path.join(root, "tools", "pierre", "preview.png"), optimize=True)
    print(f"wrote {out} ({len(MOODS)} moods, {len(used)} colours)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
