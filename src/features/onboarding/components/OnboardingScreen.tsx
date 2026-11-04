import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Check } from 'lucide-react-native';

import { Button, Card, Chip, cn, ProgressBar, Text, useToast } from '@/components/ui';
import { useProfile } from '@/features/profile/hooks';
import { Dozi, DoziSpeech } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { currentStudyDay, DEFAULT_TIMEZONE } from '@/lib/time';
import { doodleLayer, useTheme } from '@/theme';

import { requestPermission } from '@/features/notifications';

import { useOnboardingActions } from '../hooks';
import {
  defaultDraft,
  draftFromProfile,
  examDateFromPreset,
  examPresets,
  goalChoices,
  nextStep,
  onboardingSteps,
  presetForExamDate,
  previousStep,
  reminderTimes,
  SEMESTERS,
  stepFraction,
  YEARS,
  yearStepComplete,
  type OnboardingDraft,
  type OnboardingStep,
} from '../logic';

const s = strings.onboarding;
const log = createLogger('onboarding');

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/');
}

/**
 * First-launch setup (PRODUCT_SPEC §3). `edit` re-runs it from the Me tab: it starts from the
 * saved answers and "Cancel" simply goes back. Every question can be skipped.
 */
export function OnboardingScreen({ edit = false }: { edit?: boolean }) {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { profile } = useProfile();
  const { ready, finish, skip } = useOnboardingActions();
  const [step, setStep] = useState<OnboardingStep>('welcome');
  const [draft, setDraft] = useState<OnboardingDraft>(() =>
    edit ? draftFromProfile(profile) : defaultDraft,
  );
  const [busy, setBusy] = useState(false);
  const today = currentStudyDay(profile?.timezone ?? DEFAULT_TIMEZONE);

  const set = (changes: Partial<OnboardingDraft>) => setDraft((d) => ({ ...d, ...changes }));
  const next = nextStep(step);
  const previous = previousStep(step);
  const blocked = step === 'year' && !yearStepComplete(draft);

  const run = async (work: () => Promise<void>) => {
    if (busy) return;
    setBusy(true);
    try {
      await work();
      if (edit) leave();
      else router.replace('/');
    } catch (error) {
      log.warn('Could not save the setup', { error: String(error) });
      toast.show({ message: s.saveFailed, tone: 'error' });
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top }}
    >
      <View className="gap-2 px-4 pb-2 pt-3">
        <View className="flex-row items-center justify-between">
          <View className="rounded-full border-2 border-outline bg-accent-soft px-3 py-1">
            <Text variant="caption" tone="inherit" className="text-on-accent-soft">
              {s.stepOf(onboardingSteps.indexOf(step) + 1, onboardingSteps.length)}
            </Text>
          </View>
          <Button
            variant="ghost"
            label={edit ? s.cancel : s.skip}
            disabled={busy || (!edit && !ready)}
            onPress={() => (edit ? leave() : void run(skip))}
          />
        </View>
        <ProgressBar
          value={stepFraction(step)}
          accessibilityLabel={s.stepOf(onboardingSteps.indexOf(step) + 1, onboardingSteps.length)}
        />
      </View>

      <ScrollView
        className="flex-1"
        contentContainerClassName="gap-5 px-4 py-4"
        keyboardShouldPersistTaps="handled"
      >
        {step === 'welcome' ? <Welcome edit={edit} /> : null}
        {step === 'year' ? <YearStep draft={draft} set={set} /> : null}
        {step === 'goal' ? <GoalStep draft={draft} set={set} /> : null}
        {step === 'reminder' ? <ReminderStep draft={draft} set={set} /> : null}
        {step === 'exam' ? <ExamStep draft={draft} set={set} today={today} /> : null}
        {step === 'account' ? <AccountStep /> : null}
      </ScrollView>

      <View
        className="flex-row gap-3 bg-background px-4 pt-3"
        style={{ paddingBottom: Math.max(insets.bottom, 12) }}
      >
        {previous ? (
          <Button
            label={s.back}
            variant="outline"
            disabled={busy}
            onPress={() => setStep(previous)}
            className="flex-1"
          />
        ) : null}
        {next ? (
          <Button
            label={s.next}
            size="lg"
            disabled={blocked || busy}
            onPress={() => setStep(next)}
            className="flex-1"
          />
        ) : (
          <Button
            label={edit ? s.save : s.finish}
            size="lg"
            loading={busy}
            disabled={!ready}
            onPress={() =>
              void run(async () => {
                await finish(draft);
                // The reminder time is saved; now ask whether Dozi may send it (PRODUCT_SPEC §3).
                if (draft.reminder) await requestPermission();
              })
            }
            className="flex-1"
          />
        )}
      </View>
    </KeyboardAvoidingView>
  );
}

type StepProps = { draft: OnboardingDraft; set: (changes: Partial<OnboardingDraft>) => void };

function Welcome({ edit }: { edit: boolean }) {
  return (
    <View className="items-center gap-5 pt-2">
      <Dozi mood="happy" size={150} />
      <Text variant="title" className="text-center">
        {s.welcomeTitle}
      </Text>
      <Card layer="accent" className="w-full">
        <Text>{edit ? s.welcomeEditMessage : s.welcomeMessage}</Text>
      </Card>
      <Text variant="small" tone="muted" className="text-center">
        {s.offlineNote}
      </Text>
      <Text variant="small" tone="muted" className="text-center">
        {strings.disclaimer}
      </Text>
    </View>
  );
}

