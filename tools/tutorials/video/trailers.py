""""Coming soon" trailers: kinetic type, icons and Monsieur Pierre, no app screens."""
import html
import json
import os
import shutil
import sys

from gen import ANIMS, HERE, OUT, W, H, C, pierre_frames, pierre_markup, rich

ICONS = json.load(open(os.path.join(HERE, 'assets', 'icons.json')))

TRAILERS = [
    {
        'id': '10-soon-learn',
        'title': 'Your **roadmap** is coming',
        'beats': [
            ('map', 'A **roadmap** for each course unit', 'thinking'),
            ('book-open', 'Short **lessons**, one idea at a time', 'studying'),
            ('pill', '**Drug profiles** you can search', 'studying'),
            ('star', 'Checkpoints and **stars**', 'happy'),
            ('calendar-check', 'A **study plan** for exam day', 'proud'),
            ('sun', 'A **drug of the day**', 'happy'),
        ],
        'end': ('Coming **soon**', 'The Learn tab is on its way. Pierre is busy preparing it.'),
    },
    {
        'id': '11-soon-exams',
        'title': '**Exam tools** are coming',
        'beats': [
            ('file-text', '**Mock exams** like MUST papers', 'thinking'),
            ('calculator', 'A **PK calculation** trainer', 'studying'),
            ('stethoscope', '**Clinical cases** with choices', 'thinking'),
            ('timer', 'Timed **OSPE** stations', 'surprised'),
            ('gauge', 'Your **exam readiness** score', 'proud'),
            ('headphones', 'Hands-free **audio** revision', 'happy'),
        ],
        'end': ('Coming **soon**', 'Everything you need for exam season, in one place.'),
    },
    {
        'id': '12-soon-together',
        'title': '**Study together**, soon',
        'beats': [
            ('cloud', '**Back up** and sync your work', 'thinking'),
            ('link', '**Share** decks with a link', 'happy'),
            ('users', '**Study groups** for your class', 'happy'),
            ('library', 'A **public library** of decks', 'studying'),
            ('trophy', 'Weekly **leagues**, if you like', 'proud'),
            ('swords', 'Live **quiz battles**', 'surprised'),
        ],
        'end': ('Coming **soon**', 'Learn with your classmates, wherever you are.'),
    },
]

CSS = f"""
@font-face {{ font-family: 'Nunito Dozi'; src: url('assets/Nunito_800ExtraBold.ttf'); font-weight: 800; }}
@font-face {{ font-family: 'Inter Dozi'; src: url('assets/Inter_400Regular.ttf'); font-weight: 400; }}
@font-face {{ font-family: 'Inter Dozi'; src: url('assets/Inter_600SemiBold.ttf'); font-weight: 600; }}
* {{ margin: 0; padding: 0; box-sizing: border-box; }}
html, body {{ width: {W}px; height: {H}px; overflow: hidden; background: {C['primary']}; }}
#root {{ position: relative; width: {W}px; height: {H}px; overflow: hidden; background: {C['primary']}; font-family: 'Inter Dozi'; }}
.dots {{ position: absolute; inset: 0; opacity: .25; background-image: radial-gradient(#FAF7F2 2px, transparent 2.5px); background-size: 44px 44px; }}
.soon {{ position: absolute; left: 0; top: 190px; width: {W}px; text-align: center; }}
.soon span {{ display: inline-block; padding: 16px 38px; border-radius: 999px; background: {C['accent']}; color: #2B1F04;
  font: 800 38px 'Nunito Dozi'; letter-spacing: .12em; }}
.title {{ position: absolute; left: 70px; top: 330px; width: 940px; text-align: center; font: 800 104px/1.06 'Nunito Dozi'; color: #FAF7F2; }}
.title .acc, .endt .acc {{ color: {C['accent']}; }}
.beat {{ position: absolute; left: 90px; top: 420px; width: 900px; height: 760px; border-radius: 56px; background: #FAF7F2;
  box-shadow: 0 40px 90px rgba(0,0,0,.25); }}
.beat .ic {{ position: absolute; left: 330px; top: 90px; width: 240px; height: 240px; border-radius: 50%; background: {C['psoft']}; }}
.beat .ic svg {{ position: absolute; left: 50px; top: 50px; width: 140px; height: 140px; }}
.beat .ln {{ position: absolute; left: 60px; top: 380px; width: 780px; height: 300px; display: flex; align-items: center; justify-content: center;
  text-align: center; font: 800 76px/1.12 'Nunito Dozi'; color: {C['fg']}; }}
.beat .acc {{ color: {C['primary']}; }}
.count {{ position: absolute; left: 0; top: 1230px; width: {W}px; text-align: center; font: 600 32px 'Inter Dozi'; color: rgba(250,247,242,.8); }}
#pierre {{ position: absolute; left: 0; top: 0; width: 384px; height: 384px; transform-origin: 0 0; }}
.pf {{ position: absolute; left: 0; top: 0; width: 384px; height: 384px; image-rendering: pixelated; opacity: 0; }}
.endt {{ position: absolute; left: 60px; top: 1080px; width: 960px; text-align: center; font: 800 110px/1.05 'Nunito Dozi'; color: #FAF7F2; }}
.ends {{ position: absolute; left: 110px; top: 1230px; width: 860px; text-align: center; font: 400 42px/1.35 'Inter Dozi'; color: rgba(250,247,242,.9); }}
"""


def icon_svg(name):
    return (f'<svg viewBox="0 0 24 24" fill="none" stroke="{C["primary"]}" stroke-width="2" stroke-linecap="round" '
            f'stroke-linejoin="round">{ICONS[name]}</svg>')


