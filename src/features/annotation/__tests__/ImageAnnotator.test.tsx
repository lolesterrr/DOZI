import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import type { Media } from '@/db/schema';
import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { ImageAnnotator } from '../components/ImageAnnotator';
import { useAnnotationStart } from '../hooks';
import { emptyAnnotation, type Annotation, type Shape } from '../logic';

const s = strings.annotation;

const mockSave = jest.fn();
jest.mock('../hooks', () => ({
  useAnnotationStart: jest.fn(),
  useSaveAnnotation: () => mockSave,
}));
jest.mock('@/features/media/files', () => ({
  deviceMediaStore: { resolve: (path: string) => `file:///docs/${path}` },
}));

const base: Media = {
  id: 'photo',
  ownerId: 'o',
  localUri: 'media/photo.jpg',
  remotePath: null,
  mime: 'image/jpeg',
  width: 1600,
  height: 1200,
  bytes: 250_000,
  uploadStatus: 'local',
  derivedFrom: null,
  annotationJson: null,
  createdAt: '2026-10-09T10:00:00.000Z',
  updatedAt: '2026-10-09T10:00:00.000Z',
  deletedAt: null,
  dirty: true,
  syncedAt: null,
};

function open(annotation: Annotation = emptyAnnotation(1600, 1200)) {
  jest.mocked(useAnnotationStart).mockReturnValue({ status: 'ready', start: { base, annotation } });
  const onClose = jest.fn();
  const onSaved = jest.fn();
  return { onClose, onSaved };
}

/** The canvas is 400 × 300 on screen, so the 1600 × 1200 photo is shown at a quarter size. */
async function layOut() {
  await fireEvent(screen.getByTestId('annotation-canvas'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
  });
}

async function drag(points: { x: number; y: number }[]) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('annotation-pan'), points);
  });
}

const savedShapes = (): Shape[] => (mockSave.mock.calls.at(-1)?.[1] as Annotation).shapes;

beforeEach(() => jest.clearAllMocks());

describe('ImageAnnotator', () => {
  it('renders nothing while closed', async () => {
    open();
    await renderWithProviders(
      <ImageAnnotator mediaId={null} onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    expect(screen.queryByText(s.title)).toBeNull();
  });

  it('says so when the image is not on this phone', async () => {
    jest.mocked(useAnnotationStart).mockReturnValue({ status: 'missing' });
    const onClose = jest.fn();
    await renderWithProviders(
      <ImageAnnotator mediaId="gone" onClose={onClose} onSaved={jest.fn()} />,
    );
    expect(screen.getByText(s.missing)).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(onClose).toHaveBeenCalled();
  });

  it('draws a box in image pixels and saves it as a new copy', async () => {
    const { onClose, onSaved } = open();
    const saved = { ...base, id: 'drawn', derivedFrom: 'photo' };
    mockSave.mockResolvedValue(saved);
    await renderWithProviders(
      <ImageAnnotator mediaId="photo" onClose={onClose} onSaved={onSaved} />,
    );
    await layOut();

    expect(screen.getByRole('button', { name: s.save })).toBeDisabled();
    await fireEvent.press(screen.getByRole('button', { name: s.tools.box }));
    await fireEvent.press(screen.getByRole('radio', { name: s.colours.blue }));
    await drag([
      { x: 40, y: 40 },
      { x: 120, y: 100 },
      { x: 200, y: 150 },
    ]);
    expect(screen.getAllByTestId('skia-Rect')).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(mockSave).toHaveBeenCalledWith(
      base,
      expect.objectContaining({ width: 1600, height: 1200 }),
    );
    expect(savedShapes()).toEqual([
      { kind: 'box', colour: 'blue', from: { x: 160, y: 160 }, to: { x: 800, y: 600 } },
    ]);
    expect(onSaved).toHaveBeenCalledWith(saved);
    expect(onClose).not.toHaveBeenCalled();
  });

  it('ignores a tap with a drag tool, and undoes and redoes shapes', async () => {
    open();
    await renderWithProviders(
      <ImageAnnotator mediaId="photo" onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await layOut();
    await drag([{ x: 50, y: 50 }]);
    expect(screen.getByRole('button', { name: s.undo })).toBeDisabled();

    await drag([
      { x: 10, y: 10 },
      { x: 100, y: 100 },
    ]);
    expect(screen.getByRole('button', { name: s.undo })).toBeEnabled();
    // The arrow is two paths and an outline: the shaft, a filled head and its edge.
    expect(screen.getAllByTestId('skia-Path')).toHaveLength(3);

    await fireEvent.press(screen.getByRole('button', { name: s.undo }));
    expect(screen.queryAllByTestId('skia-Path')).toHaveLength(0);
    await fireEvent.press(screen.getByRole('button', { name: s.redo }));
    expect(screen.getAllByTestId('skia-Path')).toHaveLength(3);
  });

  it('places a text label where the student taps', async () => {
    open();
    mockSave.mockResolvedValue(base);
    await renderWithProviders(
      <ImageAnnotator mediaId="photo" onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await layOut();
    await fireEvent.press(screen.getByRole('button', { name: s.tools.text }));
    await act(async () => {
      fireGestureHandler(getByGestureTestId('annotation-tap'), [{ x: 100, y: 75 }]);
    });
    await fireEvent.changeText(screen.getByLabelText(s.textLabel), 'SAMPLE label');
    await fireEvent.press(screen.getByRole('button', { name: s.addText }));
    // Drawn twice: the outline, then the letters.
    expect(screen.getAllByTestId('skia-Text')).toHaveLength(2);

    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(savedShapes()).toEqual([
      { kind: 'text', colour: 'red', at: { x: 400, y: 300 }, text: 'SAMPLE label' },
    ]);
  });

  it('asks before throwing away unsaved changes', async () => {
    const { onClose } = open();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithProviders(
      <ImageAnnotator mediaId="photo" onClose={onClose} onSaved={jest.fn()} />,
    );
    await layOut();

    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();

    await drag([
      { x: 10, y: 10 },
      { x: 100, y: 100 },
    ]);
    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(alert).toHaveBeenCalledWith(s.discardTitle, s.discardMessage, expect.any(Array));
    const buttons = alert.mock.calls[0]![2]!;
    buttons.find((b) => b.text === s.discard)?.onPress?.();
    expect(onClose).toHaveBeenCalledTimes(2);
    alert.mockRestore();
  });

  it('brings back earlier strokes and shows when saving failed', async () => {
    const earlier: Shape = {
      kind: 'circle',
      colour: 'green',
      from: { x: 0, y: 0 },
      to: { x: 100, y: 100 },
    };
    open({ ...emptyAnnotation(1600, 1200), shapes: [earlier] });
    mockSave.mockRejectedValue(new Error('disk full'));
    const consoleError = jest.spyOn(console, 'error').mockImplementation(() => {});
    await renderWithProviders(
      <ImageAnnotator mediaId="photo" onClose={jest.fn()} onSaved={jest.fn()} />,
    );
    await layOut();
    expect(screen.getAllByTestId('skia-Oval')).toHaveLength(1);
    // Nothing changed yet, so there is nothing to save.
    expect(screen.getByRole('button', { name: s.save })).toBeDisabled();

    await fireEvent.press(screen.getByRole('button', { name: s.tools.freehand }));
    await drag([
      { x: 10, y: 10 },
      { x: 30, y: 30 },
    ]);
    await fireEvent.press(screen.getByRole('button', { name: s.save }));
    expect(savedShapes()).toHaveLength(2);
    expect(await screen.findByText(s.failed)).toBeOnTheScreen();
    consoleError.mockRestore();
  });
});
