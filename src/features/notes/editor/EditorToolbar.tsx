import { useBridgeState } from '@10play/tentap-editor';
import {
  Bold,
  Heading1,
  Heading2,
  Highlighter,
  ImagePlus,
  Italic,
  List,
  ListChecks,
  ListOrdered,
  MessageSquareText,
  Redo2,
  SeparatorHorizontal,
  Table,
  TextQuote,
  Underline,
  Undo2,
  type LucideIcon,
} from 'lucide-react-native';
import { useState } from 'react';
import { Pressable, ScrollView, View } from 'react-native';

import { Chip, cn } from '@/components/ui';
import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import { calloutKinds } from '../callouts';
import { highlightColours } from './css';
import type { NoteEditorBridge, NoteEditorState } from './NoteEditor';

const s = strings.notes.toolbar;

export type EditorToolbarProps = {
  editor: NoteEditorBridge;
  onInsertImage: () => void;
};

type OpenRow = 'highlight' | 'callout' | null;

/**
 * The formatting bar under the note. A second row appears for highlight colours or callout
 * types when their button is pressed, and for table actions while the cursor is in a table. Every button has a spoken label and shows when it's on.
 */
export function EditorToolbar({ editor, onInsertImage }: EditorToolbarProps) {
  const state = useBridgeState(editor) as NoteEditorState;
  const [openRow, setOpenRow] = useState<OpenRow>(null);
  const toggleRow = (row: Exclude<OpenRow, null>) =>
    setOpenRow((open) => (open === row ? null : row));
  const headingLevel = (state as { headingLevel?: number }).headingLevel;
  const activeHighlight = (state as { activeHighlight?: string }).activeHighlight;
  const activeCallout = state.activeCallout ?? null;

  return (
    <View className="border-t border-border bg-surface">
      {openRow === 'highlight' ? (
        <ToolbarRow label={s.highlightRow}>
          {highlightColours.map((colour) => (
            <Chip
              key={colour}
              label={s.highlightColours[colour]}
              selected={activeHighlight === colour}
              onPress={() => {
                editor.toggleHighlight(colour);
                setOpenRow(null);
              }}
            />
          ))}
          <Chip
            label={s.noHighlight}
            onPress={() => {
              editor.unsetHighlight();
              setOpenRow(null);
            }}
          />
        </ToolbarRow>
      ) : openRow === 'callout' ? (
        <ToolbarRow label={s.calloutRow}>
          {calloutKinds.map((kind) => (
            <Chip
              key={kind}
              label={strings.notes.callouts[kind]}
              selected={activeCallout === kind}
              onPress={() => {
                editor.setCallout(kind);
                setOpenRow(null);
              }}
            />
          ))}
          {activeCallout ? (
            <Chip
              label={s.removeCallout}
              onPress={() => {
                editor.removeCallout();
                setOpenRow(null);
              }}
            />
          ) : null}
        </ToolbarRow>
      ) : state.isTableActive ? (
        <ToolbarRow label={s.tableRow}>
          <Chip label={s.table.addRow} onPress={() => editor.table('addRow')} />
          <Chip label={s.table.addColumn} onPress={() => editor.table('addColumn')} />
          <Chip label={s.table.deleteRow} onPress={() => editor.table('deleteRow')} />
          <Chip label={s.table.deleteColumn} onPress={() => editor.table('deleteColumn')} />
          <Chip label={s.table.delete} onPress={() => editor.table('delete')} />
        </ToolbarRow>
      ) : null}

      <ScrollView
        horizontal
        keyboardShouldPersistTaps="always"
        showsHorizontalScrollIndicator={false}
        accessibilityLabel={s.label}
        contentContainerClassName="items-center gap-0.5 px-2 py-1"
      >
        <ToolButton icon={Undo2} label={s.undo} disabled={!state.canUndo} onPress={editor.undo} />
        <ToolButton icon={Redo2} label={s.redo} disabled={!state.canRedo} onPress={editor.redo} />
        <Divider />
        <ToolButton
          icon={Heading1}
          label={s.heading1}
          active={headingLevel === 1}
          onPress={() => editor.toggleHeading(1)}
        />
        <ToolButton
          icon={Heading2}
          label={s.heading2}
          active={headingLevel === 2}
          onPress={() => editor.toggleHeading(2)}
        />
        <ToolButton
          icon={Bold}
          label={s.bold}
          active={state.isBoldActive}
          onPress={editor.toggleBold}
        />
        <ToolButton
          icon={Italic}
          label={s.italic}
          active={state.isItalicActive}
          onPress={editor.toggleItalic}
        />
        <ToolButton
          icon={Underline}
          label={s.underline}
          active={state.isUnderlineActive}
          onPress={editor.toggleUnderline}
        />
        <ToolButton
          icon={Highlighter}
          label={s.highlight}
          active={openRow === 'highlight' || !!activeHighlight}
          onPress={() => toggleRow('highlight')}
        />
        <Divider />
        <ToolButton
          icon={List}
          label={s.bulletList}
          active={state.isBulletListActive}
          onPress={editor.toggleBulletList}
        />
        <ToolButton
          icon={ListOrdered}
          label={s.numberedList}
          active={state.isOrderedListActive}
          onPress={editor.toggleOrderedList}
        />
        <ToolButton
          icon={ListChecks}
          label={s.checklist}
          active={state.isTaskListActive}
          onPress={editor.toggleTaskList}
        />
        <ToolButton
          icon={TextQuote}
          label={s.quote}
          active={state.isBlockquoteActive}
          onPress={editor.toggleBlockquote}
        />
        <ToolButton
          icon={MessageSquareText}
          label={s.callout}
          active={openRow === 'callout' || !!activeCallout}
          onPress={() => toggleRow('callout')}
        />
        <Divider />
        <ToolButton icon={ImagePlus} label={s.image} onPress={onInsertImage} />
        <ToolButton
          icon={Table}
          label={s.insertTable}
          active={state.isTableActive}
          onPress={() => editor.table('insert')}
        />
        <ToolButton icon={SeparatorHorizontal} label={s.divider} onPress={editor.insertDivider} />
      </ScrollView>
    </View>
  );
}

function ToolbarRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      accessibilityLabel={label}
      contentContainerClassName="items-center gap-2 px-3 py-2"
    >
      {children}
    </ScrollView>
  );
}

function ToolButton({
  icon: Icon,
  label,
  active = false,
  disabled = false,
  onPress,
}: {
  icon: LucideIcon;
  label: string;
  active?: boolean;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ selected: active, disabled }}
      disabled={disabled}
      onPress={() => onPress()}
      className={cn(
        'min-h-touch min-w-touch items-center justify-center rounded-md active:opacity-70',
        active && 'bg-primary-soft',
        disabled && 'opacity-40',
      )}
    >
      <Icon color={active ? colors['on-primary-soft'] : colors.fg} size={22} />
    </Pressable>
  );
}

function Divider() {
  return <View className="mx-1 h-6 w-px bg-border" />;
}
