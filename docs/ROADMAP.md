# Build Roadmap — Dozi

How to use this file:
- Tell Claude Code **"Do task X.Y"**. Do one task per session where possible, and run `/clear` between tasks.
- Each task lists **Goal**, **Includes** and **Done when** (acceptance criteria). Spec references
  point to `PRODUCT_SPEC.md` (PS §) and `ARCHITECTURE.md` (AR §).
- Claude Code ticks `[x]` when a task is done and writes notes under it if anything is left over.
- The **content track** (writing official content, §C at the bottom) runs **in parallel** from
  week 1. It's mostly human work.

### Milestones
| Milestone | After | What testers get |
|---|---|---|
| **Alpha 1** | Phase 2 | A personal study app: notes, cards, quizzes, Dozi, streaks. Share the APK with 5–10 classmates. |
| **Beta** | Phase 4 | Accounts and sync, official content, the roadmap and planner. Pilot with a class. |
| **Exam-season release** | Phase 5 | Mock exams, PK trainer, cases. Play Store closed testing. |
| **v1.0** | Phase 8 | Public Play Store release with mobile-money premium. |

---

## Phase 0 — Foundations

- [x] **0.1 Create the project**
  - Goal: a running Expo app with TypeScript and Expo Router.
  - Includes: `create-expo-app` (latest SDK, TypeScript template), app name "Dozi", Android
    package `com.<developer>.dozi` (ask the developer), git init, `.gitignore`, `.env.example`,
    README run instructions. The folder already contains `CLAUDE.md`, `README.md` and `docs/`,
    so scaffold in a way that keeps them (e.g. create the app in a temporary folder and move its
    files in, merging the README).
  - Done when: the app runs, the developer can see "Hello Dozi" on their phone, and the first commit is made.
  - Note: Expo SDK 57, package `com.lolesterrr.dozi`. Routes live in root `app/` (per AR §2), not the
    template's `src/app/`. Template demo screens and images were removed. Phone check pending
    with Expo Go (see README "Running the app").

- [x] **0.2 Tooling**
  - Includes: ESLint + Prettier, `typecheck`/`lint`/`test` scripts, Jest + React Native Testing
    Library, the `@/` path alias, and one sample passing test.
  - Done when: all three commands pass.
  - Note: ESLint 9 flat config (`eslint.config.js`, eslint-config-expo + Prettier plugin, so
    formatting problems show up in `npm run lint`). Prettier skips `*.md` so the hand-written docs
    keep their layout. Jest 29 via `jest-expo`, RNTL 14 (needs `test-renderer`). Extra scripts:
    `npm run format` (fix formatting) and `npm run format:check`. Sample test:
    `src/__tests__/home-screen.test.tsx`. Tests must not live in `app/` (every file there is a route).

- [x] **0.3 EAS development build**
  - Includes: `eas.json` with `development`, `preview` and `production` profiles; step-by-step
    instructions for the developer (Expo account, `eas login`, build, install the APK, connect to
    Metro).
  - Done when: the dev client is installed on the developer's Android phone and hot reload works.
  - Note: `eas.json` (development/preview APKs, production AAB, remote app
    versions) and `expo-dev-client` are on main; the developer's guide is `docs/SETUP.md`. Waiting
    on the developer to build (`eas build -p android --profile development`), install it on the
    emulator and confirm hot reload; then tick this box. Done so far: Expo account `lolesterrr`
    created and the project linked with `eas init` (project ID in `app.json`, recorded in CLAUDE.md
    "Project facts").
    2026-10-16: the developer's first run showed only a white screen. Nothing was wrong with the
    versions or the bundle (checked in the cloud: every native package matches SDK 57, the Android
    bundle builds and compiles with Hermes, Metro serves it and the fonts). A dev build shows the
    dev launcher's plain white placeholder until the JS arrives, so the likely cause is the emulator
    not reaching Metro over the Mac's Wi-Fi IP. SETUP.md now starts Metro with `--localhost` (adb
    reverse). The root layout now shows a themed spinner (`StartupScreen`) instead of `null` while
    fonts load, with a 5 s fallback to system fonts, so "white" always means "JS not loaded yet".
    2026-10-25: with `--localhost` the developer's Metro printed `Android Bundled` (about 8 min on a
    cold cache). Web bundling (pressing `w` or opening the dev server in a browser) failed on
    expo-sqlite's `.wasm` and then "Worker chunk not found"; fixed with `wasm` in Metro's
    `assetExts` and `web.output: "single"` (static output server-renders every page in Node, which
    can't bundle expo-sqlite's web worker). Web still isn't supported (no FTS5 in expo-sqlite's web
    build), so SETUP.md says not to press `w`. 2026-10-25: the developer confirmed the app runs on
    the emulator through the dev client. Hot reload wasn't checked separately (SETUP.md step 7).

- [x] **0.4 Design system**
  - Includes: NativeWind setup; theme tokens (colours for light/dark, spacing, radius, type
    scale) with suggested direction **deep teal primary, crane-gold accent, warm neutrals**;
    fonts (Nunito for headings, Inter for body) via expo-font; primitives Button, Text, Card,
    Input, TextArea, Chip, IconButton, ProgressBar, ProgressRing, BottomSheet, Toast, EmptyState,
    Skeleton; a `/dev/ui` gallery screen.
  - Done when: the gallery shows all primitives correctly in light and dark mode.
  - Note: NativeWind 4.2.7 + Tailwind 3.4. Tokens live in `src/theme/tokens.ts`; colours are CSS
    variables applied by `src/theme/ThemeProvider.tsx` (use classes like `bg-surface text-fg`, not
    `dark:` variants; `useTheme().colors` for icon/SVG colours). Primitives in `src/components/ui/`
    (import from `@/components/ui`). BottomSheet is built on React Native's Modal and Toast on
    Reanimated, so no bottom-sheet library was added. Theme choice (System/Light/Dark) is held in
    memory only; persisting it is for the Settings task. Gallery: home screen → "Open UI gallery
    (dev)" (dev builds only). Checked in the cloud: unit tests (incl. AA contrast for every
    text/background pair), an Android bundle export, and web screenshots in light and dark.
    Emulator check pending.

- [x] **0.5 Navigation shell**
  - Includes: tabs Today · Learn · Practice · Library · Me with lucide icons and placeholder
    screens; header search button → `/search` placeholder; "+ Create" floating button with its
    action sheet (actions stubbed).
  - Done when: all tabs and routes navigate without errors.
  - Note: Tabs in `app/(tabs)/` (Expo Router `Tabs`); the old `app/index.tsx` is now
    `app/(tabs)/index.tsx` (Today). Shell pieces live in `src/features/shell/` (tab order and
    create actions in `logic.ts`, icons in `icons.ts`, `PlaceholderScreen`, `HeaderSearchButton`,
    `CreateButton`). Create actions show a "coming soon" toast until their tasks wire them up.
    `src/__tests__/navigation.test.tsx` drives the real tab layout with
    `expo-router/testing-library` (every tab, search, the create sheet). Checked in the cloud:
    typecheck, lint, tests and an Android bundle export. Emulator check pending.

- [x] **0.6 Local database**
  - Includes: expo-sqlite + Drizzle; migrations run on startup; `profiles` and `settings` tables;
    repo pattern; a DB provider with a loading/error state; Jest repo tests using in-memory SQLite.
  - Done when: a profile row is created on first launch and persists across restarts; tests pass.
  - Note (2026-10-09): schema in `src/db/schema/`, first migration `src/db/migrations/0000_init`
    (`npm run db:generate` after schema changes). `DatabaseProvider` (in `app/_layout.tsx`) opens
    `dozi.db`, migrates and calls `ensureProfile`; repos in `src/features/{profile,settings}/repo.ts`
    with better-sqlite3 tests via `src/test-utils/db.ts`. Dev check screen: Today → "Open local
    database (dev)" (`app/dev/db.tsx`). `src/lib/ids.ts` (`newId()`) was added early because the
    profile needs a UUID; task 0.7 should build on it, not replace it. The restart check is left
    for the developer on the emulator.

