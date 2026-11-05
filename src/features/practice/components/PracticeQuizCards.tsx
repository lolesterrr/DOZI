import { ClipboardList, Play, RotateCcw, Zap } from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import {
  Blob,
  BottomSheet,
  Button,
  Card,
  Chip,
  SectionTitle,
  Skeleton,
  Text,
} from '@/components/ui';
import { playDrill, playQuiz } from '@/features/quizzes/navigation';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { usePracticeSummary } from '../hooks';
import { MISTAKES_DRILL_SIZE, QUICK_QUIZ_SIZE, type RecentQuiz } from '../logic';
import type { PracticeSummary } from '../repo';

const s = strings.practice;

/** The Practice tab's quiz cards: quick quiz, "Fix my mistakes" and recent quizzes. */
export function PracticeQuizCards() {
  const summary = usePracticeSummary();
  if (!summary) return <Skeleton height={160} radius={16} />;
  return (
    <>
      <QuickQuizCard summary={summary} />
      <MistakesCard count={summary.mistakeCount} />
      <RecentQuizzes recent={summary.recent} />
    </>
  );
}

function QuickQuizCard({ summary }: { summary: PracticeSummary }) {
  const [choosing, setChoosing] = useState(false);
  const [picked, setPicked] = useState<string[]>([]);
  const hasQuestions = summary.questionCount > 0;

  const toggle = (id: string) =>
    setPicked((was) => (was.includes(id) ? was.filter((x) => x !== id) : [...was, id]));

  return (
    <Card layer="violet" className="gap-3">
      <View className="flex-row items-center gap-3">
        <Blob icon={Zap} tint="violet" size={52} index={1} />
        <Text variant="heading" className="flex-1">
          {s.quickTitle}
        </Text>
      </View>
      <Text tone="muted">{s.quickMessage(summary.questionCount, QUICK_QUIZ_SIZE)}</Text>
      {hasQuestions ? (
        <>
          <Button
            label={s.quickStart}
            icon={Play}
            onPress={() => playDrill({ kind: 'quick', quizIds: [] })}
          />
          {summary.quizzes.length > 1 ? (
            <Button label={s.quickChoose} variant="outline" onPress={() => setChoosing(true)} />
          ) : null}
        </>
      ) : null}

      <BottomSheet visible={choosing} onClose={() => setChoosing(false)} title={s.quickChooseTitle}>
        <Text tone="muted" className="pb-3">
          {s.quickChooseHint(QUICK_QUIZ_SIZE)}
        </Text>
        <ScrollView style={{ maxHeight: 320 }} contentContainerClassName="flex-row flex-wrap gap-2">
          {summary.quizzes.map((quiz) => (
            <Chip
              key={quiz.id}
              label={quiz.title}
              selected={picked.includes(quiz.id)}
              onPress={() => toggle(quiz.id)}
            />
          ))}
        </ScrollView>
        <View className="pt-4">
          <Button
            label={s.quickFromCount(picked.length)}
            icon={Play}
            disabled={picked.length === 0}
            onPress={() => {
              setChoosing(false);
              playDrill({ kind: 'quick', quizIds: picked });
            }}
          />
        </View>
      </BottomSheet>
    </Card>
  );
}

function MistakesCard({ count }: { count: number }) {
  return (
    <Card layer="coral" className="gap-3">
      <View className="flex-row items-center gap-3">
        <Blob icon={RotateCcw} tint="coral" size={52} index={2} />
        <Text variant="heading" className="flex-1">
          {s.mistakesTitle}
        </Text>
      </View>
      <Text tone="muted" accessibilityLiveRegion="polite">
        {s.mistakesMessage(count)}
      </Text>
      {count > 0 ? (
        <Button
          label={s.mistakesStart(count, MISTAKES_DRILL_SIZE)}
          icon={Play}
          onPress={() => playDrill({ kind: 'mistakes' })}
        />
      ) : null}
    </Card>
  );
}

function RecentQuizzes({ recent }: { recent: RecentQuiz[] }) {
  const { colors } = useTheme();
  return (
    <View className="gap-2">
      <SectionTitle title={s.recentTitle} />
      {recent.length === 0 ? (
        <Text tone="muted">{s.recentEmpty}</Text>
      ) : (
        <Card className="gap-1 py-2">
          {recent.map((quiz) => (
            <Pressable
              key={quiz.quizId}
              accessibilityRole="button"
              accessibilityLabel={s.recentStart(quiz.title)}
              onPress={() => playQuiz(quiz.quizId)}
              className="min-h-touch flex-row items-center gap-3 rounded-md px-1 py-2 active:bg-surface-muted"
            >
              <ClipboardList color={colors['fg-muted']} size={22} />
              <View className="flex-1">
                <Text variant="bodyStrong" numberOfLines={2}>
                  {quiz.title}
                </Text>
                <Text variant="small" tone="muted">
                  {`${s.quizQuestions(quiz.questionCount)} · ${
                    quiz.lastPercent === null ? s.recentNotTaken : s.recentLast(quiz.lastPercent)
                  }`}
                </Text>
              </View>
              <Text variant="bodyStrong" tone="primary">
                {s.start}
              </Text>
            </Pressable>
          ))}
        </Card>
      )}
    </View>
  );
}
