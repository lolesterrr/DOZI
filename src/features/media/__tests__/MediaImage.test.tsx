import { fireEvent, screen } from '@testing-library/react-native';

import { MediaImage } from '../components/MediaImage';
import { useMediaSource } from '../hooks';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

jest.mock('../hooks', () => ({ useMediaSource: jest.fn() }));
const mockUseMediaSource = jest.mocked(useMediaSource);

describe('<MediaImage>', () => {
  it('shows the image when the file is on the phone', async () => {
    mockUseMediaSource.mockReturnValue({ kind: 'local', uri: 'file:///docs/media/a.jpg' });
    await renderWithProviders(<MediaImage id="a" accessibilityLabel="SAMPLE slide" />);
    expect(screen.getByLabelText('SAMPLE slide')).toBeTruthy();
  });

  it('shows a calm placeholder when the file is missing', async () => {
    mockUseMediaSource.mockReturnValue({ kind: 'missing' });
    await renderWithProviders(<MediaImage id="a" />);
    expect(screen.getByText(strings.media.missing)).toBeTruthy();
  });

  it('is a button when it can be opened', async () => {
    mockUseMediaSource.mockReturnValue({ kind: 'local', uri: 'file:///docs/media/a.jpg' });
    const onPress = jest.fn();
    await renderWithProviders(<MediaImage id="a" onPress={onPress} />);
    await fireEvent.press(screen.getByRole('imagebutton'));
    expect(onPress).toHaveBeenCalled();
  });

  it('says when a backed-up picture is downloading', async () => {
    mockUseMediaSource.mockReturnValue({
      kind: 'cloud',
      bytes: 300_000,
      state: 'downloading',
      download: jest.fn(),
    });
    await renderWithProviders(<MediaImage id="a" />);
    expect(screen.getByLabelText(strings.media.downloading)).toBeTruthy();
  });

  it('offers a tap to download, with the size, instead of opening the viewer', async () => {
    const download = jest.fn();
    const onPress = jest.fn();
    mockUseMediaSource.mockReturnValue({
      kind: 'cloud',
      bytes: 312 * 1024,
      state: 'waiting',
      download,
    });
    await renderWithProviders(<MediaImage id="a" onPress={onPress} />);
    await fireEvent.press(
      screen.getByRole('button', { name: strings.media.tapToDownload('312 KB') }),
    );
    expect(download).toHaveBeenCalled();
    expect(onPress).not.toHaveBeenCalled();
  });

  it('offers to try again after a failed download', async () => {
    const download = jest.fn();
    mockUseMediaSource.mockReturnValue({ kind: 'cloud', bytes: 1000, state: 'failed', download });
    await renderWithProviders(<MediaImage id="a" />);
    await fireEvent.press(screen.getByRole('button', { name: strings.media.downloadFailed }));
    expect(download).toHaveBeenCalled();
  });
});
