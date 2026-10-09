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

- [ ] **0.3 EAS development build**
  - Includes: `eas.json` with `development`, `preview` and `production` profiles; step-by-step
    instructions for the developer (Expo account, `eas login`, build, install the APK, connect to
    Metro).
  - Done when: the dev client is installed on the developer's Android phone and hot reload works.

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

- [ ] **0.6 Local database**
  - Includes: expo-sqlite + Drizzle; migrations run on startup; `profiles` and `settings` tables;
    repo pattern; a DB provider with a loading/error state; Jest repo tests using in-memory SQLite.
  - Done when: a profile row is created on first launch and persists across restarts; tests pass.

- [ ] **0.7 Core utilities**
  - Includes: `lib/time.ts` (studyDay with 03:00 rollover in the profile timezone, date helpers),
    `lib/ids.ts` (UUID), `lib/logger.ts`, a global error boundary screen with Dozi placeholder
    text, and `i18n/strings.ts`.
  - Done when: studyDay unit tests cover the 02:59/03:01 edges and timezone behaviour.

## Phase 1 — Personal content ("study your way")

- [ ] **1.1 Media pipeline** (AR §5)
  - Includes: pick/capture → compress → save → `media` row; `<MediaImage id>`; a full-screen
    viewer with pinch-zoom; orphan cleanup; a storage-used calculation.
  - Done when: an image picked from the gallery shows up compressed (log the before/after size) and
    survives an app restart.

- [ ] **1.2 Library, folders & tags**
  - Includes: `folders`, `tags`, `item_tags` tables; Library tab with segments Notes · Decks ·
    Quizzes; folder navigation; create/rename/move/delete (soft, with undo toast); tag filter;
    sort options; Dozi empty states.
  - Done when: the developer can organise items into nested folders with tags.

- [ ] **1.3 Notes editor** (PS §4.1)
  - Includes: `notes` table; TenTap editor with headings, bold/italic/underline, highlight,
    lists, checklists, tables (if supported), blockquote, divider; insert image via the media
    pipeline (`media://` refs); debounced autosave; title; pin; move; tags; word count;
    `note_versions` (keep the last 10).
  - Done when: a note with text, a table and 2 images saves offline and reopens identically.

- [ ] **1.4 Note callouts, templates & search**
  - Includes: callout blocks (Exam tip · Mnemonic · Warning · Clinical pearl); templates
    (Lecture notes, Drug profile, Class comparison, Case summary); FTS5 search over notes on
    `/search`, with highlighted snippets.
  - Done when: searching a word inside a note body finds it in < 200 ms with 500 notes (seed script).

- [ ] **1.5 Image annotation** (PS §4.1)
  - Includes: a Skia canvas over an image with tools arrow · box · circle · freehand · text ·
    undo/redo · colour picker (5 colours); saves a derived media item (the original is kept).
  - Done when: the developer can annotate a photo of a diagram and insert it into a note.

- [ ] **1.6 Decks & card editor** (PS §4.2)
  - Includes: `decks`, `cards`, `card_instances`; deck list and detail; card editor for Basic,
    Basic+Reverse, Cloze (with a `{{c1::}}` helper button), Type-in; rich fields with images;
    Extra field; preview; bulk-add mode; deck settings; card instances generated automatically.
  - Done when: creating a cloze card with c1 and c2 produces 2 reviewable instances.

- [ ] **1.7 FSRS engine** (PS §5.1, AR §3.3)
  - Includes: `card_state`, `review_logs`; `srs/logic.ts` wrapping ts-fsrs; a queue builder
    honouring new/day and reviews/day limits and ordering; interval previews for each rating;
    a replay-from-logs function (needed for sync later).
  - Done when: unit tests cover scheduling, limits, ordering and log replay.

- [ ] **1.8 Review session UI**
  - Includes: `/review/[scope]`; flip animation; rating buttons with intervals; type-in checking
    with a diff; undo; edit card; suspend/bury; progress bar; summary screen; cram mode.
  - Done when: the developer can review a deck; due dates update; undo restores the previous state.