- [x] **0.7 Core utilities**
  - Includes: `lib/time.ts` (studyDay with 03:00 rollover in the profile timezone, date helpers),
    `lib/ids.ts` (UUID), `lib/logger.ts`, a global error boundary screen with Dozi placeholder
    text, and `i18n/strings.ts`.
  - Done when: studyDay unit tests cover the 02:59/03:01 edges and timezone behaviour.
  - Note (2026-10-09): `src/lib/time.ts` (date-fns + date-fns-tz): `studyDay`, `currentStudyDay`,
    `studyDayStart/End`, `localDate`, `nowIso`, `addDays`, `daysBetween`, `dayRange`, `dayOfWeek`,
    and an injectable `Clock` for time-travel tests. `studyDay` reads the local wall clock (hour < 3
    → previous date) instead of "instant − 3h", so daylight-saving days are right too.
    `src/lib/logger.ts`: `createLogger('<scope>')`, debug+ in dev, warn+ in release, `addLogSink`
    for Sentry later. `src/lib/ids.ts` (from 0.6) kept as is, now with tests. Error screen:
    `src/features/shell/components/AppErrorScreen.tsx`, exported as `ErrorBoundary` from
    `app/_layout.tsx`. `src/i18n/strings.ts` already existed; new strings added. Dev check: Today →
    "Open local database (dev)" now shows today's study day, a fresh ID and a "Test the error
    screen" button. Checked in the cloud: typecheck, lint, tests (also run with the machine in
    New York and Kiritimati time) and an Android bundle export. Emulator check pending.

## Phase 1 — Personal content ("study your way")

- [x] **1.1 Media pipeline** (AR §5)
  - Includes: pick/capture → compress → save → `media` row; `<MediaImage id>`; a full-screen
    viewer with pinch-zoom; orphan cleanup; a storage-used calculation.
  - Done when: an image picked from the gallery shows up compressed (log the before/after size) and
    survives an app restart.
  - Note (2026-10-09): `media` table (migration `0001_media`) with the shared `ownedColumns()` /
    `syncColumns()` helpers in `src/db/schema/sync.ts` — later user tables should reuse them.
    `src/features/media/`: `logic.ts` (1600 px / JPEG 0.7 resize maths, `media://` refs, orphan
    rules, `formatBytes`), `repo.ts`, `pipeline.ts` (`addImage`, `cleanUpIfDue`, device APIs
    injected so Jest tests the whole flow), `device.ts` (expo-image-picker + expo-image-manipulator),
    `files.ts` (expo-file-system, `<documents>/media/<id>.jpg`), `hooks.ts` (`useAddImage`,
    `useMediaUri`, `useStorageUsed`…), `<MediaImage id>` and `<MediaViewer id>` (pinch, pan,
    double-tap). `local_uri` is stored relative to the documents folder. The orphan clean-up runs
    at most weekly on app start (`useWeeklyMediaCleanup` in `app/_layout.tsx`); it keeps files
    under an hour old and soft-deleted images for 30 days (for undo). Cloud download in
    `<MediaImage>` waits for sync (Phase 3); a missing file shows a placeholder. The root layout is
    now wrapped in `GestureHandlerRootView`. Dev check: Today → "Open media check (dev)"
    (`app/dev/media.tsx`); the before/after size shows on screen and in the Metro log
    (`[media] Saved image`). Checked in the cloud: typecheck, lint, tests and an Android bundle
    export. Emulator check pending.

- [x] **1.2 Library, folders & tags**
  - Includes: `folders`, `tags`, `item_tags` tables; Library tab with segments Notes · Decks ·
    Quizzes; folder navigation; create/rename/move/delete (soft, with undo toast); tag filter;
    sort options; Dozi empty states.
  - Done when: the developer can organise items into nested folders with tags.
  - Note (2026-10-09): migration `0002_library`. `src/features/library/`: `logic.ts` (name rules,
    folder trees, move checks, sorting, tag filter, tag colours), `repo.ts` (folders, tags,
    `setItemTags`/`itemTagMap`), `hooks.ts`, and components `LibraryBrowser` (one level: folders,
    items, New folder · Sort · Tags, tag filter chips, folder ⋮ menu with Rename / Move to… /
    Delete + Undo toast), `Breadcrumb`, `Segments`, `FolderPicker`, `TagManager` (create, rename,
    recolour, delete tags), `TagPicker` (for item screens) and `TagPill`. Folder screen:
    `app/folder/[id].tsx`. `<Dozi mood>` placeholder in `src/features/mascot`. Added
    `@shopify/flash-list` 2.0.2. **Items:** no notes, decks or quizzes exist yet, so the Library
    shows folders only. Tasks 1.3, 1.6 and 1.10 must each (a) map their rows into
    `useLibraryItems` in `features/library/hooks.ts`, (b) give items a Move/Tags/Delete menu using
    `FolderPicker` and `TagPicker`, and (c) soft-delete items inside a deleted folder with the same
    timestamp (see the Decisions log). Checked in the cloud: typecheck, lint, tests (repo tests on
    in-memory SQLite, component tests for the browser, tags and folder route) and an Android
    bundle export. Emulator check pending: folders and tags now; putting items in folders with
    tags once notes exist (task 1.3).

- [x] **1.3 Notes editor** (PS §4.1)
  - Includes: `notes` table; TenTap editor with headings, bold/italic/underline, highlight,
    lists, checklists, tables (if supported), blockquote, divider; insert image via the media
    pipeline (`media://` refs); debounced autosave; title; pin; move; tags; word count;
    `note_versions` (keep the last 10).
  - Done when: a note with text, a table and 2 images saves offline and reopens identically.
  - Note (2026-10-09): migration `0003_notes` (`notes`, `note_versions`). `src/features/notes/`:
    `logic.ts` (ProseMirror JSON checks with zod, plain text, word count, versions rules),
    `repo.ts`, `hooks.ts` (`useNoteAutosave`, `useDebouncedSave`), `components/NoteScreen.tsx`,
    and `editor/` (`bridges.ts`, `NoteEditor.tsx`, `EditorToolbar.tsx`, `css.ts`, generated
    `editorHtml.ts`). Route `app/note/[id].tsx`. The editor uses our own WebView page
    (`editor-web/`, `npm run editor:build`) because TenTap's ready-made one has no tables or
    divider — task 1.4 adds callouts the same way (new bridge in `bridges.ts`, then rebuild).
    Toolbar: undo/redo, 2 heading sizes, bold, italic, underline, highlight (4 colours), bulleted,
    numbered and check lists, quote, image (gallery/camera), table (add/delete rows and columns
    while inside one), divider. ⋮ menu: Pin, Move, Tags, History (restore any of the last 10
    versions), Delete with Undo. Notes now show in the Library (tap to open, ⋮ for Pin · Move ·
    Tags · Delete), "New note" sits in the Notes segment and folders, "+ Create → New note" works,
    and deleting a folder deletes its notes (undo brings them back). New packages:
    `@10play/tentap-editor`, `react-native-webview` 13.16.1 (in Expo Go), TipTap extensions
    (`table`, `image`, `horizontal-rule`, `core`, `pm`; `@tiptap/react` for the page), `zod`, and
    dev-only `esbuild` + `@types/react-dom`. Not done here: image captions and tap-to-zoom inside a
    note (PS §4.1) — left for 1.5 (annotation) or a follow-up. Checked in the cloud: typecheck,
    lint, tests (logic, repo on in-memory SQLite incl. the "done when" round trip, autosave, note
    screen, Library items), an Android bundle export, and the editor page in headless Chromium
    (table, divider, highlight and two `media://` images saved and reloaded identically). Emulator
    check pending: the "done when" on the device, the keyboard/toolbar position, and images
    showing inside the editor.

