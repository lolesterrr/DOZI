import { FlashList } from '@shopify/flash-list';
import { router } from 'expo-router';
import {
  CircleCheck,
  CircleX,
  FileX,
  Flag,
  Layers,
  Plus,
  RotateCcw,
  Repeat,
  X,
} from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  Chip,
  cn,
  EmptyState,
  IconButton,
  Text,
  useToast,
} from '@/components/ui';
import { useDecks } from '@/features/decks/hooks';
import { XpSummary } from '@/features/gamification/components/XpSummary';
import { SheetAction } from '@/features/library/components/SheetAction';
import { Dozi } from '@/features/mascot';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { strings } from '@/i18n/strings';
import { createLogger } from '@/lib/logger';
import { useTheme } from '@/theme';

import { useAddToFlashcards, useAttemptResults, type AttemptReview } from '../hooks';
import { minutesSpent } from '@/features/review/logic';

import { formatPoints, questionToCard, resultsMood, summariseAttempt } from '../logic';
import { playQuiz } from '../navigation';
import { parseQuizSettings } from '../types';
import { QuestionView } from './QuestionView';

const s = strings.quizzes.results;
const log = createLogger('quizzes');

function done(quizId: string | null) {
  if (router.canGoBack()) router.back();
  else if (quizId) router.replace({ pathname: '/quiz/[id]/edit', params: { id: quizId } });
  else router.replace('/library');
}

