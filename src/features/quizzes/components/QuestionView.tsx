import {
  Check,
  Circle,
  CircleAlert,
  CircleCheck,
  CircleDot,
  CircleMinus,
  CircleX,
  Square,
  SquareCheck,
  type LucideIcon,
} from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { Pressable, View } from 'react-native';

import { BottomSheet, Button, cn, Input, Text, TextArea } from '@/components/ui';
import { CardFaceView } from '@/features/decks/components/CardFaceView';
import { plainFace } from '@/features/decks/logic';
import { Dozi, messageMood, pickMessage, type MascotContext } from '@/features/mascot';
import { strings } from '@/i18n/strings';
import { haptic } from '@/lib/haptics';
import { useTheme, type ColorName } from '@/theme';

import {
  blankIdsInText,
  formatPoints,
  parseBlankText,
  questionVerdict,
  scaleToPoints,
  scorable,
  scoreQuestion,
  setMatch,
  setStatementAnswer,
  toggleChoice,
  toggleMarkingPoint,
  type ItemResult,
  type PlayItem,
  type ScoreResult,
  type ScoringSettings,
} from '../logic';
import { optionLetter } from '../messages';
import {
  BLANK_ANSWER_MAX,
  MODEL_ANSWER_MAX,
  type FillBlankResponse,
  type MatchingResponse,
  type MtfResponse,
  type MultipleResponseResponse,
  type QuestionResponseValue,
  type SaqResponse,
  type SbaResponse,
} from '../types';

const a = strings.quizzes.answer;

export type QuestionStage = 'answering' | 'feedback';

export type QuestionViewProps = {
  item: PlayItem;
  response: QuestionResponseValue | null;
  /** answering: the student can change the answer · feedback: right answers and reasons shown. */
  stage: QuestionStage;
  settings: ScoringSettings;
  /**
   * Answering: every change. Feedback: only short answers use it, for ticking marking points
   * (leave it out to show a finished result).
   */
  onChange?: (response: QuestionResponseValue) => void;
  onImagePress?: (mediaId: string) => void;
  /** Feedback: Dozi reacts to the answer and the phone gives a small buzz (practice mode). */
  react?: boolean;
};

/**
 * One quiz question of any type: the stem, then the type's own answer controls. In feedback the
 * verdict, every option's result (icon + words, never colour alone), the reasons and the
 * explanation are shown. Used by the player (both modes) and the results review.
 */