def build(tr):
    out = os.path.join(OUT, tr['id'])
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'assets'))
    shutil.copytree(os.path.join(HERE, 'assets', 'pierre'), os.path.join(out, 'assets', 'pierre'))
    for f in os.listdir(os.path.join(HERE, 'assets')):
        if f.endswith('.ttf') or f == 'gsap.min.js':
            shutil.copy(os.path.join(HERE, 'assets', f), os.path.join(out, 'assets', f))

    js, body = [], []
    INTRO = 2.6
    BEAT = 2.9
    n = len(tr['beats'])
    end_start = INTRO + n * BEAT
    total = end_start + 3.4
    moods = [(0, INTRO, 'surprised')]

    big = dict(x=W / 2 - 210, y=1200, s=420 / 384)
    small = dict(x=W / 2 - 160, y=1300, s=320 / 384)
    js.append(f"tl.fromTo('#pierre', {{x:{big['x']}, y:{big['y']}, scale:{big['s']}}}, {{x:{big['x']}, y:{big['y']}, scale:{big['s']}, duration:0.01}}, 0);")
    body.append(f'<div id="soon" class="clip soon" data-start="0" data-duration="{end_start:.2f}"><span id="soon-p">COMING SOON</span></div>')
    body.append(f'<div id="title" class="clip title" data-start="0" data-duration="{INTRO:.2f}"><span id="title-t">{rich(tr["title"])}</span></div>')
    js.append(f"tl.to('#title-t', {{opacity:0, filter:'blur(10px)', duration:0.2, ease:'power3.in'}}, {INTRO - 0.3:.2f});")
    js.append(f"tl.to('#pierre', {{x:{small['x']}, y:{small['y']}, scale:{small['s']}, duration:0.5, ease:'power3.inOut'}}, {INTRO - 0.35:.2f});")

    for i, (ic, line, mood) in enumerate(tr['beats']):
        a = INTRO + i * BEAT
        moods.append((a, a + BEAT, mood))
        body.append(f"""<div id="b{i}" class="clip beat" data-start="{a:.2f}" data-duration="{BEAT + 0.05:.2f}" style="z-index:{10 + i}">
  <div class="ic" id="b{i}-ic">{icon_svg(ic)}</div><div class="ln" id="b{i}-ln"><span>{rich(line)}</span></div>
</div>""")
        body.append(f'<div id="n{i}" class="clip count" data-start="{a:.2f}" data-duration="{BEAT:.2f}">{i + 1} of {n}</div>')
        # whip in from the right, out to the left
        js.append(f"tl.fromTo('#b{i}', {{x:1100, filter:'blur(14px)'}}, {{x:0, filter:'blur(0px)', duration:0.45, ease:'expo.out'}}, {a:.2f});")
        js.append(f"tl.fromTo('#b{i}-ic', {{scale:0.6}}, {{scale:1, duration:0.5, ease:'back.out(1.8)'}}, {a + 0.12:.2f});")
        js.append(f"tl.to('#b{i}', {{x:-1100, filter:'blur(14px)', duration:0.3, ease:'power3.in'}}, {a + BEAT - 0.25:.2f});")

    moods.append((end_start, total, 'celebrating'))
    js.append(f"tl.to('#soon', {{opacity:0, duration:0.2}}, {end_start - 0.2:.2f});")
    js.append(f"tl.to('#pierre', {{x:{W / 2 - 230}, y:540, scale:{460 / 384}, duration:0.6, ease:'power3.inOut'}}, {end_start - 0.2:.2f});")
    et, es = tr['end']
    body.append(f'<div id="endt" class="clip endt" data-start="{end_start:.2f}" data-duration="{total - end_start:.2f}"><span id="endt-t">{rich(et)}</span></div>')
    body.append(f'<div id="ends" class="clip ends" data-start="{end_start:.2f}" data-duration="{total - end_start:.2f}"><span id="ends-t">{html.escape(es)}</span></div>')
    js.append(f"tl.fromTo('#endt-t', {{opacity:0, filter:'blur(10px)'}}, {{opacity:1, filter:'blur(0px)', duration:0.3, ease:'power4.out'}}, {end_start + 0.35:.2f});")
    js.append(f"tl.fromTo('#ends-t', {{opacity:0, filter:'blur(8px)'}}, {{opacity:1, filter:'blur(0px)', duration:0.3, ease:'power4.out'}}, {end_start + 0.65:.2f});")

    prev = None
    for at, fi in pierre_frames(moods):
        if prev is not None and prev != fi:
            js.append(f"tl.set('#pierre-f{prev}', {{opacity:0}}, {at});")
        if prev != fi:
            js.append(f"tl.set('#pierre-f{fi}', {{opacity:1}}, {at});")
        prev = fi

    doc = f"""<!doctype html>
<html lang="en-GB"><head><meta charset="UTF-8" /><meta name="viewport" content="width={W}, height={H}" />
<script src="assets/gsap.min.js"></script><style>{CSS}</style></head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total:.2f}" data-width="{W}" data-height="{H}">
  <div class="dots"></div>
  {''.join(body)}
  <div id="pierre">{pierre_markup('pierre')}</div>
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
window.__timelines = window.__timelines || {{}};
window.__timelines["main"] = tl;
</script>
</body></html>
"""
    open(os.path.join(out, 'index.html'), 'w').write(doc)
    json.dump({'id': tr['id'], 'name': tr['id']}, open(os.path.join(out, 'meta.json'), 'w'))
    return total


if __name__ == '__main__':
    only = sys.argv[1:]
    for tr in TRAILERS:
        if only and tr['id'] not in only:
            continue
        print(tr['id'], f'{build(tr):.1f}s')
