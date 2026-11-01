"""Builds one HyperFrames project per Dozi tutorial video from real app screenshots.

Usage: python3 gen.py            (writes out/<id>/index.html + assets for every video)
"""
import html
import json
import os
import re
import shutil

from PIL import Image

HERE = os.path.dirname(os.path.abspath(__file__))
SHOTS = os.path.join(HERE, '..', 'shots')
OUT = os.path.join(HERE, 'out')

W, H = 1080, 1920
# Phone screen in the frame. Screenshots are 780 x 1688 (390 x 844 CSS px at 2x).
SCR_W = 640
SCR_H = round(SCR_W * 1688 / 780)  # 1385
SCR_X = (W - SCR_W) // 2  # 220
SCR_Y = 440
BEZEL = 16
K = SCR_W / 390  # CSS px -> frame px
PACE = 1.45  # every step lasts this much longer than written in videos.py

C = {
    'bg': '#FAF7F2', 'surface': '#FFFFFF', 'muted': '#F0EBE3', 'border': '#DDD5C9',
    'fg': '#1F1B16', 'fgm': '#5E564C', 'primary': '#0B6B68', 'psoft': '#D5ECE9',
    'onpsoft': '#064744', 'accent': '#E3A72F', 'asoft': '#FAEDCF', 'onasoft': '#5A3F00',
}

ANIMS = json.load(open(os.path.join(HERE, 'assets', 'pierre', 'anims.json')))

# ----------------------------------------------------------------------------- steps.json cache
_steps = {}


def step(ref):
    d, n = ref.split('/')
    if d not in _steps:
        _steps[d] = {s['f'][:2]: s for s in json.load(open(os.path.join(SHOTS, d, 'steps.json')))}
    return _steps[d][n]


def F(ref, cap=None, dur=None, zoom=None, mood=None, tip=None, tap=True):
    """One screenshot on the phone. `cap` changes the caption; `zoom` = (scale, cssX, cssY)."""
    s = step(ref)
    t = s.get('tap') if tap else None
    if dur is None:
        dur = 1.55 if t else 1.3
    # Slower, calmer pacing: a tap needs time to find the button, press it and see the result.
    dur = max(dur * PACE, 2.5 if t else 2.0)
    return {'kind': 'shot', 'ref': ref, 'cap': cap, 'dur': dur, 'tap': t, 'zoom': zoom,
            'mood': mood, 'tip': tip}


def T(*refs, cap=None, each=0.45, zoom=None, mood=None):
    """A run of typing frames (the text appears word by word)."""
    out = [F(refs[0], cap=cap, zoom=zoom, mood=mood, tap=False)]
    out += [F(r, zoom=zoom, tap=False) for r in refs[1:]]
    for o in out:
        o['dur'] = each
        o['typing'] = True
    out[0]['dur'] = 1.0
    out[-1]['dur'] = 1.8
    return out


def R(d, a, b):
    return [f'{d}/{i:02d}' for i in range(a, b + 1)]


def card(kind, title, body, dur=5.6, mood='thinking'):
    """An explainer card over the phone, for features that can't be screen-captured."""
    return {'kind': 'card', 'art': kind, 'title': title, 'body': body, 'dur': dur, 'mood': mood}


def rich(text):
    """**word** -> teal accent."""
    t = html.escape(text)
    return re.sub(r'\*\*(.+?)\*\*', r'<span class="acc">\1</span>', t)


# ----------------------------------------------------------------------------- Pierre
def pierre_markup(pid):
    imgs = ''.join(
        f'<img id="{pid}-f{i}" class="pf" src="assets/pierre/f{i}.png" alt="" />' for i in range(31)
    )
    return imgs


def pierre_frames(timeline):
    """timeline: list of (start, end, mood). Returns list of (time, frameIndex) switches."""
    out = []
    for start, end, mood in timeline:
        a = ANIMS[mood]
        t = start
        i = 0
        while t < end - 1e-6:
            out.append((round(t, 3), a['frames'][i % len(a['frames'])]))
            t += a['ms'][i % len(a['ms'])] / 1000
            i += 1
    return out


