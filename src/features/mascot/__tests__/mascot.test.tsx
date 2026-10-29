import { render, screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';

import { Dozi, DoziSpeech, doziMoods } from '..';
import { doziArt } from '../art/moods';
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
