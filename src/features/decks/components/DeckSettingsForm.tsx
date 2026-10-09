import { useState } from 'react';
import { View } from 'react-native';

import { Button, Input } from '@/components/ui';
import type { Deck } from '@/db/schema';
import { strings } from '@/i18n/strings';

import {
  DECK_DEFAULTS,
  DECK_LIMITS,
  deckSettingsToForm,
  parseDeckSettingsForm,
  type DeckSettings,
  type DeckSettingsField,
  type DeckSettingsForm as Form,
} from '../logic';

const s = strings.decks.settings;

const limits: Record<DeckSettingsField, { min: number; max: number }> = {
  newPerDay: DECK_LIMITS.newPerDay,
  maxReviewsPerDay: DECK_LIMITS.maxReviewsPerDay,
  retentionPercent: DECK_LIMITS.retentionPercent,
};

/** New cards per day, maximum reviews per day and desired retention (PRODUCT_SPEC §4.2). */
export function DeckSettingsForm({
  deck,
  onSave,
  onCancel,
}: {
  deck: Pick<Deck, 'newPerDay' | 'maxReviewsPerDay' | 'desiredRetention'>;
  onSave: (settings: DeckSettings) => void | Promise<void>;
  onCancel: () => void;
}) {
  const [form, setForm] = useState<Form>(() => deckSettingsToForm(deck));
  const [tried, setTried] = useState(false);
  const [saving, setSaving] = useState(false);
  const parsed = parseDeckSettingsForm(form);
  const errors = tried && !parsed.ok ? parsed.errors : {};

  const errorFor = (field: DeckSettingsField) => {
    const error = errors[field];
    if (!error) return undefined;
    return error === 'notNumber' ? s.notNumber : s.outOfRange(limits[field].min, limits[field].max);
  };

  const set = (field: DeckSettingsField) => (value: string) =>
    setForm((current) => ({ ...current, [field]: value }));

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
      <Input
        label={s.newPerDay}
        hint={s.newPerDayHint(limits.newPerDay.min, limits.newPerDay.max)}
        error={errorFor('newPerDay')}
        keyboardType="number-pad"
        value={form.newPerDay}
        onChangeText={set('newPerDay')}
      />
      <Input
        label={s.maxReviews}
        hint={s.maxReviewsHint(limits.maxReviewsPerDay.min, limits.maxReviewsPerDay.max)}
        error={errorFor('maxReviewsPerDay')}
        keyboardType="number-pad"
        value={form.maxReviewsPerDay}
        onChangeText={set('maxReviewsPerDay')}
      />
      <Input
        label={s.retention}
        hint={s.retentionHint(limits.retentionPercent.min, limits.retentionPercent.max)}
        error={errorFor('retentionPercent')}
        keyboardType="number-pad"
        value={form.retentionPercent}
        onChangeText={set('retentionPercent')}
      />
      <View className="flex-row flex-wrap gap-3">
        <Button label={s.save} loading={saving} onPress={() => void submit()} />
        <Button
          label={s.reset}
          variant="outline"
          onPress={() => setForm(deckSettingsToForm(DECK_DEFAULTS))}
        />
        <Button label={strings.library.cancel} variant="ghost" onPress={onCancel} />
      </View>
    </View>
  );
}
