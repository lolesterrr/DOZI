import { BridgeExtension, TenTapStartKit } from '@10play/tentap-editor';
import { Extension, Node, mergeAttributes, type Editor } from '@tiptap/core';
import { HorizontalRule } from '@tiptap/extension-horizontal-rule';
import { Image } from '@tiptap/extension-image';
import { Table, TableCell, TableHeader, TableRow } from '@tiptap/extension-table';
import { NodeSelection } from '@tiptap/pm/state';

import { MEDIA_DIR, mediaFileName, parseMediaRef } from '@/features/media/logic';

import { calloutKinds, isCalloutKind, type CalloutKind } from '../callouts';

// TenTap "bridges" for the note editor beyond TenTap's starter kit: tables, the divider,
// callouts, `media://` images and autosave messages. This file is used twice:
//  - in the app (React Native), where each bridge adds commands to the editor object, and
//  - inside the editor's WebView (editor-web/, built by `npm run editor:build`), where each
//    bridge adds its TipTap extension.
// Both sides find a bridge by its name, so they must share these definitions. After changing
// anything here, run `npm run editor:build` so the WebView gets the change too.

/**
 * When a whole block (an image, a divider) is selected, inserting would replace it. Put the
 * cursor in a new empty line just after it instead, so inserting never deletes anything.
 */
function leaveNodeSelection(editor: Editor) {
  const { selection } = editor.state;
  if (!(selection instanceof NodeSelection)) return;
  editor
    .chain()
    .insertContentAt(selection.to, { type: 'paragraph' })
    .setTextSelection(selection.to + 1)
    .run();
}

// ---------------------------------------------------------------------------------------------
// Tables

type TableAction = 'insert' | 'addRow' | 'addColumn' | 'deleteRow' | 'deleteColumn' | 'delete';

export type TableEditorState = { isTableActive: boolean };

export type TableEditorInstance = { table: (action: TableAction) => void };

type TableMessage = { type: 'dozi-table'; payload: TableAction };

function runTableAction(editor: Editor, action: TableAction) {
  if (action === 'insert') leaveNodeSelection(editor);
  const chain = editor.chain().focus();
  switch (action) {
    case 'insert':
      return chain.insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
    case 'addRow':
      return chain.addRowAfter().run();
    case 'addColumn':
      return chain.addColumnAfter().run();
    case 'deleteRow':
      return chain.deleteRow().run();
    case 'deleteColumn':
      return chain.deleteColumn().run();
    case 'delete':
      return chain.deleteTable().run();
  }
}

export const TableBridge = new BridgeExtension<TableEditorState, TableEditorInstance, TableMessage>(
  {
    tiptapExtension: Table.configure({ resizable: false }),
    tiptapExtensionDeps: [TableRow, TableHeader, TableCell],
    onBridgeMessage: (editor, message) => {
      if (message.type === 'dozi-table') runTableAction(editor, message.payload);
      return false;
    },
    extendEditorInstance: (sendBridgeMessage) => ({
      table: (action) => sendBridgeMessage({ type: 'dozi-table', payload: action }),
    }),
    extendEditorState: (editor) => ({ isTableActive: editor.isActive('table') }),
    extendCSS: `
      .tableWrapper { overflow-x: auto; margin: 1em 0; }
      table { border-collapse: collapse; table-layout: fixed; width: 100%; margin: 0; }
      td, th { min-width: 4em; border-width: 1px; border-style: solid; padding: 6px 8px;
        vertical-align: top; box-sizing: border-box; position: relative; }
      th { font-weight: 700; text-align: left; }
      td > p, th > p { margin: 0; }
      .selectedCell:after { content: ""; position: absolute; inset: 0; pointer-events: none;
        opacity: 0.25; }
    `,
  },
);

// ---------------------------------------------------------------------------------------------
// Divider (horizontal rule)

export type DividerEditorInstance = { insertDivider: () => void };

type DividerMessage = { type: 'dozi-divider' };

