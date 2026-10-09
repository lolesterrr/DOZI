# Setting up Dozi on your Mac (task 0.3)

This guide gets the Dozi **development build** running on the Android Studio emulator. You only do
it once. After that, day-to-day work is just `npx expo start` (step 6).

Never paste passwords, keys or tokens into the Claude chat. Things that are safe to share are
marked ✅ below.

---

## Part A — What you need now

### 1. Create an emulator (Android Studio)

1. Open **Android Studio**. On the welcome screen click **More Actions → Virtual Device Manager**
   (if a project is open: **Tools → Device Manager**).
2. Click **+ / Create Virtual Device** → pick **Pixel 8** → **Next**.
3. Choose the newest system image that says **Google Play** (on an M-series Mac it will say
   `arm64-v8a`). Click the download arrow next to it if needed, then **Next → Finish**.
4. Press **▶** next to the new device. A phone appears on your screen. Leave it running.

### 2. Create a free Expo account

1. Go to <https://expo.dev/signup> and sign up (the free plan is enough).
2. Remember your **username** ✅ — you'll tell Claude it at the end.

### 3. Get the latest code and the EAS tool

In Terminal:

```bash
cd ~/repos/DOZI
git pull
npm install
npm install -g eas-cli
npx expo-doctor
```

- `npm install -g eas-cli` may ask for permission. If it says `EACCES`, run
  `sudo npm install -g eas-cli` and type your Mac password (Terminal shows nothing as you type).
- `npx expo-doctor` should end with **"No issues detected"** or only warnings. If it lists
  errors, copy them into the chat.

### 4. Log in and link the project to your account

```bash
eas login          # your Expo username/email and password
eas whoami         # should print your username
eas init           # answer Y to "create a project for @<you>/dozi"
```

`eas init` adds two lines to `app.json` (`"owner"` and an `"extra": { "eas": { "projectId": … } }`
block). These are **not** secrets ✅. Save them to GitHub:

```bash
git add app.json
git commit -m "task 0.3: link Expo project"
git pull --rebase
git push
```

`git pull --rebase` first picks up anything Claude pushed in the meantime, so the push doesn't fail.

### 5. Build the development app (in Expo's cloud)

```bash
eas build -p android --profile development
```

- **"Generate a new Android Keystore?"** → press **Y**. Expo keeps it safe for you; you never
  handle it.
- The free plan waits in a queue, so the build can take a while. You can close Terminal; the
  build keeps going and the link it printed shows progress.
- When it finishes, with the emulator running:

```bash
eas build:run -p android --latest
```

This downloads the APK and installs it on the emulator. (Alternative: open the build link,
download the `.apk`, and drag it onto the emulator window.) A **Dozi** icon appears in the app
drawer.

You only rebuild when native code changes (Claude will tell you when). Normal code changes don't
need a new build.

### 6. Run the app (every day from now on)

```bash
cd ~/repos/DOZI
npx expo start -c
```

Then press **`a`** in that Terminal. The Dozi app opens on the emulator and loads the code.

**What you should see:** the Dozi home screen with the bottom tabs Today · Learn · Practice ·
Library · Me.

### 7. Check hot reload

1. Leave the app open. In VS Code (or TextEdit), open `src/i18n/strings.ts`.
2. Change any word on a line you can see on the Today screen and save.
3. Within a couple of seconds the emulator shows the new word without restarting.
4. Undo your change and save again (or run `git checkout src/i18n/strings.ts`).

### 8. Tell Claude

Post in the thread:

- your Expo **username** ✅ and the **projectId** from `app.json` ✅,
- whether the app opened and hot reload worked (a screenshot helps).

Claude then records them in `CLAUDE.md` and ticks task 0.3.

### If something goes wrong

| What you see | What to do |
|---|---|
| `eas: command not found` | Close and reopen Terminal, or use `npx eas-cli` instead of `eas`. |
| Pressing `a` says no device found | Start the emulator first (step 1, ▶), then press `a` again. |
| The app shows a red error screen | Take a screenshot and post it in the thread. |
| "Could not connect to development server" | Make sure `npx expo start` is still running, then press `r` in Terminal. |

---

## Part B — Services that can wait

None of these are needed until the phase named. Claude will walk you through each one when its
task starts.

| Service | Needed for | What you'll do then | Cost |
|---|---|---|---|
| **Supabase** | Phase 3 (task 3.1: accounts & sync) | Create a project; put the **URL** and **anon key** into your own `.env` (see `.env.example`) and into EAS environment variables. The **service_role** key never goes in the app, `.env` or the chat. | Free tier |
| **Google Cloud OAuth client** | Phase 3 (task 3.2: Google sign-in) | Create an Android OAuth client in Google Cloud and paste its ID into Supabase. | Free |
| **Firebase (FCM)** | Phase 6 (task 6.7: push notifications) | Only for push from a server. The Phase 2 reminders are local and need nothing. | Free |
| **Anthropic API key** | Phase 7 (AI tutor) | Stored as a Supabase Edge Function secret, never in the app. | Pay per use |
| **Google Play Console** | Phase 5 (closed testing) / Phase 8 (release) | Developer account. Before then, share the `preview` APK with classmates directly. | US$25 once |
| **Sentry, PostHog** | Phase 8 (task 8.1) | Crash reports and opt-out analytics. | Free tiers |
| **Flutterwave or Pesapal** | Phase 8 (task 8.3: mobile money) | Merchant account; keys live only in Supabase secrets. | Per transaction |

## Build profiles (`eas.json`)

| Profile | Command | Use |
|---|---|---|
| `development` | `eas build -p android --profile development` | The dev client you use with `npx expo start`. |
| `preview` | `eas build -p android --profile preview` | A standalone APK to share with classmates. |
| `production` | `eas build -p android --profile production` | The Play Store bundle (`.aab`), Phase 8. |
