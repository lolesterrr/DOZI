import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { CsvImportPlan, ImportSkipReason } from '@/features/decks/csv';
import { IMPORT_ROWS_MAX } from '@/features/decks/csv';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useTransferActions, type PickCsvResult } from '../hooks';

const t = strings.transfer;
const log = createLogger('transfer');

/** How many skipped rows are listed by number before "…and N more". */
const SKIPPED_SHOWN = 5;
/** How many of the file's tags are named before "and N more". */
const TAGS_SHOWN = 12;

type Picked = Extract<PickCsvResult, { status: 'ok' }>;

type Step =
  | { kind: 'start'; error: string | null }
  | { kind: 'reading' }
  | { kind: 'preview'; picked: Picked }
  | { kind: 'saving'; picked: Picked };

function reasonText(reason: ImportSkipReason): string {
  return (t.skipReasons as Record<string, string>)[reason] ?? t.skipReasons.other;
}

/**
 * The "Import cards" sheet: pick a CSV, see how many cards it holds (and which rows will be
 * skipped, and why), then add them. Nothing is saved until "Add N cards" is pressed.
 */
export function CsvImportPanel({
  deckId,
  onCancel,
  onImport,
}: {
  /** The deck the cards go into (to spot rows already in it). */
  deckId: string;
  onCancel: () => void;
  /** Saves the plan. The sheet closes itself only when this resolves. */
  onImport: (plan: CsvImportPlan) => Promise<void>;
}) {
  const transfer = useTransferActions();
  const [step, setStep] = useState<Step>({ kind: 'start', error: null });

  const pick = async () => {
    setStep({ kind: 'reading' });
    try {
      const result = await transfer.pickCsv(deckId);
      if (result.status === 'cancelled') setStep({ kind: 'start', error: null });
      else if (result.status === 'error') setStep({ kind: 'start', error: result.message });
      else setStep({ kind: 'preview', picked: result });
    } catch (error) {
      log.warn('Could not read a CSV', { error: String(error) });
      setStep({ kind: 'start', error: t.errors.unreadable });
    }
  };

  if (step.kind === 'start' || step.kind === 'reading') {
    return (
      <View className="gap-4 pb-2">
        <Text variant="body">{t.importHelp}</Text>
        {step.kind === 'start' && step.error ? (
          <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
            {step.error}
          </Text>
        ) : null}
        <Button
          label={step.kind === 'reading' ? t.reading : t.pickFile}
          icon={FileUp}
          loading={step.kind === 'reading'}
          onPress={() => void pick()}
        />
        <Button label={t.cancel} variant="ghost" onPress={onCancel} />
      </View>
    );
  }

  const { picked } = step;
  const { plan, fileName, effect } = picked;
  const skipped = plan.skipped;
  const save = async () => {
    setStep({ kind: 'saving', picked });
    try {
      await onImport(plan);
    } catch {
      setStep({ kind: 'preview', picked });
    }
  };
  const tagNames =
    plan.tags.length > TAGS_SHOWN
      ? `${plan.tags.slice(0, TAGS_SHOWN).join(', ')} ${t.moreTags(plan.tags.length - TAGS_SHOWN)}`
      : plan.tags.join(', ');

  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted" numberOfLines={1}>
        {fileName}
      </Text>
      <Text variant="bodyStrong" accessibilityLiveRegion="polite">
        {t.found(effect.added)}
      </Text>
      {effect.existing > 0 ? <Text variant="body">{t.alreadyInDeck(effect.existing)}</Text> : null}
      {effect.repeated > 0 ? <Text variant="body">{t.repeatedRows(effect.repeated)}</Text> : null}
      {plan.truncated ? <Text variant="body">{t.truncated(IMPORT_ROWS_MAX)}</Text> : null}
      {skipped.length > 0 ? (
        <View className="gap-1">
          <Text variant="body">{t.skippedRows(skipped.length)}</Text>
          {skipped.slice(0, SKIPPED_SHOWN).map((row) => (
            <Text key={row.row} variant="small" tone="muted">
              {t.skippedRow(row.row, reasonText(row.reason))}
            </Text>
          ))}
          {skipped.length > SKIPPED_SHOWN ? (
            <Text variant="small" tone="muted">
              {t.moreSkipped(skipped.length - SKIPPED_SHOWN)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {plan.tags.length > 0 ? (
        <Text variant="small" tone="muted">
          {t.tagsFound(tagNames)}
        </Text>
      ) : null}
      <Button
        label={effect.added > 0 ? t.addCards(effect.added) : t.updateTags}
        loading={step.kind === 'saving'}
        onPress={() => void save()}
      />
      <Button
        label={t.pickAnother}
        variant="outline"
        disabled={step.kind === 'saving'}
        onPress={() => void pick()}
      />
    </View>
  );
}
