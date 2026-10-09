# Dozi — Pharmacology Study App (project starter)

This folder is the starting point for building the app with **Claude Code**. It contains no
code yet; Claude Code writes the code, task by task, following the plan in `docs/`.

## What's inside

| File | For | What it is |
|---|---|---|
| `CLAUDE.md` | Claude Code (read every session) | Project context, rules, stack, conventions, workflow |
| `docs/PRODUCT_SPEC.md` | You + Claude Code | Every feature and rule of the app |
| `docs/ARCHITECTURE.md` | Claude Code | Technical design: database, sync, media, algorithms |
| `docs/CONTENT_GUIDE.md` | You + reviewers + Claude Code | How official content is written, reviewed and published |
| `docs/ROADMAP.md` | You + Claude Code | The build plan: ~70 numbered tasks in 9 phases |

## Before you start (one-time setup)

1. **Install** on your computer: [Node.js LTS](https://nodejs.org), [Git](https://git-scm.com), and
   Claude Code.
2. **Create free accounts:** [Expo](https://expo.dev) (for cloud builds) and a GitHub account (for
   backing up your code). You'll need [Supabase](https://supabase.com) later, in Phase 3.
3. **Phone:** an Android phone to install test builds on. Enable "Install unknown apps" for your
   browser/files app when asked.
4. Put this folder somewhere sensible (e.g. `Documents/dozi`), open a terminal in it and run
   `claude`.

## Running the app (task 0.1 onwards)

The app is an Expo (React Native) project. Until the development build exists (task 0.3), you
can preview it in **Expo Go**.

1. Install the **Expo Go** app on your Android phone from the Play Store.
2. In a terminal in this folder, install dependencies (first time, and whenever `package.json` changes):
   ```bash
   npm install
   ```
3. Start the dev server:
   ```bash
   npx expo start
   ```
4. Scan the QR code shown in the terminal with Expo Go. Your phone and computer must be on the
   same Wi-Fi. If that doesn't work, stop the server and run `npx expo start --tunnel` instead.
5. You should see **"Hello Dozi"** in the middle of the screen and the study disclaimer at the bottom.

Useful checks: `npm run typecheck` (TypeScript), `npm run lint` (code style), `npm test` (unit
tests). `npm run format` fixes most style problems automatically.

Secrets: copy `.env.example` to `.env` when a task asks for keys. `.env` is never committed.

## How to work with Claude Code

- Start each session with: **"Read CLAUDE.md, then do task 0.1 from docs/ROADMAP.md."**
  Later sessions can just say **"Do task 1.3."**
- **One task per session.** When a task is done and committed, run `/clear` and start the next one.
  This keeps Claude focused and cheap.
- For big tasks, use **plan mode** (Shift+Tab) so Claude shows its plan before changing files.
- **Test on your phone after every task.** Claude will tell you what to check. If something is
  wrong, describe what you see (screenshots help).
- **Push to GitHub regularly** (ask Claude to set up the remote in task 0.1). That's your backup.
- If Claude suggests changing the stack or adding a big library, ask it why before agreeing.
- When a task is too big, ask Claude to split it; it will update the roadmap.

## Things only you can do (start now, in parallel)

- Get the **MUST pharmacology course outline(s)**. The roadmap and content follow them.
- Find **3–5 student reviewers** and, ideally, **one lecturer** who will look at content.
- Collect the **exam formats** used (question types, marks, timing) for the mock exams.
- Brief an illustrator on **Dozi the crowned crane** (see PRODUCT_SPEC §9). Until then Claude
  builds placeholder art.
- Decide the **real app name**. "Dozi" is a working name, and changing it early is easy.

## Milestones

1. **Alpha 1** (end of Phase 2): notes, flashcards, quizzes, Dozi, streaks — share with classmates.
2. **Beta** (end of Phase 4): accounts and sync, official content, roadmap and study planner.
3. **Exam-season release** (Phase 5): mock exams, PK calculation trainer, clinical cases.
4. **v1.0** (Phase 8): Play Store release with mobile-money premium.

> Dozi is a study aid for students. It is not for clinical decision-making.
