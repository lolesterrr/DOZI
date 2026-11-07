import { File, PencilRuler, Trash2 } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, useWindowDimensions, View } from 'react-native';

import { Button, Chip, IconButton, Text, useToast } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { courseSwatch, doodleLayer, useTheme, type CourseColour } from '@/theme';

import type { CustomBoxKind, CustomSheet, NoteStart } from '../customSheets';
import { useCustomSheets } from '../hooks';
import { pharmacyTemplates, sheetTemplates, type NoteTemplate } from '../templates';
import { SheetBuilder } from './SheetBuilder';

const s = strings.notes.templates;
const c = strings.notes.customSheet;
const log = createLogger('notes');

type Tab = 'sheets' | 'mine' | 'pharmacy';
const tabs: Tab[] = ['sheets', 'mine', 'pharmacy'];

/** A thumbnail is a few blocks: a full-width one (1) or two half-width ones (2). */
type Thumb = readonly (1 | 2)[];

const thumbs: Record<NoteTemplate, Thumb> = {
  concept: [1, 2, 1],
  classDay: [2, 1, 2],
  examRevision: [1, 2, 1],
  algorithm: [2, 1, 2],
  bugDiary: [1, 1, 2],
  compare: [2, 2, 1],
  lecture: [1, 1, 2],
  drugProfile: [2, 2, 1],
  classComparison: [1, 2, 2],
  caseSummary: [2, 1, 1],
};

const tints: CourseColour[] = ['green', 'violet', 'amber', 'teal', 'rose', 'blue', 'coral'];

/** A sheet's thumbnail from its boxes: tables and notes are wide, the rest sit side by side. */
function customThumb(kinds: readonly CustomBoxKind[]): Thumb {
  const wide = new Set<CustomBoxKind>(['notes', 'table', 'list']);
  const rows: (1 | 2)[] = [];
  let half = false;
  for (const kind of kinds.slice(0, 6)) {
    if (wide.has(kind)) {
      if (half) rows.push(2);
      half = false;
      rows.push(1);
    } else if (half) {
      rows.push(2);
      half = false;
    } else half = true;
  }
  if (half) rows.push(2);
  return rows.slice(0, 3);
}

