import { router, useLocalSearchParams } from 'expo-router';
import { Bell, Check, Clock, Plus, Trash2, X } from 'lucide-react-native';
import { useState, type ReactNode } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Chip, cn, EmptyState, IconButton, Input, Text, useToast } from '@/components/ui';
import { useNotificationPermission } from '@/features/notifications';
import { useAppSettings } from '@/features/settings/hooks';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { courseColourNames, courseSwatch, useTheme } from '@/theme';

import { useActiveTimetable, useTimetableActions, useTimetableClass } from '../hooks';
import {
  classDraftProblem,
  classKinds,
  classToDraft,
  emptyDraft,
  MAX_REMINDERS_PER_CLASS,
  reminderKey,
  reminderPresets,
  reminderSlot,
  sameReminder,
  sortReminders,
  weekdays,
  withStartTime,
  type ClassDraft,
  type Reminder,
  type Weekday,
} from '../logic';
import { ClassCard } from './ClassCard';
import { TimePickerSheet } from './TimePickerSheet';

const s = strings.timetable;
const log = createLogger('timetable');

type Picker = null | 'start' | 'end' | 'reminder';

/** Route: /timetable/class/[id]. `new` (with ?weekday=) adds a class; otherwise edits one. */
export function ClassEditorScreen() {
  const params = useLocalSearchParams<{ id: string; weekday?: string }>();
  const id = params.id ?? 'new';
  const isNew = id === 'new';
  const { cls, loading } = useTimetableClass(isNew ? '' : id);
  const { classes } = useActiveTimetable();
  const firstDay = Math.min(7, Math.max(1, Number(params.weekday) || 1)) as Weekday;

  if (isNew) {
    return (
      <Editor
        id={null}
        initial={emptyDraft(
          firstDay,
          classes.map((c) => c.colour),
        )}
      />
    );
  }
  if (loading) return <View className="flex-1 bg-background" />;
  if (!cls || cls.deletedAt) return <Gone />;
  return <Editor id={id} initial={classToDraft(cls)} />;
}

function Gone() {
  const insets = useSafeAreaInsets();
  return (
    <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
      <EmptyState title={s.gone} actionLabel={s.back} onAction={() => router.back()} />
    </View>
  );
}

