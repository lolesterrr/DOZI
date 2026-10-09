import { fireEvent, screen } from '@testing-library/react-native';

import UiGalleryScreen from '../../app/dev/ui';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

const s = strings.devGallery;

describe('UI gallery (/dev/ui)', () => {
  it.each(['light', 'dark'] as const)('renders every primitive in %s mode', async (theme) => {
    await renderWithProviders(<UiGalleryScreen />, { theme });
    for (const title of Object.values(s.sections)) {
      expect(screen.getByText(title)).toBeOnTheScreen();
    }
    expect(screen.getByRole('button', { name: s.buttons.primary })).toBeOnTheScreen();
    expect(screen.getByText(s.empty.title)).toBeOnTheScreen();
  });

  it('switches theme from the chips', async () => {
    await renderWithProviders(<UiGalleryScreen />);
    const dark = screen.getByRole('button', { name: s.themeDark });
    expect(dark).not.toBeSelected();
    await fireEvent.press(dark);
    expect(screen.getByRole('button', { name: s.themeDark })).toBeSelected();
  });
});