/** An attempt's results: `/quiz/attempt/<attempt id>`. */
export function AttemptResultsScreen({ attemptId }: { attemptId: string }) {
  const insets = useSafeAreaInsets();
  const { loading, attempt, quiz, reviews } = useAttemptResults(attemptId);
  const toast = useToast();
  const addToFlashcards = useAddToFlashcards();
  const decks = useDecks();
  const [showReview, setShowReview] = useState(false);
  const [wrongOnly, setWrongOnly] = useState(false);
  const [picking, setPicking] = useState(false);
  const [added, setAdded] = useState(false);
  const [viewing, setViewing] = useState<string | null>(null);

  const settings = useMemo(() => parseQuizSettings(attempt?.settingsJson), [attempt]);
  const wrong = useMemo(() => reviews.filter((r) => !r.isCorrect), [reviews]);
  const shown = showReview ? (wrongOnly ? wrong : reviews) : [];

  if (loading) return <View className="flex-1 bg-background" />;
  if (!attempt) {
    return (
      <View className="flex-1 justify-center bg-background" style={{ paddingTop: insets.top }}>
        <EmptyState
          icon={FileX}
          title={s.missingTitle}
          message={s.missingMessage}
          actionLabel={s.done}
          onAction={() => done(null)}
        />
      </View>
    );
  }

  const summary = summariseAttempt(attempt, reviews, settings.passMark);
  const mood = resultsMood(summary.percent);
  const quizLive = !!quiz && !quiz.deletedAt;

  const addWrong = async (target: { deckId: string } | { newDeckTitle: string }, name: string) => {
    setPicking(false);
    try {
      const cards = wrong.map((r) => questionToCard(r.item.question, s.cardLabels));
      const result = await addToFlashcards(target, cards);
      setAdded(true);
      toast.show({ message: s.addedToCards(result.added, name), tone: 'success' });
    } catch (error) {
      log.warn('Adding cards failed', { error: String(error) });
      toast.show({ message: strings.library.failed, tone: 'error' });
    }
  };

  const header = (
    <View className="items-center gap-4 px-5 pb-4 pt-2">
      <Dozi mood={mood} size={110} />
      <Text variant="title" className="text-center">
        {attempt.retryOf ? s.retryTitle : s.title}
      </Text>
      {quiz ? (
        <Text variant="small" tone="muted" className="text-center">
          {quiz.title}
        </Text>
      ) : null}
      <Text variant="display" accessibilityLabel={s.percent(summary.percent)}>
        {s.percent(summary.percent)}
      </Text>
      <Text variant="bodyStrong">
        {s.score(formatPoints(summary.score), formatPoints(summary.maxScore))}
      </Text>
      <PassBadge passed={summary.passed} passMark={settings.passMark} />
      <Text tone="muted" className="max-w-[340px] text-center">
        {s.messages[mood]}
      </Text>
      <View className="w-full flex-row gap-2">
        <Stat label={s.correct} value={s.correctValue(summary.correct, summary.questions)} />
        <Stat
          label={s.time}
          value={summary.timeMs < 60_000 ? s.underMinute : s.minutes(minutesSpent(summary.timeMs))}
        />
      </View>

      <XpSummary />

      <View className="w-full gap-2">
        {quizLive && summary.wrong > 0 ? (
          <Button
            label={s.retryWrong(summary.wrong)}
            icon={RotateCcw}
            onPress={() =>
              playQuiz(attempt.quizId as string, { retryOf: attempt.id, replace: true })
            }
          />
        ) : null}
        {summary.wrong > 0 ? (
          <Button
            label={added ? s.alreadyAdded : s.addToCards}
            icon={Layers}
            variant="secondary"
            disabled={added}
            onPress={() => setPicking(true)}
          />
        ) : null}
        {quizLive ? (
          <Button
            label={s.retake}
            icon={Repeat}
            variant="outline"
            onPress={() => playQuiz(attempt.quizId as string, { replace: true })}
          />
        ) : null}
        <Button
          label={showReview ? s.hideReview : s.review}
          variant="outline"
          onPress={() => setShowReview((v) => !v)}
        />
        <Button label={s.done} variant="ghost" onPress={() => done(attempt.quizId)} />
      </View>

      {showReview ? (
        <View className="w-full gap-2">
          <View className="flex-row gap-2">
            <Chip label={s.showAll} selected={!wrongOnly} onPress={() => setWrongOnly(false)} />
            <Chip label={s.showWrong} selected={wrongOnly} onPress={() => setWrongOnly(true)} />
          </View>
          {shown.length === 0 ? (
            <Text tone="muted" className="py-4 text-center">
              {s.reviewEmpty}
            </Text>
          ) : null}
        </View>
      ) : null}
    </View>
  );

  return (
    <View className="flex-1 bg-background" style={{ paddingTop: insets.top }}>
      <View className="flex-row items-center px-1">
        <IconButton icon={X} accessibilityLabel={s.done} onPress={() => done(attempt.quizId)} />
      </View>
      <FlashList
        data={shown}
        keyExtractor={(review) => review.item.questionId}
        ListHeaderComponent={header}
        contentContainerStyle={{ paddingBottom: insets.bottom + 24 }}
        renderItem={({ item: review }) => (
          <ReviewRow
            review={review}
            number={reviews.indexOf(review) + 1}
            settings={settings}
            onImagePress={setViewing}
          />
        )}
      />

      <BottomSheet visible={picking} onClose={() => setPicking(false)} title={s.pickDeckTitle}>
        <View className="gap-2 pb-2">
          <Text variant="small" tone="muted">
            {s.pickDeckHint(wrong.length)}
          </Text>
          <SheetAction
            icon={Plus}
            label={s.newDeck(s.newDeckTitle(quiz?.title ?? s.title))}
            onPress={() => {
              const title = s.newDeckTitle(quiz?.title ?? s.title);
              void addWrong({ newDeckTitle: title }, title);
            }}
          />
          {decks.map((deck) => (
            <SheetAction
              key={deck.id}
              icon={Layers}
              label={deck.title}
              onPress={() => void addWrong({ deckId: deck.id }, deck.title)}
            />
          ))}
        </View>
      </BottomSheet>

      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function PassBadge({ passed, passMark }: { passed: boolean; passMark: number }) {
  const { colors } = useTheme();
  const Icon = passed ? CircleCheck : CircleX;
  return (
    <View
      className={cn(
        'flex-row items-center gap-1.5 rounded-full px-3 py-1',
        passed ? 'bg-success-soft' : 'bg-warning-soft',
      )}
    >
      <Icon size={18} color={colors[passed ? 'on-success-soft' : 'on-warning-soft']} />
      <Text
        variant="label"
        tone="inherit"
        className={passed ? 'text-on-success-soft' : 'text-on-warning-soft'}
      >
        {passed ? s.passed(passMark) : s.notYet(passMark)}
      </Text>
    </View>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View
      accessible
      accessibilityLabel={`${label}: ${value}`}
      className="flex-1 items-center gap-1 rounded-lg border border-border bg-surface px-2 py-3"
    >
      <Text variant="heading">{value}</Text>
      <Text variant="caption" tone="muted">
        {label}
      </Text>
    </View>
  );
}

function ReviewRow({
  review,
  number,
  settings,
  onImagePress,
}: {
  review: AttemptReview;
  number: number;
  settings: ReturnType<typeof parseQuizSettings>;
  onImagePress: (mediaId: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <View className="mx-4 mb-3 gap-3 rounded-xl border border-border bg-surface p-4">
      <View className="flex-row flex-wrap items-center gap-2">
        <Text variant="label" className="flex-1">
          {`${s.questionLabel(number)} · ${strings.questions.types[review.item.question.type]}`}
        </Text>
        {review.flagged ? (
          <View className="flex-row items-center gap-1">
            <Flag size={14} color={colors['fg-muted']} />
            <Text variant="caption" tone="muted">
              {s.flaggedNote}
            </Text>
          </View>
        ) : null}
      </View>
      {review.questionDeleted ? (
        <Text variant="caption" tone="muted">
          {s.deletedNote}
        </Text>
      ) : null}
      <QuestionView
        item={review.item}
        response={review.response}
        stage="feedback"
        settings={settings}
        onImagePress={onImagePress}
      />
    </View>
  );
}
