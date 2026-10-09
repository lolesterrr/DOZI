import type { DoziMood } from '@/features/mascot';
import type { ReviewRating } from '@/features/srs/logic';

// Pure rules for the review session (PRODUCT_SPEC §5.1): checking a typed answer and showing the
// difference, cram-mode ordering, progress and the end-of-session summary. No React and no
// database, so all of it is unit-tested.

// ---------------------------------------------------------------------------------------------
// Type-in answers

/** Typed answers are cut to this length before checking (the field allows 200 characters). */
export const TYPED_ANSWER_MAX = 400;

// Greek letters are often typed as words ("beta" for β), so both forms match.
const GREEK_LETTERS: Record<string, string> = {
  α: 'alpha',
  β: 'beta',
  γ: 'gamma',
  δ: 'delta',
  ε: 'epsilon',
  θ: 'theta',
  κ: 'kappa',
  λ: 'lambda',
  μ: 'mu',
  π: 'pi',
  σ: 'sigma',
  τ: 'tau',
  ω: 'omega',
};

/**
 * What two answers are compared on: lower case, accents and Greek letters turned into plain
 * letters, and everything except letters and digits dropped — so "Beta-2 agonist",
 * "β2 agonist" and "beta2agonist" are the same answer.
 */
export function answerKey(text: string): string {
  return text
    .slice(0, TYPED_ANSWER_MAX)
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[α-ω]/g, (letter) => GREEK_LETTERS[letter] ?? letter)
    .replace(/[^\p{L}\p{N}]+/gu, '');
}

/** How many typing slips still count as "almost": none for very short answers. */
export function allowedSlips(length: number): number {
  if (length <= 3) return 0;
  if (length <= 7) return 1;
  if (length <= 14) return 2;
  return 3;
}

/** The number of single-letter changes (add, remove, swap one for another) from a to b. */
export function editDistance(a: string, b: string): number {
  if (a === b) return 0;
  let previous = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const current = [i];
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      current[j] = Math.min(previous[j] + 1, current[j - 1] + 1, previous[j - 1] + cost);
    }
    previous = current;
  }
  return previous[b.length];
}

/** correct: the same answer · close: a few typing slips · wrong: anything else (or blank). */
export type TypedVerdict = 'correct' | 'close' | 'wrong';

export type DiffSegment = { text: string; kind: 'same' | 'wrong' | 'missed' };

export type TypedAnswerCheck = {
  verdict: TypedVerdict;
  /** What was typed: letters that match, and letters that shouldn't be there ('wrong'). */
  typed: DiffSegment[];
  /** The expected answer: letters that match, and letters that were left out ('missed'). */
  expected: DiffSegment[];
};

function tidy(text: string): string {
  return text.slice(0, TYPED_ANSWER_MAX).trim().replace(/\s+/g, ' ');
}

/** Checks a typed answer against the card's answer and works out the letter-by-letter diff. */
export function checkTypedAnswer(expectedAnswer: string, typedAnswer: string): TypedAnswerCheck {
  const expected = tidy(expectedAnswer);
  const typed = tidy(typedAnswer);
  const expectedKey = answerKey(expected);
  const typedKey = answerKey(typed);

  let verdict: TypedVerdict;
  if (typedKey === '') verdict = 'wrong';
  else if (typedKey === expectedKey) verdict = 'correct';
  else if (editDistance(typedKey, expectedKey) <= allowedSlips(expectedKey.length))
    verdict = 'close';
  else verdict = 'wrong';

  const diff = diffLetters(typed, expected);
  return { verdict, typed: diff.typed, expected: diff.expected };
}

/**
 * A letter-by-letter diff (longest common subsequence, ignoring case): which letters of `typed`
 * are extra and which letters of `expected` are missing. Runs of the same kind are merged.
 */
export function diffLetters(
  typed: string,
  expected: string,
): { typed: DiffSegment[]; expected: DiffSegment[] } {
  const a = [...typed];
  const b = [...expected];
  const same = (x: string, y: string) => x.toLocaleLowerCase() === y.toLocaleLowerCase();
  // lengths[i][j] = LCS length of a[i:] and b[j:]
  const lengths = Array.from({ length: a.length + 1 }, () =>
    new Array<number>(b.length + 1).fill(0),
  );
  for (let i = a.length - 1; i >= 0; i--) {
    for (let j = b.length - 1; j >= 0; j--) {
      lengths[i][j] = same(a[i], b[j])
        ? lengths[i + 1][j + 1] + 1
        : Math.max(lengths[i + 1][j], lengths[i][j + 1]);
    }
  }
  const typedOut: DiffSegment[] = [];
  const expectedOut: DiffSegment[] = [];
  const push = (list: DiffSegment[], text: string, kind: DiffSegment['kind']) => {
    const last = list[list.length - 1];
    if (last && last.kind === kind) last.text += text;
    else list.push({ text, kind });
  };
  let i = 0;
  let j = 0;
  while (i < a.length || j < b.length) {
    if (i < a.length && j < b.length && same(a[i], b[j])) {
      push(typedOut, a[i++], 'same');
      push(expectedOut, b[j++], 'same');
    } else if (j >= b.length || (i < a.length && lengths[i + 1][j] >= lengths[i][j + 1])) {
      push(typedOut, a[i++], 'wrong');
    } else {
      push(expectedOut, b[j++], 'missed');
    }
  }
  return { typed: typedOut, expected: expectedOut };
}

