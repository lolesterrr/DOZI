"""Original café-jazz background music for the Dozi tutorials, written as MIDI and played with
the free FluidR3 GM soundfont. Usage: python3 compose.py <out.mid> <calm|bright> <seconds>"""
import random
import sys

import mido

out, mood, secs = sys.argv[1], sys.argv[2], float(sys.argv[3])
random.seed(7 if mood == 'calm' else 11)
BPM = 84 if mood == 'calm' else 108
TPB = 480
SW = 2 / 3  # swing: the off-beat lands two thirds through the beat

F, G, A, Bb, C, D, E = 53, 55, 57, 58, 60, 62, 64
# Eight-bar loop in F major: Fmaj7 Dm7 Gm7 C7 Am7 D7 Gm7-C7 Fmaj7 (chord tones as MIDI notes)
CHORDS = [
    [('F', [53, 57, 60, 64])], [('D', [50, 53, 57, 60])], [('G', [55, 58, 62, 65])],
    [('C', [48, 52, 55, 58])], [('A', [57, 60, 64, 67])], [('D', [50, 54, 57, 60])],
    [('G', [55, 58, 62, 65]), ('C', [48, 52, 55, 58])], [('F', [53, 57, 60, 64])],
]
ROOT = {'F': 41, 'D': 38, 'G': 43, 'C': 36, 'A': 45}
# Melody: (beat, length, note) per bar, F major, a lazy lilting line
MEL = [
    [(0, 1.5, 69), (1.5, .5, 72), (2, 1, 76), (3, 1, 74)],
    [(0, 2, 72), (2, 1, 69), (3, 1, 65)],
    [(0, 1.5, 70), (1.5, .5, 74), (2, 1, 77), (3, .5, 76), (3.5, .5, 74)],
    [(0, 2.5, 76), (3, 1, 67)],
    [(0, 1.5, 72), (1.5, .5, 76), (2, 1.5, 79), (3.5, .5, 76)],
    [(0, 1, 78), (1, .5, 76), (1.5, .5, 74), (2, 2, 72)],
    [(0, 1, 70), (1, 1, 69), (2, 1, 67), (3, 1, 70)],
    [(0, 3.5, 69)],
]


def t(beat):  # beat position with swing -> ticks
    whole = int(beat)
    frac = beat - whole
    if abs(frac - .5) < 1e-6:
        frac = SW
    return int((whole + frac) * TPB)


events = []  # (tick, msg)


def note(ch, beat, length, n, vel):
    a = t(beat)
    b = max(a + 30, t(beat + length) - 20)
    events.append((a, mido.Message('note_on', channel=ch, note=n, velocity=vel)))
    events.append((b, mido.Message('note_off', channel=ch, note=n, velocity=0)))


bar_beats = 4
bars = int(secs / (60 / BPM * 4)) + 2
loops = (bars + 7) // 8
EP, BASS, MELO, GTR, DR = 0, 1, 2, 3, 9
programs = {EP: 4, BASS: 32, MELO: 21 if mood == 'calm' else 11, GTR: 24}
setup = []
for ch, pg in programs.items():
    setup.append(mido.Message('program_change', channel=ch, program=pg))
setup.append(mido.Message('program_change', channel=DR, program=40))  # brush kit
for ch, vol in ((EP, 92), (BASS, 105), (MELO, 70 if mood == 'calm' else 78), (GTR, 70), (DR, 80)):
    setup.append(mido.Message('control_change', channel=ch, control=7, value=vol))
    setup.append(mido.Message('control_change', channel=ch, control=91, value=60))  # reverb

for b in range(bars):
    loop, i = divmod(b, 8)
    base = b * bar_beats
    chords = CHORDS[i]
    # electric piano: Charleston comp, soft
    for k, (name, tones) in enumerate(chords):
        span = 4 / len(chords)
        st = base + k * span
        v = random.randint(42, 52)
        hits = [(0, 1.2), (1.5, .4)] if span == 4 else [(0, 1.4)]
        if span == 4 and random.random() < .4:
            hits.append((3.5, .5))
        for off, ln in hits:
            for n in tones[1:]:
                note(EP, st + off, ln, n + 12, v)
    # walking bass (enters after the first two bars)
    if b >= 2 or loop > 0:
        walk = []
        for k, (name, tones) in enumerate(chords):
            r = ROOT[name]
            if len(chords) == 1:
                walk += [r, r + 7 if random.random() < .5 else r + 4, r + 12 if random.random() < .3 else r + 7]
                nxt = ROOT[CHORDS[(i + 1) % 8][0][0]]
                walk.append(nxt + (1 if nxt < r + 6 else -1))
            else:
                walk += [r, r + 7]
        for k, n in enumerate(walk):
            note(BASS, base + k, .9, n, random.randint(70, 82))
    # brushes: swirl on every beat, tap on 2 and 4, soft ride swing (from bar 3)
    if b >= 2 or loop > 0:
        for k in range(4):
            note(DR, base + k, .9, 39, random.randint(30, 40))
        for k in (1, 3):
            note(DR, base + k, .2, 38, random.randint(38, 48))
        if mood == 'bright' or loop % 2 == 1:
            for k in range(4):
                note(DR, base + k, .3, 51, random.randint(28, 36))
                if k in (1, 3):
                    note(DR, base + k + .5, .3, 51, random.randint(22, 30))
    # melody every other loop, starting with the second loop
    if loop % 2 == 1 or (mood == 'bright' and loop > 0):
        lift = 12 if (mood == 'calm' and loop % 4 == 3) else 0
        for off, ln, n in MEL[i]:
            note(MELO, base + off, ln, n + lift - (12 if mood == 'bright' else 0) + (0 if mood == 'calm' else 12), random.randint(56, 66))
    # nylon guitar arpeggio answers in the loops without melody
    elif loop > 0:
        tones = chords[0][1]
        for k, n in enumerate([tones[0] + 12, tones[2] + 12, tones[3] + 12, tones[1] + 24]):
            if random.random() < .8:
                note(GTR, base + 2 + k * .5, .8, n, random.randint(40, 52))

# final chord
end = bars * 4
for n in [53, 57, 60, 64, 69]:
    note(EP, end, 4, n + 12, 46)
note(BASS, end, 4, 41, 70)

mid = mido.MidiFile(ticks_per_beat=TPB)
tr = mido.MidiTrack()
mid.tracks.append(tr)
tr.append(mido.MetaMessage('set_tempo', tempo=mido.bpm2tempo(BPM)))
for m in setup:
    tr.append(m.copy(time=0))
events.sort(key=lambda e: (e[0], e[1].type == 'note_on'))
now = 0
for tick, m in events:
    tr.append(m.copy(time=tick - now))
    now = tick
mid.save(out)
print(out, bars, 'bars', BPM, 'bpm')