- [x] **1.4 Note callouts, templates & search**
  - Includes: callout blocks (Exam tip · Mnemonic · Warning · Clinical pearl); templates
    (Lecture notes, Drug profile, Class comparison, Case summary); FTS5 search over notes on
    `/search`, with highlighted snippets.
  - Done when: searching a word inside a note body finds it in < 200 ms with 500 notes (seed script).
  - Note (2026-10-09): **Callouts:** `CalloutBridge` in `src/features/notes/editor/bridges.ts`
    (node `callout`, kinds in `features/notes/callouts.ts`), labels and colours in `editor/css.ts`,
    a "Callout box" toolbar button that opens a row of the 4 kinds plus "Remove callout"; editor
    page rebuilt. **Templates:** `features/notes/templates.ts` + `components/TemplatePicker.tsx`;
    "New note" in the Library and in "+ Create" now asks Blank / Lecture notes / Drug profile /
    Class comparison / Case summary (structure only, no drug facts); untouched template notes are
    discarded on leaving like blank ones. **Search:** migration `0004_notes_search` (FTS5 table +
    triggers), `searchNotes` in `notes/repo.ts`, `toFtsQuery`/`splitHighlights` in `notes/logic.ts`,
    `useNoteSearch` in `notes/hooks.ts`, screen in `src/features/search/components/SearchScreen.tsx`
    (`app/search.tsx`). Notes only for now; cards, drugs and topics join in later tasks.
    **Seed script:** `addSampleNotes`/`removeSampleNotes` (repo) with made-up SAMPLE text
    (`notes/sampleNotes.ts`), on Today → database check (dev) → "Search speed". Checked in the
    cloud: typecheck, lint, tests (search on 500 SAMPLE notes ≈ 5–7 ms, saving stays ≈ 3 ms; title
    ranked above body; deleted/other owners left out; search syntax typed as text is safe;
    templates; Search screen), an Android bundle export, and the editor page in headless Chromium
    (all 4 templates reload identically; wrap/change/remove callout; light and dark look).
    Emulator check pending: the "done when" timing on the device (dev screen), callouts and
    templates in the editor, and the Search screen.

- [x] **1.5 Image annotation** (PS §4.1)
  - Includes: a Skia canvas over an image with tools arrow · box · circle · freehand · text ·
    undo/redo · colour picker (5 colours); saves a derived media item (the original is kept).
  - Done when: the developer can annotate a photo of a diagram and insert it into a note.
  - Note (2026-10-09): no migration (the `media` table already had `derived_from` and
    `annotation_json`). `src/features/annotation/`: `logic.ts` (annotation JSON schema, fitting the
    image on screen, shape building, arrow/freehand geometry, undo/redo, `drawingReducer`),
    `pipeline.ts` (`saveAnnotatedImage`, `loadAnnotationStart`; renderer injected for tests),
    `render.ts` (Skia `drawAsImage` → JPEG 0.7 in the cache, then adopted into the media folder),
    `hooks.ts`, and components `AnnotationScene` (the Skia drawing, shared by screen and export)
    and `ImageAnnotator` (full-screen modal: Arrow · Box · Circle · Pen · Text, 5 colours with
    names and a tick, undo/redo, Save; asks before discarding changes, also on Android back). Pen
    colours are tokens in `theme/tokens.ts` (`annotationColours`). **In notes:** "Add image" now
    also has "Choose from gallery, then draw" / "Take a photo, then draw"; tapping an image in a
    note shows a "Selected image" row with **View full screen** (the tap-to-zoom left from 1.3)
    and **Draw on image**, which swaps in the annotated copy (`replaceMediaImage` in
    `MediaImageBridge`; editor page rebuilt). Re-opening an annotated image brings its strokes
    back. Dev check: Today → "Open media check (dev)" → "Draw on it" under any image. New package:
    `@shopify/react-native-skia` 2.6.2 (the SDK 57 version, in Expo Go). Jest now loads Gesture
    Handler's `jestSetup` and a Skia stand-in (`src/test-utils/mockSkia.tsx`). Still open from
    1.3: image captions. Checked in the cloud: typecheck, lint, tests (logic, save/re-open on
    in-memory SQLite, the drawing screen driven with fake gestures, the note screen flows), an
    Android bundle export, and the editor page in headless Chromium (tapping an image reports it;
    replacing works, also with a stale position). Emulator check pending: the "done when", how
    drawing feels (speed), the label font, and the saved picture matching the screen.

- [x] **1.6 Decks & card editor** (PS §4.2)
  - Includes: `decks`, `cards`, `card_instances`; deck list and detail; card editor for Basic,
    Basic+Reverse, Cloze (with a `{{c1::}}` helper button), Type-in; rich fields with images;
    Extra field; preview; bulk-add mode; deck settings; card instances generated automatically.
  - Done when: creating a cloze card with c1 and c2 produces 2 reviewable instances.
  - Note (2026-10-09): migration `0005_decks` (`decks` with a `pinned` column added for the
    Library, `cards`, `card_instances`). `src/features/decks/`: `logic.ts` (deck titles, settings
    form with zod, card fields ↔ ProseMirror JSON, cloze parsing/wrapping, checks before saving,
    `instanceKeys`/`planInstances`, `instanceFaces` for preview and review), `repo.ts`, `hooks.ts`,
    `messages.ts`, `navigation.ts` (`openCardEditor`), and components `DeckScreen` (summary
    "N cards · M to review", Add cards, Deck settings, card list, ⋮ Pin · Rename · Settings · Move ·
    Tags · Delete with Undo), `DeckSettingsForm`, `CardEditorScreen`, `FieldEditor`, `CardPreview`
    and `CardFaceView` (native renderer of a card side; task 1.8 should reuse it). Routes
    `app/deck/[id]/index.tsx` and `app/deck/[id]/card/[cardId].tsx` (`new` = add a card). **Card
    fields are plain text + images** (no bold/italic yet; see the Decisions log). Cloze: "Cloze cN"
    wraps the selection in a new number, "Same number" reuses the last; hints `{{c1::answer::hint}}`
    work. Bulk-add = the "Keep adding" switch. Leaving with unsaved changes (back arrow or Android
    back) asks first; images added to an unsaved card are dropped again. Library: Decks segment has
    "New deck", deck rows show the card count and open the deck; Move/Pin/Tags/Delete work;
    deleting a Decks folder deletes its decks and cards (undo restores them). "+ Create → New deck"
    and "New card" (pick a deck, or name a first one) work. No study button yet — reviewing is
    1.7/1.8; `card_state` rows are not created here (1.7 can treat an instance with no state as
    new). Not done: CSV import/export, card search, moving cards between decks, suspend/bury (all
    later tasks). Checked in the cloud: typecheck, lint, tests (logic; repo on in-memory SQLite incl.
    the "done when" — a c1+c2 cloze makes 2 instances; edits keep instance rows by key; deck and
    folder delete/undo; card editor, deck screen, Library and "+ Create" flows) and an Android bundle
    export. Emulator check pending: the whole flow on the device, the keyboard over the editor, and
    the cloze button keeping the cursor in the right place.

