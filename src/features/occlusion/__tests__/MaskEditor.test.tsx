import { act, fireEvent, screen } from '@testing-library/react-native';
import { Alert } from 'react-native';
import { fireGestureHandler, getByGestureTestId } from 'react-native-gesture-handler/jest-utils';

import { strings } from '@/i18n/strings';
import { renderWithProviders } from '@/test-utils/render';

import { MaskEditor } from '../components/MaskEditor';
import { maskId, type Mask, type OcclusionDraft } from '../logic';

// SAMPLE labels for tests only — no drug facts.
const s = strings.occlusion;

jest.mock('@/features/media/hooks', () => ({
  useMediaUri: () => ({ uri: 'file:///docs/media/diagram.jpg', loading: false }),
}));

const diagram = (masks: Mask[] = []): OcclusionDraft => ({
  mediaId: 'diagram',
  width: 800,
  height: 600,
  mode: 'hide_one',
  masks,
  nextMask: masks.length + 1,
});

/** The canvas is 400 × 300, so the 800 × 600 diagram fills it at half size. */
async function layOut() {
  await fireEvent(screen.getByTestId('occlusion-canvas'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width: 400, height: 300 } },
  });
}

async function drag(points: { x: number; y: number }[]) {
  await act(async () => {
    fireGestureHandler(getByGestureTestId('occlusion-pan'), points);
  });
}

describe('MaskEditor', () => {
  it('renders nothing while closed', async () => {
    await renderWithProviders(<MaskEditor draft={null} onClose={jest.fn()} onDone={jest.fn()} />);
    expect(screen.queryByText(s.editorTitle)).toBeNull();
  });

  it('draws two boxes, labels one, deletes the other and hands back the boxes', async () => {
    const onDone = jest.fn();
    await renderWithProviders(<MaskEditor draft={diagram()} onClose={jest.fn()} onDone={onDone} />);
    await layOut();
    expect(screen.getByText(s.count(0, 40))).toBeOnTheScreen();

    await drag([
      { x: 40, y: 30 },
      { x: 120, y: 60 },
    ]);
    // The new box is selected, ready for a label.
    expect(screen.getByText(s.selected(1))).toBeOnTheScreen();
    await fireEvent.changeText(screen.getByLabelText(s.labelLabel), 'SAMPLE label');
    await fireEvent.press(screen.getByRole('button', { name: s.deselect }));

    await drag([
      { x: 200, y: 150 },
      { x: 300, y: 240 },
    ]);
    expect(screen.getAllByTestId(/^occlusion-mask/)).toHaveLength(2);
    await fireEvent.press(screen.getByRole('button', { name: s.deleteBox }));
    expect(screen.getAllByTestId(/^occlusion-mask/)).toHaveLength(1);

    await fireEvent.press(screen.getByRole('button', { name: s.done }));
    expect(onDone).toHaveBeenCalledWith(
      [
        {
          id: 'm001',
          label: 'SAMPLE label',
          x: 0.1,
          y: 0.1,
          w: expect.closeTo(0.2),
          h: expect.closeTo(0.1),
        },
      ],
      3,
    );
  });

  it('moves a box by dragging it and selects boxes from the list', async () => {
    const onDone = jest.fn();
    const box: Mask = { id: maskId(1), x: 0.1, y: 0.1, w: 0.2, h: 0.2, label: '' };
    await renderWithProviders(
      <MaskEditor draft={diagram([box])} onClose={jest.fn()} onDone={onDone} />,
    );
    await layOut();
    // Box 1 covers 40–120 across and 30–90 down on screen; drag it 40 right and 30 down.
    await drag([
      { x: 60, y: 50 },
      { x: 100, y: 80 },
    ]);
    expect(screen.getByTestId('occlusion-mask-selected')).toBeOnTheScreen();
    await fireEvent.press(screen.getByRole('radio', { name: s.selectBox(1, '') }));
    expect(screen.queryByTestId('occlusion-mask-selected')).toBeNull();

    await fireEvent.press(screen.getByRole('button', { name: s.done }));
    expect(onDone.mock.calls[0][0][0]).toMatchObject({
      x: expect.closeTo(0.2),
      y: expect.closeTo(0.2),
    });
  });

  it('asks before throwing away changed boxes', async () => {
    const onClose = jest.fn();
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    await renderWithProviders(
      <MaskEditor draft={diagram()} onClose={onClose} onDone={jest.fn()} />,
    );
    await layOut();
    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(alert).not.toHaveBeenCalled();

    await drag([
      { x: 40, y: 30 },
      { x: 120, y: 60 },
    ]);
    await fireEvent.press(screen.getByRole('button', { name: s.close }));
    expect(alert).toHaveBeenCalledWith(s.discardTitle, s.discardMessage, expect.any(Array));
    alert.mockRestore();
  });
});