/**
 * The choice shown when making a new note (mockup E3): tabs for sheets for any subject, the
 * student's own sheets and pharmacy templates; each sheet is a card with a little picture of its
 * layout. "Build your own" opens the sheet builder; "Blank page" sits at the bottom.
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
  const [tab, setTab] = useState<Tab>('sheets');

  const remove = (sheet: CustomSheet) =>
    custom
      .remove(sheet.id)
      .then(() => toast.show({ message: c.deleted(sheet.name) }))
      .catch((error: unknown) => {
        log.warn('Could not delete a sheet', { error: String(error) });
        toast.show({ message: strings.library.failed, tone: 'error' });
      });

  const builtIn = (keys: readonly NoteTemplate[]) =>
    keys.map((key, i) => (
      <SheetCard
        key={key}
        title={s.names[key]}
        description={s.descriptions[key]}
        thumb={thumbs[key]}
        tint={tints[i % tints.length]}
        onPress={() => onPick(key)}
      />
    ));

  return (
    <View className="gap-3 pb-2">
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerClassName="gap-2"
      >
        {tabs.map((key) => (
          <Chip
            key={key}
            label={s.groups[key]}
            selected={tab === key}
            onPress={() => setTab(key)}
          />
        ))}
      </ScrollView>

      <ScrollView style={{ maxHeight: height * 0.55 }} contentContainerClassName="pb-1">
        <View className="flex-row flex-wrap" style={{ marginHorizontal: -6 }}>
          {tab === 'sheets' ? builtIn(sheetTemplates) : null}
          {tab === 'pharmacy' ? builtIn(pharmacyTemplates) : null}
          {tab === 'mine' ? (
            <>
              <BuildCard onPress={onBuild} />
              {custom.sheets.map((sheet, i) => (
                <SheetCard
                  key={sheet.id}
                  title={sheet.name}
                  description={c.mineHint(sheet.boxes.length)}
                  thumb={customThumb(sheet.boxes.map((box) => box.kind))}
                  tint={tints[(i + 3) % tints.length]}
                  onPress={() => onPick(sheet)}
                  corner={
                    <IconButton
                      icon={Trash2}
                      size={18}
                      accessibilityLabel={c.deleteLabel(sheet.name)}
                      onPress={() => void remove(sheet)}
                    />
                  }
                />
              ))}
            </>
          ) : null}
        </View>
        {tab === 'sheets' ? (
          <View className="mx-0 mt-1">
            <BuildCard onPress={onBuild} wide />
          </View>
        ) : null}
      </ScrollView>

      <Button
        label={s.names.blank}
        variant="outline"
        icon={File}
        accessibilityLabel={`${s.names.blank}. ${s.descriptions.blank}`}
        onPress={() => onPick(null)}
      />
    </View>
  );
}

function SheetCard({
  title,
  description,
  thumb,
  tint,
  onPress,
  corner,
}: {
  title: string;
  description: string;
  thumb: Thumb;
  tint: CourseColour;
  onPress: () => void;
  corner?: ReactNode;
}) {
  const { colors, scheme } = useTheme();
  const swatch = courseSwatch(scheme, tint);
  return (
    <View className="w-1/2 p-1.5">
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${title}. ${description}`}
        onPress={onPress}
        className="flex-1 gap-1.5 rounded-2xl border-2 border-outline bg-surface p-2 active:opacity-80"
        style={doodleLayer(colors, 'ink', 8, scheme)}
      >
        <View
          className="h-[72px] gap-1 rounded-lg p-1.5"
          style={{ backgroundColor: swatch.fill }}
          importantForAccessibility="no-hide-descendants"
          accessibilityElementsHidden
        >
          {thumb.map((row, i) => (
            <View key={i} className="flex-1 flex-row gap-1">
              {Array.from({ length: row }, (_, j) => (
                <View
                  key={j}
                  className="flex-1 rounded-[3px] bg-surface"
                  style={{ opacity: 0.85 }}
                />
              ))}
            </View>
          ))}
        </View>
        <Text variant="small" className="font-body-semibold" numberOfLines={2}>
          {title}
        </Text>
        <Text variant="caption" tone="muted" numberOfLines={2}>
          {description}
        </Text>
      </Pressable>
      {corner ? <View className="absolute right-1 top-1">{corner}</View> : null}
    </View>
  );
}

function BuildCard({ onPress, wide = false }: { onPress: () => void; wide?: boolean }) {
  const { colors, scheme } = useTheme();
  const amber = courseSwatch(scheme, 'amber');
  return (
    <View className={wide ? 'w-full p-1.5' : 'w-1/2 p-1.5'}>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${c.build}. ${c.buildHint}`}
        onPress={onPress}
        className={
          wide
            ? 'min-h-touch flex-row items-center gap-3 rounded-2xl border-2 border-dashed border-outline p-3 active:opacity-80'
            : 'flex-1 items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-outline p-3 active:opacity-80'
        }
        style={[{ backgroundColor: amber.fill }, doodleLayer(colors, 'amber', 8, scheme)]}
      >
        <View className="h-10 w-10 items-center justify-center rounded-full border-2 border-outline bg-surface">
          <PencilRuler size={20} color={colors.fg} />
        </View>
        <View className={wide ? 'flex-1' : 'items-center'}>
          <Text
            variant="small"
            className={wide ? 'font-body-semibold' : 'text-center font-body-semibold'}
            style={{ color: amber.ink }}
          >
            {c.build}
          </Text>
          <Text
            variant="caption"
            className={wide ? undefined : 'text-center'}
            style={{ color: amber.ink }}
          >
            {c.buildHint}
          </Text>
        </View>
      </Pressable>
    </View>
  );
}
