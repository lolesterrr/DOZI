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
import { planNotesCsvImport, planNotesImport, type NotesCsvImportPlan } from '@/features/notes/csv';
import { mediaIdsInDoc, parseNoteContent } from '@/features/notes/logic';
import { deleteNotes, existingNoteTexts, getNote, importNotes } from '@/features/notes/repo';
import { useProfile } from '@/features/profile/hooks';
import {
  planQuizCsvImport,
  planQuizImport,
  quizToCsv,
  type QuizCsvImportPlan,
} from '@/features/quizzes/csv';
import { questionToDraft } from '@/features/quizzes/logic';
import {
  deleteQuestions,
  getQuiz,
  importQuestionsToQuiz,
  listQuizQuestions,
  quizQuestionKeys,
} from '@/features/quizzes/repo';
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

export type PickQuizCsvResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      fileName: string;
      plan: QuizCsvImportPlan;
      /** How many questions the import adds, and how many the quiz already has. */
      effect: { added: number; alreadyInQuiz: number; repeated: number };
    };

export type PickNotesCsvResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | {
      status: 'ok';
      fileName: string;
      plan: NotesCsvImportPlan;
      /** How many notes the import adds, and how many the Library already has. */
      effect: { added: number; alreadyThere: number };
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

      /** Lets the student pick a quiz CSV and reads it into questions (nothing is saved yet). */
      pickQuizCsv: async (quizId: string): Promise<PickQuizCsvResult> => {
        const picked = await pickTextFile();
        if (picked.status === 'cancelled') return picked;
        if (picked.status === 'tooBig') return { status: 'error', message: t.errors.tooBig(2) };
        if (picked.status === 'unreadable')
          return { status: 'error', message: t.errors.unreadable };
        const result = planQuizCsvImport(picked.text);
        if (!result.ok) return { status: 'error', message: t.quizErrors[result.error] };
        const { plan } = result;
        const { toAdd, alreadyInQuiz, repeated } = planQuizImport(
          plan.questions,
          await quizQuestionKeys(db, quizId),
        );
        return {
          status: 'ok',
          fileName: picked.name,
          plan,
          effect: { added: toAdd.length, alreadyInQuiz, repeated },
        };
      },

      /** Saves a planned quiz import: new questions in the bank and at the end of the quiz. */
      importQuizCsv: (quizId: string, plan: QuizCsvImportPlan) =>
        importQuestionsToQuiz(db, { ownerId, quizId, questions: plan.questions }),

      /** Undo for `importQuizCsv`: the new questions leave the bank and the quiz. */
      undoQuizImport: async (questionIds: readonly string[]) => {
        await deleteQuestions(db, questionIds);
      },

      /** Lets the student pick a notes CSV and reads it into notes (nothing is saved yet). */
      pickNotesCsv: async (): Promise<PickNotesCsvResult> => {
        const picked = await pickTextFile();
        if (picked.status === 'cancelled') return picked;
        if (picked.status === 'tooBig') return { status: 'error', message: t.errors.tooBig(2) };
        if (picked.status === 'unreadable')
          return { status: 'error', message: t.errors.unreadable };
        const result = planNotesCsvImport(picked.text);
        if (!result.ok) return { status: 'error', message: t.notesErrors[result.error] };
        const { plan } = result;
        const { toAdd, alreadyThere } = planNotesImport(
          plan.notes,
          await existingNoteTexts(db, ownerId),
        );
        return {
          status: 'ok',
          fileName: picked.name,
          plan,
          effect: { added: toAdd.length, alreadyThere },
        };
      },

      /** Saves a planned notes import into a folder (null = the top of Notes). */
      importNotesCsv: (folderId: string | null, plan: NotesCsvImportPlan) =>
        importNotes(db, { ownerId, folderId, notes: plan.notes }),

      /** Undo for `importNotesCsv`: the new notes go to the bin. */
      undoNotesImport: async (noteIds: readonly string[]) => {
        await deleteNotes(db, noteIds);
      },

      /** Writes a quiz as CSV (the format the import reads) and opens the share sheet. */
      exportQuizCsv: (quizId: string, title: string): Promise<ExportResult> =>
        guarded('Quiz CSV', async () => {
          const rows = await listQuizQuestions(db, quizId);
          if (rows.length === 0) return { status: 'nothing', message: t.quizEmpty };
          const result = quizToCsv(rows);
          const shared = await shareCsv(
            exportFileName(title, 'csv'),
            result.csv,
            t.shareTitle(title),
          );
          if (!shared) return { status: 'unavailable' };
          const notes: string[] = [];
          if (result.withoutImages > 0) notes.push(t.csvNoImages);
          if (result.withoutRationales > 0) notes.push(t.csvNoRationales);
          return { status: 'shared', notes };
        }),

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
