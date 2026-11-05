import { QUIZ_IMPORT_ROWS_MAX, type QuizCsvImportPlan } from '@/features/quizzes/csv';
import { strings } from '@/i18n/strings';

import { useTransferActions, type PickQuizCsvResult } from '../hooks';
import { CsvImportFlow, type CsvPickResult } from './CsvImportFlow';

const t = strings.transfer;

type Picked = Omit<Extract<PickQuizCsvResult, { status: 'ok' }>, 'status' | 'fileName'>;

function reasonText(reason: string): string {
  return (t.quizSkipReasons as Record<string, string>)[reason] ?? t.quizSkipReasons.other;
}

/** The quiz's "Import questions" sheet: questions go into the bank and onto the quiz. */
export function QuizCsvImportPanel({
  quizId,
  onCancel,
  onImport,
}: {
  quizId: string;
  onCancel: () => void;
  /** Saves the plan. The sheet closes itself only when this resolves. */
  onImport: (plan: QuizCsvImportPlan) => Promise<void>;
}) {
  const transfer = useTransferActions();
  const pick = async (): Promise<CsvPickResult<Picked>> => {
    const result = await transfer.pickQuizCsv(quizId);
    if (result.status !== 'ok') return result;
    const { status: _status, fileName, ...picked } = result;
    return { status: 'ok', fileName, picked };
  };
  return (
    <CsvImportFlow<Picked>
      help={t.importQuizHelp}
      extraHelp={t.quizFormatHelp}
      pick={pick}
      onCancel={onCancel}
      onImport={(picked) => onImport(picked.plan)}
      describe={({ plan, effect }) => {
        const notes: string[] = [];
        if (effect.alreadyInQuiz > 0) notes.push(t.alreadyInQuiz(effect.alreadyInQuiz));
        if (effect.repeated > 0) notes.push(t.repeatedQuestions(effect.repeated));
        if (plan.truncated) notes.push(t.truncated(QUIZ_IMPORT_ROWS_MAX));
        return {
          found: t.questionsFound(effect.added),
          notes,
          skipped: plan.skipped.map((s) => ({ row: s.row, reason: reasonText(s.reason) })),
          addLabel: t.addQuestions(effect.added),
          addDisabled: effect.added === 0,
        };
      }}
    />
  );
}