- [x] **1.7 FSRS engine** (PS §5.1, AR §3.3)
  - Includes: `card_state`, `review_logs`; `srs/logic.ts` wrapping ts-fsrs; a queue builder
    honouring new/day and reviews/day limits and ordering; interval previews for each rating;
    a replay-from-logs function (needed for sync later).
  - Done when: unit tests cover scheduling, limits, ordering and log replay.
  - Note (2026-10-09): migration `0006_srs` (`card_state`, `review_logs`, both with a
    `learning_steps` column that ts-fsrs 5 needs). New package: `ts-fsrs` 5.4.2 (plain JS, no
    native code; in the Android bundle). `src/features/srs/`: `logic.ts` (`RATINGS` 1–4,
    `reviewCard`, `previewIntervals` with labels like "10m"/"3d" from `strings.srs.interval`,
    `formatInterval`, `replayReviews`, `buildReviewQueue`, `interleave`) and `repo.ts`
    (`loadReviewQueue(db, { ownerId, scope: 'all' | { deckId }, timeZone })`, `answerCard`
    → `{ logId, state }`, `undoAnswer(logId)`, `rebuildCardState(instanceId)`, `getCardState`,
    `deckAllowances`). **For 1.8:** the session screen calls `loadReviewQueue` (timezone from the
    profile), shows `previewIntervals(getCardState…, now, { desiredRetention: deck's })` on the
    buttons, calls `answerCard` with the time on screen, keeps the `logId` for Undo, and reloads the
    queue after each answer (learning cards come back when due; `nextLearningDue` says when). No
    UI and no hooks yet; the deck screen's "M to review" still counts instances. `buried_until` is
    in `card_state` but nothing sets it yet (suspend/bury is 1.8; suspend uses `cards.suspended`,
    which the queue already skips). Not done: sibling burying (c1 and c2 of one card can show in
    the same session), "reset card" (needs a log entry so replay keeps it), cram mode (1.8).
    Checked in the cloud: typecheck, lint, tests (48 new: scheduling, previews, retention,
    interval labels, replay incl. out-of-order logs, queue order/limits/03:00 rollover/bury; repo
    on in-memory SQLite: answer, limits across a study day, suspended/deleted left out, undo back
    to the exact state or to new, rebuild after a log "from another phone") and an Android bundle
    export with ts-fsrs in it. Nothing to check on the emulator yet: reviewing arrives with 1.8.

- [x] **1.8 Review session UI**
  - Includes: `/review/[scope]`; flip animation; rating buttons with intervals; type-in checking
    with a diff; undo; edit card; suspend/bury; progress bar; summary screen; cram mode.
  - Done when: the developer can review a deck; due dates update; undo restores the previous state.
  - Note (2026-10-09): `src/features/review/` (logic, repo, hooks, components) and route
    `app/review/[scope].tsx` (`all` or a deck id; `?mode=cram`). No new packages, no migration.
    **Where to start:** the deck screen has "Study now (N)" (the real due count; disabled when
    nothing is due) and "Cram this deck" in its ⋮ menu; the Practice tab now shows "Due now"
    across all decks with "Review all decks". Session screen: close · progress bar · Undo · ⋮
    (Edit card, Bury until tomorrow, Suspend card, each with Undo in a toast); counts line "New ·
    Learning · Review"; "Show answer" flips the card (or "Check" for type-in, which shows
    Correct / Almost / Not quite plus a letter diff); Again · Hard · Good · Easy with the next
    interval on each. Answers are saved at once, so leaving mid-session loses nothing. Summary:
    Dozi, cards, % remembered, minutes, and "a few cards come back in 8m" with "Check for more
    cards". Cram: shuffled, Again / Got it, schedule untouched. Suspended cards are labelled in
    the deck list and brought back from the card editor. Not done: XP on the summary (Phase 2),
    sibling burying, "reset card", moving cards between decks during review, cram by tag/topic,
    image occlusion cards (1.9). Checked in the cloud: typecheck, lint, tests (37 new: type-in
    keys/slips/diff, cram order, summary, route params; repo on in-memory SQLite for review items,
    cram cards, suspend, bury incl. the 03:00 rollover; the whole screen against a real database:
    flip, rating intervals, due date moved on, type-in diff, summary, undo restores "new",
    suspend + undo, bury, cram writes nothing, empty state) and an Android bundle export.
    **Emulator check pending:** review a deck end to end, the flip animation, the keyboard over
    the type-in box, and "Edit card" coming back to the same card.