/** The form. It keeps its own copy of the class from `initial`, saved only on "Save". */
function Editor({ id, initial }: { id: string | null; initial: ClassDraft }) {
  const [draft, setDraft] = useState(initial);
  const insets = useSafeAreaInsets();
  const { colors, scheme } = useTheme();
  const toast = useToast();
  const actions = useTimetableActions();
  const permission = useNotificationPermission();
  const { settings } = useAppSettings();
  const [picker, setPicker] = useState<Picker>(null);
  const [customDayOffset, setCustomDayOffset] = useState<0 | -1>(-1);
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);

  const set = (changes: Partial<ClassDraft>) => setDraft({ ...draft, ...changes });
  const problem = classDraftProblem(draft);
  const shownProblem = tried ? problem : draft.endTime <= draft.startTime ? 'times' : null;

  const close = () => (router.canGoBack() ? router.back() : router.replace('/timetable'));

  const save = async () => {
    setTried(true);
    if (problem) return;
    setSaving(true);
    try {
      if (id) {
        await actions.updateClass(id, draft);
        toast.show({ message: s.saved, tone: 'success' });
      } else {
        const rows = await actions.addClasses(draft);
        toast.show({
          message: rows.length > 1 ? s.savedMany(rows.length) : s.saved,
          tone: 'success',
        });
      }
      if (draft.reminders.length > 0 && permission.state === 'undetermined') await permission.ask();
      close();
    } catch (error) {
      log.warn('Could not save a class', { error: String(error) });
      toast.show({ message: s.failed, tone: 'error' });
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!id) return;
    try {
      await actions.deleteClass(id);
      close();
      toast.show({
        message: s.deleted,
        actionLabel: s.undo,
        onAction: () => void actions.restoreClass(id),
      });
    } catch (error) {
      log.warn('Could not delete a class', { error: String(error) });
      toast.show({ message: s.failed, tone: 'error' });
    }
  };

  const toggleDay = (day: Weekday) => {
    if (id) return set({ weekdays: [day] });
    const has = draft.weekdays.includes(day);
    set({ weekdays: has ? draft.weekdays.filter((d) => d !== day) : [...draft.weekdays, day] });
  };

  const addReminder = (r: Reminder) => {
    if (draft.reminders.some((x) => sameReminder(x, r))) return;
    if (draft.reminders.length >= MAX_REMINDERS_PER_CLASS) return;
    set({ reminders: sortReminders([...draft.reminders, r]) });
  };

  const full = draft.reminders.length >= MAX_REMINDERS_PER_CLASS;
  const freePresets = reminderPresets.filter(
    (p) => !draft.reminders.some((r) => sameReminder(r, p)),
  );

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="flex-row items-center gap-2 border-b border-border px-2 py-1">
        <IconButton icon={X} variant="soft" accessibilityLabel={s.cancel} onPress={close} />
        <Text variant="heading" className="flex-1">
          {id ? s.editClass : s.newClass}
        </Text>
        <Button label={s.save} icon={Check} loading={saving} onPress={() => void save()} />
      </View>

      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerClassName="gap-6 px-4 pt-4"
        contentContainerStyle={{ paddingBottom: insets.bottom + 32 }}
      >
        <View className="gap-2">
          <Text variant="label" tone="muted">
            {s.preview}
          </Text>
          <ClassCard cls={{ ...draft, reminderCount: draft.reminders.length }} />
        </View>

        <View className="gap-4">
          <Input
            label={s.courseName}
            placeholder={s.courseNamePlaceholder}
            value={draft.title}
            onChangeText={(title) => set({ title })}
            maxLength={80}
            error={tried && problem === 'title' ? s.problems.title : undefined}
          />
          <Input
            label={s.courseCode}
            placeholder={s.courseCodePlaceholder}
            value={draft.code}
            onChangeText={(code) => set({ code })}
            autoCapitalize="characters"
            maxLength={60}
          />
        </View>

        <Section title={s.kind}>
          <View className="flex-row flex-wrap gap-2">
            {classKinds.map((kind) => (
              <Chip
                key={kind}
                label={s.kinds[kind]}
                selected={draft.kind === kind}
                onPress={() => set({ kind })}
              />
            ))}
          </View>
        </Section>

        <Section title={id ? s.days : s.daysNew}>
          <View className="flex-row flex-wrap gap-2">
            {weekdays.map((day) => (
              <Chip
                key={day}
                label={s.weekdaysShort[day]}
                accessibilityLabel={s.weekdays[day]}
                selected={draft.weekdays.includes(day)}
                onPress={() => toggleDay(day)}
              />
            ))}
          </View>
          {tried && problem === 'days' ? (
            <Text variant="small" tone="danger">
              {s.problems.days}
            </Text>
          ) : null}
        </Section>

        <Section title={s.time}>
          <View className="flex-row gap-3">
            <TimeButton
              label={s.starts}
              value={draft.startTime}
              onPress={() => setPicker('start')}
            />
            <TimeButton label={s.ends} value={draft.endTime} onPress={() => setPicker('end')} />
          </View>
          {shownProblem === 'times' ? (
            <Text variant="small" tone="danger">
              {s.problems.times}
            </Text>
          ) : null}
        </Section>

        <View className="gap-4">
          <Input
            label={s.location}
            placeholder={s.locationPlaceholder}
            value={draft.location}
            onChangeText={(location) => set({ location })}
            maxLength={60}
          />
          <Input
            label={s.lecturer}
            placeholder={s.lecturerPlaceholder}
            value={draft.lecturer}
            onChangeText={(lecturer) => set({ lecturer })}
            maxLength={60}
          />
        </View>

        <Section title={s.colour}>
          <View className="flex-row flex-wrap gap-3">
            {courseColourNames.map((name) => {
              const swatch = courseSwatch(scheme, name);
              const on = draft.colour === name;
              return (
                <Pressable
                  key={name}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={s.colours[name]}
                  onPress={() => set({ colour: name })}
                  className={cn(
                    'h-11 w-11 items-center justify-center rounded-full border-2',
                    on ? 'border-fg' : 'border-transparent',
                  )}
                >
                  <View
                    className="h-8 w-8 items-center justify-center rounded-full"
                    style={{ backgroundColor: swatch.bar }}
                  >
                    {on ? <Check color={swatch.fill} size={18} /> : null}
                  </View>
                </Pressable>
              );
            })}
          </View>
        </Section>

        <Section title={s.reminders} help={s.remindersHelp}>
          {!settings.notifications.lectures ? (
            <Text variant="small" tone="muted">
              {s.remindersOff}
            </Text>
          ) : null}
          {permission.state === 'denied' || permission.state === 'undetermined' ? (
            draft.reminders.length > 0 ? (
              <View className="flex-row items-center gap-3 rounded-lg bg-accent-soft p-3">
                <Bell color={colors['on-accent-soft']} size={18} />
                <Text variant="small" tone="inherit" className="flex-1 text-on-accent-soft">
                  {s.allowNotifications}
                </Text>
                {permission.state === 'undetermined' ? (
                  <Button label={s.allow} variant="outline" onPress={() => void permission.ask()} />
                ) : null}
              </View>
            ) : null
          ) : null}
          <View className="gap-2">
            {draft.reminders.map((r) => (
              <ReminderRow
                key={reminderKey(r)}
                reminder={r}
                draft={draft}
                onRemove={() =>
                  set({ reminders: draft.reminders.filter((x) => !sameReminder(x, r)) })
                }
              />
            ))}
          </View>
          {!full ? (
            <View className="gap-2">
              <Text variant="label" tone="muted">
                {s.addReminder}
              </Text>
              <View className="flex-row flex-wrap gap-2">
                {freePresets.map((p) => (
                  <Chip
                    key={reminderKey(p)}
                    label={s.reminderLabel(p)}
                    icon={Plus}
                    onPress={() => addReminder(p)}
                  />
                ))}
                <Chip label={s.customReminder} icon={Clock} onPress={() => setPicker('reminder')} />
              </View>
            </View>
          ) : null}
        </Section>

        {id ? (
          <Button
            label={s.deleteClass}
            icon={Trash2}
            variant="outline"
            onPress={() => void remove()}
          />
        ) : null}
      </ScrollView>

      <TimePickerSheet
        visible={picker === 'start' || picker === 'end'}
        title={picker === 'end' ? s.ends : s.starts}
        value={picker === 'end' ? draft.endTime : draft.startTime}
        onClose={() => setPicker(null)}
        onDone={(time) => {
          setDraft(picker === 'end' ? { ...draft, endTime: time } : withStartTime(draft, time));
          setPicker(null);
        }}
      />
      <TimePickerSheet
        visible={picker === 'reminder'}
        title={s.pickTime}
        value={customDayOffset === -1 ? '20:00' : '07:00'}
        onClose={() => setPicker(null)}
        onDone={(time) => {
          addReminder({ type: 'at', time, dayOffset: customDayOffset });
          setPicker(null);
        }}
      >
        <View className="flex-row gap-2">
          <Chip
            label={s.dayBefore}
            selected={customDayOffset === -1}
            onPress={() => setCustomDayOffset(-1)}
          />
          <Chip
            label={s.sameDay}
            selected={customDayOffset === 0}
            onPress={() => setCustomDayOffset(0)}
          />
        </View>
      </TimePickerSheet>
    </KeyboardAvoidingView>
  );
}

