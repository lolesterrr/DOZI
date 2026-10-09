import { Stack } from 'expo-router';
import { fireEvent, renderRouter, screen } from 'expo-router/testing-library';
import type { ReactNode } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import TabsLayout from '../../app/(tabs)/_layout';
import TodayScreen from '../../app/(tabs)/index';
import LearnScreen from '../../app/(tabs)/learn';
import LibraryScreen from '../../app/(tabs)/library';
import MeScreen from '../../app/(tabs)/me';
import PracticeScreen from '../../app/(tabs)/practice';
import FolderScreen from '../../app/folder/[id]';
import SearchScreen from '../../app/search';
import { ToastProvider } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { ThemeProvider } from '@/theme';

const safeAreaMetrics = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 0, left: 0, right: 0, bottom: 0 },
};

function Providers({ children }: { children: ReactNode }) {
  return (
    <SafeAreaProvider initialMetrics={safeAreaMetrics}>
      <ThemeProvider initialPreference="light">
        <ToastProvider>{children}</ToastProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

// The real tab layout and screens. The root layout is swapped for a plain Stack because the
// real one waits for fonts and the splash screen.
const routes = {
  _layout: () => <Stack screenOptions={{ headerShown: false }} />,
  '(tabs)/_layout': TabsLayout,
  '(tabs)/index': TodayScreen,
  '(tabs)/learn': LearnScreen,
  '(tabs)/practice': PracticeScreen,
  '(tabs)/library': LibraryScreen,
  '(tabs)/me': MeScreen,
  search: SearchScreen,
  'folder/[id]': FolderScreen,
};

// The Library reads the database; give it an empty one.
jest.mock('@/features/library/hooks', () => ({
  useFolders: () => [],
  useFolder: () => ({ folder: undefined, loading: false }),
  useTags: () => [],
  useLibraryItems: () => [],
  useLibrarySort: () => ['updated', () => {}],
  useLibraryActions: () => ({}),
}));

// With React Native Testing Library 14 `render` is async, so `renderRouter` hands back a promise
// that also carries `getPathname()`. Await the render, then keep the router helpers.
async function renderApp(initialUrl = '/') {
  const app = renderRouter(routes, { initialUrl, wrapper: Providers });
  await app;
  return { pathname: () => app.getPathname() };
}

describe('navigation shell', () => {
  it('opens on Today with the greeting and the study disclaimer', async () => {
    const app = await renderApp();
    expect(app.pathname()).toBe('/');
    expect(screen.getByText(strings.today.greeting)).toBeOnTheScreen();
    expect(screen.getByText(strings.disclaimer)).toBeOnTheScreen();
  });

  it.each([
    ['learn', '/learn'],
    ['practice', '/practice'],
    ['me', '/me'],
  ] as const)('switches to the %s tab', async (tab, path) => {
    const app = await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(strings.tabs[tab]) }));
    expect(app.pathname()).toBe(path);
    expect(screen.getByText(strings.placeholders[tab].title)).toBeOnTheScreen();
  });

  it('switches to the library tab', async () => {
    const app = await renderApp();
    await fireEvent.press(screen.getByRole('button', { name: new RegExp(strings.tabs.library) }));
    expect(app.pathname()).toBe('/library');
    expect(screen.getByText(strings.library.empty.note.title)).toBeOnTheScreen();
  });

  it('opens a folder screen and copes with a folder that is gone', async () => {
    const app = await renderApp('/folder/missing');
    expect(app.pathname()).toBe('/folder/missing');
    expect(screen.getByText(strings.library.folderMissingTitle)).toBeOnTheScreen();
  });

  it('opens search from the header', async () => {
    const app = await renderApp('/learn');
    await fireEvent.press(screen.getByRole('button', { name: strings.search.open }));
    expect(app.pathname()).toBe('/search');
    expect(screen.getByText(strings.search.placeholderTitle)).toBeOnTheScreen();
  });

  it('opens the create sheet and stubs each action', async () => {
    await renderApp('/library');
    await fireEvent.press(screen.getByRole('button', { name: strings.create.button }));
    for (const label of Object.values(strings.create.actions)) {
      expect(screen.getByText(label)).toBeOnTheScreen();
    }
    await fireEvent.press(screen.getByText(strings.create.actions.note));
    expect(screen.getByText(strings.create.comingSoon)).toBeOnTheScreen();
  });

  it('shows "+ Create" on Today and Library only', async () => {
    await renderApp('/practice');
    expect(screen.queryByRole('button', { name: strings.create.button })).toBeNull();
  });
});
