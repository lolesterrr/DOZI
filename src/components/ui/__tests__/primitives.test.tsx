import { act, fireEvent, screen } from '@testing-library/react-native';
import { Play } from 'lucide-react-native';
import { Pressable, Text as RNText } from 'react-native';

import { renderWithProviders } from '@/test-utils/render';

import {
  BottomSheet,
  Button,
  Chip,
  EmptyState,
  IconButton,
  Input,
  ProgressBar,
  ProgressRing,
  useToast,
} from '..';

describe('Button', () => {
  it('calls onPress', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Start" icon={Play} onPress={onPress} />);
    await fireEvent.press(screen.getByRole('button', { name: 'Start' }));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and busy while loading', async () => {
    const onPress = jest.fn();
    await renderWithProviders(<Button label="Save" loading onPress={onPress} />);
    const button = screen.getByRole('button', { name: 'Save' });
    expect(button).toBeDisabled();
    expect(button).toBeBusy();
    await fireEvent.press(button);
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('IconButton', () => {
  it('is reachable by its accessibility label', async () => {
    const onPress = jest.fn();
    await renderWithProviders(
      <IconButton icon={Play} accessibilityLabel="Play" onPress={onPress} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Play' }));
    expect(onPress).toHaveBeenCalled();
  });
});

describe('Chip', () => {
  it('reports its selected state', async () => {
    await renderWithProviders(<Chip label="Notes" selected />);
    expect(screen.getByRole('button', { name: 'Notes' })).toBeSelected();
  });
});

describe('Input', () => {
  it('shows the error text instead of the hint', async () => {
    await renderWithProviders(<Input label="Email" hint="We never share it" error="Invalid" />);
    expect(screen.getByText('Invalid')).toBeOnTheScreen();
    expect(screen.queryByText('We never share it')).toBeNull();
  });

  it('passes typed text to onChangeText', async () => {
    const onChangeText = jest.fn();
    await renderWithProviders(<Input label="Deck name" onChangeText={onChangeText} />);
    await fireEvent.changeText(screen.getByLabelText('Deck name'), 'Antibiotics');
    expect(onChangeText).toHaveBeenCalledWith('Antibiotics');
  });
});

describe('progress', () => {
  it('ProgressBar exposes a clamped percentage', async () => {
    await renderWithProviders(<ProgressBar value={1.5} accessibilityLabel="Goal" />);
    expect(screen.getByRole('progressbar', { name: 'Goal' })).toHaveAccessibilityValue({
      now: 100,
    });
  });

  it('ProgressRing exposes its percentage', async () => {
    await renderWithProviders(<ProgressRing value={0.65} accessibilityLabel="Mastery" />);
    expect(screen.getByRole('progressbar', { name: 'Mastery' })).toHaveAccessibilityValue({
      now: 65,
    });
  });
});

describe('EmptyState', () => {
  it('shows its action button', async () => {
    const onAction = jest.fn();
    await renderWithProviders(
      <EmptyState title="No notes yet" actionLabel="Write a note" onAction={onAction} />,
    );
    await fireEvent.press(screen.getByRole('button', { name: 'Write a note' }));
    expect(onAction).toHaveBeenCalled();
  });
});

describe('BottomSheet', () => {
  it('renders its content when visible and closes from the X button', async () => {
    const onClose = jest.fn();
    await renderWithProviders(
      <BottomSheet visible title="Create" onClose={onClose}>
        <RNText>Sheet body</RNText>
      </BottomSheet>,
    );
    expect(screen.getByText('Sheet body')).toBeOnTheScreen();
    await fireEvent.press(screen.getAllByRole('button', { name: 'Close' })[1]);
    expect(onClose).toHaveBeenCalled();
  });
});

describe('Toast', () => {
  function ShowToast({ onUndo }: { onUndo: () => void }) {
    const toast = useToast();
    return (
      <Pressable
        accessibilityRole="button"
        onPress={() =>
          toast.show({ message: 'Moved to Bin', actionLabel: 'Undo', onAction: onUndo })
        }
      >
        <RNText>Delete</RNText>
      </Pressable>
    );
  }

  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  it('shows a message with an action, then hides itself', async () => {
    const onUndo = jest.fn();
    await renderWithProviders(<ShowToast onUndo={onUndo} />);
    await fireEvent.press(screen.getByText('Delete'));
    expect(screen.getByText('Moved to Bin')).toBeOnTheScreen();

    await fireEvent.press(screen.getByRole('button', { name: 'Undo' }));
    expect(onUndo).toHaveBeenCalled();
    expect(screen.queryByText('Moved to Bin')).toBeNull();

    await fireEvent.press(screen.getByText('Delete'));
    await act(async () => {
      jest.advanceTimersByTime(4000);
    });
    expect(screen.queryByText('Moved to Bin')).toBeNull();
  });
});
