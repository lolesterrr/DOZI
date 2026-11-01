import { fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { TUTORIALS } from '../catalog';
import { TutorialPlayerScreen } from '../components/TutorialPlayerScreen';
import { TutorialsScreen } from '../components/TutorialsScreen';

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Stack: { Screen: () => null },
  };
});

const s = strings.tutorials;

describe('Tutorials list', () => {
  it('shows every tutorial and the coming-soon trailers', async () => {
    await renderWithProviders(<TutorialsScreen />);
    for (const t of TUTORIALS) {
      expect(screen.getByText(s.items[t.key].title)).toBeOnTheScreen();
    }
    expect(screen.getByText(s.soonTitle)).toBeOnTheScreen();
    expect(screen.getAllByText(s.soonBadge)).toHaveLength(
      TUTORIALS.filter((t) => t.kind === 'trailer').length,
    );
  });

  it('opens the player when a tutorial is tapped', async () => {
    await renderWithProviders(<TutorialsScreen />);
    fireEvent.press(screen.getByText(s.items.decks.title));
    expect(router.push).toHaveBeenCalledWith({
      pathname: '/tutorials/[id]',
      params: { id: '03-decks' },
    });
  });
});

describe('Tutorial player', () => {
  it('plays the video and offers the next tutorial', async () => {
    await renderWithProviders(<TutorialPlayerScreen id="01-welcome" />);
    expect(screen.getByTestId('video-view')).toBeOnTheScreen();
    fireEvent.press(screen.getByText(s.next(s.items.notes.title)));
    expect(router.replace).toHaveBeenCalledWith({
      pathname: '/tutorials/[id]',
      params: { id: '02-notes' },
    });
  });

  it('has no next button after the last trailer', async () => {
    await renderWithProviders(<TutorialPlayerScreen id="12-soon-together" />);
    expect(screen.queryByText(/^Next:/)).toBeNull();
  });

  it('says so when the video is missing', async () => {
    await renderWithProviders(<TutorialPlayerScreen id="nope" />);
    expect(screen.getByText(s.missingTitle)).toBeOnTheScreen();
  });
});