export const DividerBridge = new BridgeExtension<object, DividerEditorInstance, DividerMessage>({
  tiptapExtension: HorizontalRule,
  onBridgeMessage: (editor, message) => {
    if (message.type !== 'dozi-divider') return false;
    leaveNodeSelection(editor);
    editor.chain().focus().setHorizontalRule().run();
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => ({
    insertDivider: () => sendBridgeMessage({ type: 'dozi-divider' }),
  }),
  extendCSS: `
    hr { border: none; border-top-width: 2px; border-top-style: solid; margin: 1.5em 0; }
    hr.ProseMirror-selectednode { outline-width: 2px; outline-style: solid; }
  `,
});

// ---------------------------------------------------------------------------------------------
// Callouts (Exam tip · Mnemonic · Warning · Clinical pearl)

/**
 * A coloured box around one or more blocks, saved as `{ type: 'callout', attrs: { kind } }`.
 * Its label ("Exam tip"…) is drawn by the theme CSS (css.ts) from `data-callout`, so it follows
 * the app's strings and isn't part of the text.
 */
const CalloutNode = Node.create({
  name: 'callout',
  group: 'block',
  content: 'block+',
  defining: true,
  addAttributes() {
    return {
      kind: {
        default: calloutKinds[0],
        parseHTML: (element: HTMLElement) => {
          const kind = element.getAttribute('data-callout');
          return isCalloutKind(kind) ? kind : calloutKinds[0];
        },
        renderHTML: (attributes: Record<string, unknown>) => ({ 'data-callout': attributes.kind }),
      },
    };
  },
  parseHTML() {
    return [{ tag: 'div[data-callout]' }];
  },
  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { class: 'callout' }), 0];
  },
});

export type CalloutEditorState = { activeCallout: CalloutKind | null };

export type CalloutEditorInstance = {
  /** Puts the current block(s) in a callout of this kind, or changes the callout's kind. */
  setCallout: (kind: CalloutKind) => void;
  /** Takes the content out of the callout around the cursor (the content stays). */
  removeCallout: () => void;
};

type CalloutMessage = { type: 'dozi-callout'; payload: CalloutKind | null };

/** Where the callout around the cursor starts, or null when the cursor isn't in one. */
function calloutAround(editor: Editor): { pos: number; kind: unknown } | null {
  const { $from } = editor.state.selection;
  for (let depth = $from.depth; depth > 0; depth--) {
    const node = $from.node(depth);
    if (node.type.name === 'callout') return { pos: $from.before(depth), kind: node.attrs.kind };
  }
  return null;
}

function runCalloutAction(editor: Editor, kind: CalloutKind | null) {
  const around = calloutAround(editor);
  if (kind === null) {
    if (!around) return;
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(around.pos);
        if (!node) return false;
        tr.replaceWith(around.pos, around.pos + node.nodeSize, node.content);
        return true;
      })
      .run();
    return;
  }
  if (around) {
    editor
      .chain()
      .focus()
      .command(({ tr }) => {
        tr.setNodeAttribute(around.pos, 'kind', kind);
        return true;
      })
      .run();
    return;
  }
  leaveNodeSelection(editor);
  editor.chain().focus().wrapIn('callout', { kind }).run();
}

export const CalloutBridge = new BridgeExtension<
  CalloutEditorState,
  CalloutEditorInstance,
  CalloutMessage
>({
  tiptapExtension: CalloutNode,
  onBridgeMessage: (editor, message) => {
    if (message.type === 'dozi-callout') runCalloutAction(editor, message.payload);
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => ({
    setCallout: (kind) => sendBridgeMessage({ type: 'dozi-callout', payload: kind }),
    removeCallout: () => sendBridgeMessage({ type: 'dozi-callout', payload: null }),
  }),
  extendEditorState: (editor) => {
    const kind = calloutAround(editor)?.kind;
    return { activeCallout: isCalloutKind(kind) ? kind : null };
  },
  extendCSS: `
    .callout { border-left-width: 4px; border-left-style: solid; border-radius: 8px;
      margin: 0.75em 0; padding: 0.5em 0.85em; }
    .callout::before { display: block; font-weight: 700; font-size: 0.85em;
      letter-spacing: 0.02em; margin-bottom: 0.15em; }
    .callout > :first-child { margin-top: 0; }
    .callout > :last-child { margin-bottom: 0; }
  `,
});

// ---------------------------------------------------------------------------------------------
// Images stored as media://<id>

/**
 * TipTap's image node, but the saved `src` is a `media://<id>` reference (ARCHITECTURE §5).
 * When drawn, it points at the file in the media folder, relative to the WebView's base URL
 * (the app's documents folder). Copy and paste keep the reference in `data-media-ref`.
 */
const MediaImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      src: {
        default: null,
        parseHTML: (element: HTMLElement) =>
          element.getAttribute('data-media-ref') ?? element.getAttribute('src'),
        renderHTML: (attributes: Record<string, unknown>) => {
          const src = typeof attributes.src === 'string' ? attributes.src : '';
          const id = parseMediaRef(src);
          return id ? { src: `${MEDIA_DIR}/${mediaFileName(id)}`, 'data-media-ref': src } : { src };
        },
      },
    };
  },
}).configure({ inline: false, allowBase64: false });

