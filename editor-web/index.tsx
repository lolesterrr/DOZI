import { useTenTap } from '@10play/tentap-editor/web';
import { EditorContent } from '@tiptap/react';
import { createRoot } from 'react-dom/client';

import { noteEditorBridges } from '@/features/notes/editor/bridges';

// The note editor that runs inside the WebView (TenTap's "advanced setup"). Built into one HTML
// string by `npm run editor:build` (editor-web/build.mjs) → src/features/notes/editor/editorHtml.ts.
// While bundling, `@10play/tentap-editor` (and `/web`) point at TenTap's web source, not its app code.

const bridges = noteEditorBridges();
// For debugging in Chrome's WebView inspector: which bridges this build knows.
window.doziBridgeNames = bridges.map((bridge) => bridge.name);

function Editor() {
  const editor = useTenTap({ bridges });
  return <EditorContent editor={editor} />;
}

declare global {
  interface Window {
    contentInjected: boolean | undefined;
    doziBridgeNames: string[];
  }
}

// On Android the app's settings (initial content, bridge list) can arrive after the page loads,
// so wait for them before starting the editor — the same check TenTap's own editor makes.
const wait = setInterval(() => {
  if (!window.contentInjected) return;
  clearInterval(wait);
  createRoot(document.getElementById('root')!).render(<Editor />);
}, 1);
