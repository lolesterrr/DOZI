"""Monsieur Pierre for Dozi: his pixel-art moods, in the pharmacy.

Builds on the developer's own sprite scripts, copied unchanged next to this file:
  makepierre.py      from oneko-woah (MIT, see LICENSE-makepierre): the 32x32 frame, palette and
                     outline pass, and the sitting and sleeping cat
  makepierre_mpa.py  from MPA: more faces, arms, the beret, paper, hearts and sparkles
This file dresses him as a pharmacist (white coat, green cross, mortar and pestle, capsules) and
draws a short looping animation for each of Dozi's 10 moods (src/features/mascot/moods.ts):
blinks, a tail flick, the pestle grinding, capsules falling, a sweat drop, eyes reading a page.

Usage (needs Python 3 and Pillow), from the repo root:
    npm run mascot:build
Writes src/features/mascot/art/sprites.ts (generated: don't edit it by hand) and
tools/pierre/preview.png (one row per mood, its frames left to right, for eyeballing).
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


def pestle(dy=0):
    f = Frame()
    f.add(mpa.cap(17.5, 24.0, 23.5, 14.5 + dy, 1.4), "s")
    f.add(ell(23.8, 14.0 + dy, 1.7, 1.7), "s")
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

# ---------- the 10 moods, each a short loop ----------
# Each mood is a list of (Scene, milliseconds), like the animations in makepierre_mpa.py. The
# first frame is the still picture shown when the phone asks for less motion.

L_SH, R_SH = (9.5, 21.0), (22.5, 21.0)


def blink(make, hold=2400):
    """A frame, then a quick double blink: make(eyes) returns the scene for 'open' or 'closed'."""
    return [(make("open"), hold), (make("closed"), 130), (make("open"), 220), (make("closed"), 130)]


def m_idle():
    def f(eyes, tail=0):
        return Scene(pierre(eyes=eyes, tail=tail), beret())
    return blink(f) + [(f("open", 1), 260), (f("open", 2), 260), (f("open", 1), 260)]


def m_happy():
    def f(down, tail):
        y = 2 if down else 0
        return Scene(pierre(eyes="happy", tail=tail), beret(), pestle(y), mortar(),
                     sleeve(22.5, 21.0, 24.5, 17.0 + y), cuff(24.5, 17.0 + y),
                     sparkle(5, 7) if not down else sparkle(4, 11),
                     heart(26, 4 - (1 if down else 0), big=False))
    return [(f(False, 0), 300), (f(True, 1), 300)]


def m_celebrating():
    def f(up, shift):
        l, r = ((4.0, 9.0), (28.0, 9.0)) if up else ((3.0, 12.0), (29.0, 12.0))
        return Scene(pierre(eyes="happy", mouth="open", tail=1 if up else -1),
                     sleeve(*L_SH, *l), sleeve(*R_SH, *r), cuff(*l), cuff(*r), beret(0, 0 if up else 1),
                     capsule(1, 2 + shift), capsule(27, 1 + shift, flip=True), capsule(13, shift),
                     sparkle(2, 16) if up else sparkle(3, 20), sparkle(30, 15) if up else sparkle(29, 19))
    return [(f(True, 0), 260), (f(False, 2), 260), (f(True, 4), 260), (f(False, 1), 260)]


def m_thinking():
    dot = lambda x: [(x, 3), (x + 1, 3), (x, 4), (x + 1, 4)]
    def f(n, eyes=None):
        body = pierre(look=(1, -1), mouth="chew") if eyes is None else pierre(eyes=eyes, mouth="chew")
        dots = [p for x in (23, 26, 29)[:n] for p in dot(x)]
        return Scene(body, beret(), sleeve(*R_SH, 19.0, 18.8), marks(dots) if dots else None)
    return [(f(3), 900), (f(0), 360), (f(1), 360), (f(2), 360), (f(3), 900), (f(3, "closed"), 130)]


def m_encouraging():
    def f(lift, glint):
        hand = (27.0, 12.0 - lift)
        return Scene(pierre(eyes="happy", tail=lift), sleeve(*R_SH, *hand), cuff(*hand), beret(),
                     marks([(27, 8 - lift), (27, 9 - lift), (28, 9 - lift)], "w"),   # thumb up
                     sparkle(30, 5) if glint else sparkle(23, 4))
    return [(f(0, True), 420), (f(1, False), 420)]


def m_concerned():
    def f(drop, eyes="sad"):
        body = pierre(eyes=eyes, ears=.8, mouth="frown")
        sweat = [(25, 9 + drop), (24, 10 + drop), (25, 10 + drop), (24, 11 + drop), (25, 11 + drop)]
        return Scene(body, beret(), marks(sweat, "t") if drop < 4 else None)
    return [(f(0), 1200), (f(1), 240), (f(2), 240), (f(3), 260), (f(4), 500), (f(4, "closed"), 130)]


def m_sleepy():
    return [(Scene(mp.sleeping(1), beret(-7, 7)), 900), (Scene(mp.sleeping(0), beret(-7, 7)), 900)]


def m_studying():
    def f(look=None, eyes=None):
        body = pierre(look=look, glasses=True) if eyes is None else pierre(eyes=eyes, glasses=True)
        return Scene(body, beret(),
                     paper(9, 18, 22, 30), paw(9.4, 21.2), paw(22.6, 21.2),
                     marks([(15, 20), (14, 21), (15, 21), (16, 21), (15, 22)], "x"))
    return [(f((0, 1)), 600), (f((-1, 1)), 700), (f((0, 1)), 500), (f((1, 1)), 700),
            (f((0, 1)), 400), (f(eyes="closed"), 130)]


def m_proud():
    def f(shine):
        return Scene(pierre(eyes="happy", tail=1 if shine else 0), beret(), trophy(26, 19),
                     sleeve(*R_SH, 26.0, 16.5),
                     sparkle(29, 4) if shine else sparkle(30, 9),
                     sparkle(4, 8) if shine else sparkle(6, 4),
                     marks([(24, 10)], "w") if shine else None)
    return [(f(True), 500), (f(False), 500)]


def m_surprised():
    def f(big):
        lines = ([(3, 6), (4, 7), (28, 6), (27, 7), (3, 12), (4, 12), (28, 12), (27, 12)] if big else
                 [(2, 5), (3, 6), (29, 5), (28, 6), (2, 12), (3, 12), (29, 12), (28, 12)])
        return Scene(pierre(eyes="wide", ears=1.25 if big else 1.15, mouth="o"),
                     beret(0, -1 if big else 0), marks(lines))
    return [(f(True), 380), (f(False), 260)]


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

    def rows_of(img):
        return tuple("".join(rgba_to_key[img.getpixel((x, y))] if img.getpixel((x, y))[3] else "."
                             for x in range(32)) for y in range(32))

    # Every distinct frame once (moods share frames, e.g. idle's open eyes); each mood lists
    # which frames it plays and for how long.
    frames, index, anims = [], {}, {}
    for name, fn in MOODS:
        steps = []
        for scene, ms in fn():
            rows = rows_of(scene.render())
            if rows not in index:
                index[rows] = len(frames)
                frames.append(rows)
            steps.append((index[rows], ms))
        anims[name] = steps
    used = sorted({ch for rows in frames for row in rows for ch in row if ch != "."})

    lines = [
        "// GENERATED by tools/pierre/make_dozi.py (npm run mascot:build). Don't edit by hand.",
        "// Monsieur Pierre's pixel art. `pierreFrames` holds every 32 × 32 frame once: each row is a",
        "// string, each character a colour from `pierrePalette`, and '.' is transparent.",
        "// `pierreAnimations` says which frames each mood plays, in order, and for how many ms.",
        "// The first frame of a mood is its still picture.",
        "import type { DoziMood } from '../moods';",
        "",
        "export type PierreStep = { frame: number; ms: number };",
        "",
        "export const pierrePalette: Record<string, string> = {",
    ]
    lines += [f"  {k if k.isalnum() else repr(k)}: '{hexa(mp.PAL[k])}'," for k in used]
    lines += ["};", "", "export const pierreAnimations: Record<DoziMood, readonly PierreStep[]> = {"]
    for name, steps in anims.items():
        inner = ", ".join(f"{{ frame: {i}, ms: {ms} }}" for i, ms in steps)
        lines.append(f"  {name}: [{inner}],")
    lines += ["};", "", "export const pierreFrames: readonly (readonly string[])[] = ["]
    for i, rows in enumerate(frames):
        lines.append(f"  // {i}")
        lines.append("  [")
        lines += [f"    '{row}'," for row in rows]
        lines.append("  ],")
    lines += ["];", ""]
    out = os.path.join(root, "src", "features", "mascot", "art", "sprites.ts")
    with open(out, "w") as fh:
        fh.write("\n".join(lines))

    # preview: one row per mood, its frames left to right at 6x, on a light badge
    from PIL import ImageDraw
    scale, pad = 6, 10
    size = 40 * scale
    longest = max(len(steps) for steps in anims.values())
    prev = Image.new("RGBA", (longest * (size + pad) + pad, len(MOODS) * (size + pad) + pad),
                     (238, 240, 245, 255))
    for r, (name, steps) in enumerate(anims.items()):
        bg = (214, 238, 236, 255) if r % 2 == 0 else (22, 48, 47, 255)
        for c, (i, _) in enumerate(steps):
            tile = Image.new("RGBA", (size, size), (0, 0, 0, 0))
            ImageDraw.Draw(tile).ellipse((0, 0, size - 1, size - 1), fill=bg)
            img = Image.new("RGBA", (32, 32), (0, 0, 0, 0))
            for y, row in enumerate(frames[i]):
                for x, ch in enumerate(row):
                    if ch != ".":
                        img.putpixel((x, y), mp.PAL[ch])
            tile.alpha_composite(img.resize((32 * scale, 32 * scale), Image.NEAREST),
                                 (4 * scale, 4 * scale))
            prev.alpha_composite(tile, (pad + c * (size + pad), pad + r * (size + pad)))
    prev.save(os.path.join(root, "tools", "pierre", "preview.png"), optimize=True)
    print(f"wrote {out} ({len(MOODS)} moods, {len(frames)} frames, {len(used)} colours)")


if __name__ == "__main__":
    main(sys.argv[1] if len(sys.argv) > 1 else os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__)))))
