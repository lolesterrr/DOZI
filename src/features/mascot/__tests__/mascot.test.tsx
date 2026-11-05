import { act, render, screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';
import { ThemeProvider } from '@/theme';

import { Dozi, DoziSpeech, doziMoods } from '..';
import { doziAnimations, doziArt, doziFrames, spritePaths } from '../art/moods';
import { pierreFrames, pierrePalette } from '../art/sprites';
import { nextStep, stepAt, stepDuration } from '../logic';
import { greetingContext, mascotContexts, messageMood, pickMessage } from '../messages';

describe('Dozi', () => {
  it.each(doziMoods)('draws the %s mood with an accessible label', async (mood) => {
    await render(<Dozi mood={mood} />);
    expect(screen.getByTestId(`dozi-${mood}`)).toBeOnTheScreen();
    expect(screen.getByLabelText(strings.mascot.label)).toBeOnTheScreen();
  });

  it('has a drawing for every mood', () => {
    expect(Object.keys(doziArt).sort()).toEqual([...doziMoods].sort());
  });

  it('has 32 × 32 pixel frames using only palette colours', () => {
    expect(doziFrames).toHaveLength(pierreFrames.length);
    for (const rows of pierreFrames) {
      expect(rows).toHaveLength(32);
      for (const row of rows) {
        expect(row).toHaveLength(32);
        for (const key of row) if (key !== '.') expect(pierrePalette[key]).toBeDefined();
      }
    }
  });

  it.each(doziMoods)('animates the %s mood with a loop of real frames', (mood) => {
    const loop = doziAnimations[mood];
    expect(loop.frames.length).toBeGreaterThanOrEqual(2);
    expect(loop.ms).toHaveLength(loop.frames.length);
    for (const frame of loop.frames) expect(pierreFrames[frame]).toBeDefined();
    for (const ms of loop.ms) expect(ms).toBeGreaterThanOrEqual(100);
    expect(new Set(loop.frames).size).toBeGreaterThan(1);
  });

  it('steps through the frames on a timer and stays still when not animated', async () => {
    jest.useFakeTimers();
    try {
      const first = doziAnimations.sleepy.ms[0];
      await render(<Dozi mood="sleepy" />);
      const before = screen.toJSON();
      await act(async () => {
        jest.advanceTimersByTime(first + 1);
      });
      expect(screen.toJSON()).not.toEqual(before);

      await render(<Dozi mood="sleepy" animated={false} />);
      const still = screen.toJSON();
      await act(async () => {
        jest.advanceTimersByTime(first + 1);
      });
      expect(screen.toJSON()).toEqual(still);
    } finally {
      jest.useRealTimers();
    }
  });

  it('turns pixel rows into one path per colour, a rectangle per run', () => {
    const paths = spritePaths(['.kk.', 'okko']);
    expect(paths.map((p) => p.colour)).toEqual([pierrePalette.k, pierrePalette.o]);
    expect(paths[0].d.match(/M/g)).toHaveLength(2);
    expect(paths[0].d.startsWith('M1 0h2.04')).toBe(true);
    expect(paths[1].d.match(/M/g)).toHaveLength(2);
  });

  it('shows the message in a speech bubble', async () => {
    await render(
      <ThemeProvider>
        <DoziSpeech mood="proud" message="Well done!" />
      </ThemeProvider>,
    );
    expect(screen.getByText('Well done!')).toBeOnTheScreen();
    expect(screen.getByTestId('dozi-proud')).toBeOnTheScreen();
  });
});

describe('mood loop timing', () => {
  const loop = { frames: [4, 7, 9], ms: [100, 200, 300] };

  it('moves to the next step and wraps round', () => {
    expect(nextStep(loop, 0)).toBe(1);
    expect(nextStep(loop, 2)).toBe(0);
    expect(nextStep({ frames: [], ms: [] }, 3)).toBe(0);
  });

  it('never waits less than one screen refresh', () => {
    expect(stepDuration(loop, 1)).toBe(200);
    expect(stepDuration({ frames: [1], ms: [0] }, 0)).toBe(16);
    expect(stepDuration(loop, 9)).toBe(16);
  });

  it('finds the step showing at a given time, looping', () => {
    expect(stepAt(loop, 0)).toBe(0);
    expect(stepAt(loop, 99)).toBe(0);
    expect(stepAt(loop, 100)).toBe(1);
    expect(stepAt(loop, 350)).toBe(2);
    expect(stepAt(loop, 600)).toBe(0);
    expect(stepAt({ frames: [3], ms: [500] }, 1234)).toBe(0);
  });
});

describe('mascot messages', () => {
  it('has several lines for every situation and a mood for each', () => {
    for (const context of mascotContexts) {
      expect(strings.mascot.messages[context].length).toBeGreaterThanOrEqual(3);
      expect(doziMoods).toContain(messageMood(context));
    }
  });

  it('picks the same line for the same seed, cycling through all of them', () => {
    const lines = strings.mascot.messages.correct;
    expect(pickMessage('correct', 2)).toBe(pickMessage('correct', 2));
    expect(new Set(lines.map((_, i) => pickMessage('correct', i))).size).toBe(lines.length);
    expect(pickMessage('correct', lines.length)).toBe(pickMessage('correct', 0));
    expect(pickMessage('correct', -1)).toBe(lines[lines.length - 1]);
  });

  it('picks the greeting by the hour, with a sleepy Dozi from 22:00 to 05:00', () => {
    expect(greetingContext(7)).toBe('greetingMorning');
    expect(greetingContext(13)).toBe('greetingDay');
    expect(greetingContext(19)).toBe('greetingEvening');
    expect(greetingContext(22)).toBe('greetingLate');
    expect(greetingContext(2)).toBe('greetingLate');
    expect(messageMood('greetingLate')).toBe('sleepy');
  });

  it('never shames: no line scolds or counts failures', () => {
    const banned = /\b(lazy|failed|failure|disappoint|shame|should have|only)\b/i;
    for (const context of mascotContexts) {
      for (const line of strings.mascot.messages[context]) expect(line).not.toMatch(banned);
    }
  });
});