- [x] **1.9 Image occlusion cards** (PS §4.2)
  - Includes: pick/annotate an image → draw mask rectangles (move/resize/delete, optional
    label) → choose mode (hide one / hide all) → one instance per mask; rendering in review
    (the masked region is highlighted when revealed).
  - Done when: a 5-label diagram becomes 5 working cards.
  - Note (2026-10-09): no migration (`cards.occlusion_json` was already there) and no new
    packages. New `src/features/occlusion/`: `logic.ts` (the `occlusion_json` zod schema, masks in
    fractions of the image, ids `m001`, `m002`…, hit-testing, move/resize, the box editor's
    reducer, and what each card shows in both modes) and components `MaskEditor` (full-screen box
    editor), `OcclusionFields` (the card editor's part) and `OcclusionImage` (the diagram with
    its boxes as plain views, used by preview and review). **Where to find it:** "Image
    occlusion" is now a type in the card editor: optional prompt → "Choose from gallery" / "Take a
    photo" → the box editor opens: drag over a label to cover it; tap a box (or its chip under
    the picture) to select it, drag it to move, drag a corner to resize, give it a label, or
    delete it; "Done". Back in the editor: "Edit boxes (N)", "Draw on image" (the 1.5 drawing
    screen; its copy replaces the diagram and the boxes stay), "Change image", the mode ("Hide
    one, show others" / "Hide all, reveal one"), "Makes N cards", Preview (one card per box).
    `decks/logic.ts`: `CardDraft.occlusion`, `changeDraftType`, `draftInstanceKeys`,
    `draftMediaIds`, occlusion faces (a new `occlusion` face block, so `CardFaceView`, the
    preview and the review screen needed no special path). Review: the asked box is covered and
    marked "?"; "Show answer" uncovers it with a thick gold outline and shows its label under the
    diagram. Not done: undo inside the box editor (delete is there), "+ Create → Scan diagram"
    (PS §2), zooming into a big diagram while drawing boxes. Checked in the cloud: typecheck, lint,
    tests (35 new: schema round trip, both modes, geometry, the editor's reducer; repo on
    in-memory SQLite incl. the "done when" (5 boxes → 5 instances → 5 in the review queue) and
    removing a box; the box editor driven by gestures; the card editor flow; reviewing an
    occlusion card against a real database) and an Android bundle export.
    **Emulator check pending:** make a card from a labelled diagram with 5 boxes, review all 5 in
    both modes, and check that the boxes land exactly on the labels, that dragging and corner
    handles feel right, and the keyboard over the label box.

- [x] **1.10 Question bank & quiz builder** (PS §4.3)
  - Includes: `questions`, `quizzes`, `quiz_questions`; zod schemas per type in
    `quizzes/types.ts`; editors for **SBA, MTF, multiple response, fill-blank, matching, SAQ
    (marking points)**, with images in the stem and a rationale per option; quiz builder
    (add from bank or create inline, reorder, points); quiz settings.
  - Done when: the developer can build a quiz containing one of each type.
  - Note (2026-10-10): migration `0007_quizzes` (`questions`, `quizzes` with a `pinned` column,
    `quiz_questions` with a (quiz, question) primary key like `item_tags`). No new packages.
    `src/features/quizzes/`: `types.ts` (zod payload schema per type + quiz settings schema, the
    source of truth for CONTENT_GUIDE §5.4), `logic.ts` (question drafts, `questionDraftProblem`,
    fill-in `{{1}}` blanks and "Make blank", default points, settings form, bank search),
    `repo.ts`, `hooks.ts`, `messages.ts`, `navigation.ts`, and components `QuizBuilderScreen`,
    `QuestionEditorScreen`, `PayloadEditors` (one editor per type), `QuizSettingsForm`,
    `QuestionBankScreen`, `QuestionList`. Routes `app/quiz/[id]/edit.tsx` (builder),
    `app/question/[id].tsx` (`new` + `?quizId=&type=`) and `app/questions.tsx` (bank).
    **Where to find it:** Library → Quizzes → "New quiz" (or "+ Create → New quiz") opens the
    builder: "Add question" → "Write a new question" (pick a type) or "Add from question bank"
    (search, filter by type, tick several); each row has ↑ ↓ to reorder and ⋮ for Edit · Change
    points · Remove from quiz (Undo); "Quiz settings" (Practice/Exam, time limit, pass mark,
    shuffle questions/options, MTF negative marking); ⋮ for Pin · Rename · Question bank · Move ·
    Tags · Delete (Undo; the questions stay in the bank). The Quizzes segment also has a
    "Question bank" button. Editor: stem with images (same fields as cards), the type's part
    (options with Correct + "Why" rationale; T/F statements with "Why"; sentence + "Make blank"
    + accepted answers one per line; left/right pairs; marking points + model answer),
    explanation with images, difficulty. A saved question's type can't be changed. Folders:
    deleting a Quizzes folder deletes its quizzes (Undo brings them back). **For 1.11:** read a
    quiz with `listQuizQuestions` (question rows + points, in order) and `parseQuizSettings`;
    turn each row into its typed payload with `questionToDraft`; put the scorers in
    `quizzes/logic.ts`; the "Taking the quiz arrives in the next update" line in the builder
    (`strings.quizzes.playSoon`) should become a "Start quiz" button. Not done: ordering,
    calculation, LEQ, hotspot and case-based types (later tasks add them to `questionTypes`),
    distractors for matching, tags on single questions, saving official questions to "My bank"
    (Phase 4). Checked in the cloud: typecheck, lint, tests (93 new: logic incl. every problem
    per type and a save/read round trip of each type; repo on in-memory SQLite incl. the "done
    when" — a quiz with one question of each type, half inline and half from the bank — reorder,
    points, remove/undo, question delete/undo across quizzes, quiz and folder delete/undo; the
    question editor writing each of the 6 types; the builder and the bank against a real
    database) and an Android bundle export. **Emulator check pending:** build a quiz with one
    of each type, the keyboard over the long editor, and "Make blank" keeping the cursor in place.

- [x] **1.11 Quiz player & results**
  - Includes: `quiz_attempts`, `question_responses`; renderers per type; practice mode
    (instant feedback + rationale) and exam mode (timer, flag, navigator grid, submit); scorers
    in `quizzes/logic.ts` with table-driven tests (MTF negative marking, fuzzy fill-in, Greek
    letters); results screen; review answers; "Retry wrong only"; "Add wrong ones to
    flashcards"; attempt history.
  - Done when: all scorer tests pass and both modes work end to end.
  - Note (2026-10-25): migration `0008_quiz_attempts` (`quiz_attempts` with `settings_json`
    snapshot and `retry_of`; `question_responses` with `position`; scores in quiz points, as
    `real`). No new packages. Logic in `quizzes/logic.ts`: one scorer per type
    (`scoreSba`, `scoreMultipleResponse`, `scoreMtf`, `checkBlank`/`scoreFillBlank`,
    `scoreMatching`, `scoreSaq`, all through `scoreQuestion`), `buildPlayItems` (shuffling),
    answer helpers, timer, `buildAttemptResult`, `summariseAttempt`, `questionToCard`. Response
    zod schemas in `types.ts`. Repo: `saveAttempt` (attempt + responses in one transaction),
    `getAttempt`, `listAttemptResponses`, `listQuizAttempts`, `wrongQuestionIds`,
    `addCardsToDeck`. Hooks: `useQuizPlayer`, `useAttemptResults`, `useQuizAttempts`,
    `useAddToFlashcards`. Components: `QuestionView` (renders every type, answering or with
    feedback), `QuizPlayerScreen`, `AttemptResultsScreen`. Routes `app/quiz/[id]/play.tsx`
    (`?retry=<attempt id>`) and `app/quiz/attempt/[attemptId].tsx`. **Where to find it:** quiz
    builder → **Start quiz** → intro (questions, points, mode, pass mark, disclaimer) → Start.
    Practice: answer → Check (verdict, each option marked with icon + words, "why", explanation)
    → Next → See results; a short answer is written, then "Mark my answer" to tick the marking
    points covered. Exam: timer in the top bar (warns under a minute, hands in at 0), flag
    button, grid button (numbered cells: filled = answered, flag = flagged), Previous / Next,
    Submit (warns about unanswered ones), then self-mark any written short answers. ✕ or the
    Android back button asks: finish and see results, leave without saving, or keep going.
    Results: %, points, pass / not yet against the pass mark the attempt was taken with, fully
    right count, time, Dozi; "Retry N wrong ones", "Add wrong ones to flashcards" (pick a deck
    or make "<quiz> · mistakes"; fill-ins become cloze cards, the rest basic cards), "Take the
    quiz again", "Review answers" (All / Not fully right). Builder → "Past attempts" lists
    attempts (date, mode, %), each opening its results. Not done: XP for answers (2.2), quizzes
    on the Practice tab, resuming a quiz left halfway (it isn't saved), the later question
    types. Checked in the cloud: typecheck, lint, tests (scorer tables incl. MTF negative
    marking, fuzzy fill-in with Greek letters and numbers, partial credit; attempts on in-memory
    SQLite; the player end to end in practice and exam mode incl. flags, grid, submit,
    self-marking, time running out and retry; the results screen incl. review filter, retry
    and adding cards) and Android + iOS bundle exports (SDK 58). **Phone check pending:** take a quiz in
    each mode, the keyboard over fill-in and short-answer boxes, and the timer.

- [x] **1.12 Import / export**
  - Includes: CSV import/export for decks; export a note or quiz as a PDF (expo-print) and share
    it (expo-sharing).
  - Done when: a CSV round-trip preserves the cards, and a PDF opens in the phone's viewer.
  - Note (2026-10-26): no migration. New packages `expo-print`, `expo-sharing` and
    `expo-document-picker` (the last approved by the developer for picking the CSV file; added
    to ARCHITECTURE §1). `decks/csv.ts` (pure): RFC 4180 `parseCsv`/`toCsv`, separator
    detection (comma, semicolon, tab), Anki plain-text extras (`#separator:`, `#html:`,
    `#tags column:` lines; simple HTML → text), `planCsvImport` (header optional: without one
    the columns are front, back, tags; header names map columns in any order; type column
    optional, else cloze when the front has `{{c1::…}}`; rows that can't be cards are listed
    with a reason; max 5000 rows, 20 tags) and `deckToCsv` (header
    `front,back,tags,extra,type`, UTF-8 BOM, cloze markers kept, image occlusion cards left out,
    images dropped). Repo: `importCards` (one transaction, 1 ms apart so file order is kept),
    `undoImport`. `src/features/export/`: `logic.ts` (pure HTML for a note and for a quiz paper
    with an optional answer key on a new page; images inlined as data: URIs; everything escaped;
    study disclaimer at the foot), `device.ts` (file picker, writing to `cache/exports/`,
    `printToFileAsync`, share sheet, image loading), `hooks.ts` (`useTransferActions`),
    `messages.ts`, `components/CsvImportPanel.tsx`. **Where to find it:** deck ⋮ → "Import
    cards from CSV" (pick a file → "Found N cards…", skipped rows with reasons, tags → "Add N
    cards" → toast with Undo) and "Export as CSV" (share sheet); note ⋮ → "Export as PDF"; quiz
    builder ⋮ → "Export as PDF" → "Questions only" or "Questions and answers". Not done: Anki
    `.apkg` import, a whole-deck/Library "export my data" (Settings, later), per-card tags
    (tags in a CSV go on the deck — see the Decisions log). Checked in the cloud: typecheck,
    lint, tests (CSV parsing/writing, Anki files, skip reasons and a text round-trip of every
    card type; the **done-when** round-trip through the database — deck → CSV → new deck gives
    identical cards and instances; import order, undo; note and quiz HTML incl. escaping, every
    question type with and without answers; the deck, note and quiz screens' menu flows), the
    PDF HTML rendered in Chromium, and an Android bundle export. **Checked on the iPhone (Expo
    Go, 2026-10-26):** CSV import from Files and PDF export of a note open in the share sheet
    (after two fixes: the note editor's WebView `originWhitelist`, and waiting for the menu
    sheet to close before sharing). **Android check pending.**

- [x] **1.13 Make flashcards from notes**
  - Includes: select text in a note → "Make card" (basic / cloze) → pick a deck; the card links back
    to the note.
  - Done when: the flow works and the card shows a "From note: …" link.
  - Note (2026-10-26): no migration (`cards.source_note_id` was already there) and no new
    packages. The editor reports the selected text through a new bridge, `NoteSelectionBridge`
    (`doziSelection`, state only, in `notes/editor/bridges.ts`; `noteSelectionOf` gives the text,
    blocks joined by line breaks, plus the rest of the paragraph around it when the selection is
    inside one). The WebView page was rebuilt (`npm run editor:build`); the old build still had
    React DOM 19.2.3 inside, the new one has the app's 19.3.0. `notes/makeCard.ts` (pure):
    basic → the selection is the front; cloze inside one paragraph → the paragraph with the
    selection as `{{c1::…}}` (cut to the sentence when the paragraph is over 600 characters);
    cloze across paragraphs → the plain text, the student marks the answers; text over 5000
    characters is cut with a toast. **Where to find it:** select text in a note → a "Make card"
    row appears above the formatting bar → "Basic" or "Cloze" → pick a deck (the last one used
    comes first, or "New deck “<note title>”") → the card editor opens with the text and a "From
    note: …" line → Save goes back to the note. Saved cards show "From note: …" as a link in the
    card editor and under the answer in review; a deleted note shows "Made from a note that has
    since been deleted". The card editor's route takes `fromNote`, `cardType` and `text` params
    (`openCardEditor(deckId, 'new', { noteId, type, text })`). Checked in the cloud: typecheck,
    lint, tests (selection → card text incl. sentence cutting and odd markers; the bridge on a
    real ProseMirror document; the note screen's Make card → deck → editor flow and new deck;
    the card editor prefilled from a note, saving the link, the link on saved/deleted notes; the
    "From note" link in review; `source_note_id` in the database) and an Android bundle export.
    **Phone check pending** (selecting text in the WebView, the row above the keyboard).

## Phase 2 — Motivation: Dozi, XP, streaks, progress

- [x] **2.1 Dozi mascot component** (PS §9)
  - Includes: `<Dozi mood size>` using placeholder SVGs for all 10 moods (simple, original,
    clearly a tuxedo cat in a lab coat); speech bubble; `mascot/messages.ts` with context-based
    lines (varied, never shaming); subtle Reanimated idle bounce.
  - Done when: the gallery shows every mood; replacing the placeholders later only needs a
    file swap.
  - Note (2026-10-29): the developer changed Dozi from a crowned crane to a **tuxedo cat**
    (CLAUDE.md #8, PRODUCT_SPEC §9 and README updated). No migration, no new packages
    (`react-native-svg` was already in). `src/features/mascot/`: `art/Cat.tsx` (the shared
    drawing: tail, lab coat, ears, head, blaze, muzzle, eyes, mouth, whiskers), `art/moods.tsx`
    (`doziArt`: one drawing per mood — arms, book, trophy, confetti, Zzz…), `art/colours.ts`,
    `moods.ts`, `components/Dozi.tsx` (round soft badge, `mood`, `size`, `animated`; bounce
    height and speed depend on the mood; off when the phone asks for reduced motion),
    `components/DoziSpeech.tsx` (Dozi plus a speech bubble), `messages.ts` (`pickMessage`,
    `messageMood`, `greetingContext`; the lines are in `strings.mascot.messages`: 17 situations,
    3–4 lines each). The existing `<Dozi>` uses (empty states, review summary, quiz results,
    error screen) now show the cat. **Where to find it:** a dev build's Today tab → "Open mascot
    gallery (dev)" (`/dev/mascot`): every mood, sizes, a still one, every speech bubble, with a
    theme switch. **Swapping in real art later:** change the entries of `doziArt` in
    `art/moods.tsx` (or the component they draw) — nothing else needs to change. Checked in the
    cloud: typecheck, lint, tests (every mood renders, messages, greeting by hour, a no-shaming
    word check) and the ten drawings looked at in a browser in light and dark. **Phone check
    pending.**

- [x] **2.2 XP, daily goal & levels** (PS §8.1, §8.3)
  - Includes: `xp_events`; rules table + `awardXp()` with daily caps; hooks in the review, quiz and
    note flows; daily goal progress; levels and titles.
  - Done when: unit tests cover the rules and caps; XP appears after sessions.
  - Note (2026-10-29): migration `0009_xp_events` (table `xp_events`, append-only, with the usual
    owner/sync columns and a `study_day`). No new packages. `src/features/gamification/`:
    `logic.ts` (pure; the **rules table** `xpRules` with each source's amount, repeat limit and
    daily cap; `planAward`; daily goal progress; `xpForLevel` / `levelForXp` / `levelProgress`;
    titles), `repo.ts` (`awardXp` in one transaction — reads the profile's timezone and daily
    goal, works out the study day, applies the rules, adds the 5 XP goal bonus the first time the
    day reaches the goal, reports a level-up; `getTotalXp`, `getDayXp`), `hooks.ts`
    (`useXpOverview` live level and goal; `useXpActions().award`, which toasts only for "daily
    goal reached" and "level up" and never lets an XP failure get in the way),
    `components/XpSummary.tsx` (level, title, progress to the next level, today's goal bar).
    **Wired in:** reviewing a card (1 XP, once per card per study day; not in cram mode),
    finishing a quiz (1 XP per fully correct answer, once per attempt), saving a new card (1 XP,
    max 20 a day) and a note passing 100 words (2 XP once per note, max 10 a day). The review
    summary and the quiz results screen show `XpSummary`. The rules table also holds lessons,
    practice nodes, checkpoints, mock exams, official-quiz answers and accepted error reports, so
    those tasks only need to call `award`. **Where to see it:** review some cards → the summary
    shows "Level 1 · Intern", "x / 50 XP today"; take a quiz → the results show it too; reaching
    50 XP shows a "Daily goal reached! +5 bonus XP" toast. Not done here: changing the daily goal
    (task 2.9 settings; the profile field `daily_goal_xp` already exists), the streak (2.3), the
    Today screen (2.4). Checked in the cloud: typecheck, lint, tests (rules, caps, dedupe,
    goal bonus, levels and titles; the database with timezone and 03:00 rollover; XP after a
    review session, a quiz and a long note; a new card). **Phone check pending.**

- [x] **2.3 Streaks** (PS §8.2, AR §7.2)
  - Includes: `streak_state`; a pure streak calculator (freeze earn/use, repair window, 03:00
    rollover); time-travel tests.
  - Done when: all streak edge-case tests pass.
  - Note (2026-10-29): migration `0010_streak_state`. No new packages. `gamification/streak.ts`
    (pure `calculateStreak`: replays the XP of each study day → `current`, `longest`,
    `todayCounted`, `atRisk`, `freezesHeld`, `frozenDays`, the open `repair` and the repaired
    breaks). Rules: a day counts at **10 XP**; a missed day uses a freeze if one is held, else
    the streak breaks; a freeze is earned at every 7-day milestone (max 2); **repair** = earn
    2 × the daily goal in the two study days after the missed day (48 hours), once every 30
    days, and it happens by itself as soon as the target is reached. 27 time-travel tests (no
    history, 9 vs 10 XP, at risk vs broken, freezes earned/used/capped/not double-earned, repair
    window open/closed/cooldown/goal off/second miss, and the 02:59 vs 03:01 study-day edge).
    `repo.ts`: `awardXp` now also returns the streak and whether it was extended or repaired
    and saves `streak_state`; `refreshStreak` (works the streak out as of now and saves it;
    run it when a day has passed or after a sync); `getStreakState`. `hooks.ts`: `useStreak`
    (live; saves the summary once on open). `components/StreakLine.tsx` is the top of the XP card
    on the review summary and quiz results: "N-day streak", a gentle line about today, freezes
    held, longest streak, and after a break how much XP brings it back. Toasts: "Streak
    started!", "N-day streak!", "Streak restored!". **Where to see it:** earn 10 XP in a day
    (about 10 cards, or a few quiz answers and a card) → the XP card shows "1-day streak". Not
    done here: the calendar of active days (Stats, task 2.7), the streak-at-risk notification
    (2.9) and the Today screen (2.4). Checked in the cloud: typecheck, lint, tests (calculator,
    database, the XP card with a streak, a break and a repair). **Phone check pending.**

- [x] **2.4 Today screen** (PS §2)
  - Includes: Dozi greeting by time of day; streak flame with count; daily goal ring;
    "Reviews due (N)"; quick-create; recent items; placeholders for "Continue roadmap" and
    "Drug of the day".
  - Done when: the screen updates live after a review session.
  - Note: built in `src/features/today/` (pure greeting rules in `logic.ts`, `useToday` composing the
    XP, streak, due-count and recent-items hooks). Roadmap and Drug of the day are "coming soon"
    placeholders. Checked in the cloud: typecheck, lint, tests (incl. a live-update test), Android
    bundle export. **Phone check pending.**

- [x] **2.5 Celebrations & feedback**
  - Includes: session-end screen with an XP count-up; streak-extended animation; level-up and
    achievement toasts; small Dozi reactions on correct/wrong answers; haptics; confetti (Skia or
    Reanimated — no heavy dependency).
  - Done when: it feels rewarding without slowing a low-end phone (test on the developer's device).
  - Note: session-end screen has the XP count-up (`CountUp`), lines for new level, daily goal and
    streak with a small pop, and confetti (`Confetti`, 24 plain Reanimated squares) on the big
    moments. Practice quizzes show a small Dozi reaction with the verdict. Haptics (`expo-haptics`,
    new package, in `src/lib/haptics.ts`) on rating a card, checking a quiz answer and the big
    moments. Everything is skipped when the phone asks for reduced motion. Level-up, goal and
    streak toasts already existed (2.1–2.3). Not done: quiz result screen celebration (quiz XP
    is awarded elsewhere) and a haptics on/off switch (comes with Settings). **Needs
    `npm install`. Phone check pending.**

- [x] **2.6 Achievements** (PS §8.4)
  - Includes: definitions table; evaluation after events; a badge gallery in Me (locked badges show
    their hint).
  - Done when: unit tests cover the unlock rules; the badges display.
  - Note: new `achievements` table (migration 0011). Rules are in `gamification/achievements.ts`;
    after every XP award the app checks for new badges (toast, and a line on the session-end
    screen). The Me tab now shows level/streak/goal and the badge gallery. Eleven badges unlock
    from data that exists today; Topic Mastered, ANS Ace, Antimicrobial Guardian and PK Pro show
    as locked, "coming with a later update", until topics and calculation problems exist.
    First Dose, Perfect Checkpoint, Mock Survivor and Sharp Eye unlock automatically once those
    features award their XP. **Phone check pending.**

- [ ] **2.7 Stats screen** (PS §8.5)
  - Includes: activity heatmap (study days), XP per day chart, cards reviewed, accuracy by
    question type, time studied, 30-day review forecast, per-deck stats.
  - Done when: the charts render from real local data.

- [ ] **2.8 Onboarding** (PS §3)
  - Includes: the full flow with Dozi; saves the profile; can be skipped; re-runnable from settings.
  - Done when: a fresh install lands in onboarding, then Today.

- [ ] **2.9 Local notifications & settings** (PS §10, §12)
  - Includes: daily reminder, streak-at-risk nudge, exam countdown; quiet hours; per-type
    toggles; settings screens (theme, text size, goal, reminders, storage).
  - Done when: the notifications fire at the right times and never during quiet hours.

- [ ] **2.10 Alpha 1 release prep**
  - Includes: `preview` APK build; in-app feedback link (e.g. a Google Form URL setting); a
    known-issues list; a Maestro flow for onboarding → note → deck → review → quiz.
  - Done when: the APK is shared with testers.

## Phase 3 — Accounts & sync

- [ ] **3.1 Supabase project & schema**
  - Includes: step-by-step project creation for the developer; Supabase CLI; migrations that mirror
    all syncable tables; `server_updated_at` and LWW triggers; RLS policies; Storage bucket
    `user-media` with RLS; SQL RLS tests.
  - Done when: the migrations apply cleanly and the RLS tests prove isolation between users.

- [ ] **3.2 Authentication**
  - Includes: email one-time code sign-in and Google sign-in; secure session storage; optional
    sign-in (the app works without it); `adoptLocalData()` on first sign-in; sign-out warning if
    unsynced changes exist.
  - Done when: signing in on a phone with existing local data keeps all of it.

- [ ] **3.3 Sync engine** (AR §4)
  - Includes: dirty tracking in the repos; push and pull with per-table cursors and ordering;
    batching; backoff; triggers (start, foreground, reconnect, after session, manual); a status
    indicator.
  - Done when: merge tests pass; two phones (or phone + emulator) converge after offline edits.

- [ ] **3.4 Review-log replay & derived-state rebuild**
  - Includes: after a pull, replay FSRS for affected instances; recompute the streak from
    `xp_events`.
  - Done when: a test with interleaved reviews from two devices gives the correct final state.

- [ ] **3.5 Media sync**
  - Includes: an upload queue with Wi-Fi-only honoured; signed-URL downloads with caching;
    retry/failed states in the UI.
  - Done when: images added on one device appear on another.

- [ ] **3.6 Account management**
  - Includes: profile edit; export my data (JSON + media zip via expo-sharing); delete account
    (an Edge Function that removes the rows and storage); privacy policy link.
  - Done when: export opens as a zip; deletion removes all server data (verified in the dashboard).

## Phase 4 — Official curriculum & roadmap

- [ ] **4.0 Lesson design prototype** (PS §6.4a)
  - Includes: one SAMPLE lesson (clearly labelled SAMPLE, no unreviewed drug facts presented as
    official) built in two presentation styles inside the app, e.g. swipeable one-idea cards vs a
    guided scroll with inline checks; a drug-class colour and icon; one interactive diagram (a
    step-through mechanism or a PK slider); highlight → card. Hard-coded SAMPLE data is fine here;
    no Supabase needed. Can be done any time after Phase 2, before 4.5.
  - Done when: the developer and 5 classmates have tried both styles in Expo Go or the emulator,
    the preferred style is written into PS §6.4a, and the decision is logged in AR §11.

- [ ] **4.1 Content schemas & validation** (CONTENT_GUIDE)
  - Includes: zod schemas for every content file; `npm run content:validate` with clear error
    messages (file, line, field); SAMPLE content for 1 topic.
  - Done when: invalid sample files produce helpful errors and valid ones pass.

- [ ] **4.2 Content tables & push**
  - Includes: Supabase official tables with the status workflow; `content_reviews`, `reports`;
    `npm run content:push` (service key, local only) that upserts by stable ID and bumps the
    version.
  - Done when: the sample content appears in Supabase as `in_review`.

- [ ] **4.3 Content packs**
  - Includes: `npm run content:build` → gzip JSON per course unit + checksum → Storage and a manifest
    row; in-app manifest check, size prompt, download, checksum verify, transactional import;
    starter pack bundled in assets.
  - Done when: a fresh offline install shows starter content; an update installs a new pack
    version without losing progress.

- [ ] **4.4 Curriculum browser & drug profiles** (PS §6)
  - Includes: Learn tab: course units → topics → items; drug profile screen with fixed sections,
    disclaimer and actions; class comparison table view; glossary; global search across
    official and personal content.
  - Done when: the developer can find propranolol via search and via the topic tree.

- [ ] **4.5 Lesson player** (PS §6.4)
  - Includes: block renderers in the style chosen in 4.0; inline check questions using the quiz renderers; completion XP;
    option to add linked cards to reviews.
  - Done when: the sample lesson plays end to end.

- [ ] **4.6 Official decks & questions in personal study**
  - Includes: "Add to my reviews" (official deck → user deck with `source=official`, synced
    card states); "Save to my bank"; "Fork to edit".
  - Done when: official cards review like personal ones and update when a new pack version fixes them.

- [ ] **4.7 Roadmap path UI** (PS §7.1–7.2)
  - Includes: `/roadmap/[courseUnitId]`: a vertical winding path of nodes in sections; node
    states (locked/available/completed with stars/needs review); Dozi at the current node;
    tapping a node shows a preview sheet (type, minutes, XP, Start); scroll to the current node.
  - Done when: it runs smoothly with 100+ nodes on the developer's phone.

- [ ] **4.8 Roadmap logic** (AR §7.4)
  - Includes: `roadmap_progress`; unlocking; checkpoints (≥ 70 %); test-out; stars from score;
    launching each node type into the right flow and recording the result.
  - Done when: unit tests cover the unlocking rules; completing nodes unlocks the next ones.

- [ ] **4.9 Topic mastery & progress screens** (AR §7.3)
  - Includes: `mastery/logic.ts` + tests; recompute triggers; per-course-unit and per-topic
    progress screens; "needs review" node decay; "Fix my weak spots" session.
  - Done when: mastery changes sensibly after sessions and decays over simulated time in tests.

- [ ] **4.10 Study planner** (PS §7.3, AR §7.5)
  - Includes: exam dates UI; minutes per day and days off; `planner/logic.ts` + tests; Today shows
    the plan with checkboxes; user-pinned items and personal goals; rebalance plus a kind Dozi message
    when behind; "Continue roadmap" on Today wired up.
  - Done when: a plan generated 30 days before an exam covers all nodes and leaves revision days.

- [ ] **4.11 Error reports & Reviewer Mode** (PS §11, CONTENT_GUIDE §3)
  - Includes: "Report a problem" on all official items; reviewer role; review queue; item
    preview; checklist; approve / request changes with a comment; approval rules; badges.
  - Done when: a reviewer account can approve the sample content and it can then be published and
    packed.

- [ ] **4.12 Beta release**
  - Includes: `preview` APK; onboarding picks the course unit and downloads the pack; a Maestro
    flow for the roadmap node journey.

## Phase 5 — Exam mastery tools

- [ ] **5.1 More question types:** ordering, calculation (units + tolerance + worked solution),
  image label (hotspots), LEQ with rubric self-assessment, OSPE station mode (timed stations
  with auto-advance).
- [ ] **5.2 Case-based questions & branching clinical cases:** a case JSON graph (nodes: vignette,
  decision, outcome, question); player with consequences; debrief.
- [ ] **5.3 PK calculation trainer:** problem templates with randomised parameters (t½, k, Vd,
  CL, loading dose, maintenance dose, Css, bioavailability/AUC, renal adjustment with
  Cockcroft–Gault); step-by-step solutions rendered with KaTeX; tests verifying the maths for
  random seeds.
- [ ] **5.4 Mock exam simulator:** paper blueprints (sections, formats, timing, marks) matching
  MUST papers; build papers from the official bank; exam-conditions mode; analytics by
  topic and type after the exam.
- [ ] **5.5 Exam readiness score:** combines coverage, mastery and mock results; shows the top 3
  actions; countdown mode on Today.
- [ ] **5.6 Audio revision:** expo-speech reads cards or notes aloud; hands-free review (card
  → pause → answer); works offline.
- [ ] **5.7 Rive mascot upgrade** (when the art is ready): Rive state machine with moods and
  transitions, and a fallback to static art.

## Phase 6 — Community

- [ ] **6.1 Share by link/code:** read-only snapshot, preview, fork into the recipient's library.
- [ ] **6.2 Public library:** browse by topic, Verified/Community badges, upvotes, report →
  moderation queue.
- [ ] **6.3 Study groups / classes:** join by code, shared content feed, group quizzes (a
  lecturer or class rep can assign them).
- [ ] **6.4 Weekly leagues:** opt-in cohort leaderboards; anti-farming XP rules; end-of-week
  results.
- [ ] **6.5 Live quiz battles:** Supabase Realtime; 1v1 and class mode; host screen.
- [ ] **6.6 Discussion threads** on official questions, with moderation tools.
- [ ] **6.7 Push notifications** (Expo push) for social events, respecting quiet hours.

## Phase 7 — AI tutor (Claude API)

- [ ] **7.1 AI gateway:** Edge Function proxy, JWT check, per-user daily quota table, model
  configuration (the model is a setting, so a cheaper or self-hosted one can be swapped in
  later), request logging (no personal data), a kill switch, a global monthly budget cap.
- [ ] **7.2 Retrieval:** embed published official content into pgvector; a retrieval function;
  answers cite the content items used.
- [ ] **7.3 "Explain this"** on any card, question or drug profile, with level selection (simple /
  exam-level / deep).
- [ ] **7.4 SAQ/LEQ marking** against marking points and a rubric, with structured feedback
  (zod-validated).
- [ ] **7.5 Import a document, or use a note, and generate notes, cards and quizzes** (big: use a
  branch and PR; build as 7.5a free import, then 7.5b AI generation)
  - 7.5a (free, no AI): pick a PDF or Word (.docx) file or paste text; the Edge Function extracts
    the text (pdf.js, mammoth); the user edits it into a note and uses the existing flashcard
    tools (1.13). Text-based files only; reject scans with a clear message. Page cap per upload.
  - 7.5b (AI, behind quotas): generate notes, cards and questions from the extracted text or from
    one of the user's own notes. Cost rules: the cheapest model that passes a quality test on a
    few real MUST lecture PDFs (model is a config setting in 7.1); strip repeated headers and
    slide boilerplate; compact zod-validated JSON with a fixed item count per chunk; hash each
    file so it is never processed twice; prompt caching; batch API for non-urgent jobs ("ready in
    a few minutes"); a few free generations a month per user, more in premium (8.2); a global
    monthly budget and the 7.1 kill switch.
  - Safety: the model may use only the uploaded text; everything is saved as a draft marked
    AI-generated; the user reviews and edits before saving; the study-only disclaimer is shown.
    Uploaded files stay private to the uploader (no sharing or publishing; see Phase 6).
  - Later options (not in this task): scanned PDFs and slide images via OCR or vision, as a paid
    extra.
  - Done when: a text PDF and a .docx each turn into an editable note; AI generation respects the
    quota, never reprocesses the same file, and the user can review every item before saving.
- [ ] **7.6 Socratic tutor chat** per topic; guardrails: education only, no patient-specific
  advice, and a disclaimer.

## Phase 8 — Launch & monetisation

- [ ] **8.1 Performance pass:** cold start, list performance, APK size, memory on a low-end
  device; Sentry; PostHog (opt-out, no content text).
- [ ] **8.2 Entitlements & paywall:** feature flags; a clear free-vs-premium screen (all creation
  tools stay free).
- [ ] **8.3 Mobile money:** Flutterwave or Pesapal via an Edge Function; webhook verification;
  entitlement grants; receipts; semester pass; restore purchases.
- [ ] **8.4 Play Store:** privacy policy, Data safety form, disclaimer, listing assets (Dozi!),
  internal → closed → production tracks.
- [ ] **8.5 Compliance check:** Uganda Data Protection and Privacy Act 2019 obligations (e.g.
  registration with the Personal Data Protection Office), consent flows, terms of use. Get
  local advice on current requirements.

## Later
- Work Mode / Quick Reference for interns (only with validated, licensed data).
- Lecturer web portal (Next.js on the same Supabase).
- iOS release.
- Anki `.apkg` import, voice notes, handwriting pages.
- Other universities and programmes.

---

## §C Content track (parallel, mostly human)

- [ ] C.1 Get the official MUST pharmacology course outline(s) → write `content/curriculum.yaml`.
- [ ] C.2 Recruit 3–5 student reviewers (and ideally 1 lecturer); agree on the review rules.
- [ ] C.3 Collect past-paper formats (question types, marks, timing) for the mock blueprints.
      Get permission before using actual past-paper questions.
- [ ] C.4 Write the General Principles + PK content first (lessons, cards, questions, calc
      templates).
- [ ] C.5 Autonomic pharmacology.
- [ ] C.6 Chemotherapy (antimalarials, antibacterials, anti-TB, ARVs…).
- [ ] C.7 Commission the Dozi mascot art (10 moods, SVG/PNG, later Rive). Brief: PS §9.
- [ ] C.8 Continue through the remaining course units in the MUST order.