# ----------------------------------------------------------------------------- build
CSS = """
@font-face { font-family: 'Nunito Dozi'; src: url('assets/Nunito_800ExtraBold.ttf'); font-weight: 800; }
@font-face { font-family: 'Nunito Dozi'; src: url('assets/Nunito_700Bold.ttf'); font-weight: 700; }
@font-face { font-family: 'Inter Dozi'; src: url('assets/Inter_400Regular.ttf'); font-weight: 400; }
@font-face { font-family: 'Inter Dozi'; src: url('assets/Inter_600SemiBold.ttf'); font-weight: 600; }
* { margin: 0; padding: 0; box-sizing: border-box; }
html, body { width: %(W)dpx; height: %(H)dpx; overflow: hidden; background: %(bg)s; }
#root { position: relative; width: %(W)dpx; height: %(H)dpx; overflow: hidden; background: %(bg)s;
  font-family: 'Inter Dozi', sans-serif; color: %(fg)s; }
.full { position: absolute; left: 0; top: 0; width: %(W)dpx; height: %(H)dpx; }
.dots { position: absolute; inset: 0; opacity: .55;
  background-image: radial-gradient(%(border)s 2px, transparent 2.5px); background-size: 44px 44px; }
#cam { position: absolute; left: 0; top: 0; width: %(W)dpx; height: %(H)dpx; transform-origin: 0 0; }
#phone { position: absolute; left: %(PX)dpx; top: %(PY)dpx; width: %(PW)dpx; height: %(PH)dpx;
  border-radius: 78px; background: #1E1C1A; box-shadow: 0 40px 90px rgba(31,27,22,.22), 0 6px 18px rgba(31,27,22,.18); }
#screen { position: absolute; left: %(SX)dpx; top: %(SY)dpx; width: %(SW)dpx; height: %(SH)dpx;
  border-radius: 62px; overflow: hidden; background: %(bg)s; }
.shot { position: absolute; left: 0; top: 0; width: %(SW)dpx; height: %(SH)dpx; }
.shot img { width: 100%%; height: 100%%; display: block; }
.spot { position: absolute; }
.spot .dim { position: absolute; inset: 0; border-radius: 22px; box-shadow: 0 0 0 2400px rgba(31,27,22,.30); opacity: 0; }
.spot .ring { position: absolute; inset: -4px; border-radius: 26px; border: 6px solid %(accent)s;
  box-shadow: 0 0 0 4px rgba(255,255,255,.85), 0 0 28px rgba(227,167,47,.55); opacity: 0; }
#finger { position: absolute; left: 0; top: 0; width: 96px; height: 96px; margin: -48px 0 0 -48px; opacity: 0; }
#finger .dot { position: absolute; inset: 14px; border-radius: 50%%; background: rgba(255,255,255,.55);
  border: 5px solid rgba(11,107,104,.9); box-shadow: 0 6px 16px rgba(0,0,0,.25); }
#finger .halo { position: absolute; inset: 0; border-radius: 50%%; background: rgba(11,107,104,.28); opacity: 0; }
#bubble { opacity: 0; position: absolute; left: 40px; top: 120px; width: 770px; height: 270px; background: %(surface)s;
  border: 3px solid %(border)s; border-radius: 40px; box-shadow: 0 10px 30px rgba(31,27,22,.08); }
#bubble:after { content: ''; position: absolute; right: -24px; top: 112px; width: 40px; height: 40px;
  background: %(surface)s; border-right: 3px solid %(border)s; border-top: 3px solid %(border)s; transform: rotate(45deg); }
.kicker { opacity: 0; position: absolute; left: 76px; top: 150px; font: 600 28px 'Inter Dozi'; color: %(primary)s; letter-spacing: .02em; }
.cap { position: absolute; left: 76px; top: 196px; width: 700px; height: 170px; display: flex; align-items: center;
  font: 800 52px/1.14 'Nunito Dozi'; color: %(fg)s; }
.acc { color: %(primary)s; }
#pierre { position: absolute; left: 0; top: 0; width: 384px; height: 384px; transform-origin: 0 0; }
.pf { position: absolute; left: 0; top: 0; width: 384px; height: 384px; image-rendering: pixelated; opacity: 0; }
.hook { position: absolute; left: 0; width: %(W)dpx; text-align: center; }
.hook .k { font: 600 34px 'Inter Dozi'; color: %(primary)s; }
.hook .t { margin-top: 18px; font: 800 96px/1.08 'Nunito Dozi'; color: %(fg)s; padding: 0 70px; }
.hook .s { margin-top: 26px; font: 400 40px/1.35 'Inter Dozi'; color: %(fgm)s; padding: 0 110px; }
.xcard { position: absolute; left: 90px; top: 760px; width: 900px; padding: 46px 48px; background: %(surface)s;
  border: 3px solid %(border)s; border-radius: 44px; box-shadow: 0 30px 80px rgba(31,27,22,.18); }
.xcard h3 { font: 800 50px/1.15 'Nunito Dozi'; color: %(fg)s; }
.xcard p { margin-top: 18px; font: 400 36px/1.4 'Inter Dozi'; color: %(fgm)s; }
.xcard .art { margin-top: 30px; height: 420px; border-radius: 28px; background: %(muted)s; position: relative; overflow: hidden; }
.pill { display: inline-block; padding: 12px 26px; border-radius: 999px; background: %(psoft)s; color: %(onpsoft)s; font: 600 30px 'Inter Dozi'; }
.end .t { font: 800 84px/1.1 'Nunito Dozi'; }
"""


