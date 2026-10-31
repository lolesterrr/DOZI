import { act, render, screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';

import { Dozi, DoziSpeech, doziMoods } from '..';
import { doziAnimations, doziArt, spritePaths } from '../art/moods';
import { pierreAnimations, pierreFrames, pierrePalette } from '../art/sprites';
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

  it('has 32 × 32 pixel frames that use only palette colours', () => {
    expect(pierreFrames.length).toBeGreaterThan(doziMoods.length);
    for (const rows of pierreFrames) {
      expect(rows).toHaveLength(32);
      for (const row of rows) {
        expect(row).toHaveLength(32);
        for (const key of row) if (key !== '.') expect(pierrePalette[key]).toBeDefined();
      }
    }
  });

  it('gives every mood a loop of at least two real frames with sensible timings', () => {
    for (const mood of doziMoods) {
      const steps = pierreAnimations[mood];
      expect(steps.length).toBeGreaterThanOrEqual(2);
      expect(new Set(steps.map((s) => s.frame)).size).toBeGreaterThanOrEqual(2);
      for (const { frame, ms } of steps) {
        expect(pierreFrames[frame]).toBeDefined();
        expect(ms).toBeGreaterThanOrEqual(100);
        expect(ms).toBeLessThanOrEqual(3000);
      }
      expect(doziAnimations[mood]).toHaveLength(steps.length);
    }
  });

  it('plays the frames of his loop, and holds still when not animated', async () => {
    jest.useFakeTimers();
    try {
      const { rerender } = await render(<Dozi mood="happy" />);
      const first = screen.toJSON();
      await act(async () => {
        jest.advanceTimersByTime(pierreAnimations.happy[0].ms + 10);
      });
      expect(screen.toJSON()).not.toEqual(first);
      await rerender(<Dozi mood="happy" animated={false} />);
      const still = screen.toJSON();
      await act(async () => {
        jest.advanceTimersByTime(5000);
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
    await render(<DoziSpeech mood="proud" message="Well done!" />);
    expect(screen.getByText('Well done!')).toBeOnTheScreen();
    expect(screen.getByTestId('dozi-proud')).toBeOnTheScreen();
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