export function QuestionView({
  item,
  response,
  stage,
  settings,
  onChange,
  onImagePress,
  react = false,
}: QuestionViewProps) {
  const { question } = item;
  const feedback = stage === 'feedback';
  const result = useMemo(
    () => (feedback ? scoreQuestion(scorable(question, response), settings) : null),
    [feedback, question, response, settings],
  );
  const change = (next: QuestionResponseValue) => onChange?.(next);
  const stem = plainFace(question.stem);

  return (
    <View className="gap-4">
      {stem.length > 0 ? <CardFaceView face={stem} onImagePress={onImagePress} /> : null}

      {result ? (
        <Verdict result={result} points={item.points} react={react ? item.questionId : null} />
      ) : null}

      {question.type === 'sba' || question.type === 'multiple_response' ? (
        <ChoiceList
          item={item}
          single={question.type === 'sba'}
          response={response as SbaResponse | MultipleResponseResponse | null}
          result={result}
          onToggle={(id) =>
            change(toggleChoice(question.type as 'sba' | 'multiple_response', response, id))
          }
        />
      ) : null}

      {question.type === 'mtf' ? (
        <MtfList
          statements={question.payload.statements}
          response={response as MtfResponse | null}
          result={result}
          onAnswer={(id, value) =>
            change(setStatementAnswer(response as MtfResponse | null, id, value))
          }
        />
      ) : null}

      {question.type === 'fill_blank' ? (
        <FillBlank
          text={question.payload.text}
          blanks={question.payload.blanks}
          response={response as FillBlankResponse | null}
          result={result}
          onType={(id, value) => {
            const current = (response as FillBlankResponse | null)?.blanks ?? {};
            change({ blanks: { ...current, [id]: value } });
          }}
        />
      ) : null}

      {question.type === 'matching' ? (
        <MatchingList
          item={item}
          response={response as MatchingResponse | null}
          result={result}
          onPick={(pairId, right) =>
            change(setMatch(response as MatchingResponse | null, pairId, right))
          }
        />
      ) : null}

      {question.type === 'saq' ? (
        <ShortAnswer
          points={question.payload.marking_points}
          modelAnswer={question.payload.model_answer}
          response={response as SaqResponse | null}
          result={result}
          canTick={feedback && !!onChange}
          onWrite={(text) => {
            const current = (response as SaqResponse | null) ?? {
              text: '',
              ticked: [],
              marked: false,
            };
            change({ ...current, text });
          }}
          onTick={(id) => change(toggleMarkingPoint(response as SaqResponse | null, id))}
        />
      ) : null}

      {feedback && (question.explanation.text.trim() || question.explanation.mediaIds.length) ? (
        <View className="gap-1.5 rounded-md bg-surface-muted p-3">
          <Text variant="label">{a.explanation}</Text>
          <CardFaceView face={plainFace(question.explanation)} onImagePress={onImagePress} />
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Results: the verdict and each item's mark

type Look = { icon: LucideIcon; box: string; text: string; colour: ColorName };

const looks: Record<Exclude<ItemResult, 'neutral'>, Look> = {
  right: {
    icon: CircleCheck,
    box: 'bg-success-soft',
    text: 'text-on-success-soft',
    colour: 'on-success-soft',
  },
  missed: {
    icon: CircleCheck,
    box: 'bg-success-soft',
    text: 'text-on-success-soft',
    colour: 'on-success-soft',
  },
  close: {
    icon: CircleAlert,
    box: 'bg-warning-soft',
    text: 'text-on-warning-soft',
    colour: 'on-warning-soft',
  },
  wrong: {
    icon: CircleX,
    box: 'bg-danger-soft',
    text: 'text-on-danger-soft',
    colour: 'on-danger-soft',
  },
  blank: {
    icon: CircleMinus,
    box: 'bg-surface-muted',
    text: 'text-fg',
    colour: 'fg-muted',
  },
};

function Verdict({
  result,
  points,
  react,
}: {
  result: ScoreResult;
  points: number;
  /** The question id when Dozi should react (it also seeds which line is used). */
  react: string | null;
}) {
  const { colors } = useTheme();
  const verdict = result.answered ? questionVerdict(result) : 'blank';
  const reaction: MascotContext | null =
    react === null || verdict === 'blank' ? null : verdict === 'wrong' ? 'wrong' : 'correct';
  useEffect(() => {
    if (reaction) haptic(reaction === 'correct' ? 'success' : 'warning');
  }, [reaction]);
  const look =
    verdict === 'right'
      ? looks.right
      : verdict === 'partial'
        ? looks.close
        : verdict === 'wrong'
          ? looks.wrong
          : looks.blank;
  const Icon = verdict === 'partial' ? CircleAlert : look.icon;
  const earned = scaleToPoints(result.score, result.max, points);
  const seed = [...(react ?? '')].reduce((sum, ch) => sum + ch.charCodeAt(0), 0);
  return (
    <View className="gap-2">
      <View
        accessibilityLiveRegion="polite"
        className={cn('flex-row items-center gap-2 rounded-md px-3 py-2', look.box)}
      >
        <Icon color={colors[look.colour]} size={22} />
        <Text variant="bodyStrong" tone="inherit" className={cn('flex-1', look.text)}>
          {a.verdicts[verdict]}
        </Text>
        <Text variant="small" tone="inherit" className={look.text}>
          {a.score(formatPoints(earned), formatPoints(points))}
        </Text>
      </View>
      {reaction ? (
        <View className="flex-row items-center gap-3" testID="dozi-reaction">
          <Dozi mood={messageMood(reaction)} size={48} />
          <Text variant="small" tone="muted" className="flex-1">
            {pickMessage(reaction, seed)}
          </Text>
        </View>
      ) : null}
    </View>
  );
}

/** A small result line under an item: icon plus words. */
function ItemMark({ kind, label }: { kind: Exclude<ItemResult, 'neutral'>; label?: string }) {
  const { colors } = useTheme();
  const look = looks[kind];
  const Icon = look.icon;
  return (
    <View className={cn('flex-row items-center gap-1.5 self-start rounded px-2 py-1', look.box)}>
      <Icon color={colors[look.colour]} size={16} />
      <Text variant="caption" tone="inherit" className={look.text}>
        {label ?? a.items[kind]}
      </Text>
    </View>
  );
}

function Why({ text }: { text: string }) {
  if (!text.trim()) return null;
  return (
    <Text variant="small" tone="muted">
      {text}
    </Text>
  );
}

// ---------------------------------------------------------------------------------------------
// SBA and multiple response

function ChoiceList({
  item,
  single,
  response,
  result,
  onToggle,
}: {
  item: PlayItem;
  single: boolean;
  response: SbaResponse | MultipleResponseResponse | null;
  result: ScoreResult | null;
  onToggle: (optionId: string) => void;
}) {
  const { colors } = useTheme();
  if (item.question.type !== 'sba' && item.question.type !== 'multiple_response') return null;
  const options = item.question.payload.options;
  const byId = new Map(options.map((o) => [o.id, o]));
  const order = item.optionOrder.length ? item.optionOrder : options.map((o) => o.id);
  const picked = new Set(
    single
      ? [(response as SbaResponse | null)?.choice].filter(Boolean)
      : ((response as MultipleResponseResponse | null)?.choices ?? []),
  );

  return (
    <View className="gap-2">
      <Text variant="small" tone="muted">
        {single ? a.chooseOne : a.chooseAll}
      </Text>
      {order.map((id, index) => {
        const option = byId.get(id);
        if (!option) return null;
        const letter = optionLetter(index);
        const isPicked = picked.has(id);
        const mark = result?.items[id];
        const Icon = single ? (isPicked ? CircleDot : Circle) : isPicked ? SquareCheck : Square;
        const body = (
          <>
            <View className="flex-row items-start gap-3">
              <Icon color={colors[isPicked ? 'primary' : 'fg-muted']} size={22} />
              <Text variant="body" className="flex-1">
                {`${letter}. ${option.text}`}
              </Text>
            </View>
            {mark && mark !== 'neutral' ? (
              <View className="gap-1 pl-9">
                <ItemMark kind={mark} />
                <Why text={option.why} />
              </View>
            ) : result && option.why.trim() ? (
              <View className="pl-9">
                <Why text={option.why} />
              </View>
            ) : null}
          </>
        );
        const box = cn(
          'gap-2 rounded-lg border px-3 py-3',
          isPicked ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
        );
        if (result) {
          return (
            <View
              key={id}
              className={box}
              accessible
              accessibilityLabel={a.option(letter, option.text)}
            >
              {body}
            </View>
          );
        }
        return (
          <Pressable
            key={id}
            accessibilityRole={single ? 'radio' : 'checkbox'}
            accessibilityState={{ checked: isPicked }}
            accessibilityLabel={a.option(letter, option.text)}
            onPress={() => onToggle(id)}
            className={cn('min-h-touch active:opacity-80', box)}
          >
            {body}
          </Pressable>
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// MTF

function MtfList({
  statements,
  response,
  result,
  onAnswer,
}: {
  statements: { id: string; text: string; answer: boolean; why: string }[];
  response: MtfResponse | null;
  result: ScoreResult | null;
  onAnswer: (statementId: string, answer: boolean) => void;
}) {
  const answers = response?.answers ?? {};
  const word = (value: boolean) => (value ? strings.questions.true : strings.questions.false);
  return (
    <View className="gap-2">
      {result ? null : (
        <Text variant="small" tone="muted">
          {a.mtfHint}
        </Text>
      )}
      {statements.map((statement, index) => {
        const n = index + 1;
        const given = answers[statement.id];
        const mark = result?.items[statement.id];
        return (
          <View key={statement.id} className="gap-2 rounded-lg border border-border bg-surface p-3">
            <Text variant="body">{`${n}. ${statement.text}`}</Text>
            {result ? (
              <View className="gap-1">
                {mark === 'right' ? (
                  <ItemMark kind="right" label={a.statementRight(word(given))} />
                ) : mark === 'wrong' ? (
                  <ItemMark
                    kind="wrong"
                    label={a.statementWrong(word(given), word(statement.answer))}
                  />
                ) : (
                  <ItemMark kind="blank" label={a.statementBlank(word(statement.answer))} />
                )}
                <Why text={statement.why} />
              </View>
            ) : (
              <View className="flex-row gap-2">
                <TrueFalseButton
                  label={strings.questions.true}
                  accessibilityLabel={a.markTrue(n)}
                  selected={given === true}
                  onPress={() => onAnswer(statement.id, true)}
                />
                <TrueFalseButton
                  label={strings.questions.false}
                  accessibilityLabel={a.markFalse(n)}
                  selected={given === false}
                  onPress={() => onAnswer(statement.id, false)}
                />
              </View>
            )}
          </View>
        );
      })}
    </View>
  );
}

function TrueFalseButton({
  label,
  accessibilityLabel,
  selected,
  onPress,
}: {
  label: string;
  accessibilityLabel: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ checked: selected }}
      onPress={onPress}
      className={cn(
        'min-h-touch flex-1 flex-row items-center justify-center gap-1.5 rounded-lg border px-3 active:opacity-80',
        selected ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
      )}
    >
      {selected ? <Check color={colors['on-primary-soft']} size={18} /> : null}
      <Text
        variant="label"
        tone="inherit"
        className={selected ? 'text-on-primary-soft' : 'text-fg'}
      >
        {label}
      </Text>
    </Pressable>
  );
}

// ---------------------------------------------------------------------------------------------
// Fill in the blank

function FillBlank({
  text,
  blanks,
  response,
  result,
  onType,
}: {
  text: string;
  blanks: { id: string; answers: string[] }[];
  response: FillBlankResponse | null;
  result: ScoreResult | null;
  onType: (blankId: string, value: string) => void;
}) {
  const order = blankIdsInText(text);
  const number = (id: string) => order.indexOf(id) + 1;
  const typed = response?.blanks ?? {};
  return (
    <View className="gap-3">
      <Text variant="body">
        {parseBlankText(text).map((part, i) =>
          part.type === 'text' ? (
            <Text key={i} variant="body" tone="inherit">
              {part.text}
            </Text>
          ) : (
            <Text
              key={i}
              variant="bodyStrong"
              tone="inherit"
              className="bg-primary-soft text-on-primary-soft"
            >
              {` ${a.blankMarker(number(part.id))} ___ `}
            </Text>
          ),
        )}
      </Text>
      {order.map((id) => {
        const blank = blanks.find((b) => b.id === id);
        if (!blank) return null;
        const value = typed[id] ?? '';
        const mark = result?.items[id];
        if (result) {
          return (
            <View key={id} className="gap-1 rounded-lg border border-border bg-surface p-3">
              <Text variant="label">{a.blankLabel(number(id))}</Text>
              {value.trim() ? <Text variant="body">{a.youTyped(value.trim())}</Text> : null}
              {mark && mark !== 'neutral' ? (
                <ItemMark kind={mark === 'missed' ? 'wrong' : mark} />
              ) : null}
              <Text variant="small" tone="muted">
                {a.accepted(blank.answers.join(' · '))}
              </Text>
            </View>
          );
        }
        return (
          <Input
            key={id}
            label={a.blankLabel(number(id))}
            placeholder={a.blankPlaceholder}
            value={value}
            onChangeText={(next) => onType(id, next)}
            autoCapitalize="none"
            autoCorrect={false}
            maxLength={BLANK_ANSWER_MAX}
          />
        );
      })}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Matching

function MatchingList({
  item,
  response,
  result,
  onPick,
}: {
  item: PlayItem;
  response: MatchingResponse | null;
  result: ScoreResult | null;
  onPick: (pairId: string, right: string | null) => void;
}) {
  const { colors } = useTheme();
  const [picking, setPicking] = useState<string | null>(null);
  if (item.question.type !== 'matching') return null;
  const pairs = item.question.payload.pairs;
  const matches = response?.matches ?? {};
  const pickingPair = pairs.find((p) => p.id === picking);

  return (
    <View className="gap-2">
      {result ? null : (
        <Text variant="small" tone="muted">
          {a.matchHint}
        </Text>
      )}
      {pairs.map((pair) => {
        const picked = matches[pair.id] ?? null;
        const mark = result?.items[pair.id];
        return (
          <View key={pair.id} className="gap-2 rounded-lg border border-border bg-surface p-3">
            <Text variant="bodyStrong">{pair.left}</Text>
            {result ? (
              <View className="gap-1">
                {picked ? <Text variant="body">{a.yourMatch(picked)}</Text> : null}
                {mark && mark !== 'neutral' ? (
                  <ItemMark kind={mark === 'missed' ? 'wrong' : mark} />
                ) : null}
                {mark !== 'right' ? (
                  <Text variant="small" tone="muted">
                    {a.correctMatch(pair.right)}
                  </Text>
                ) : null}
              </View>
            ) : (
              <Button
                label={picked ?? a.matchPick}
                variant={picked ? 'secondary' : 'outline'}
                accessibilityLabel={a.matchPickLabel(pair.left, picked)}
                onPress={() => setPicking(pair.id)}
                className="justify-start"
              />
            )}
          </View>
        );
      })}

      <BottomSheet
        visible={pickingPair !== undefined}
        onClose={() => setPicking(null)}
        title={pickingPair ? a.matchSheetTitle(pickingPair.left) : undefined}
      >
        <View className="gap-1 pb-2">
          {item.matchChoices.map((choice) => {
            const selected = pickingPair ? matches[pickingPair.id] === choice : false;
            return (
              <Pressable
                key={choice}
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                accessibilityLabel={choice}
                onPress={() => {
                  if (pickingPair) onPick(pickingPair.id, choice);
                  setPicking(null);
                }}
                className={cn(
                  'min-h-touch flex-row items-center gap-3 rounded-md px-2 py-3 active:bg-surface-muted',
                  selected && 'bg-primary-soft',
                )}
              >
                {selected ? (
                  <CircleDot color={colors.primary} size={22} />
                ) : (
                  <Circle color={colors['fg-muted']} size={22} />
                )}
                <Text variant="body" className="flex-1">
                  {choice}
                </Text>
              </Pressable>
            );
          })}
          {pickingPair && matches[pickingPair.id] ? (
            <Button
              label={a.matchClear}
              variant="ghost"
              onPress={() => {
                onPick(pickingPair.id, null);
                setPicking(null);
              }}
            />
          ) : null}
        </View>
      </BottomSheet>
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Short answer (self-marked)

function ShortAnswer({
  points,
  modelAnswer,
  response,
  result,
  canTick,
  onWrite,
  onTick,
}: {
  points: { id: string; text: string }[];
  modelAnswer: string;
  response: SaqResponse | null;
  result: ScoreResult | null;
  canTick: boolean;
  onWrite: (text: string) => void;
  onTick: (pointId: string) => void;
}) {
  const { colors } = useTheme();
  const text = response?.text ?? '';
  if (!result) {
    return (
      <TextArea
        label={a.saqLabel}
        placeholder={a.saqPlaceholder}
        value={text}
        onChangeText={onWrite}
        maxLength={MODEL_ANSWER_MAX}
        minLines={5}
        textAlignVertical="top"
      />
    );
  }
  const ticked = new Set(response?.ticked ?? []);
  return (
    <View className="gap-3">
      <View className="gap-1 rounded-lg border border-border bg-surface p-3">
        <Text variant="label">{a.saqYourAnswer}</Text>
        <Text variant="body" tone={text.trim() ? 'default' : 'muted'}>
          {text.trim() || a.saqNothingWritten}
        </Text>
      </View>
      <View className="gap-2">
        <Text variant="label">{a.saqMarkingPoints}</Text>
        {canTick ? (
          <Text variant="small" tone="muted">
            {a.saqTickHint}
          </Text>
        ) : null}
        {points.map((point) => {
          const isTicked = ticked.has(point.id);
          const Icon = isTicked ? SquareCheck : Square;
          const row = (
            <View className="flex-row items-start gap-3">
              <Icon color={colors[isTicked ? 'primary' : 'fg-muted']} size={22} />
              <View className="flex-1 gap-1">
                <Text variant="body">{point.text}</Text>
                {!canTick ? (
                  <ItemMark
                    kind={isTicked ? 'right' : 'blank'}
                    label={isTicked ? a.saqCovered : a.saqNotCovered}
                  />
                ) : null}
              </View>
            </View>
          );
          return canTick ? (
            <Pressable
              key={point.id}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: isTicked }}
              accessibilityLabel={a.tick(point.text)}
              onPress={() => onTick(point.id)}
              className={cn(
                'min-h-touch rounded-lg border px-3 py-3 active:opacity-80',
                isTicked ? 'border-primary bg-primary-soft' : 'border-border bg-surface',
              )}
            >
              {row}
            </Pressable>
          ) : (
            <View key={point.id} className="rounded-lg border border-border bg-surface px-3 py-3">
              {row}
            </View>
          );
        })}
      </View>
      {modelAnswer.trim() ? (
        <View className="gap-1 rounded-lg border border-border bg-surface p-3">
          <Text variant="label">{a.saqModelAnswer}</Text>
          <Text variant="body">{modelAnswer}</Text>
        </View>
      ) : null}
    </View>
  );
}
