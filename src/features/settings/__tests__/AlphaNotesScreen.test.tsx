import { screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { AlphaNotesScreen } from '../components/AlphaNotesScreen';

describe('Alpha notes', () => {
  it('lists every known issue, including that data stays on the phone', async () => {
    await renderWithProviders(<AlphaNotesScreen />);
    for (const item of strings.alpha.items) {
      expect(screen.getByText(item.title)).toBeOnTheScreen();
    }
    expect(screen.getByText(strings.alpha.items[0].title)).toBeOnTheScreen();
    expect(strings.alpha.items[0].text).toMatch(/uninstall/i);
  });
});