function Section({ title, help, children }: { title: string; help?: string; children: ReactNode }) {
  return (
    <View className="gap-2">
      <Text variant="subheading" accessibilityRole="header">
        {title}
      </Text>
      {help ? (
        <Text variant="small" tone="muted">
          {help}
        </Text>
      ) : null}
      {children}
    </View>
  );
}

function TimeButton({
  label,
  value,
  onPress,
}: {
  label: string;
  value: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${label}: ${value}`}
      onPress={onPress}
      className="min-h-touch flex-1 gap-0.5 rounded-[20px] border-2 border-outline bg-surface px-4 py-3 active:opacity-80"
    >
      <Text variant="caption" tone="muted">
        {label}
      </Text>
      <View className="flex-row items-center gap-2">
        <Clock color={colors.primary} size={18} />
        <Text variant="title">{value}</Text>
      </View>
    </Pressable>
  );
}

function ReminderRow({
  reminder,
  draft,
  onRemove,
}: {
  reminder: Reminder;
  draft: ClassDraft;
  onRemove: () => void;
}) {
  const { colors } = useTheme();
  const label = s.reminderLabel(reminder);
  const slot = reminderSlot(
    { weekday: draft.weekdays[0] ?? 1, startTime: draft.startTime },
    reminder,
  );
  const note = !slot
    ? s.reminderSkipped
    : slot.shifted
      ? s.reminderShifted
      : draft.weekdays.length === 1
        ? s.reminderSends(s.weekdays[slot.weekday], slot.time)
        : null;
  return (
    <View className="min-h-touch flex-row items-center gap-3 rounded-[20px] border-2 border-outline bg-surface py-2 pl-3 pr-1">
      <View className="h-9 w-9 items-center justify-center rounded-full bg-primary-soft">
        <Bell color={colors['on-primary-soft']} size={18} />
      </View>
      <View className="flex-1">
        <Text variant="bodyStrong">{label}</Text>
        {note ? (
          <Text variant="small" tone={slot ? 'muted' : 'danger'}>
            {note}
          </Text>
        ) : null}
      </View>
      <IconButton icon={X} accessibilityLabel={s.removeReminder(label)} onPress={onRemove} />
    </View>
  );
}
