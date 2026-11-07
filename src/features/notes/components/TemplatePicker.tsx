import {
  BookOpen,
  Bug,
  CodeXml,
  Columns3,
  File,
  GraduationCap,
  Lightbulb,
  Pill,
  Presentation,
  Scale,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Blob, Text, type DoodleTint } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { pharmacyTemplates, sheetTemplates, type NoteTemplate } from '../templates';

/** Each template gets its own sticker colour so the list is easy to scan. */
const templateTints: DoodleTint[] = ['teal', 'coral', 'violet', 'amber', 'green', 'blue'];

const s = strings.notes.templates;

const icons: Record<NoteTemplate | 'blank', LucideIcon> = {
  blank: File,
  concept: Lightbulb,
  classDay: BookOpen,
  examRevision: GraduationCap,
  algorithm: CodeXml,
  bugDiary: Bug,
  compare: Scale,
  lecture: Presentation,
  drugProfile: Pill,
  classComparison: Columns3,
  caseSummary: Stethoscope,
};

const groups: { title: string | null; keys: readonly (NoteTemplate | 'blank')[] }[] = [
  { title: s.groups.sheets, keys: ['blank', ...sheetTemplates] },
  { title: s.groups.pharmacy, keys: pharmacyTemplates },
];

/**
 * The choice shown when making a new note: blank, a sheet for any subject, or a pharmacy
 * template. Scrolls inside the sheet, because the list is taller than a small phone.
 */
export function TemplatePicker({ onPick }: { onPick: (template: NoteTemplate | null) => void }) {
  const { height } = useWindowDimensions();
  let index = 0;
  return (
    <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerClassName="pb-2">
      {groups.map((group) => (
        <View key={group.title ?? 'all'}>
          {group.title ? (
            <Text variant="caption" tone="muted" className="px-2 pb-1 pt-3 uppercase">
              {group.title}
            </Text>
          ) : null}
          {group.keys.map((key) => {
            const Icon = icons[key];
            const position = index++;
            return (
              <Pressable
                key={key}
                accessibilityRole="button"
                accessibilityLabel={`${s.names[key]}. ${s.descriptions[key]}`}
                onPress={() => onPick(key === 'blank' ? null : key)}
                className="min-h-touch flex-row items-center gap-4 rounded-md px-2 py-3 active:bg-surface-muted"
              >
                <Blob
                  icon={Icon}
                  tint={templateTints[position % templateTints.length]}
                  index={position}
                  size={44}
                />
                <View className="flex-1">
                  <Text variant="bodyStrong">{s.names[key]}</Text>
                  <Text variant="small" tone="muted">
                    {s.descriptions[key]}
                  </Text>
                </View>
              </Pressable>
            );
          })}
        </View>
      ))}
    </ScrollView>
  );
}
