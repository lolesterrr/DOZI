import { CheckCheck, Circle, CircleCheck, Trash2, X } from 'lucide-react-native';
import { View } from 'react-native';

import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { Button } from './Button';
import { IconButton } from './IconButton';
import { Text } from './Text';
import type { Selection } from './useSelection';

const s = strings.selection;

/**
 * The bar shown while rows are long-press selected: how many, Select all, Delete, and ✕ to stop.
 * It sits above the list, so the screen's own toolbar stays where it was.
 */
export function SelectionBar({
  selection,
  onDelete,
}: {
  selection: Selection;
  onDelete: () => void;
}) {
  if (!selection.selecting) return null;
  return (
    <View
      className="flex-row items-center gap-2 border-b-2 border-outline bg-primary-soft px-2 py-2"
      accessibilityRole="toolbar"
    >
      <IconButton icon={X} accessibilityLabel={s.cancel} onPress={selection.clear} />
      <Text
        variant="bodyStrong"
        tone="inherit"
        className="flex-1 text-on-primary-soft"
        accessibilityLiveRegion="polite"
        numberOfLines={1}
      >
        {s.count(selection.count)}
      </Text>
      <IconButton
        icon={CheckCheck}
        accessibilityLabel={s.selectAll}
        accessibilityState={{ checked: selection.everything }}
        onPress={selection.toggleAll}
      />
      <Button
        label={s.deleteButton}
        icon={Trash2}
        variant="danger"
        accessibilityLabel={s.delete}
        onPress={onDelete}
      />
    </View>
  );
}

/**
 * The tick on a row while selecting: a filled check when picked, an empty ring when not. The
 * shape changes too, so it never relies on colour alone.
 */
export function SelectMark({ selected }: { selected: boolean }) {
  const { colors } = useTheme();
  return (
    <View
      className={
        selected
          ? 'h-7 w-7 items-center justify-center rounded-full bg-primary'
          : 'h-7 w-7 items-center justify-center rounded-full bg-surface'
      }
      accessible={false}
      importantForAccessibility="no-hide-descendants"
    >
      {selected ? (
        <CircleCheck color={colors['on-primary']} size={24} />
      ) : (
        <Circle color={colors['fg-muted']} size={24} />
      )}
    </View>
  );
}
