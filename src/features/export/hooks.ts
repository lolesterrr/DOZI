import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { deckToCsv, planCsvImport, type CsvImportPlan } from '@/features/decks/csv';
import { planCardImport, type CardImportPlan } from '@/features/decks/logic';
import {
  deckCardKeys,
  importCards,
  listCards,
  undoImport,
  type ImportedCards,
} from '@/features/decks/repo';
import { mediaIdsInDoc, parseNoteContent } from '@/features/notes/logic';
import { getNote } from '@/features/notes/repo';
import { useProfile } from '@/features/profile/hooks';
import { questionToDraft } from '@/features/quizzes/logic';
import { getQuiz, listQuizQuestions } from '@/features/quizzes/repo';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { nowIso } from '@/lib/time';

import { loadImageSources, pickTextFile, shareCsv, sharePdf } from './device';
import { exportFileName, noteToHtml, quizMediaIds, quizToHtml } from './logic';

// Import and export, bound to the database and the profile (task 1.12).

export type PickCsvResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      fileName: string;
      plan: CsvImportPlan;
      /** What the import will do to this deck: new cards, rows already in it, repeats. */
      effect: Omit<CardImportPlan, 'steps'>;
    };

export type ExportResult =
  | { status: 'shared'; notes: string[] }
  | { status: 'nothing'; message: string }
  | { status: 'unavailable' }
  /** Something went wrong; `detail` (which step and why) is logged and shown in dev builds. */
  | { status: 'failed'; detail: string };

const t = strings.transfer;
const log = createLogger('transfer');

/** Runs an export, turning a failure into a result the screen can explain. */
async function guarded(kind: string, work: () => Promise<ExportResult>): Promise<ExportResult> {
  try {
    return await work();
  } catch (error) {
    const detail = error instanceof Error ? error.message : String(error);
    log.warn(`${kind} export failed`, { detail });
    return { status: 'failed', detail };
  }
}

export function useTransferActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  return useMemo(
    () => ({
      /** Lets the student pick a CSV and reads it into cards for a deck (nothing is saved yet). */
      pickCsv: async (deckId: string): Promise<PickCsvResult> => {
        const picked = await pickTextFile();
        if (picked.status === 'cancelled') return picked;
        if (picked.status === 'tooBig') return { status: 'error', message: t.errors.tooBig(2) };
        if (picked.status === 'unreadable')
          return { status: 'error', message: t.errors.unreadable };
        const result = planCsvImport(picked.text);
        if (!result.ok) return { status: 'error', message: t.errors[result.error] };
        const { plan } = result;
        const { steps: _steps, ...effect } = planCardImport(
          plan.drafts,
          plan.draftTags,
          await deckCardKeys(db, deckId),
        );
        return { status: 'ok', fileName: picked.name, plan, effect };
      },

      /**
       * Saves the cards of a planned import into a deck, each with its own tags (tags stay in
       * the deck and never reach the Library's tag list). Rows already in the deck only get
       * their tags. Returns what `undoImport` needs.
       */
      importCsv: (deckId: string, plan: CsvImportPlan) =>
        importCards(db, { ownerId, deckId, drafts: plan.drafts, tags: plan.draftTags }),

      undoImport: (deckId: string, imported: ImportedCards) =>
        undoImport(db, deckId, imported.cardIds, { retagged: imported.retagged }),

      /** Writes the deck as CSV and opens the share sheet. */
      exportDeckCsv: (deckId: string, title: string): Promise<ExportResult> =>
        guarded('CSV', async () => {
          const cards = await listCards(db, deckId);
          if (cards.length === 0) return { status: 'nothing', message: t.exportEmpty };
          const result = deckToCsv(cards);
          if (result.exported === 0) return { status: 'nothing', message: t.exportNothing };
          const shared = await shareCsv(
            exportFileName(title, 'csv'),
            result.csv,
            t.shareTitle(title),
          );
          if (!shared) return { status: 'unavailable' };
          const notes: string[] = [];
          if (result.leftOut > 0) notes.push(t.csvLeftOut(result.leftOut));
          if (result.withoutImages > 0) notes.push(t.csvNoImages);
          return { status: 'shared', notes };
        }),

      /** Prints a note (as saved) to PDF and opens the share sheet. */
      exportNotePdf: (noteId: string, title: string): Promise<ExportResult> =>
        guarded('Note PDF', async () => {
          const note = await getNote(db, noteId);
          if (!note) return { status: 'nothing', message: t.failed };
          const doc = parseNoteContent(note.contentJson);
          const images = await loadImageSources(db, mediaIdsInDoc(doc));
          const html = noteToHtml({ title, doc, images, exportedAt: nowIso() });
          const shared = await sharePdf(exportFileName(title, 'pdf'), html, t.shareTitle(title));
          return shared ? { status: 'shared', notes: [] } : { status: 'unavailable' };
        }),

      /** Prints a quiz paper (optionally with the answer key) to PDF and opens the share sheet. */
      exportQuizPdf: (quizId: string, withAnswers: boolean): Promise<ExportResult> =>
        guarded('Quiz PDF', async () => {
          const quiz = await getQuiz(db, quizId);
          if (!quiz) return { status: 'nothing', message: t.failed };
          const rows = await listQuizQuestions(db, quizId);
          if (rows.length === 0) return { status: 'nothing', message: t.quizEmpty };
          const questions = rows.map((row) => ({
            draft: questionToDraft(row.question),
            points: row.points,
          }));
          const images = await loadImageSources(db, quizMediaIds(questions, withAnswers));
          const html = quizToHtml({
            title: quiz.title,
            description: quiz.description,
            questions,
            withAnswers,
            images,
            exportedAt: nowIso(),
          });
          const shared = await sharePdf(
            exportFileName(quiz.title, 'pdf'),
            html,
            t.shareTitle(quiz.title),
          );
          return shared ? { status: 'shared', notes: [] } : { status: 'unavailable' };
        }),
    }),
    [db, ownerId],
  );
}
