import { fireEvent, screen } from '@testing-library/react-native';

import { MediaImage } from '../components/MediaImage';
import { useMediaUri } from '../hooks';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('../hooks', () => ({ useMediaUri: jest.fn() }));
const mockUseMediaUri = jest.mocked(useMediaUri);

describe('<MediaImage>', () => {
  it('shows the image when the file is on the phone', async () => {
    mockUseMediaUri.mockReturnValue({ uri: 'file:///docs/media/a.jpg', loading: false });
    await renderWithProviders(<MediaImage id="a" accessibilityLabel="Beta blocker slide" />);
    expect(screen.getByLabelText('Beta blocker slide')).toBeTruthy();
  });

  it('shows a calm placeholder when the file is missing', async () => {
    mockUseMediaUri.mockReturnValue({ uri: null, loading: false });
    await renderWithProviders(<MediaImage id="a" />);
    expect(screen.getByText(strings.media.missing)).toBeTruthy();
  });

  it('is a button when it can be opened', async () => {
    mockUseMediaUri.mockReturnValue({ uri: 'file:///docs/media/a.jpg', loading: false });
    const onPress = jest.fn();
    await renderWithProviders(<MediaImage id="a" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('imagebutton'));
    expect(onPress).toHaveBeenCalled();
  });
});
