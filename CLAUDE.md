# Dozi — Pharmacology Study App (working name)

## What this project is

An **offline-first Android app** (Expo / React Native, TypeScript) that helps pharmacy students at
**Mbarara University of Science and Technology (MUST), Uganda** master pharmacology — the hardest
course unit in their programme.

Current scope is **Study Mode only**. There is no clinical "Work Mode" yet — do not build
point-of-care dosing or clinical decision support features.

Read these before working on a task — they are the source of truth:

| File | What it holds |
|---|---|
| `docs/PRODUCT_SPEC.md` | Every feature, screen and rule (XP, streaks, question types, mascot…) |
| `docs/ARCHITECTURE.md` | Stack, folder structure, database schema, sync, media, content pipeline, decisions log |
| `docs/CONTENT_GUIDE.md` | Official content file formats and the review workflow |
| `docs/ROADMAP.md` | The build plan: phases → numbered tasks with acceptance criteria |

## Project facts

- **GitHub repo:** `lolesterrr/dozi` (branch `main`). Push each finished task there.
- **Android package / iOS bundle id:** `com.lolesterrr.dozi`.
- **Expo SDK:** 57. Routes live in the root `app/` folder; everything else in `src/`.
- **Handoff between sessions:** each task's state lives in `docs/ROADMAP.md` (ticked boxes and the
  note under each task) and design decisions in the Decisions log in `docs/ARCHITECTURE.md`.
  Read both at the start of every session.

## Who you are working with

The developer builds this app **entirely through Claude Code** and is not a professional software
engineer. Therefore:

- Before a large change, explain the plan in plain language (what files, why).
- After a change, give the **exact commands** to run and **what they should see on their phone**.
- Prefer boring, well-documented, widely used libraries. Do not add a dependency that isn't in
  `docs/ARCHITECTURE.md` without asking first and saying why.
- Never end a task with the app broken. If you can't finish, say so clearly, leave the code
  compiling, and add a note under the task in `docs/ROADMAP.md`.
- When something needs the developer to act outside the code (create an account, paste a key,
  install the dev build), stop and give step-by-step instructions.

## Workflow for every task

The developer will usually say something like **"Do task 1.6"**.

1. Read the task in `docs/ROADMAP.md` and the spec/architecture sections it references.
2. Check what already exists in the codebase — don't duplicate or rewrite working code.
3. Post a short plan (files to add/change, new dependencies, migrations). If the task is too big
   for one session, propose splitting it into 1.6a / 1.6b and update the roadmap.
4. Implement. Keep pure logic (scoring, scheduling, XP, streaks, planner, sync merge) in
   `logic.ts` files with **unit tests**.
5. Run `npm run typecheck && npm run lint && npm test` and fix every failure.
6. Explain how to verify on the phone (step by step).
7. Tick the task's checkbox in `docs/ROADMAP.md`. If you made a design decision, append it to the
   **Decisions log** in `docs/ARCHITECTURE.md`.
8. Commit: `task 1.6: <short summary>`.

## Stack (fixed — ask before changing)

- **Expo** (latest stable SDK) + **Expo Router** + **TypeScript (strict)**. Android first.
  Uses an **EAS development build** (not Expo Go) because of native modules.
- **Local DB:** `expo-sqlite` + **Drizzle ORM** (migrations, live queries). SQLite FTS5 for search.
- **Backend (from Phase 3):** **Supabase** — Postgres + Row Level Security, Auth, Storage,
  Edge Functions.
- **UI:** NativeWind (Tailwind), `react-native-reanimated`, `@shopify/flash-list`,
  `lucide-react-native` icons, `@shopify/react-native-skia` for drawing and image occlusion.
- **Rich text notes:** `@10play/tentap-editor`.
- **Spaced repetition:** `ts-fsrs` (FSRS algorithm).
- **State:** Drizzle live queries for local data, Zustand for UI state, TanStack Query for
  network calls. **Forms:** react-hook-form + zod.
- **Mascot animation:** static SVG/PNG expressions first; Rive (`rive-react-native`) later.
- **Tests:** Jest + React Native Testing Library; Maestro for end-to-end flows.

## Non-negotiables

1. **Offline-first.** Every study feature works with no network. Local SQLite is the source of
   truth for the UI; the network is only for sync, downloads and AI.
