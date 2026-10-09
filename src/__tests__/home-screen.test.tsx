import { render, screen } from '@testing-library/react-native';
import { DefaultTheme, ThemeProvider } from 'expo-router';

import HomeScreen from '../../app/index';
import { strings } from '@/i18n/strings';

// Sample test from task 0.2: proves Jest, React Native Testing Library and the `@/` alias work.
describe('HomeScreen', () => {
  it('shows the greeting and the study disclaimer', async () => {
    await render(
      <ThemeProvider value={DefaultTheme}>
        <HomeScreen />
      </ThemeProvider>,
    );
    expect(screen.getByText(strings.home.greeting)).toBeOnTheScreen();
    expect(screen.getByText(strings.disclaimer)).toBeOnTheScreen();
  });
});
