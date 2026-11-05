import { act, fireEvent, screen } from '@testing-library/react-native';
import { router } from 'expo-router';

import { currentConnection } from '@/features/media/network';
import { strings } from '@/i18n/strings';
import { getLogLevel, setLogLevel } from '@/lib/logger';
import { fakeTutorialFiles } from '@/test-utils/fakeTutorialFiles';
import { renderWithProviders } from '@/test-utils/render';

import { TUTORIALS } from '../catalog';
import { TutorialPlayerScreen } from '../components/TutorialPlayerScreen';
import { TutorialsScreen } from '../components/TutorialsScreen';
import { tutorialUrl } from '../logic';
import { resetTutorialsForTests } from '../store';

const mockFake = fakeTutorialFiles();
const PROJECT = 'https://sample.supabase.co';

jest.mock('../device', () => ({
  deviceTutorialDeps: {
    // Getters, because jest.mock runs before `mockFake` is made.
    get files() {
      return mockFake.files;
    },
    projectUrl: 'https://sample.supabase.co',
    fetchText: (url: string) => mockFake.fetchText(url),
  },
}));

jest.mock('@/features/media/network', () => ({
  currentConnection: jest.fn(() => Promise.resolve('wifi')),
}));

const mockSettings = { wifiOnly: true };
jest.mock('@/features/settings/hooks', () => ({
  useAppSettings: () => ({ loading: false, settings: mockSettings, update: jest.fn() }),
}));

jest.mock('expo-router', () => {
  const actual = jest.requireActual('expo-router');
  return {
    ...actual,
    router: { push: jest.fn(), replace: jest.fn(), back: jest.fn() },
    Stack: { Screen: () => null },
  };
});

const s = strings.tutorials;
const logLevel = getLogLevel();
beforeAll(() => setLogLevel('error'));
afterAll(() => setLogLevel(logLevel));

beforeEach(() => {
  mockFake.stored.clear();
  mockFake.web.clear();
  for (const t of TUTORIALS) {
    if (t.video.kind === 'cloud') {
      mockFake.web.set(tutorialUrl(PROJECT, t.video.file), `SAMPLE video ${t.id}`);
    }
  }
  jest.mocked(currentConnection).mockResolvedValue('wifi');
});
afterEach(() => resetTutorialsForTests());

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

  it('shows each download’s size, which videos are on the phone, and frees the space', async () => {
    mockFake.stored.set('03-decks.mp4', 'SAMPLE video 03-decks');
    await renderWithProviders(<TutorialsScreen />);
    expect(screen.getByText('1:08 min · 1.9 MB')).toBeOnTheScreen();
    expect(screen.getByText(`1:27 min · ${s.downloaded}`)).toBeOnTheScreen();
    expect(screen.getByText('1:10 min')).toBeOnTheScreen(); // the built-in welcome video
    expect(screen.getByText(s.storageUsed('1 KB'))).toBeOnTheScreen();

    await act(async () => {
      fireEvent.press(screen.getByText(s.removeDownloads));
    });
    expect(mockFake.stored.has('03-decks.mp4')).toBe(false);
    expect(screen.getByText(s.removed)).toBeOnTheScreen();
    expect(screen.getByText('1:27 min · 3.1 MB')).toBeOnTheScreen();
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

  it('downloads a cloud video on Wi-Fi, then plays it', async () => {
    await renderWithProviders(<TutorialPlayerScreen id="03-decks" />);
    await act(async () => {});
    expect(mockFake.stored.get('03-decks.mp4')).toBe('SAMPLE video 03-decks');
    expect(screen.getByTestId('video-view')).toBeOnTheScreen();
  });

  it('waits on mobile data with Data saver on, until the student says go', async () => {
    jest.mocked(currentConnection).mockResolvedValue('cellular');
    await renderWithProviders(<TutorialPlayerScreen id="03-decks" />);
    await act(async () => {});
    expect(screen.getByText(s.askMessage)).toBeOnTheScreen();
    expect(screen.queryByTestId('video-view')).toBeNull();
    expect(mockFake.stored.size).toBe(0);

    await act(async () => {
      fireEvent.press(screen.getByText(s.downloadAnyway('3.1 MB')));
    });
    expect(screen.getByTestId('video-view')).toBeOnTheScreen();
  });

  it('says so when offline, and offers to try again after a failed download', async () => {
    jest.mocked(currentConnection).mockResolvedValue('none');
    await renderWithProviders(<TutorialPlayerScreen id="03-decks" />);
    await act(async () => {});
    expect(screen.getByText(s.offlineMessage('3.1 MB'))).toBeOnTheScreen();

    mockFake.control.failNext = new Error('Network request failed');
    await act(async () => {
      fireEvent.press(screen.getByText(s.tryAgain));
    });
    expect(screen.getByText(s.failedMessage)).toBeOnTheScreen();
    await act(async () => {
      fireEvent.press(screen.getByText(s.tryAgain));
    });
    expect(screen.getByTestId('video-view')).toBeOnTheScreen();
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
