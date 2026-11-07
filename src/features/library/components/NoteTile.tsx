import { Pin } from 'lucide-react-native';
import type { ReactNode } from 'react';
import { Pressable, View, type PressableProps } from 'react-native';

import { Text } from '@/components/ui';
import type { Tag } from '@/db/schema';
import { customSheetName } from '@/features/notes/customSheets';
import { isNoteTemplate } from '@/features/notes/templates';
import { strings } from '@/i18n/strings';
import { courseLayers, courseSwatch, doodleLayer, useTheme } from '@/theme';

import { stickyColour, stickyColours, stickyTilt, type LibraryItem } from '../logic';
import { TagPill } from './TagPill';

const s = strings.library;

/**
 * A note on the notes board (2026-11-07): a tilted sticky note with a strip of tape, the sheet
 * it started from, and a stamp saying how many cards it became. Colour is never alone: the
 * sheet name and the stamp are words.
 */
export function NoteTile({
  index,
  item,
  tags,
  selected,
  pickHint,
  pressProps,
  corner,
}: {
  index: number;
  item: LibraryItem;
  tags: Tag[];
  selected: boolean;
  pickHint?: string;
  pressProps: Pick<PressableProps, 'onPress' | 'onLongPress' | 'accessibilityState'>;
  /** The ⋮ button, or the tick while picking several. */
  corner: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const colour = stickyColour(item.id);
  const swatch = courseSwatch(scheme, colour);
  const tape = stickyColours[(stickyColours.indexOf(colour) + 3) % stickyColours.length];
  const sheet = isNoteTemplate(item.template)
    ? strings.notes.templates.names[item.template]
    : customSheetName(item.template);
  const cards = item.cardCount ?? 0;
  return (
    <View className="px-1.5 pb-5 pt-3">
      <View
        className={
          selected
            ? 'min-h-[150px] flex-1 rounded-[6px] rounded-br-[18px] border-4 border-primary'
            : 'min-h-[150px] flex-1 rounded-[6px] rounded-br-[18px] border-2 border-outline'
        }
        style={[
          { backgroundColor: swatch.fill, transform: [{ rotate: `${stickyTilt(index)}deg` }] },
          doodleLayer(colors, 'ink', 8, scheme),
        ]}
      >
        <View
          pointerEvents="none"
          className="absolute -top-2.5 h-[18px] w-16 self-center border-[1.5px] border-outline"
          style={{ backgroundColor: courseLayers[scheme][tape], opacity: 0.9 }}
        />
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={s.itemLabel('note', item.name)}
          accessibilityHint={pickHint ?? s.noteTileHint(item.pinned, sheet, cards)}
          {...pressProps}
          className="min-h-touch flex-1 gap-1.5 p-3 pt-4 active:opacity-80"
        >
          <View className="flex-row items-center gap-1.5 pr-8">
            {item.pinned ? <Pin color={swatch.ink} size={14} /> : null}
            {sheet ? (
              <Text
                variant="caption"
                numberOfLines={1}
                className="flex-1 uppercase"
                style={{ color: swatch.ink, letterSpacing: 0.6 }}
              >
                {sheet}
              </Text>
            ) : null}
          </View>
          <Text variant="bodyStrong" numberOfLines={2} style={{ color: swatch.ink }}>
            {item.name}
          </Text>
          {item.preview ? (
            <Text variant="caption" numberOfLines={2} style={{ color: swatch.ink, opacity: 0.85 }}>
              {item.preview}
            </Text>
          ) : null}
          <View className="mt-auto flex-row flex-wrap items-center gap-1.5 pt-1">
            <View className="rounded-full border-[1.5px] border-outline bg-surface px-2 py-0.5">
              <Text variant="caption" className="font-body-semibold">
                {cards > 0 ? s.noteCards(cards) : s.noNoteCards}
              </Text>
            </View>
            {tags.map((tag) => (
              <TagPill key={tag.id} tag={tag} />
            ))}
          </View>
        </Pressable>
        {corner}
      </View>
    </View>
  );
}