def css():
    return CSS % dict(W=W, H=H, PX=SCR_X - BEZEL, PY=SCR_Y - BEZEL, PW=SCR_W + 2 * BEZEL, PH=SCR_H + 2 * BEZEL,
                      SX=SCR_X, SY=SCR_Y, SW=SCR_W, SH=SCR_H, **C)


def art_markup(kind, cid):
    if kind == 'occlusion':
        # A neutral labelled diagram: shapes with three labels that get covered by boxes.
        return f"""
<svg viewBox="0 0 800 420" width="100%" height="100%">
  <rect x="250" y="70" width="300" height="280" rx="40" fill="#fff" stroke="{C['border']}" stroke-width="6"/>
  <circle cx="400" cy="170" r="60" fill="{C['psoft']}" stroke="{C['primary']}" stroke-width="6"/>
  <rect x="320" y="260" width="160" height="50" rx="14" fill="{C['asoft']}" stroke="{C['accent']}" stroke-width="6"/>
  <line x1="340" y1="150" x2="170" y2="110" stroke="{C['fgm']}" stroke-width="4"/>
  <line x1="470" y1="285" x2="620" y2="320" stroke="{C['fgm']}" stroke-width="4"/>
  <line x1="530" y1="100" x2="630" y2="90" stroke="{C['fgm']}" stroke-width="4"/>
  <text x="60" y="122" font-family="Inter Dozi" font-size="34" fill="{C['fg']}">Label A</text>
  <text x="630" y="332" font-family="Inter Dozi" font-size="34" fill="{C['fg']}">Label B</text>
  <text x="640" y="102" font-family="Inter Dozi" font-size="34" fill="{C['fg']}">Label C</text>
  <rect id="{cid}-m1" x="44" y="80" width="160" height="60" rx="10" fill="{C['primary']}" opacity="0"/>
  <rect id="{cid}-m2" x="614" y="290" width="160" height="60" rx="10" fill="{C['primary']}" opacity="0"/>
  <rect id="{cid}-m3" x="624" y="60" width="160" height="60" rx="10" fill="{C['primary']}" opacity="0"/>
  <text id="{cid}-q" x="124" y="122" text-anchor="middle" font-family="Nunito Dozi" font-weight="800" font-size="40" fill="#fff" opacity="0">?</text>
</svg>"""
    if kind == 'annotate':
        return f"""
<svg viewBox="0 0 800 420" width="100%" height="100%">
  <rect x="60" y="40" width="680" height="340" rx="18" fill="#fff" stroke="{C['border']}" stroke-width="6"/>
  <rect x="110" y="90" width="300" height="26" rx="8" fill="{C['border']}"/>
  <rect x="110" y="140" width="420" height="18" rx="8" fill="{C['muted']}"/>
  <rect x="110" y="176" width="380" height="18" rx="8" fill="{C['muted']}"/>
  <rect x="110" y="212" width="400" height="18" rx="8" fill="{C['muted']}"/>
  <circle cx="600" cy="270" r="70" fill="{C['psoft']}"/>
  <path id="{cid}-arrow" d="M 330 330 C 420 330 470 300 530 280" fill="none" stroke="#C42636" stroke-width="10" stroke-linecap="round" stroke-dasharray="260" stroke-dashoffset="260"/>
  <path id="{cid}-head" d="M 515 262 L 540 278 L 512 296" fill="none" stroke="#C42636" stroke-width="10" stroke-linecap="round" stroke-linejoin="round" opacity="0"/>
  <text id="{cid}-label" x="130" y="345" font-family="Nunito Dozi" font-weight="800" font-size="40" fill="#C42636" opacity="0">Look here!</text>
</svg>"""
    return ''


