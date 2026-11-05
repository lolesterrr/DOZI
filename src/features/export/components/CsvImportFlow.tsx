import { FileUp } from 'lucide-react-native';
import { useState } from 'react';
import { View } from 'react-native';

import { Button, Text } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

const t = strings.transfer;
const log = createLogger('transfer');

/** How many skipped rows are listed by number before "…and N more". */
const SKIPPED_SHOWN = 5;

export type CsvPickResult<P> =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'ok'; fileName: string; picked: P };

/** What the preview shows for a picked file. */
export type CsvPreview = {
  /** "Found N … ready to add." */
  found: string;
  /** Extra lines: rows already there, repeats, a cut-off file. */
  notes: string[];
  skipped: { row: number; reason: string }[];
  /** Small print under the skipped rows (e.g. the tags found). */
  footer?: string;
  addLabel: string;
  /** Nothing to add (every row is already there). */
  addDisabled?: boolean;
};

type Step<P> =
  | { kind: 'start'; error: string | null }
  | { kind: 'reading' }
  | { kind: 'preview'; fileName: string; picked: P }
  | { kind: 'saving'; fileName: string; picked: P };

/**
 * The import sheet shared by decks and quizzes: pick a CSV, see what it holds (and which rows
 * will be skipped, and why), then add it. Nothing is saved until the add button is pressed.
 */
export function CsvImportFlow<P>({
  help,
  extraHelp,
  pick,
  describe,
  onCancel,
  onImport,
}: {
  help: string;
  /** Shown under the help before a file is picked (the format, in short). */
  extraHelp?: string;
  pick: () => Promise<CsvPickResult<P>>;
  describe: (picked: P) => CsvPreview;
  onCancel: () => void;
  /** Saves what was picked. The sheet closes itself only when this resolves. */
  onImport: (picked: P) => Promise<void>;
}) {
  const [step, setStep] = useState<Step<P>>({ kind: 'start', error: null });

  const choose = async () => {
    setStep({ kind: 'reading' });
    try {
      const result = await pick();
      if (result.status === 'cancelled') setStep({ kind: 'start', error: null });
      else if (result.status === 'error') setStep({ kind: 'start', error: result.message });
      else setStep({ kind: 'preview', fileName: result.fileName, picked: result.picked });
    } catch (error) {
      log.warn('Could not read a CSV', { error: String(error) });
      setStep({ kind: 'start', error: t.errors.unreadable });
    }
  };

  if (step.kind === 'start' || step.kind === 'reading') {
    return (
      <View className="gap-4 pb-2">
        <Text variant="body">{help}</Text>
        {extraHelp ? (
          <Text variant="small" tone="muted">
            {extraHelp}
          </Text>
        ) : null}
        {step.kind === 'start' && step.error ? (
          <Text variant="body" tone="danger" accessibilityLiveRegion="polite">
            {step.error}
          </Text>
        ) : null}
        <Button
          label={step.kind === 'reading' ? t.reading : t.pickFile}
          icon={FileUp}
          loading={step.kind === 'reading'}
          onPress={() => void choose()}
        />
        <Button label={t.cancel} variant="ghost" onPress={onCancel} />
      </View>
    );
  }

  const { picked, fileName } = step;
  const preview = describe(picked);
  const { skipped } = preview;
  const save = async () => {
    setStep({ kind: 'saving', fileName, picked });
    try {
      await onImport(picked);
    } catch {
      setStep({ kind: 'preview', fileName, picked });
    }
  };

  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted" numberOfLines={1}>
        {fileName}
      </Text>
      <Text variant="bodyStrong" accessibilityLiveRegion="polite">
        {preview.found}
      </Text>
      {preview.notes.map((note) => (
        <Text key={note} variant="body">
          {note}
        </Text>
      ))}
      {skipped.length > 0 ? (
        <View className="gap-1">
          <Text variant="body">{t.skippedRows(skipped.length)}</Text>
          {skipped.slice(0, SKIPPED_SHOWN).map((row) => (
            <Text key={row.row} variant="small" tone="muted">
              {t.skippedRow(row.row, row.reason)}
            </Text>
          ))}
          {skipped.length > SKIPPED_SHOWN ? (
            <Text variant="small" tone="muted">
              {t.moreSkipped(skipped.length - SKIPPED_SHOWN)}
            </Text>
          ) : null}
        </View>
      ) : null}
      {preview.footer ? (
        <Text variant="small" tone="muted">
          {preview.footer}
        </Text>
      ) : null}
      <Button
        label={preview.addLabel}
        loading={step.kind === 'saving'}
        disabled={preview.addDisabled}
        onPress={() => void save()}
      />
      <Button
        label={t.pickAnother}
        variant="outline"
        disabled={step.kind === 'saving'}
        onPress={() => void choose()}
      />
    </View>
  );
}
