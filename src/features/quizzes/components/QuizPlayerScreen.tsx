import { router } from 'expo-router';
import {
  ArrowLeft,
  ArrowRight,
  Clock,
  FileX,
  Flag,
  FlagOff,
  Grid3x3,
  TriangleAlert,
  X,
} from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import {
  BackHandler,
  KeyboardAvoidingView,
  Pressable,
  ScrollView,
  View,
  type ScrollViewInstance,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BottomSheet,
  Button,
  cn,
  EmptyState,
  IconButton,
  ProgressBar,
  Text,
  useToast,
} from '@/components/ui';
import { Dozi } from '@/features/mascot';
import { MediaViewer } from '@/features/media/components/MediaViewer';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { useQuizPlayer, type QuizPlayer } from '../hooks';
import {
  formatClock,
  formatPoints,
  isAnswered,
  secondsLeft,
  TIMER_WARNING_SEC,
  totalPoints,
} from '../logic';
import { QuestionView } from './QuestionView';

const s = strings.quizzes.play;

function leave() {
  if (router.canGoBack()) router.back();
  else router.replace('/library');
}

/** Taking a quiz: `/quiz/<id>/play`, `?retry=<attempt id>` for "Retry wrong only". */
export function QuizPlayerScreen({ quizId, retryOf }: { quizId: string; retryOf: string | null }) {
  const insets = useSafeAreaInsets();
  const player = useQuizPlayer(quizId, retryOf);
  const [sheet, setSheet] = useState<'leave' | 'submit' | 'grid' | null>(null);
  const [viewing, setViewing] = useState<string | null>(null);
  const { phase } = player;
  const inProgress = phase === 'playing' || phase === 'marking';

  // Android's back button asks before throwing away answers.
  useEffect(() => {
    if (!inProgress) return undefined;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      setSheet('leave');
      return true;
    });
    return () => sub.remove();
  }, [inProgress]);

  const close = () => (inProgress ? setSheet('leave') : leave());

  return (
    <View
      className="flex-1 bg-background"
      style={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
    >
      <KeyboardAvoidingView behavior="padding" style={{ flex: 1 }}>
        <TopBar player={player} onClose={close} onGrid={() => setSheet('grid')} />

        {phase === 'loading' || phase === 'saving' ? (
          <View className="flex-1 items-center justify-center gap-3">
            {phase === 'saving' ? <Text tone="muted">{s.saving}</Text> : null}
          </View>
        ) : null}

        {phase === 'missing' ? (
          <Centred>
            <EmptyState
              icon={FileX}
              title={strings.quizzes.missingTitle}
              message={strings.quizzes.missingMessage}
              actionLabel={s.back}
              onAction={leave}
            />
          </Centred>
        ) : null}

        {phase === 'empty' || phase === 'noneWrong' ? (
          <Centred>
            <EmptyState
              illustration={<Dozi mood={phase === 'noneWrong' ? 'celebrating' : 'thinking'} />}
              title={phase === 'noneWrong' ? s.noneWrongTitle : s.emptyTitle}
              message={phase === 'noneWrong' ? s.noneWrongMessage : s.emptyMessage}
              actionLabel={s.back}
              onAction={leave}
            />
          </Centred>
        ) : null}

        {phase === 'failed' ? (
          <Centred>
            <EmptyState
              illustration={<Dozi mood="concerned" />}
              title={s.saveFailed}
              actionLabel={s.tryAgain}
              onAction={() => void player.retrySave()}
            />
          </Centred>
        ) : null}

        {phase === 'intro' ? <Intro player={player} retry={retryOf !== null} /> : null}

        {phase === 'playing' && player.current ? (
          <Playing
            key={player.current.questionId}
            player={player}
            onImagePress={setViewing}
            onSubmit={() => setSheet('submit')}
          />
        ) : null}

        {phase === 'marking' && player.markItem ? (
          <Marking key={player.markItem.questionId} player={player} onImagePress={setViewing} />
        ) : null}
      </KeyboardAvoidingView>

      <BottomSheet
        visible={sheet !== null}
        onClose={() => setSheet(null)}
        title={sheet === 'leave' ? s.leaveTitle : sheet === 'submit' ? s.submitTitle : s.gridTitle}
      >
        {sheet === 'leave' ? (
          <View className="gap-3 pb-2">
            <Text tone="muted">{s.leaveMessage}</Text>
            <Button
              label={s.leaveFinish}
              onPress={() => {
                setSheet(null);
                player.finishNow();
              }}
            />
            <Button
              label={s.leaveDiscard}
              variant="outline"
              onPress={() => {
                setSheet(null);
                leave();
              }}
            />
            <Button label={s.keepGoing} variant="ghost" onPress={() => setSheet(null)} />
          </View>
        ) : null}

        {sheet === 'submit' ? (
          <SubmitSheet
            player={player}
            onSubmit={() => {
              setSheet(null);
              player.submit();
            }}
            onCancel={() => setSheet(null)}
          />
        ) : null}

        {sheet === 'grid' ? (
          <NavigatorGrid
            player={player}
            onPick={(index) => {
              setSheet(null);
              player.goTo(index);
            }}
            onSubmit={() => setSheet('submit')}
          />
        ) : null}
      </BottomSheet>

      <MediaViewer id={viewing} onClose={() => setViewing(null)} />
    </View>
  );
}

