import type { CsvImportPlan, ImportSkipReason } from '@/features/decks/csv';
import { IMPORT_ROWS_MAX } from '@/features/decks/csv';
import { strings } from '@/i18n/strings';

import { useTransferActions, type PickCsvResult } from '../hooks';
import { CsvImportFlow, type CsvPickResult } from './CsvImportFlow';

const t = strings.transfer;

/** How many of the file's tags are named before "and N more". */
const TAGS_SHOWN = 12;

type Picked = Omit<Extract<PickCsvResult, { status: 'ok' }>, 'status' | 'fileName'>;

function reasonText(reason: ImportSkipReason): string {
  return (t.skipReasons as Record<string, string>)[reason] ?? t.skipReasons.other;
}

/** The deck's "Import cards" sheet (each row's tags go on its card). */
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
  const pick = async (): Promise<CsvPickResult<Picked>> => {
    const result = await transfer.pickCsv(deckId);
    if (result.status !== 'ok') return result;
    const { status: _status, fileName, ...picked } = result;
    return { status: 'ok', fileName, picked };
  };
  return (
    <CsvImportFlow<Picked>
      help={t.importHelp}
      pick={pick}
      onCancel={onCancel}
      onImport={(picked) => onImport(picked.plan)}
      describe={({ plan, effect }) => {
        const notes: string[] = [];
        if (effect.existing > 0) notes.push(t.alreadyInDeck(effect.existing));
        if (effect.repeated > 0) notes.push(t.repeatedRows(effect.repeated));
        if (plan.truncated) notes.push(t.truncated(IMPORT_ROWS_MAX));
        const tagNames =
          plan.tags.length > TAGS_SHOWN
            ? `${plan.tags.slice(0, TAGS_SHOWN).join(', ')} ${t.moreTags(plan.tags.length - TAGS_SHOWN)}`
            : plan.tags.join(', ');
        return {
          found: t.found(effect.added),
          notes,
          skipped: plan.skipped.map((s) => ({ row: s.row, reason: reasonText(s.reason) })),
          footer: plan.tags.length > 0 ? t.tagsFound(tagNames) : undefined,
          addLabel: effect.added > 0 ? t.addCards(effect.added) : t.updateTags,
        };
      }}
    />
  );
}
