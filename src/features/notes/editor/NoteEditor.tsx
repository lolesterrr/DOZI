import {
  BridgeExtension,
  PlaceholderBridge,
  RichText,
  useEditorBridge,
  type EditorBridge,
} from '@10play/tentap-editor';
import { Paths } from 'expo-file-system';
import { useEffect, useRef, useState } from 'react';
import { PixelRatio, Platform } from 'react-native';

import { strings } from '@/i18n/strings';
import { useTheme } from '@/theme';

import type { DocNode } from '../logic';
import {
  noteEditorBridges,
  type DividerEditorInstance,
  type MediaImageEditorInstance,
  type TableEditorInstance,
  type TableEditorState,
} from './bridges';
import { editorCss } from './css';
import { editorHtml } from './editorHtml';

/** TenTap's editor object plus the commands our own bridges add. */
export type NoteEditorBridge = EditorBridge &
  TableEditorInstance &
  DividerEditorInstance &
  MediaImageEditorInstance;

/** TenTap's editor state plus ours. */
export type NoteEditorState = ReturnType<EditorBridge['getEditorState']> &
  Partial<TableEditorState>;

const THEME_CSS_TAG = 'doziTheme';

/**
 * The note editor (TenTap = TipTap in a WebView) with our own WebView bundle (editor-web/).
 * `onChange` gets the whole document a moment after each change; the note screen saves it.
 */
export function useNoteEditor({
  initialContent,
  onChange,
}: {
  initialContent: DocNode;
  onChange: (doc: unknown) => void;
}): NoteEditorBridge {
  const { colors } = useTheme();
  const onChangeRef = useRef(onChange);
  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  // Built once: TenTap reads the bridge list when the WebView first loads. The ref is only read
  // later, when the WebView sends content, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [bridges] = useState(() => [
    ...noteEditorBridges((doc) => onChangeRef.current(doc)),
    PlaceholderBridge.configureExtension({ placeholder: strings.notes.bodyPlaceholder }),
    // Native-only: just carries the theme CSS into the WebView.
    new BridgeExtension({ forceName: THEME_CSS_TAG, extendCSS: editorCss(colors) }),
  ]);
  const [content] = useState(initialContent);

  const editor = useEditorBridge({
    customSource: editorHtml,
    bridgeExtensions: bridges,
    initialContent: content,
    avoidIosKeyboard: true,
    // Images load from the app's documents folder (media/<id>.jpg), relative to this URL.
    webviewBaseURL: documentsUrl(),
    theme: { webview: { backgroundColor: colors.background } },
  }) as NoteEditorBridge;

  // Follow light/dark mode changes after the editor has loaded.
  const css = editorCss(colors);
  // (TenTap returns a new editor object on every render, so only the CSS is a dependency.)
  useEffect(() => {
    editor.injectCSS(css, THEME_CSS_TAG);
  }, [css]); // eslint-disable-line react-hooks/exhaustive-deps

  return editor;
}

/** The editable page. Fills the space it is given. */
export function NoteEditorView({ editor }: { editor: NoteEditorBridge }) {
  return (
    <RichText
      editor={editor}
      // Lets the page show images from the app's own documents folder (not other apps' files).
      allowFileAccess
      // Android WebViews ignore the system font size; follow it like the rest of the app.
      textZoom={Platform.OS === 'android' ? Math.round(PixelRatio.getFontScale() * 100) : undefined}
      accessibilityLabel={strings.notes.bodyLabel}
    />
  );
}

function documentsUrl(): string {
  const uri = Paths.document.uri;
  return uri.endsWith('/') ? uri : `${uri}/`;
}
