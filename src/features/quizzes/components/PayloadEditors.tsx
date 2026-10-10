import { Plus, Scissors, X } from 'lucide-react-native';
import { useRef, useState, type ReactNode } from 'react';
import { View } from 'react-native';

import { Button, Chip, IconButton, Input, Text, TextArea } from '@/components/ui';
import type { TextSelection } from '@/features/decks/logic';
import { strings } from '@/i18n/strings';

import {
  answersToLines,
  BLANKS_MAX,
  chooseSbaAnswer,
  emptyChoice,
  emptyMarkingPoint,
  emptyPair,
  emptyStatement,
  linesToAnswers,
  makeBlank,
  MAX_MARKING_POINTS,
  MAX_OPTIONS,
  MAX_PAIRS,
  MAX_STATEMENTS,
  nextItemId,
  syncBlanks,
} from '../logic';
import { optionLetter } from '../messages';
import {
  MARKING_POINT_MAX,
  MATCH_TEXT_MAX,
  MODEL_ANSWER_MAX,
  OPTION_TEXT_MAX,
  RATIONALE_MAX,
  type Blank,
  type Choice,
  type FillBlankPayload,
  type MarkingPoint,
  type Pair,
  type SaqPayload,
  type Statement,
} from '../types';

// The type-specific part of the question editor: options, statements, blanks, pairs, marking
// points. Each editor gets its list and hands back the changed list.

const s = strings.questions;

