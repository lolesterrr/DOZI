# Setting up Dozi on your computer (task 0.3)

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
3. Choose the newest system image that says **Google Play** (on an Apple-silicon Mac it will say
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
  `sudo npm install -g eas-cli` and type your computer's password (Terminal shows nothing as you type).
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
npx expo start --localhost
```

Then press **`a`** in that Terminal. The Dozi app opens on the emulator and loads the code.

`--localhost` sends the code to the emulator through Android's own USB-style tunnel instead of
your Wi-Fi, so a firewall, VPN or a change of Wi-Fi network can't block it. Add `-c`
(`npx expo start --localhost -c`) only when Claude asks you to clear the cache.

**What happens while it loads:** the emulator shows a **plain white screen** while the code
travels from your computer (a thin "Bundling…" strip may show at the top). The Terminal prints
`Android Bundling …%` and then `Android Bundled …ms`. The first time after a cache clear this can
take several minutes; later starts reuse the cache and are much quicker. Then a teal spinner shows
briefly while Dozi starts.

**What you should see:** the Dozi home screen with the bottom tabs Today · Learn · Practice ·
Library · Me.

Two things to leave alone in that Terminal:

- **Don't press `w`** (web). Dozi is an Android app; its database doesn't work in a browser yet, so
  the web page would only show an error screen.
- **Ignore "An update for expo is available … Run npx expo install --check".** Don't run
  `npx expo install --fix`: updating Expo changes native code and needs a new dev build, so Claude
  does it as a planned task.

### 6b. Or run it in Expo Go on an iPhone (no emulator, no build)

Expo Go is a free App Store app that can run Dozi without a development build. It only runs the
newest Expo SDK, which is why the project is on SDK 58.

1. On the iPhone, install **Expo Go** from the App Store and log in with your Expo account.
2. Connect the PC and the iPhone to the same network. The easiest way without Wi-Fi is the
   **USB hotspot**: on the iPhone open Settings › Personal Hotspot, turn on **Allow Others to
   Join**, then plug the iPhone into the PC with its cable. The PC joins as a wired network, and
   the app's code goes down the cable instead of using mobile data.
3. On the PC:

   ```bash
   cd ~/repos/DOZI
   npx expo start --go
   ```

4. Scan the QR code in the Terminal with the iPhone's **Camera** and tap the Expo Go banner.
   Dozi opens, and saved code changes reload on the phone.

If the QR code won't connect (a firewall or a different network), stop with Ctrl+C and run
`npx expo start --go --tunnel` instead. Say yes if it asks to install `@expo/ngrok`. This sends the
code over the internet, so both devices need internet and every reload uses some data.

Once Dozi has loaded you can unplug the cable and keep using it. Code changes won't arrive, and
reloading or reopening the app needs the PC again.

Things to know: Expo Go is iOS here, so a few details (fonts, keyboard, shadows) can look a bit
different from Android. Check Android before a release. Features that need native code that isn't
in Expo Go (later, e.g. the Rive mascot) will need the Android dev build.

### 7. Check hot reload

1. Leave the app open. In VS Code (or any text editor), open `src/i18n/strings.ts`.
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
| A white screen that never changes, and the Terminal never prints `Android Bundling` | The emulator can't reach your computer. Press Ctrl+C, run `npx expo start --localhost` and press `a`. Turn off any VPN. |
| A white screen, and the Terminal did print `Android Bundled` | Press `j` in the Terminal (opens DevTools), click **Console** and post any red errors in the thread, plus any red lines from the Terminal. |
| A teal spinner that never goes away | Post a screenshot and the Terminal output in the thread. |

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

## Part C — Sharing the alpha with classmates (task 2.10)

Do this once the alpha build is ready. Everything runs on your own computer (checkout in
`~/repos/DOZI`); cloud sessions don't hold your Expo login.

### 1. Make the feedback form
1. Go to https://forms.google.com and make a new form called **Dozi alpha feedback**.
2. Suggested questions: *What phone do you use?* (short answer) · *What were you doing?* (paragraph)
   · *What happened, and what did you expect?* (paragraph) · *How confusing was it, 1–5?* (scale)
   · *Anything you loved?* (paragraph). Keep it short; people skip long forms.
3. Click **Send**, choose the link icon, tick *Shorten URL* and copy the link (it starts with
   `https://forms.gle/`).

### 2. Give the link to the app
The link is built into the APK, so it must be set before you build:
```bash
cd ~/repos/DOZI
git pull && npm install
eas env:create --environment preview --name EXPO_PUBLIC_FEEDBACK_URL \
  --value "https://forms.gle/YOUR-LINK" --visibility plaintext
```
(For `npx expo start` on your own machine you can instead put `EXPO_PUBLIC_FEEDBACK_URL=…` in `.env`.)

### 3. Build the APK
```bash
eas build -p android --profile preview
```
It takes a while in Expo's cloud. When it finishes, EAS prints a link and a QR code to the build
page. Open the page on your phone or computer and download the `.apk`. Check its size: the goal is
under 40 MB.

### 4. Check it yourself first
Install the APK on the emulator (`eas build:run -p android --latest`) or a phone. Go through
`docs/ALPHA_TESTERS.md`, tap **Me → Settings → Send feedback** and check the form opens.

### 5. Send it to testers
Send the build page link (or the `.apk`) to 5 to 10 classmates, together with the message in
`docs/ALPHA_TESTERS.md`. Android will ask them to allow installing from this source; that is normal
for apps outside the Play Store. iPhone users can't install the APK; they would need Expo Go and
you running Metro, so start with Android classmates.

Read `docs/KNOWN_ISSUES.md` before you share, so you can tell testers what is not finished.
