import {
  Columns3,
  File,
  Pill,
  Presentation,
  Stethoscope,
  type LucideIcon,
} from 'lucide-react-native';
import { Pressable, View } from 'react-native';

import { Blob, Text, type DoodleTint } from '@/components/ui';
import { strings } from '@/i18n/strings';

import { noteTemplates, type NoteTemplate } from '../templates';

/** Each template gets its own sticker colour so the list is easy to scan. */
const templateTints: DoodleTint[] = ['teal', 'coral', 'violet', 'amber', 'green', 'blue'];

const s = strings.notes.templates;

const options: { key: NoteTemplate | 'blank'; icon: LucideIcon }[] = [
  { key: 'blank', icon: File },
  ...noteTemplates.map((key) => ({
    key,
    icon: {
      lecture: Presentation,
      drugProfile: Pill,
      classComparison: Columns3,
      caseSummary: Stethoscope,
    }[key],
  })),
];

/** The choice shown when making a new note: blank, or one of the templates. */
export function TemplatePicker({ onPick }: { onPick: (template: NoteTemplate | null) => void }) {
  return (
    <View className="pb-2">
      {options.map(({ key, icon: Icon }, index) => (
        <Pressable
          key={key}
          accessibilityRole="button"
          accessibilityLabel={`${s.names[key]}. ${s.descriptions[key]}`}
          onPress={() => onPick(key === 'blank' ? null : key)}
          className="min-h-touch flex-row items-center gap-4 rounded-md px-2 py-3 active:bg-surface-muted"
        >
          <Blob
            icon={Icon}
            tint={templateTints[index % templateTints.length]}
            index={index}
            size={44}
          />
          <View className="flex-1">
            <Text variant="bodyStrong">{s.names[key]}</Text>
            <Text variant="small" tone="muted">
              {s.descriptions[key]}
            </Text>
          </View>
        </Pressable>
      ))}
    </View>
  );
}
