import { screen } from '@testing-library/react-native';

import HomeScreen from '../../app/index';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

// Sample test from task 0.2: proves Jest, React Native Testing Library and the `@/` alias work.
describe('HomeScreen', () => {
  it('shows the greeting and the study disclaimer', async () => {
    await renderWithProviders(<HomeScreen />);
    expect(screen.getByText(strings.home.greeting)).toBeOnTheScreen();
    expect(screen.getByText(strings.disclaimer)).toBeOnTheScreen();
  });
});
