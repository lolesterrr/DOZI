import { useMemo } from 'react';

import { useDatabase } from '@/db/DatabaseProvider';
import { deckToCsv, planCsvImport, type CsvImportPlan } from '@/features/decks/csv';
import { importCards, listCards, undoImport } from '@/features/decks/repo';
import { tagNameProblem } from '@/features/library/logic';
import { addTagToItem, createTag, listItemTagIds, listTags } from '@/features/library/repo';
import { mediaIdsInDoc, parseNoteContent } from '@/features/notes/logic';
import { getNote } from '@/features/notes/repo';
import { useProfile } from '@/features/profile/hooks';
import { questionToDraft } from '@/features/quizzes/logic';
import { getQuiz, listQuizQuestions } from '@/features/quizzes/repo';
import { strings } from '@/i18n/strings';
import { nowIso } from '@/lib/time';

import { loadImageSources, pickTextFile, shareCsv, sharePdf } from './device';
import { exportFileName, noteToHtml, quizMediaIds, quizToHtml } from './logic';

// Import and export, bound to the database and the profile (task 1.12).

export type PickCsvResult =
  | { status: 'cancelled' }
  | { status: 'error'; message: string }
  | { status: 'ok'; fileName: string; plan: CsvImportPlan };

export type ExportResult =
  | { status: 'shared'; notes: string[] }
  | { status: 'nothing'; message: string }
  | { status: 'unavailable' };

const t = strings.transfer;

export function useTransferActions() {
  const db = useDatabase();
  const ownerId = useProfile().profile?.id ?? '';
  return useMemo(
    () => ({
      /** Lets the student pick a CSV and reads it into cards (nothing is saved yet). */
      pickCsv: async (): Promise<PickCsvResult> => {
        const picked = await pickTextFile();
        if (picked.status === 'cancelled') return picked;
        if (picked.status === 'tooBig') return { status: 'error', message: t.errors.tooBig(2) };
        if (picked.status === 'unreadable')
          return { status: 'error', message: t.errors.unreadable };
        const result = planCsvImport(picked.text);
        if (!result.ok) return { status: 'error', message: t.errors[result.error] };
        return { status: 'ok', fileName: picked.name, plan: result.plan };
      },

      /**
       * Saves the cards of a planned import into a deck and puts the file's tags on the deck
       * (making tags that don't exist yet). Returns what `undoImport` needs.
       */
      importCsv: async (deckId: string, plan: CsvImportPlan) => {
        const imported = await importCards(db, { ownerId, deckId, drafts: plan.drafts });
        if (plan.tags.length > 0) {
          const existing = await listTags(db, ownerId);
          for (const name of plan.tags) {
            const match = existing.find((tag) => tagNameProblem(name, [tag]) === 'duplicate');
            const tag = match ?? (await createTag(db, { ownerId, name }));
            if (!match) existing.push(tag);
            await addTagToItem(db, { ownerId, itemType: 'deck', itemId: deckId }, tag.id);
          }
        }
        return imported;
      },

      undoImport: (deckId: string, cardIds: readonly string[]) => undoImport(db, deckId, cardIds),

      /** Writes the deck as CSV and opens the share sheet. */
      exportDeckCsv: async (deckId: string, title: string): Promise<ExportResult> => {
        const cards = await listCards(db, deckId);
        if (cards.length === 0) return { status: 'nothing', message: t.exportEmpty };
        const tagIds = await listItemTagIds(db, { itemType: 'deck', itemId: deckId });
        const tagNames = (await listTags(db, ownerId))
          .filter((tag) => tagIds.includes(tag.id))
          .map((tag) => tag.name);
        const result = deckToCsv(cards, tagNames);
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
      },

      /** Prints a note (as saved) to PDF and opens the share sheet. */
      exportNotePdf: async (noteId: string, title: string): Promise<ExportResult> => {
        const note = await getNote(db, noteId);
        if (!note) return { status: 'nothing', message: t.failed };
        const doc = parseNoteContent(note.contentJson);
        const images = await loadImageSources(db, mediaIdsInDoc(doc));
        const html = noteToHtml({ title, doc, images, exportedAt: nowIso() });
        const shared = await sharePdf(exportFileName(title, 'pdf'), html, t.shareTitle(title));
        return shared ? { status: 'shared', notes: [] } : { status: 'unavailable' };
      },

      /** Prints a quiz paper (optionally with the answer key) to PDF and opens the share sheet. */
      exportQuizPdf: async (quizId: string, withAnswers: boolean): Promise<ExportResult> => {
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
      },
    }),
    [db, ownerId],
  );
}
