# Known issues: Alpha 1

The same list is in the app under **Me → Settings → Known issues in this alpha**
(`strings.alpha` in `src/i18n/strings.ts`). Keep the two in step.

## Not built yet (by design)

- **No accounts, backup or sync.** Everything is stored on the phone. Uninstalling or clearing the
  app's data deletes it. (Phase 3.)
- **No official content.** The Learn tab is a placeholder; students study their own notes, decks
  and quizzes. (Phase 4.)
- **Badges that need lessons, checkpoints, mock exams, topics or calculation problems** stay
  locked. (Later phases.)
- **Export my data, content packs, delete account, privacy policy** in Settings. (Phase 3 and later.)
- **No year-specific course units**: the year and semester chosen in setup are saved but not used
  yet.

## Behaviour to expect

- Reminders need the notification permission, and some phones' battery savers delay them. They are
  planned a week ahead and re-planned whenever the app opens or XP is earned. The Android build
  needs this version's new native module, so use the new APK, not an older development build.
- Stats refresh when the screen opens, not live while it is open.
- Undoing a card answer does not take back the XP it earned.
- Text size "Larger" can make some dense screens (the note toolbar, the card editor) tight.
- The first load of the note editor can take a moment on slower phones.
- The Maestro flow (`e2e/alpha-flow.yaml`) has not been run on a device yet.

## Found by testers

Add new items here as they come in, with the date and the phone model.
