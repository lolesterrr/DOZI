import { screen } from '@testing-library/react-native';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { AlphaExpiredScreen } from '../components/AlphaExpiredScreen';

describe('AlphaExpiredScreen', () => {
  it('tells the tester the alpha has ended and to delete the app', async () => {
    await renderWithProviders(<AlphaExpiredScreen />);
    expect(screen.getByText(strings.alphaExpiry.expiredTitle)).toBeTruthy();
    expect(screen.getByText(strings.alphaExpiry.expiredMessage)).toBeTruthy();
    // There is nothing to press: the rest of the app can't be reached.
    expect(screen.queryAllByRole('button')).toHaveLength(0);
  });
});