function YearStep({ draft, set }: StepProps) {
  const incomplete = !yearStepComplete(draft);
  return (
    <View className="gap-5">
      <DoziSpeech mood="thinking" message={s.yearTitle} />
      <Text variant="small" tone="muted">
        {s.yearHelp} {s.optional}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        {YEARS.map((year) => (
          <Chip
            key={year}
            label={s.year(year)}
            selected={draft.year === year}
            onPress={() => set({ year: draft.year === year ? null : year })}
          />
        ))}
      </View>
      <Text variant="subheading">{s.semesterTitle}</Text>
      <View className="flex-row flex-wrap gap-2">
        {SEMESTERS.map((semester) => (
          <Chip
            key={semester}
            label={s.semester(semester)}
            selected={draft.semester === semester}
            onPress={() => set({ semester: draft.semester === semester ? null : semester })}
          />
        ))}
      </View>
      {incomplete ? (
        <Text variant="small" tone="danger" accessibilityLiveRegion="polite">
          {s.yearBothNeeded}
        </Text>
      ) : null}
    </View>
  );
}

function GoalStep({ draft, set }: StepProps) {
  return (
    <View className="gap-4">
      <DoziSpeech mood="encouraging" message={s.goalTitle} />
      <Text variant="small" tone="muted">
        {s.goalHelp}
      </Text>
      {goalChoices.map((goal) => (
        <ChoiceRow
          key={goal.key}
          label={s.goalOption(s.goals[goal.key].name, goal.xp)}
          detail={s.goals[goal.key].hint}
          selected={draft.goalXp === goal.xp}
          onPress={() => set({ goalXp: goal.xp })}
        />
      ))}
    </View>
  );
}

function ReminderStep({ draft, set }: StepProps) {
  return (
    <View className="gap-4">
      <DoziSpeech mood="idle" message={s.reminderTitle} />
      <Text variant="small" tone="muted">
        {s.reminderHelp}
      </Text>
      <View className="flex-row flex-wrap gap-2">
        <Chip
          label={s.reminderNone}
          selected={draft.reminder === null}
          onPress={() => set({ reminder: null })}
        />
        {reminderTimes().map((time) => (
          <Chip
            key={time}
            label={time}
            selected={draft.reminder === time}
            onPress={() => set({ reminder: time })}
          />
        ))}
      </View>
    </View>
  );
}

function ExamStep({ draft, set, today }: StepProps & { today: string }) {
  const chosen = presetForExamDate(draft.examDate, today);
  return (
    <View className="gap-4">
      <DoziSpeech mood="thinking" message={s.examTitle} />
      <Text variant="small" tone="muted">
        {s.examHelp} {s.optional}
      </Text>
      {examPresets.map((preset) => (
        <ChoiceRow
          key={preset.key}
          label={s.examPresets[preset.key]}
          selected={chosen === preset.key}
          onPress={() => set({ examDate: examDateFromPreset(preset.key, today) })}
        />
      ))}
      <ChoiceRow
        label={s.examNotSure}
        selected={draft.examDate === null}
        onPress={() => set({ examDate: null })}
      />
    </View>
  );
}

function AccountStep() {
  return (
    <View className="items-center gap-5 pt-2">
      <Dozi mood="celebrating" size={150} />
      <Text variant="title" className="text-center">
        {s.accountTitle}
      </Text>
      <Card layer="primary" className="w-full">
        <Text>{s.accountMessage}</Text>
      </Card>
    </View>
  );
}

/**
 * A full-width choice, drawn like a doodle card. The filled, ticked circle marks the selected one
 * (not colour alone). The ink under-layer stays the same when selected: changing a shadow on press
 * makes NativeWind remount the view.
 */
function ChoiceRow({
  label,
  detail,
  selected,
  onPress,
}: {
  label: string;
  detail?: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      accessibilityLabel={detail ? `${label}. ${detail}` : label}
      onPress={onPress}
      style={doodleLayer(colors, 'ink', 6)}
      className={cn(
        'min-h-touch flex-row items-center gap-3 rounded-[20px] border-2 border-outline px-4 py-3 active:opacity-80',
        selected ? 'bg-accent-soft' : 'bg-surface',
      )}
    >
      <View
        className={cn(
          'h-7 w-7 items-center justify-center rounded-full border-2 border-outline',
          selected ? 'bg-primary' : 'bg-surface',
        )}
      >
        {selected ? <Check color={colors['on-primary']} size={16} /> : null}
      </View>
      <View className="flex-1">
        <Text
          variant="bodyStrong"
          tone="inherit"
          className={selected ? 'text-on-accent-soft' : 'text-fg'}
        >
          {label}
        </Text>
        {detail ? (
          <Text
            variant="small"
            tone="inherit"
            className={selected ? 'text-on-accent-soft' : 'text-fg-muted'}
          >
            {detail}
          </Text>
        ) : null}
      </View>
    </Pressable>
  );
}