def build(video):
    vid = video['id']
    out = os.path.join(OUT, vid)
    if os.path.exists(out):
        shutil.rmtree(out)
    os.makedirs(os.path.join(out, 'assets', 'shots'))
    shutil.copytree(os.path.join(HERE, 'assets', 'pierre'), os.path.join(out, 'assets', 'pierre'))
    for f in os.listdir(os.path.join(HERE, 'assets')):
        if f.endswith('.ttf'):
            shutil.copy(os.path.join(HERE, 'assets', f), os.path.join(out, 'assets', f))
    shutil.copy(os.path.join(HERE, 'assets', 'gsap.min.js'), os.path.join(out, 'assets', 'gsap.min.js'))

    items = []
    for it in video['steps']:
        items.extend(it if isinstance(it, list) else [it])
    # Each caption stays up for at least 0.5 s + 0.3 s a word (+ a little for the fade).
    groups = []
    for it in items:
        if it.get('cap') is not None or it['kind'] == 'card' or not groups:
            groups.append([])
        groups[-1].append(it)
    for g in groups:
        text = g[0].get('cap') or g[0].get('title') or ''
        words = len(re.sub(r'[*]', '', text).split())
        need = 1.3 + 0.36 * words
        have = sum(i['dur'] for i in g)
        if have < need:
            g[-1]['dur'] += need - have

    HOOK = 3.4
    OUTRO = 3.2
    t = HOOK
    body = []
    js = []
    pierre_tl = []  # (start, end, mood)
    caps = []  # (start, end, html)
    cur_cap = None
    cur_cap_start = None
    cur_mood = 'idle'
    mood_start = 0.0
    shots_html = []
    spots = []
    finger_pos = None
    zoom_state = (1.0, 0.0, 0.0)

    def set_mood(m, at):
        nonlocal cur_mood, mood_start
        if m == cur_mood:
            return
        pierre_tl.append((mood_start, at, cur_mood))
        cur_mood, mood_start = m, at

    # Hook: Pierre big in the middle, title below.
    set_mood(video.get('hookMood', 'happy'), 0.0)
    pierre_big = dict(x=W / 2 - 230, y=430, s=460 / 384)
    pierre_small = dict(x=826, y=140, s=232 / 384)

    js.append(f"tl.fromTo('#pierre', {{x:{pierre_big['x']}, y:{pierre_big['y']}, scale:{pierre_big['s']}}}, "
              f"{{x:{pierre_big['x']}, y:{pierre_big['y']}, scale:{pierre_big['s']}, duration:0.01}}, 0);")
    hook = video['hook']
    body.append(f"""<div id="hook" class="clip hook" data-start="0" data-duration="{HOOK:.2f}" style="top:1010px">
  <div class="k" id="hook-k">{html.escape(hook['kicker'])}</div>
  <div class="t" id="hook-t">{rich(hook['title'])}</div>
  <div class="s" id="hook-s">{html.escape(hook.get('sub', ''))}</div>
</div>""")
    js.append(f"tl.to('#hook-k, #hook-t, #hook-s', {{opacity:0, filter:'blur(8px)', duration:0.2, ease:'power3.in'}}, {HOOK-0.45});")
    # Pierre moves to the corner while the phone rises.
    js.append(f"tl.to('#pierre', {{x:{pierre_small['x']}, y:{pierre_small['y']}, scale:{pierre_small['s']}, duration:0.6, ease:'power3.inOut'}}, {HOOK-0.5});")
    js.append(f"tl.fromTo('#cam', {{y:1500}}, {{y:0, duration:0.7, ease:'expo.out'}}, {HOOK-0.35});")
    js.append(f"tl.fromTo('#bubble, #kicker', {{opacity:0, scale:0.96}}, {{opacity:1, scale:1, duration:0.35, ease:'power4.out'}}, {HOOK-0.15});")
    set_mood('idle', HOOK)

    shot_i = 0
    for it in items:
        start = t
        if it.get('mood'):
            set_mood(it['mood'], start)
        if it['kind'] == 'shot':
            if it['cap'] is not None:
                if cur_cap is not None:
                    caps.append((cur_cap_start, start, cur_cap))
                cur_cap, cur_cap_start = it['cap'], start
            src = it['ref'].replace('/', '-') + '.png'
            dst = os.path.join(out, 'assets', 'shots', src.replace('.png', '.jpg'))
            if not os.path.exists(dst):
                Image.open(os.path.join(SHOTS, it['ref'] + '.png')).convert('RGB').save(dst, quality=92)
            sid = f's{shot_i}'
            shot_i += 1
            shots_html.append({'id': sid, 'start': start, 'dur': it['dur'] + 0.25, 'z': shot_i,
                               'src': src.replace('.png', '.jpg')})
            fade = 0.06 if it.get('typing') else 0.25
            js.append(f"tl.fromTo('#{sid} img', {{opacity:0}}, {{opacity:1, duration:{fade}, ease:'none'}}, {start:.3f});")
            # camera
            z = it['zoom']
            if z is not None:
                s, cx, cy = z
                px, py = SCR_X + cx * K, SCR_Y + cy * K
                tx, ty = W / 2, SCR_Y + SCR_H * 0.46
                x, y = tx - s * px, ty - s * py
                def clamp(v, lo, hi):
                    if lo > hi:
                        lo, hi = hi, lo
                    return max(lo, min(hi, v))
                x = clamp(x, 20 - s * SCR_X, W - 20 - s * (SCR_X + SCR_W))
                y = clamp(y, H - s * (SCR_Y + SCR_H) - 10, 420 - s * SCR_Y)
                new = (s, x, y)
            else:
                new = (1.0, 0.0, 0.0)
            if new != zoom_state:
                js.append(f"tl.to('#cam', {{scale:{new[0]}, x:{new[1]:.1f}, y:{new[2]:.1f}, duration:1.0, ease:'power3.inOut'}}, {max(start - 0.25, 0):.3f});")
                zoom_state = new
            # finger
            if it['tap']:
                b = it['tap']
                fx = SCR_X + (b['x'] + b['width'] / 2) * K
                fy = SCR_Y + (b['y'] + b['height'] / 2) * K
                arrive = start + 0.35
                # Spotlight: dim the rest of the screen and ring the button before the press.
                pad = 10
                sx, sy = b['x'] * K - pad, b['y'] * K - pad
                sw, sh = b['width'] * K + 2 * pad, b['height'] * K + 2 * pad
                spot_id = f'sp{shot_i}'
                spots.append(f'<div id="{spot_id}" class="clip spot" data-start="{start:.3f}" data-duration="{it["dur"] + 0.2:.3f}" '
                             f'style="left:{sx:.1f}px; top:{sy:.1f}px; width:{sw:.1f}px; height:{sh:.1f}px; z-index:900">'
                             f'<div class="dim" id="{spot_id}-d"></div><div class="ring" id="{spot_id}-r"></div></div>')
                js.append(f"tl.fromTo('#{spot_id}-d', {{opacity:0}}, {{opacity:1, duration:0.35, ease:'power2.out'}}, {start + 0.45:.3f});")
                js.append(f"tl.fromTo('#{spot_id}-r', {{opacity:0, scale:1.25}}, {{opacity:1, scale:1, duration:0.4, ease:'back.out(1.6)'}}, {start + 0.5:.3f});")
                js.append(f"tl.to('#{spot_id}-r', {{scale:1.06, duration:0.35, ease:'sine.inOut', yoyo:true, repeat:1}}, {start + 0.95:.3f});")
                js.append(f"tl.to('#{spot_id}-d, #{spot_id}-r', {{opacity:0, duration:0.25, ease:'power2.in'}}, {start + it['dur'] - 0.12:.3f});")
                if finger_pos is None:
                    js.append(f"tl.set('#finger', {{x:{fx:.1f}, y:{fy + 120:.1f}}}, {arrive - 0.01:.3f});")
                js.append(f"tl.to('#finger', {{opacity:1, duration:0.2, ease:'none'}}, {arrive:.3f});")
                js.append(f"tl.to('#finger', {{x:{fx:.1f}, y:{fy:.1f}, duration:0.7, ease:'power3.inOut'}}, {arrive:.3f});")
                press = start + it['dur'] - 0.5
                js.append(f"tl.to('#finger .dot', {{scale:0.78, duration:0.12, ease:'power2.out'}}, {press:.3f});")
                js.append(f"tl.fromTo('#finger .halo', {{opacity:0.9, scale:0.6}}, {{opacity:0, scale:1.5, duration:0.45, ease:'power2.out', immediateRender:false}}, {press + 0.05:.3f});")
                js.append(f"tl.to('#finger .dot', {{scale:1, duration:0.2, ease:'power2.out'}}, {press + 0.14:.3f});")
                js.append(f"tl.to('#finger', {{opacity:0, duration:0.22, ease:'none'}}, {start + it['dur'] - 0.06:.3f});")
                finger_pos = (fx, fy)
            t += it['dur']
        elif it['kind'] == 'card':
            if shots_html:
                shots_html[-1]['dur'] = start + it['dur'] + 0.3 - shots_html[-1]['start']
            cid = f'c{shot_i}'
            shot_i += 1
            body.append(f"""<div id="{cid}" class="clip xcard" data-start="{start:.3f}" data-duration="{it['dur']:.3f}" style="z-index:40">
  <h3>{rich(it['title'])}</h3><p>{html.escape(it['body'])}</p>
  <div class="art">{art_markup(it['art'], cid)}</div>
  <div style="margin-top:22px"><span class="pill">Illustration</span></div>
</div>""")
            js.append(f"tl.fromTo('#{cid}', {{opacity:0, y:60, scale:0.96}}, {{opacity:1, y:0, scale:1, duration:0.45, ease:'expo.out'}}, {start:.3f});")
            js.append(f"tl.to('#{cid}', {{opacity:0, y:-30, duration:0.25, ease:'power3.in'}}, {start + it['dur'] - 0.3:.3f});")
            if it['art'] == 'occlusion':
                for k in range(1, 4):
                    js.append(f"tl.fromTo('#{cid}-m{k}', {{opacity:0, scale:0.6, transformOrigin:'50% 50%'}}, {{opacity:1, scale:1, duration:0.3, ease:'back.out(1.7)'}}, {start + 0.8 + k * 0.45:.3f});")
                js.append(f"tl.fromTo('#{cid}-q', {{opacity:0}}, {{opacity:1, duration:0.2}}, {start + 2.4:.3f});")
            if it['art'] == 'annotate':
                js.append(f"tl.fromTo('#{cid}-arrow', {{strokeDashoffset:260}}, {{strokeDashoffset:0, duration:0.8, ease:'power2.inOut'}}, {start + 0.9:.3f});")
                js.append(f"tl.fromTo('#{cid}-head', {{opacity:0}}, {{opacity:1, duration:0.15}}, {start + 1.65:.3f});")
                js.append(f"tl.fromTo('#{cid}-label', {{opacity:0, y:10}}, {{opacity:1, y:0, duration:0.3, ease:'power4.out'}}, {start + 1.9:.3f});")
            if cur_cap is not None:
                caps.append((cur_cap_start, start, cur_cap))
            cur_cap, cur_cap_start = it.get('cap', it['title']), start
            t += it['dur']

    if cur_cap is not None:
        caps.append((cur_cap_start, t, cur_cap))
    end_main = t
    # Outro
    outro = video['outro']
    set_mood(outro.get('mood', 'celebrating'), end_main)
    total = end_main + OUTRO
    js.append(f"tl.to('#cam', {{y:1700, scale:1, x:0, duration:0.55, ease:'power3.in'}}, {end_main - 0.1:.3f});")
    js.append(f"tl.to('#bubble, #kicker', {{opacity:0, duration:0.2}}, {end_main - 0.1:.3f});")
    js.append(f"tl.to('#pierre', {{x:{pierre_big['x']}, y:{pierre_big['y']}, scale:{pierre_big['s']}, duration:0.6, ease:'power3.inOut'}}, {end_main:.3f});")
    body.append(f"""<div id="outro" class="clip hook end" data-start="{end_main:.3f}" data-duration="{OUTRO:.3f}" style="top:1010px">
  <div class="t" id="outro-t">{rich(outro['title'])}</div>
  <div class="s" id="outro-s">{html.escape(outro.get('sub', ''))}</div>
</div>""")
    js.append(f"tl.fromTo('#outro-t', {{opacity:0, filter:'blur(10px)'}}, {{opacity:1, filter:'blur(0px)', duration:0.3, ease:'power4.out'}}, {end_main + 0.45:.3f});")
    js.append(f"tl.fromTo('#outro-s', {{opacity:0, filter:'blur(8px)'}}, {{opacity:1, filter:'blur(0px)', duration:0.3, ease:'power4.out'}}, {end_main + 0.75:.3f});")
    pierre_tl.append((mood_start, total, cur_mood))

    # captions
    cap_html = []
    for i, (a, b, text) in enumerate(caps):
        cap_html.append(f'<div id="cap{i}" class="clip cap" data-start="{a:.3f}" data-duration="{b - a:.3f}" style="z-index:3">'
                        f'<span id="cap{i}-t">{rich(text)}</span></div>')
        js.append(f"tl.fromTo('#cap{i}-t', {{opacity:0, filter:'blur(8px)'}}, {{opacity:1, filter:'blur(0px)', duration:0.2, ease:'power4.out'}}, {a + 0.02:.3f});")

    # Pierre frames
    switches = pierre_frames(pierre_tl)
    prev = None
    for at, fi in switches:
        if prev is not None and prev != fi:
            js.append(f"tl.set('#pierre-f{prev}', {{opacity:0}}, {at});")
        if prev != fi:
            js.append(f"tl.set('#pierre-f{fi}', {{opacity:1}}, {at});")
        prev = fi

    doc = f"""<!doctype html>
<html lang="en-GB">
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width={W}, height={H}" />
<script src="assets/gsap.min.js"></script>
<style>{css()}</style>
</head>
<body>
<div id="root" data-composition-id="main" data-start="0" data-duration="{total:.3f}" data-width="{W}" data-height="{H}">
  <div class="dots"></div>
  <div id="cam">
    <div id="phone"></div>
    <div id="screen">
      {''.join(spots)}
      {''.join(f'<div id="{h["id"]}" class="clip shot" data-start="{h["start"]:.3f}" data-duration="{h["dur"]:.3f}" style="z-index:{h["z"]}"><img src="assets/shots/{h["src"]}" alt="" /></div>' for h in shots_html)}
    </div>
    <div id="finger"><div class="halo"></div><div class="dot"></div></div>
  </div>
  <div id="bubble"></div>
  <div id="kicker" class="kicker">{html.escape(video['kicker'])}</div>
  {''.join(cap_html)}
  {''.join(body)}
  <div id="pierre">{pierre_markup('pierre')}</div>
</div>
<script>
const tl = gsap.timeline({{ paused: true }});
{chr(10).join(js)}
window.__timelines = window.__timelines || {{}};
window.__timelines["main"] = tl;
</script>
</body>
</html>
"""
    open(os.path.join(out, 'index.html'), 'w').write(doc)
    json.dump({'id': vid, 'name': vid}, open(os.path.join(out, 'meta.json'), 'w'))
    return total


if __name__ == '__main__':
    import sys
    from videos import VIDEOS
    only = sys.argv[1:]
    for v in VIDEOS:
        if only and v['id'] not in only:
            continue
        d = build(v)
        print(f"{v['id']}: {d:.1f}s")