- [ ] **1.9 Image occlusion cards** (PS §4.2)
  - Includes: pick/annotate an image → draw mask rectangles (move/resize/delete, optional
    label) → choose mode (hide one / hide all) → one instance per mask; rendering in review
    (the masked region is highlighted when revealed).
  - Done when: a 5-label diagram becomes 5 working cards.

- [ ] **1.10 Question bank & quiz builder** (PS §4.3)
  - Includes: `questions`, `quizzes`, `quiz_questions`; zod schemas per type in
    `quizzes/types.ts`; editors for **SBA, MTF, multiple response, fill-blank, matching, SAQ
    (marking points)**, with images in the stem and a rationale per option; quiz builder
    (add from bank or create inline, reorder, points); quiz settings.
  - Done when: the developer can build a quiz containing one of each type.

- [ ] **1.11 Quiz player & results**
  - Includes: `quiz_attempts`, `question_responses`; renderers per type; practice mode
    (instant feedback + rationale) and exam mode (timer, flag, navigator grid, submit); scorers
    in `quizzes/logic.ts` with table-driven tests (MTF negative marking, fuzzy fill-in, Greek
    letters); results screen; review answers; "Retry wrong only"; "Add wrong ones to
    flashcards"; attempt history.
  - Done when: all scorer tests pass and both modes work end to end.

- [ ] **1.12 Import / export**
  - Includes: CSV import/export for decks; export a note or quiz as a PDF (expo-print) and share
    it (expo-sharing).
  - Done when: a CSV round-trip preserves the cards, and a PDF opens in the phone's viewer.

- [ ] **1.13 Make flashcards from notes**
  - Includes: select text in a note → "Make card" (basic / cloze) → pick a deck; the card links back
    to the note.
  - Done when: the flow works and the card shows a "From note: …" link.

## Phase 2 — Motivation: Dozi, XP, streaks, progress

- [ ] **2.1 Dozi mascot component** (PS §9)
  - Includes: `<Dozi mood size>` using placeholder SVGs for all 10 moods (simple, original,
    clearly a crowned crane in a lab coat); speech bubble; `mascot/messages.ts` with context-based
    lines (varied, never shaming); subtle Reanimated idle bounce.
  - Done when: the gallery shows every mood; replacing the placeholders later only needs a
    file swap.

- [ ] **2.2 XP, daily goal & levels** (PS §8.1, §8.3)
  - Includes: `xp_events`; rules table + `awardXp()` with daily caps; hooks in the review, quiz and
    note flows; daily goal progress; levels and titles.
  - Done when: unit tests cover the rules and caps; XP appears after sessions.

- [ ] **2.3 Streaks** (PS §8.2, AR §7.2)
  - Includes: `streak_state`; a pure streak calculator (freeze earn/use, repair window, 03:00
    rollover); time-travel tests.
  - Done when: all streak edge-case tests pass.

- [ ] **2.4 Today screen** (PS §2)
  - Includes: Dozi greeting by time of day; streak flame with count; daily goal ring;
    "Reviews due (N)"; quick-create; recent items; placeholders for "Continue roadmap" and
    "Drug of the day".
  - Done when: the screen updates live after a review session.

- [ ] **2.5 Celebrations & feedback**
  - Includes: session-end screen with an XP count-up; streak-extended animation; level-up and
    achievement toasts; small Dozi reactions on correct/wrong answers; haptics; confetti (Skia or
    Reanimated — no heavy dependency).
  - Done when: it feels rewarding without slowing a low-end phone (test on the developer's device).

- [ ] **2.6 Achievements** (PS §8.4)
  - Includes: definitions table; evaluation after events; a badge gallery in Me (locked badges show
    their hint).
  - Done when: unit tests cover the unlock rules; the badges display.

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
  - Includes: block renderers; inline check questions using the quiz renderers; completion XP;
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
  configuration, request logging (no personal data), a kill switch.
- [ ] **7.2 Retrieval:** embed published official content into pgvector; a retrieval function;
  answers cite the content items used.
- [ ] **7.3 "Explain this"** on any card, question or drug profile, with level selection (simple /
  exam-level / deep).
- [ ] **7.4 SAQ/LEQ marking** against marking points and a rubric, with structured feedback
  (zod-validated).
- [ ] **7.5 Generate cards and questions from my note:** the user reviews and edits before saving;
  items are marked AI-generated.
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