/** A bordered box for one option/statement/pair, with its label and a remove button. */
function ItemBox({
  label,
  removeLabel,
  onRemove,
  children,
}: {
  label: string;
  removeLabel: string;
  onRemove?: () => void;
  children: ReactNode;
}) {
  return (
    <View className="gap-2 rounded-lg border border-border bg-surface p-3">
      <View className="flex-row items-center">
        <Text variant="label" className="flex-1">
          {label}
        </Text>
        {onRemove ? (
          <IconButton icon={X} accessibilityLabel={removeLabel} onPress={onRemove} size={20} />
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SectionTitle({ title, help }: { title: string; help?: string }) {
  return (
    <View className="gap-1">
      <Text variant="subheading">{title}</Text>
      {help ? (
        <Text variant="small" tone="muted">
          {help}
        </Text>
      ) : null}
    </View>
  );
}

function replaceAt<T>(list: readonly T[], index: number, item: T): T[] {
  return list.map((current, i) => (i === index ? item : current));
}

// ---------------------------------------------------------------------------------------------
// SBA and multiple response

export function ChoicesEditor({
  single,
  options,
  onChange,
}: {
  /** SBA: exactly one correct option. */
  single: boolean;
  options: Choice[];
  onChange: (options: Choice[]) => void;
}) {
  const toggleCorrect = (index: number) => {
    const option = options[index];
    if (single) onChange(chooseSbaAnswer(options, option.id));
    else onChange(replaceAt(options, index, { ...option, correct: !option.correct }));
  };
  return (
    <View className="gap-3">
      <SectionTitle title={s.options} help={single ? s.sbaHelp : s.multipleHelp} />
      {options.map((option, index) => {
        const letter = optionLetter(index);
        return (
          <ItemBox
            key={option.id}
            label={s.optionLabel(letter)}
            removeLabel={s.removeOption(letter)}
            onRemove={
              options.length > 1 ? () => onChange(options.filter((_, i) => i !== index)) : undefined
            }
          >
            <Input
              label={s.optionLabel(letter)}
              placeholder={s.optionPlaceholder}
              maxLength={OPTION_TEXT_MAX}
              value={option.text}
              onChangeText={(text) => onChange(replaceAt(options, index, { ...option, text }))}
            />
            <Chip
              label={s.correct}
              selected={option.correct}
              accessibilityRole={single ? 'radio' : 'checkbox'}
              accessibilityLabel={s.markCorrect(letter)}
              accessibilityState={{ checked: option.correct, selected: option.correct }}
              onPress={() => toggleCorrect(index)}
            />
            <Input
              label={s.why}
              placeholder={s.whyPlaceholder}
              maxLength={RATIONALE_MAX}
              multiline
              value={option.why}
              onChangeText={(why) => onChange(replaceAt(options, index, { ...option, why }))}
            />
          </ItemBox>
        );
      })}
      <Button
        label={s.addOption}
        icon={Plus}
        variant="outline"
        disabled={options.length >= MAX_OPTIONS}
        onPress={() => onChange([...options, emptyChoice(nextItemId('o', options))])}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// MTF

export function StatementsEditor({
  statements,
  onChange,
}: {
  statements: Statement[];
  onChange: (statements: Statement[]) => void;
}) {
  return (
    <View className="gap-3">
      <SectionTitle title={s.statements} />
      {statements.map((statement, index) => (
        <ItemBox
          key={statement.id}
          label={s.statementLabel(index + 1)}
          removeLabel={s.removeStatement(index + 1)}
          onRemove={
            statements.length > 1
              ? () => onChange(statements.filter((_, i) => i !== index))
              : undefined
          }
        >
          <Input
            label={s.statementLabel(index + 1)}
            placeholder={s.statementPlaceholder}
            maxLength={OPTION_TEXT_MAX}
            multiline
            value={statement.text}
            onChangeText={(text) => onChange(replaceAt(statements, index, { ...statement, text }))}
          />
          <View className="flex-row gap-2" accessibilityRole="radiogroup">
            {[true, false].map((answer) => (
              <Chip
                key={String(answer)}
                label={answer ? s.true : s.false}
                selected={statement.answer === answer}
                accessibilityRole="radio"
                accessibilityLabel={`${s.statementLabel(index + 1)}: ${answer ? s.true : s.false}`}
                onPress={() => onChange(replaceAt(statements, index, { ...statement, answer }))}
              />
            ))}
          </View>
          <Input
            label={s.why}
            placeholder={s.whyPlaceholder}
            maxLength={RATIONALE_MAX}
            multiline
            value={statement.why}
            onChangeText={(why) => onChange(replaceAt(statements, index, { ...statement, why }))}
          />
        </ItemBox>
      ))}
      <Button
        label={s.addStatement}
        icon={Plus}
        variant="outline"
        disabled={statements.length >= MAX_STATEMENTS}
        onPress={() => onChange([...statements, emptyStatement(nextItemId('s', statements))])}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Fill in the blank

export function BlanksEditor({
  payload,
  onChange,
}: {
  payload: FillBlankPayload;
  onChange: (payload: FillBlankPayload) => void;
}) {
  // Where the cursor is (the button blanks the selection). `forced` is only set right after a
  // blank is made, to put the cursor after it.
  const selection = useRef<TextSelection>({ start: 0, end: 0 });
  const [forced, setForced] = useState<TextSelection | undefined>(undefined);
  // What is typed in each blank's answers box, kept as text so blank lines can be typed.
  const [answerText, setAnswerText] = useState<Record<string, string>>(() =>
    Object.fromEntries(payload.blanks.map((b) => [b.id, answersToLines(b.answers)])),
  );

  const blanks = syncBlanks(payload.text, payload.blanks);

  const setText = (text: string) => {
    setForced(undefined);
    // Blanks whose marker was deleted keep their answers until saving, so typing the marker
    // back brings them back. Saving drops them (`tidyQuestionDraft`).
    onChange({ text, blanks: payload.blanks });
  };

  const addBlank = () => {
    const result = makeBlank(payload.text, payload.blanks, selection.current);
    const added = result.blanks[result.blanks.length - 1];
    setAnswerText((current) => ({ ...current, [added.id]: answersToLines(added.answers) }));
    selection.current = result.selection;
    setForced(result.selection);
    onChange({ text: result.text, blanks: result.blanks });
  };

  const setAnswers = (blank: Blank, text: string) => {
    setAnswerText((current) => ({ ...current, [blank.id]: text }));
    const answers = linesToAnswers(text);
    const known = payload.blanks.some((b) => b.id === blank.id);
    onChange({
      text: payload.text,
      blanks: known
        ? payload.blanks.map((b) => (b.id === blank.id ? { id: b.id, answers } : b))
        : [...payload.blanks, { id: blank.id, answers }],
    });
  };

  return (
    <View className="gap-3">
      <TextArea
        label={s.blankText}
        placeholder={s.blankTextPlaceholder}
        minLines={4}
        value={payload.text}
        onChangeText={setText}
        selection={forced}
        onSelectionChange={(event) => {
          selection.current = event.nativeEvent.selection;
        }}
      />
      <View className="gap-2">
        <Button
          label={s.makeBlank}
          icon={Scissors}
          variant="secondary"
          accessibilityHint={s.makeBlankHint}
          disabled={blanks.length >= BLANKS_MAX}
          onPress={addBlank}
        />
        <Text variant="small" tone="muted">
          {s.blankHelp}
        </Text>
        <Text variant="label" accessibilityLiveRegion="polite">
          {s.blankCount(blanks.length)}
        </Text>
      </View>
      {blanks.map((blank) => (
        <TextArea
          key={blank.id}
          label={s.blankAnswers(blank.id)}
          hint={s.blankAnswersHint}
          placeholder={s.blankAnswersPlaceholder}
          minLines={2}
          autoCapitalize="none"
          value={answerText[blank.id] ?? answersToLines(blank.answers)}
          onChangeText={(text) => setAnswers(blank, text)}
        />
      ))}
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// Matching

export function PairsEditor({
  pairs,
  onChange,
}: {
  pairs: Pair[];
  onChange: (pairs: Pair[]) => void;
}) {
  return (
    <View className="gap-3">
      <SectionTitle title={s.pairs} help={s.matchingHelp} />
      {pairs.map((pair, index) => (
        <ItemBox
          key={pair.id}
          label={s.pairLabel(index + 1)}
          removeLabel={s.removePair(index + 1)}
          onRemove={
            pairs.length > 1 ? () => onChange(pairs.filter((_, i) => i !== index)) : undefined
          }
        >
          <Input
            label={s.left}
            placeholder={s.leftPlaceholder}
            maxLength={MATCH_TEXT_MAX}
            value={pair.left}
            onChangeText={(left) => onChange(replaceAt(pairs, index, { ...pair, left }))}
          />
          <Input
            label={s.right}
            placeholder={s.rightPlaceholder}
            maxLength={MATCH_TEXT_MAX}
            value={pair.right}
            onChangeText={(right) => onChange(replaceAt(pairs, index, { ...pair, right }))}
          />
        </ItemBox>
      ))}
      <Button
        label={s.addPair}
        icon={Plus}
        variant="outline"
        disabled={pairs.length >= MAX_PAIRS}
        onPress={() => onChange([...pairs, emptyPair(nextItemId('p', pairs))])}
      />
    </View>
  );
}

// ---------------------------------------------------------------------------------------------
// SAQ

export function SaqEditor({
  payload,
  onChange,
}: {
  payload: SaqPayload;
  onChange: (payload: SaqPayload) => void;
}) {
  const points = payload.marking_points;
  const setPoints = (marking_points: MarkingPoint[]) => onChange({ ...payload, marking_points });
  return (
    <View className="gap-3">
      <SectionTitle title={s.markingPoints} help={s.saqHelp} />
      {points.map((point, index) => (
        <View key={point.id} className="flex-row items-end gap-1">
          <View className="flex-1">
            <Input
              label={s.markingPointLabel(index + 1)}
              placeholder={s.markingPointPlaceholder}
              maxLength={MARKING_POINT_MAX}
              multiline
              value={point.text}
              onChangeText={(text) => setPoints(replaceAt(points, index, { ...point, text }))}
            />
          </View>
          {points.length > 1 ? (
            <IconButton
              icon={X}
              accessibilityLabel={s.removeMarkingPoint(index + 1)}
              onPress={() => setPoints(points.filter((_, i) => i !== index))}
            />
          ) : null}
        </View>
      ))}
      <Button
        label={s.addMarkingPoint}
        icon={Plus}
        variant="outline"
        disabled={points.length >= MAX_MARKING_POINTS}
        onPress={() => setPoints([...points, emptyMarkingPoint(nextItemId('m', points))])}
      />
      <TextArea
        label={s.modelAnswer}
        placeholder={s.modelAnswerPlaceholder}
        maxLength={MODEL_ANSWER_MAX}
        minLines={4}
        value={payload.model_answer}
        onChangeText={(model_answer) => onChange({ ...payload, model_answer })}
      />
    </View>
  );
}