// ---------------------------------------------------------------------------------------------
// Cram mode: study a deck without touching the schedule

/** In cram mode a card answered "Again" comes back after this many other cards. */
export const CRAM_AGAIN_GAP = 3;

/** A shuffled copy (Fisher–Yates). Pass `random` in tests for a fixed order. */
export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * The cram queue after answering its first card: "Again" puts it back a few cards later (or
 * last, if fewer are left); any other answer takes it out.
 */
export function cramAfterAnswer<T>(queue: readonly T[], rating: ReviewRating): T[] {
  if (queue.length === 0) return [];
  const [current, ...rest] = queue;
  if (rating !== 1) return rest;
  const at = Math.min(CRAM_AGAIN_GAP, rest.length);
  return [...rest.slice(0, at), current, ...rest.slice(at)];
}

/**
 * Moves the entry matching `isPinned` to the front (e.g. the card an undo brought back), or adds
 * `pinned` at the front if the queue doesn't have it.
 */
export function pinToFront<T>(queue: readonly T[], pinned: T, isPinned: (item: T) => boolean): T[] {
  const rest = queue.filter((item) => !isPinned(item));
  return [pinned, ...rest];
}

// ---------------------------------------------------------------------------------------------
// Progress and summary

/** How far through the session: answers given out of answers given plus cards still waiting. */
export function sessionProgress(done: number, remaining: number): number {
  const total = done + remaining;
  return total === 0 ? 0 : done / total;
}

export type SessionAnswer = { instanceId: string; rating: ReviewRating; durationMs: number };

export type SessionSummary = {
  /** Answers given (a card answered "Again" and seen again counts twice). */
  answers: number;
  /** Different cards seen. */
  cards: number;
  /** Answers that weren't "Again". */
  remembered: number;
  /** remembered ÷ answers, or null with no answers. */
  accuracy: number | null;
  /** Time spent looking at cards. */
  timeMs: number;
};

export function summariseSession(answers: readonly SessionAnswer[]): SessionSummary {
  const remembered = answers.filter((a) => a.rating !== 1).length;
  return {
    answers: answers.length,
    cards: new Set(answers.map((a) => a.instanceId)).size,
    remembered,
    accuracy: answers.length === 0 ? null : remembered / answers.length,
    timeMs: answers.reduce((sum, a) => sum + Math.max(0, a.durationMs), 0),
  };
}

/** The moods the summary uses (each has its own message). */
export type SummaryMood = Extract<
  DoziMood,
  'idle' | 'celebrating' | 'proud' | 'happy' | 'encouraging'
>;

/** Dozi's reaction at the end of a session. Always warm: a hard session gets encouragement. */
export function summaryMood(summary: SessionSummary): SummaryMood {
  if (summary.accuracy === null) return 'idle';
  if (summary.accuracy >= 0.9) return 'celebrating';
  if (summary.accuracy >= 0.7) return 'proud';
  if (summary.accuracy >= 0.5) return 'happy';
  return 'encouraging';
}

/** Whole minutes for the summary, at least 1 once any time was spent. */
export function minutesSpent(ms: number): number {
  if (ms <= 0) return 0;
  return Math.max(1, Math.round(ms / 60_000));
}

// ---------------------------------------------------------------------------------------------
// Route parameters

export type ReviewMode = 'review' | 'cram';

/** `/review/all` or `/review/<deck id>`; `?mode=cram` for cram mode. */
export function parseReviewRoute(
  scope: string | string[] | undefined,
  mode: string | string[] | undefined,
): { scope: 'all' | { deckId: string }; mode: ReviewMode } {
  const value = Array.isArray(scope) ? scope[0] : scope;
  const modeValue = Array.isArray(mode) ? mode[0] : mode;
  return {
    scope: !value || value === 'all' ? 'all' : { deckId: value },
    mode: modeValue === 'cram' ? 'cram' : 'review',
  };
}
