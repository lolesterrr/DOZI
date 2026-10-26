import { router } from 'expo-router';
import { FileText, FileX } from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Text } from '@/components/ui';
import { useNote } from '@/features/notes/hooks';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

const s = strings.cards;

/**
 * "From note: …" on a card made from a note (task 1.13). Tapping it opens the note. `linked`
 * false shows the same line without the link (a new card whose note is the screen behind it).
 */
export function SourceNoteLink({ noteId, linked = true }: { noteId: string; linked?: boolean }) {
  const { colors } = useTheme();
  const { note, loading } = useNote(noteId);
  if (loading) return null;

  if (!note || note.deletedAt) {
    return (
      <View className="min-h-touch flex-row items-center gap-2">
        <FileX color={colors['fg-muted']} size={18} />
        <Text variant="small" tone="muted" className="flex-1">
          {s.fromDeletedNote}
        </Text>
      </View>
    );
  }

  const label = s.fromNote(note.title.trim() || strings.notes.untitled);
  if (!linked) {
    return (
      <View className="min-h-touch flex-row items-center gap-2">
        <FileText color={colors['fg-muted']} size={18} />
        <Text variant="small" tone="muted" numberOfLines={2} className="flex-1">
          {label}
        </Text>
      </View>
    );
  }
  return (
    <Pressable
      accessibilityRole="link"
      accessibilityLabel={label}
      accessibilityHint={s.fromNoteHint}
      onPress={() => router.push({ pathname: '/note/[id]', params: { id: note.id } })}
      className="min-h-touch flex-row items-center gap-2 self-start active:opacity-70"
    >
      <FileText color={colors.primary} size={18} />
      <Text variant="label" tone="primary" numberOfLines={2} className="shrink underline">
        {label}
      </Text>
    </Pressable>
  );
}