export type MediaImageEditorInstance = { insertMediaImage: (ref: string) => void };

type MediaImageMessage = { type: 'dozi-insert-image'; payload: string };

/** Replaces the starter kit's image bridge (same name, so TenTap keeps this one). */
export const MediaImageBridge = new BridgeExtension<
  object,
  MediaImageEditorInstance,
  MediaImageMessage
>({
  tiptapExtension: MediaImage,
  onBridgeMessage: (editor, message) => {
    if (message.type === 'dozi-insert-image') {
      leaveNodeSelection(editor);
      // The empty paragraph after the image leaves the cursor somewhere to keep typing.
      editor
        .chain()
        .focus()
        .insertContent([{ type: 'image', attrs: { src: message.payload } }, { type: 'paragraph' }])
        .run();
    }
    return false;
  },
  extendEditorInstance: (sendBridgeMessage) => ({
    insertMediaImage: (ref) => sendBridgeMessage({ type: 'dozi-insert-image', payload: ref }),
  }),
  extendCSS: `
    img { display: block; height: auto; max-width: 100%; margin: 0.75em 0; border-radius: 8px; }
    img.ProseMirror-selectednode { outline-width: 3px; outline-style: solid; }
  `,
});

// ---------------------------------------------------------------------------------------------
// Autosave: the WebView sends the whole document a moment after each change

export const CONTENT_MESSAGE = 'dozi-content';

/** How long the WebView waits after a change before sending the document to the app. */
export const CONTENT_SEND_DELAY_MS = 300;

type ContentMessage = { type: typeof CONTENT_MESSAGE; payload: unknown };

type PostMessageWindow = { ReactNativeWebView?: { postMessage: (message: string) => void } };

const ContentSync = Extension.create({
  name: 'doziContentSync',
  addStorage() {
    return { timer: undefined as ReturnType<typeof setTimeout> | undefined };
  },
  onUpdate() {
    const storage = this.storage as { timer?: ReturnType<typeof setTimeout> };
    const editor = this.editor;
    if (storage.timer) clearTimeout(storage.timer);
    storage.timer = setTimeout(() => {
      storage.timer = undefined;
      const message: ContentMessage = { type: CONTENT_MESSAGE, payload: editor.getJSON() };
      (globalThis as PostMessageWindow).ReactNativeWebView?.postMessage(JSON.stringify(message));
    }, CONTENT_SEND_DELAY_MS);
  },
});

/** The app side passes `onContent`; the WebView side leaves it out. */
export function createContentSyncBridge(onContent?: (doc: unknown) => void) {
  return new BridgeExtension<object, object, ContentMessage>({
    tiptapExtension: ContentSync,
    onEditorMessage: (message) => {
      if (message.type !== CONTENT_MESSAGE) return false;
      onContent?.(message.payload);
      return true;
    },
  });
}

// ---------------------------------------------------------------------------------------------
// The full set

/** The starter-kit bridges the note editor uses (the image bridge is replaced above). */
export const starterBridges = TenTapStartKit.filter((bridge) => bridge.name !== 'image');

/** Every bridge that has a TipTap extension, in the order both sides register them. */
export function noteEditorBridges(onContent?: (doc: unknown) => void) {
  return [
    ...starterBridges,
    MediaImageBridge,
    TableBridge,
    DividerBridge,
    CalloutBridge,
    createContentSyncBridge(onContent),
  ];
}
