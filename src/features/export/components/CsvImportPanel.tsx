import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import type { CsvImportPlan, ImportSkipReason } from '@/features/decks/csv';
import { IMPORT_ROWS_MAX } from '@/features/decks/csv';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useTransferActions } from '../hooks';

const t = strings.transfer;
const log = createLogger('transfer');

/** How many skipped rows are listed by number before "…and N more". */
const SKIPPED_SHOWN = 5;

type Step =
  | { kind: 'start'; error: string | null }
  | { kind: 'reading' }
  | { kind: 'preview'; fileName: string; plan: CsvImportPlan }
  | { kind: 'saving'; fileName: string; plan: CsvImportPlan };

function reasonText(reason: ImportSkipReason): string {
  return (t.skipReasons as Record<string, string>)[reason] ?? t.skipReasons.other;
}

/**
 * The "Import cards" sheet: pick a CSV, see how many cards it holds (and which rows will be
 * skipped, and why), then add them. Nothing is saved until "Add N cards" is pressed.
 */
export function CsvImportPanel({
  onCancel,
  onImport,
}: {
  onCancel: () => void;
  /** Saves the plan. The sheet closes itself only when this resolves. */
  onImport: (plan: CsvImportPlan) => Promise<void>;
}) {
  const transfer = useTransferActions();
  const [step, setStep] = useState<Step>({ kind: 'start', error: null });

  const pick = async () => {
    setStep({ kind: 'reading' });
    try {
      const result = await transfer.pickCsv();
      if (result.status === 'cancelled') setStep({ kind: 'start', error: null });
      else if (result.status === 'error') setStep({ kind: 'start', error: result.message });
      else setStep({ kind: 'preview', fileName: result.fileName, plan: result.plan });
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

  const { plan, fileName } = step;
  const skipped = plan.skipped;
  const save = async () => {
    setStep({ kind: 'saving', fileName, plan });
    try {
      await onImport(plan);
    } catch {
      setStep({ kind: 'preview', fileName, plan });
    }
  };

  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted" numberOfLines={1}>
        {fileName}
      </Text>
      <Text variant="bodyStrong" accessibilityLiveRegion="polite">
        {t.found(plan.drafts.length)}
      </Text>
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
          {t.tagsFound(plan.tags.join(', '))}
        </Text>
      ) : null}
      <Button
        label={t.addCards(plan.drafts.length)}
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
