import { useState } from 'react';
import { Switch, View } from 'react-native';

import { Button, Chip, Input, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import {
  parseQuizSettingsForm,
  quizSettingsToForm,
  TIME_LIMIT_MINUTES,
  type QuizSettingsField,
  type QuizSettingsForm as Form,
} from '../logic';
import { DEFAULT_QUIZ_SETTINGS, quizModes, type QuizSettings } from '../types';

const s = strings.quizzes.settings;

const limits: Record<QuizSettingsField, { min: number; max: number }> = {
  timeLimitMinutes: TIME_LIMIT_MINUTES,
  passMark: { min: 0, max: 100 },
};

/** Mode, time limit, shuffling, pass mark and negative marking (PRODUCT_SPEC §4.3). */
export function QuizSettingsForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: QuizSettings;
  onSave: (settings: QuizSettings) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Form>(() => quizSettingsToForm(settings));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = parseQuizSettingsForm(form);
  const errors = tried && !parsed.ok ? parsed.errors : {};

  const errorFor = (field: QuizSettingsField) => {
    const error = errors[field];
    if (!error) return undefined;
    return error === 'notNumber' ? s.notNumber : s.outOfRange(limits[field].min, limits[field].max);
  };

  const submit = async () => {
    setTried(true);
    if (!parsed.ok || saving) return;
    setSaving(true);
    try {
      await onSave(parsed.settings);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View className="gap-4 pb-2">
      <View className="gap-2">
        <Text variant="label">{s.modeLabel}</Text>
        <View className="flex-row gap-2" accessibilityRole="radiogroup">
          {quizModes.map((mode) => (
            <Chip
              key={mode}
              label={s.modes[mode]}
              selected={form.mode === mode}
              accessibilityRole="radio"
              onPress={() => setForm((current) => ({ ...current, mode }))}
            />
          ))}
        </View>
        <Text variant="small" tone="muted">
          {s.modeHints[form.mode]}
        </Text>
      </View>
      {form.mode === 'exam' ? (
        <Input
          label={s.timeLimit}
          hint={s.timeLimitHint(TIME_LIMIT_MINUTES.min, TIME_LIMIT_MINUTES.max)}
          error={errorFor('timeLimitMinutes')}
          keyboardType="number-pad"
          value={form.timeLimitMinutes}
          onChangeText={(timeLimitMinutes) => setForm((c) => ({ ...c, timeLimitMinutes }))}
        />
      ) : null}
      <Input
        label={s.passMark}
        hint={s.passMarkHint}
        error={errorFor('passMark')}
        keyboardType="number-pad"
        value={form.passMark}
        onChangeText={(passMark) => setForm((c) => ({ ...c, passMark }))}
      />
      <SwitchRow
        label={s.shuffleQuestions}
        hint={s.shuffleQuestionsHint}
        value={form.shuffleQuestions}
        onChange={(shuffleQuestions) => setForm((c) => ({ ...c, shuffleQuestions }))}
      />
      <SwitchRow
        label={s.shuffleOptions}
        hint={s.shuffleOptionsHint}
        value={form.shuffleOptions}
        onChange={(shuffleOptions) => setForm((c) => ({ ...c, shuffleOptions }))}
      />
      <SwitchRow
        label={s.negativeMarking}
        hint={s.negativeMarkingHint}
        value={form.negativeMarking}
        onChange={(negativeMarking) => setForm((c) => ({ ...c, negativeMarking }))}
      />
      <View className="flex-row flex-wrap gap-3">
        <Button label={s.save} loading={saving} onPress={() => void submit()} />
        <Button
          label={s.reset}
          variant="outline"
          onPress={() => setForm(quizSettingsToForm(DEFAULT_QUIZ_SETTINGS))}
        />
        <Button label={strings.library.cancel} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}

function SwitchRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string;
  hint: string;
  value: boolean;
  onChange: (value: boolean) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="min-h-touch flex-row items-center gap-3">
      <View className="flex-1">
        <Text variant="bodyStrong">{label}</Text>
        <Text variant="small" tone="muted">
          {hint}
        </Text>
      </View>
      <Switch
        accessibilityLabel={label}
        accessibilityHint={hint}
        value={value}
        onValueChange={onChange}
        trackColor={{ false: colors.border, true: colors.primary }}
        thumbColor={colors.surface}
      />
    </View>
  );
}