function Centred({ children }: { children: React.ReactNode }) {
  return <View className="flex-1 justify-center">{children}</View>;
}

// ---------------------------------------------------------------------------------------------

function TopBar({
  player,
  onClose,
  onGrid,
}: {
  player: QuizPlayer;
  onClose: () => void;
  onGrid: () => void;
}) {
  const { colors } = useTheme();
  const exam = player.settings.mode === 'exam';
  const playing = player.phase === 'playing';
  const flagged = player.current ? !!player.flagged[player.current.questionId] : false;
  const progress =
    player.items.length === 0
      ? 0
      : player.phase === 'marking'
        ? 1
        : player.index / player.items.length;
  return (
    <View className="gap-1 pb-2">
      <View className="flex-row items-center gap-1 px-1">
        <IconButton icon={X} accessibilityLabel={s.close} onPress={onClose} />
        <View className="flex-1 px-2">
          {playing || player.phase === 'marking' ? (
            <ProgressBar value={progress} accessibilityLabel={s.progressLabel} />
          ) : (
            <Text variant="heading" numberOfLines={1}>
              {player.quiz?.title ?? ''}
            </Text>
          )}
        </View>
        {exam && playing ? (
          <>
            <IconButton
              icon={flagged ? FlagOff : Flag}
              accessibilityLabel={flagged ? s.unflag : s.flag}
              accessibilityState={{ selected: flagged }}
              onPress={player.toggleFlag}
            />
            <IconButton icon={Grid3x3} accessibilityLabel={s.grid} onPress={onGrid} />
          </>
        ) : null}
      </View>
      {playing ? (
        <View className="flex-row items-center justify-between gap-2 px-4">
          <Text variant="caption" tone="muted">
            {`${s.progress(player.index + 1, player.items.length)} · ${s.points(player.current?.points ?? 0)}`}
          </Text>
          {exam && flagged ? (
            <View className="flex-row items-center gap-1">
              <Flag size={14} color={colors['fg-muted']} />
              <Text variant="caption" tone="muted">
                {s.flagged}
              </Text>
            </View>
          ) : null}
          {exam && player.settings.timeLimitSec !== null && player.startedAtMs !== null ? (
            <Timer
              startedAtMs={player.startedAtMs}
              limitSec={player.settings.timeLimitSec}
              onTimeUp={player.submit}
            />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** Exam countdown. Under a minute it says so in words too; at 0 the answers are handed in. */
function Timer({
  startedAtMs,
  limitSec,
  onTimeUp,
}: {
  startedAtMs: number;
  limitSec: number;
  onTimeUp: () => void;
}) {
  const { colors } = useTheme();
  const toast = useToast();
  const [now, setNow] = useState(() => Date.now());
  const done = useRef(false);
  const onTimeUpRef = useRef(onTimeUp);
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  });
  const left = secondsLeft(startedAtMs, limitSec, now);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    if (left > 0 || done.current) return;
    done.current = true;
    toast.show({ message: s.timeUp });
    onTimeUpRef.current();
  }, [left, toast]);

  const low = left <= TIMER_WARNING_SEC;
  const clock = formatClock(left);
  return (
    <View
      accessible
      accessibilityLabel={low ? `${s.timeLeftLabel(clock)}. ${s.timeLow}` : s.timeLeftLabel(clock)}
      className={cn(
        'flex-row items-center gap-1 rounded-full px-2 py-0.5',
        low ? 'bg-danger-soft' : 'bg-surface-muted',
      )}
    >
      {low ? (
        <TriangleAlert size={14} color={colors['on-danger-soft']} />
      ) : (
        <Clock size={14} color={colors['fg-muted']} />
      )}
      <Text
        variant="caption"
        tone="inherit"
        className={low ? 'font-body-semibold text-on-danger-soft' : 'text-fg-muted'}
      >
        {low ? `${s.timeLow} · ${clock}` : s.timeLeft(clock)}
      </Text>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------

function Intro({ player, retry }: { player: QuizPlayer; retry: boolean }) {
  const { settings, items } = player;
  const minutes = settings.timeLimitSec === null ? null : Math.round(settings.timeLimitSec / 60);
  const hasMtf = items.some((i) => i.question.type === 'mtf');
  return (
    <ScrollView contentContainerClassName="items-center gap-4 px-6 py-6">
      <Dozi mood="studying" size={110} />
      <Text variant="title" className="text-center">
        {player.quiz?.title ?? ''}
      </Text>
      <Text variant="bodyStrong" className="text-center">
        {`${s.introQuestions(items.length)} · ${s.introPoints(formatPoints(totalPoints(items)))}`}
      </Text>
      {retry ? (
        <Text tone="muted" className="text-center">
          {s.introRetry(items.length)}
        </Text>
      ) : null}
      <Text tone="muted" className="max-w-[360px] text-center">
        {settings.mode === 'practice' ? s.introPractice : s.introExam(minutes)}
      </Text>
      <Text variant="small" tone="muted" className="text-center">
        {s.introPassMark(settings.passMark)}
      </Text>
      {settings.negativeMarking && hasMtf ? (
        <Text variant="small" tone="muted" className="text-center">
          {s.introNegative}
        </Text>
      ) : null}
      {player.skipped > 0 ? (
        <Text variant="small" tone="muted" className="text-center">
          {s.skipped(player.skipped)}
        </Text>
      ) : null}
      <Button label={s.begin} size="lg" fullWidth onPress={player.begin} />
      <Text variant="caption" tone="muted" className="text-center">
        {strings.disclaimer}
      </Text>
    </ScrollView>
  );
}

/** The question on screen and the buttons under it. Remounted for each question. */
function Playing({
  player,
  onImagePress,
  onSubmit,
}: {
  player: QuizPlayer;
  onImagePress: (mediaId: string) => void;
  onSubmit: () => void;
}) {
  const scroll = useRef<ScrollViewInstance>(null);
  const item = player.current;
  if (!item) return null;
  const exam = player.settings.mode === 'exam';
  const checked = !exam && !!player.checked[item.questionId];
  const isLast = player.index === player.items.length - 1;
  const response = player.responses[item.questionId] ?? null;

  return (
    <>
      <ScrollView
        ref={scroll}
        className="flex-1"
        contentContainerClassName="px-4 pb-6 pt-1"
        keyboardShouldPersistTaps="handled"
      >
        <QuestionView
          item={item}
          response={response}
          stage={checked ? 'feedback' : 'answering'}
          settings={player.settings}
          onChange={(next) => player.setResponse(item.questionId, next)}
          onImagePress={onImagePress}
        />
      </ScrollView>

      <View className="flex-row gap-3 border-t border-border bg-surface px-4 pb-3 pt-3">
        {exam ? (
          <>
            <Button
              label={s.previous}
              icon={ArrowLeft}
              variant="outline"
              disabled={player.index === 0}
              onPress={() => player.goTo(player.index - 1)}
              className="flex-1"
            />
            {isLast ? (
              <Button label={s.submit} onPress={onSubmit} className="flex-1" />
            ) : (
              <Button
                label={s.nextExam}
                icon={ArrowRight}
                onPress={() => player.goTo(player.index + 1)}
                className="flex-1"
              />
            )}
          </>
        ) : checked ? (
          <Button
            label={isLast ? s.seeResults : s.next}
            size="lg"
            fullWidth
            onPress={player.next}
            className="flex-1"
          />
        ) : (
          <Button
            label={item.question.type === 'saq' ? strings.quizzes.answer.saqShowPoints : s.check}
            size="lg"
            fullWidth
            onPress={() => {
              player.check();
              scroll.current?.scrollTo({ y: 0, animated: true });
            }}
            className="flex-1"
          />
        )}
      </View>
    </>
  );
}

/** Exam mode, after submitting: tick the marking points each written short answer covered. */
function Marking({
  player,
  onImagePress,
}: {
  player: QuizPlayer;
  onImagePress: (mediaId: string) => void;
}) {
  const item = player.markItem;
  if (!item) return null;
  const isLast = player.markIndex === player.markCount - 1;
  return (
    <>
      <ScrollView className="flex-1" contentContainerClassName="gap-3 px-4 pb-6 pt-1">
        <Text variant="heading">{s.markTitle}</Text>
        <Text variant="small" tone="muted">
          {player.markIndex === 0
            ? s.markIntro(player.markCount)
            : s.markProgress(player.markIndex + 1, player.markCount)}
        </Text>
        <QuestionView
          item={item}
          response={player.responses[item.questionId] ?? null}
          stage="feedback"
          settings={player.settings}
          onChange={(next) => player.setResponse(item.questionId, next)}
          onImagePress={onImagePress}
        />
      </ScrollView>
      <View className="border-t border-border bg-surface px-4 pb-3 pt-3">
        <Button
          label={isLast ? s.markDone : s.markNext}
          size="lg"
          fullWidth
          onPress={player.markNext}
        />
      </View>
    </>
  );
}

// ---------------------------------------------------------------------------------------------

function useAnswerCounts(player: QuizPlayer) {
  const answered = player.items.filter((item) =>
    isAnswered(item, player.responses[item.questionId] ?? null),
  ).length;
  const flagged = player.items.filter((item) => player.flagged[item.questionId]).length;
  return { answered, flagged, total: player.items.length };
}

function SubmitSheet({
  player,
  onSubmit,
  onCancel,
}: {
  player: QuizPlayer;
  onSubmit: () => void;
  onCancel: () => void;
}) {
  const { answered, total } = useAnswerCounts(player);
  const unanswered = total - answered;
  return (
    <View className="gap-3 pb-2">
      <Text tone="muted">{unanswered > 0 ? s.submitUnanswered(unanswered) : s.submitAll}</Text>
      <Button label={s.submitConfirm} onPress={onSubmit} />
      <Button label={s.keepGoing} variant="ghost" onPress={onCancel} />
    </View>
  );
}

/** Exam navigator: a numbered cell per question (answered filled + tick, flagged with a flag). */
function NavigatorGrid({
  player,
  onPick,
  onSubmit,
}: {
  player: QuizPlayer;
  onPick: (index: number) => void;
  onSubmit: () => void;
}) {
  const { colors } = useTheme();
  const counts = useAnswerCounts(player);
  return (
    <View className="gap-3 pb-2">
      <Text variant="small" tone="muted">
        {s.gridSummary(counts.answered, counts.total, counts.flagged)}
      </Text>
      <ScrollView style={{ maxHeight: 320 }}>
        <View className="flex-row flex-wrap gap-2">
          {player.items.map((item, index) => {
            const answered = isAnswered(item, player.responses[item.questionId] ?? null);
            const flagged = !!player.flagged[item.questionId];
            const current = index === player.index;
            return (
              <Pressable
                key={item.questionId}
                accessibilityRole="button"
                accessibilityLabel={s.gridCell(index + 1, answered, flagged, current)}
                onPress={() => onPick(index)}
                className={cn(
                  'h-12 w-12 items-center justify-center rounded-md border active:opacity-80',
                  answered ? 'border-primary bg-primary' : 'border-border bg-surface',
                  current && 'border-2 border-accent',
                )}
              >
                <Text
                  variant="bodyStrong"
                  tone="inherit"
                  className={answered ? 'text-on-primary' : 'text-fg'}
                >
                  {String(index + 1)}
                </Text>
                {flagged ? (
                  <View className="absolute right-0.5 top-0.5">
                    <Flag size={12} color={colors[answered ? 'on-primary' : 'fg']} />
                  </View>
                ) : null}
              </Pressable>
            );
          })}
        </View>
      </ScrollView>
      <Text variant="caption" tone="muted">
        {s.gridLegend}
      </Text>
      <Button label={s.submit} onPress={onSubmit} />
    </View>
  );
}