2. **Low-end Android.** Design for ~3 GB RAM phones and expensive mobile data. Use FlashList for
   long lists. Compress every image before saving (long edge ≤ 1600 px, JPEG quality 0.7).
   Show the size before any download over 5 MB. Offer a "Wi-Fi only" setting for media sync.
3. **Medical content safety.** Never invent drug facts in official content, seed data or UI copy.
   Any pharmacology content you draft must be saved with `status: draft` and `ai_drafted: true`, and
   a human must review it before it can be published (see `docs/CONTENT_GUIDE.md`). Dev/sample
   data must be clearly labelled `SAMPLE`. Show the in-app disclaimer: *"For study purposes only
   — not for clinical decisions."*
4. **Uganda context.** References are the Uganda Clinical Guidelines (UCG), the Essential Medicines
   and Health Supplies List for Uganda (EMHSLU) and the National Drug Authority (NDA) — not FDA/US
   sources by default. Use British/Ugandan English spelling (colour, haemoglobin, paediatric).
5. **Privacy.** Follow Uganda's Data Protection and Privacy Act 2019. Collect the minimum personal
   data and **no patient data**. Put RLS on every Supabase table. Never ship the `service_role`
   key in the app; only `EXPO_PUBLIC_*` values and the anon key go into the client.
6. **Secrets** live in `.env` (git-ignored). Keep `.env.example` up to date.
7. **Accessibility.** Touch targets ≥ 44 dp, support system font scaling, AA contrast. Never use
   colour alone: correct/incorrect answers also get an icon and a label.
8. **Original mascot.** Dozi is a Ugandan grey crowned crane. Never imitate Duolingo's owl or any
   other brand's characters or art style.
9. **Encouraging tone.** Copy is warm and never guilt-tripping or shaming. No notifications
   between 22:00 and 07:00.

## Conventions

- Feature folders: `src/features/<feature>/{logic.ts, repo.ts, hooks.ts, components/}`.
  Shared primitives go in `src/components/ui/`. Routes live in `app/` (Expo Router).
- UI components **never** write SQL. Go through `repo.ts` functions.
- IDs: UUID v4 generated on the device (`expo-crypto` `randomUUID()`).
- Every user-owned table has `id, owner_id, created_at, updated_at, deleted_at` (soft delete)
  plus local sync columns (see ARCHITECTURE §Sync).
- Timestamps are stored as ISO-8601 UTC strings. A **study day** is the local date in the user's
  timezone (default `Africa/Kampala`) and rolls over at **03:00**. Always use `src/lib/time.ts`;
  never call `new Date()` directly for streak/day logic.
- Validate with zod at every boundary: content import, forms, sync payloads, AI responses.
- Styling uses NativeWind classes and theme tokens from `src/theme`. No raw hex colours in
  components.
- All user-facing strings live in `src/i18n/strings.ts` (English for now; structure allows
  translation later).
- Rich content (notes, card faces, question stems) is stored as TipTap/ProseMirror JSON. Images
  are referenced as `media://<media_id>`, never as file paths.

## Commands

```bash
npm run start            # start Metro for the dev build
npm run android          # build and run on a connected Android device/emulator (if set up)
npm run typecheck        # tsc --noEmit
npm run lint             # eslint
npm test                 # jest
npm run db:generate      # drizzle-kit generate (after changing src/db/schema)
npm run content:validate # validate content/ YAML against zod schemas (Phase 4)
npm run content:build    # build offline content packs (Phase 4)
eas build -p android --profile development   # new dev client APK (after native changes)
eas build -p android --profile preview       # shareable test APK for classmates
```

Keep this list updated when you add scripts.

## Glossary

- **MUST:** Mbarara University of Science and Technology.
- **SBA:** single best answer MCQ. **MTF:** multiple true/false (one stem, usually 5 statements).
- **SAQ:** short answer question. **LEQ:** long essay question. **OSPE:** objectively structured
  practical exam (timed stations).
- **FSRS:** Free Spaced Repetition Scheduler. **Retrievability:** the probability of recalling
  a card now.
- **UCG / EMHSLU / NDA:** Uganda Clinical Guidelines / Essential Medicines and Health Supplies List
  for Uganda / National Drug Authority.
- **VEN:** Vital, Essential, Necessary classification. **LOC:** level of care (HC2 … NR).
- **MOA:** mechanism of action. **ADR:** adverse drug reaction. **PK / PD:** pharmacokinetics /
  pharmacodynamics.
