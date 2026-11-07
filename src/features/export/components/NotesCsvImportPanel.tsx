import { useToast } from '@/components/ui';
import { NOTES_IMPORT_ROWS_MAX } from '@/features/notes/csv';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';

import { useTransferActions, type PickNotesCsvResult } from '../hooks';
import { CsvImportFlow, type CsvPickResult } from './CsvImportFlow';

const t = strings.transfer;
const log = createLogger('transfer');

type Picked = Omit<Extract<PickNotesCsvResult, { status: 'ok' }>, 'status' | 'fileName'>;

function reasonText(reason: string): string {
  return (t.notesSkipReasons as Record<string, string>)[reason] ?? t.notesSkipReasons.other;
}

/**
 * The Library's "Import notes" sheet (2026-11-07): each note in the file becomes a note in this
 * folder, and a toast offers Undo.
 */
export function NotesCsvImportPanel({
  folderId,
  onClose,
}: {
  /** Where the notes go: a folder, or null for the top of Notes. */
  folderId: string | null;
  onClose: () => void;
}) {
  const transfer = useTransferActions();
  const toast = useToast();

  const pick = async (): Promise<CsvPickResult<Picked>> => {
    const result = await transfer.pickNotesCsv();
    if (result.status !== 'ok') return result;
    const { status: _status, fileName, ...picked } = result;
    return { status: 'ok', fileName, picked };
  };

  const undo = (noteIds: readonly string[]) =>
    transfer.undoNotesImport(noteIds).catch((error: unknown) => {
      log.warn('Undoing a notes import failed', { error: String(error) });
      toast.show({ message: t.failed, tone: 'error' });
    });

  const save = async ({ plan }: Picked) => {
    try {
      const imported = await transfer.importNotesCsv(folderId, plan);
      onClose();
      const added = imported.noteIds.length;
      if (added === 0) {
        toast.show({ message: t.notesNothingNew });
        return;
      }
      toast.show({
        message: t.notesImported(added),
        tone: 'success',
        actionLabel: t.undo,
        onAction: () => void undo(imported.noteIds),
      });
    } catch (error) {
      log.warn('Notes CSV import failed', { error: String(error) });
      toast.show({ message: t.failed, tone: 'error' });
      throw error;
    }
  };

  return (
    <CsvImportFlow<Picked>
      help={t.importNotesHelp}
      extraHelp={t.notesFormatHelp}
      pick={pick}
      onCancel={onClose}
      onImport={save}
      describe={({ plan, effect }) => {
        const notes: string[] = [];
        if (effect.alreadyThere > 0) notes.push(t.notesAlreadyThere(effect.alreadyThere));
        if (plan.truncated) notes.push(t.truncated(NOTES_IMPORT_ROWS_MAX));
        return {
          found: t.notesFound(effect.added),
          notes,
          skipped: plan.skipped.map((s) => ({ row: s.row, reason: reasonText(s.reason) })),
          addLabel: t.addNotes(effect.added),
          addDisabled: effect.added === 0,
        };
      }}
    />
  );
}
