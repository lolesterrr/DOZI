import {
  BookOpen,
  Bug,
  CodeXml,
  Columns3,
  File,
  GraduationCap,
  LayoutTemplate,
  Lightbulb,
  PencilRuler,
  Pill,
  Presentation,
  Scale,
  Stethoscope,
  Trash2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Blob, IconButton, Text, useToast, type DoodleTint } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import type { CustomSheet, NoteStart } from '../customSheets';
import { useCustomSheets } from '../hooks';
import { pharmacyTemplates, sheetTemplates, type NoteTemplate } from '../templates';
import { SheetBuilder } from './SheetBuilder';

/** Each template gets its own sticker colour so the list is easy to scan. */
const templateTints: DoodleTint[] = ['teal', 'coral', 'violet', 'amber', 'green', 'blue'];

const s = strings.notes.templates;
const c = strings.notes.customSheet;
const log = createLogger('notes');

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

const builtIn: Record<'sheets' | 'pharmacy', readonly (NoteTemplate | 'blank')[]> = {
  sheets: ['blank', ...sheetTemplates],
  pharmacy: pharmacyTemplates,
};

/**
 * The choice shown when making a new note: blank, a sheet for any subject, the student's own
 * sheets (or building a new one), or a pharmacy template. Scrolls inside the sheet, because the
 * list is taller than a small phone.
 */
export function TemplatePicker({ onPick }: { onPick: (start: NoteStart) => void }) {
  const [building, setBuilding] = useState(false);
  if (building) return <SheetBuilder onBack={() => setBuilding(false)} onSaved={onPick} />;
  return <TemplateList onPick={onPick} onBuild={() => setBuilding(true)} />;
}

function TemplateList({
  onPick,
  onBuild,
}: {
  onPick: (start: NoteStart) => void;
  onBuild: () => void;
}) {
  const { height } = useWindowDimensions();
  const toast = useToast();
  const custom = useCustomSheets();
  let index = 0;
  const tint = () => {
    const position = index++;
    return { tint: templateTints[position % templateTints.length], index: position };
  };

  const builtInRow = (key: NoteTemplate | 'blank') => (
    <Row
      key={key}
      icon={icons[key]}
      {...tint()}
      title={s.names[key]}
      description={s.descriptions[key]}
      onPress={() => onPick(key === 'blank' ? null : key)}
    />
  );

  const remove = (sheet: CustomSheet) =>
    custom
      .remove(sheet.id)
      .then(() => toast.show({ message: c.deleted(sheet.name) }))
      .catch((error: unknown) => {
        log.warn('Could not delete a sheet', { error: String(error) });
        toast.show({ message: strings.library.failed, tone: 'error' });
      });

  return (
    <ScrollView style={{ maxHeight: height * 0.62 }} contentContainerClassName="pb-2">
      <GroupTitle title={s.groups.sheets} />
      {builtIn.sheets.map(builtInRow)}

      <GroupTitle title={s.groups.mine} />
      {custom.sheets.map((sheet) => (
        <Row
          key={sheet.id}
          icon={LayoutTemplate}
          {...tint()}
          title={sheet.name}
          description={sheet.boxes.map((box) => box.title || c.boxKinds[box.kind]).join(' · ')}
          onPress={() => onPick(sheet)}
          trailing={
            <IconButton
              icon={Trash2}
              size={20}
              accessibilityLabel={c.deleteLabel(sheet.name)}
              onPress={() => void remove(sheet)}
            />
          }
        />
      ))}
      <Row
        icon={PencilRuler}
        {...tint()}
        title={c.build}
        description={c.buildHint}
        onPress={onBuild}
      />

      <GroupTitle title={s.groups.pharmacy} />
      {builtIn.pharmacy.map(builtInRow)}
    </ScrollView>
  );
}

function GroupTitle({ title }: { title: string }) {
  return (
    <Text variant="caption" tone="muted" className="px-2 pb-1 pt-3 uppercase">
      {title}
    </Text>
  );
}

function Row({
  icon,
  tint,
  index,
  title,
  description,
  onPress,
  trailing,
}: {
  icon: LucideIcon;
  tint: DoodleTint;
  index: number;
  title: string;
  description: string;
  onPress: () => void;
  trailing?: ReactNode;
}) {
  return (
    <View className="flex-row items-center">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        onPress={onPress}
        className="min-h-touch flex-1 flex-row items-center gap-4 rounded-md px-2 py-3 active:bg-surface-muted"
      >
        <Blob icon={icon} tint={tint} index={index} size={44} />
        <View className="flex-1">
          <Text variant="bodyStrong">{title}</Text>
          <Text variant="small" tone="muted" numberOfLines={2}>
            {description}
          </Text>
        </View>
      </Pressable>
      {trailing}
    </View>
  );
}
