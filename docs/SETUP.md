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
| **Supabase** | Phase 3 (task 3.1: accounts & sync) | **Now: see Part D below.** Create a project; put the **URL** and **anon key** into your own `.env` (see `.env.example`) and later into EAS environment variables. The **service_role** key never goes in the app, `.env` or the chat. | Free tier |
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
The APK stops working **14 days after the day you build it** (Kampala time). Testers see the
date when they first open it and in **Me → Settings → About**; after it, the app only shows "This
alpha has ended, please delete the app". This happens by itself for the `preview` profile, so
there is nothing to set. To pick another date for one build, add
`"env": { "ALPHA_EXPIRES_ON": "2026-11-30" }` to the `preview` profile in `eas.json` (or
`"off"` for no expiry). The number of days is `ALPHA_DAYS` in `app.config.js`. Expo Go and the
dev build never expire.

```bash
eas build -p android --profile preview
```
The `preview` profile builds only for modern 64-bit phones (`arm64-v8a`) and runs Gradle one task at a time. Building more chips, or in parallel, ran Expo's free build machine out of memory (the Gradle daemon got killed twice). Very old 32-bit phones cannot install this test APK. Use the `development` build for the PC emulator.

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

### Building the Alpha APK on your own PC (all phones)

Expo's free build machine runs out of memory, so build on your own Linux PC. This uses the `preview-local` profile, which includes older 32-bit phones too.

1. `git pull && npm install`
2. Check Java 17: `java -version` (install with `sudo apt install openjdk-17-jdk` if missing).
3. Check the Android SDK path: `echo $ANDROID_HOME` should print something like `/home/<you>/Android/Sdk`. If empty: `export ANDROID_HOME=$HOME/Android/Sdk`.
4. `eas build -p android --profile preview-local --local`
5. When it finishes it prints the path of the `.apk` file. Send that file to testers.

### If Expo's servers keep dropping the connection: plain Gradle build

This builds the Alpha APK with no Expo servers involved (it worked for Alpha 1, about 27 minutes on the 2014 MacBook Pro). The APK is signed with the default test key, not the Expo key, so testers must uninstall it before installing a later Expo-built APK.

```bash
git pull
export ANDROID_HOME=$HOME/Android/Sdk ANDROID_SDK_ROOT=$HOME/Android/Sdk
export EAS_BUILD_PROFILE=preview            # turns on the 14-day alpha expiry
export EXPO_PUBLIC_FEEDBACK_URL="<the Google Form link>"
npx expo prebuild -p android --clean        # makes android/ (git-ignored)
cd android
./gradlew assembleRelease -PreactNativeArchitectures=armeabi-v7a,arm64-v8a
```

Afterwards run `cd .. && git restore package.json` (prebuild rewrites the `android`/`ios` scripts; the change is not needed). The APK is `android/app/build/outputs/apk/release/app-release.apk`. If a download fails with a TLS "handshake" error, rerun the last line.

---

## Part D — Supabase, the online database (task 3.1)

Supabase will hold each student's notes, cards and progress once accounts and sync arrive (tasks
3.2–3.3). This part only creates the database and its safety rules; the app doesn't talk to it
yet, so nothing changes on the phone. It takes about 15 minutes and is free.

You need Node (you already have it) and a web browser. **Docker is not needed.**

### 1. Create the project

1. Go to <https://supabase.com> and press **Start your project**. Sign in with GitHub.
2. Press **New project**. If it asks for an organisation, make a free one called `lolesterrr`.
3. Fill in:
   - **Project name:** `dozi`
   - **Database password:** press **Generate a password**, then save it in your password manager.
     You'll need it in step 2. Never paste it into the chat or into `.env`.
   - **Region:** the one closest to Uganda in the list. If there's no Africa option, pick
     **Central EU (Frankfurt)** or **West EU (London)**.
   - Leave the other options as they are.
4. Press **Create new project** and wait about 2 minutes until the dashboard is ready.
5. Look at the address bar: `https://supabase.com/dashboard/project/<project-ref>`. The
   `<project-ref>` (20 lowercase letters) is your **project ref**. Copy it.

### 2. Put the tables and safety rules into the database

In a terminal on your PC:

```bash
cd ~/repos/DOZI
git pull
npx supabase@3.0.0 login                         # opens the browser; press Authorize
npx supabase@3.0.0 link --project-ref <project-ref>   # asks for the database password
npx supabase@3.0.0 db push --remote              # type y if it asks
```

The first `npx` line downloads the Supabase tool once (about 40 MB). `db push` should print:

```
Applying migration 20261103100000_user_tables.sql...
Applying migration 20261103100100_user_media_bucket.sql...
Finished supabase db push.
```

Check in the dashboard: **Table Editor** lists 21 tables (`cards`, `decks`, `notes`…), each
without a red "RLS disabled" warning, and **Storage** shows a private bucket called `user-media`.

### 3. Run the safety test

This proves that one student can never see or change another student's data.

1. In the dashboard open **SQL Editor** → **New query**.
2. Open `supabase/tests/database/rls_isolation.test.sql` from the repo in a text editor, copy
   **all** of it and paste it into the SQL Editor.
3. Press **Run**. If it warns about "destructive operations", press **Run this query** (the test
   undoes everything it did at the end, so nothing stays in the database).
4. **Passed:** a green result, usually one row that says `1..142`.
   **Failed:** a red error such as `ERROR: 2 tests failed of 142`. Copy the error to Claude.

(If you ever install Docker, `npx supabase@3.0.0 test db --remote` runs the same test and prints
each check.)

### 4. Copy the app's two public values into `.env`

1. In the dashboard: **Project Settings** → **API Keys** (or **Data API** for the URL).
2. Copy the **Project URL** (`https://<project-ref>.supabase.co`) into `.env` as
   `EXPO_PUBLIC_SUPABASE_URL=`.
3. Copy the **publishable** key (starts with `sb_publishable_`; older projects call it the
   **anon public** key) into `.env` as `EXPO_PUBLIC_SUPABASE_ANON_KEY=`.
4. **Never copy the secret / `service_role` key** anywhere: not into `.env`, the app or the chat.

These two values are safe to ship in the app: the safety rules from step 2 decide what each
signed-in student may see. They're used from task 3.2.

### 5. Tell Claude

Say "Supabase is set up and the safety test passed" (or paste any error). Claude then ticks task
3.1 and can start 3.2 (sign-in).

### When the database changes later

New tasks add files to `supabase/migrations/`. After `git pull`, run
`npx supabase@3.0.0 db push --remote` again; it only applies the new ones.

---

## Part E — Turning on sign-in (task 3.2)

Sign-in is optional in the app. These steps switch on the two ways to sign in. Do them in the
Supabase dashboard (and Gmail / Google Cloud). About 30 minutes.

### 1. Make the email show a code (15 minutes)

Supabase only lets you change the email once you connect your own email sender (SMTP). A free
Gmail account works and needs no website or domain:

1. Use a Gmail account for the app (a new one such as `dozi.study@gmail.com` is tidiest).
2. Turn on **2-Step Verification** for it: <https://myaccount.google.com/security>.
3. Make an app password: <https://myaccount.google.com/apppasswords> → name it `Supabase` →
   **Create**. Copy the 16-letter password (spaces don't matter). It goes only into Supabase.
4. Supabase → **Authentication** → **Emails** → **SMTP Settings** → switch on **Enable custom
   SMTP** and fill in:
   - **Sender email:** the Gmail address · **Sender name:** `Dozi`
   - **Host:** `smtp.gmail.com` · **Port:** `465`
   - **Username:** the Gmail address · **Password:** the app password
   - Press **Save**.

Gmail allows about 500 emails a day, plenty for testing and the alpha. Supabase normally emails
a link; Dozi asks for the 6-digit code instead, so now change the template to show it:

5. Still in **Authentication** → **Emails**, open the **Templates** tab.
6. Open the **Magic Link** template. Set **Subject** to `Your Dozi sign-in code` and replace the
   whole **Body** with:

   ```html
   <h2>Your Dozi sign-in code</h2>
   <p>Type this code in the Dozi app:</p>
   <p style="font-size:28px;font-weight:bold;letter-spacing:4px">{{ .Token }}</p>
   <p>If you didn't ask for it, you can ignore this email.</p>
   ```

7. Press **Save**. Do the same for the **Confirm signup** template (a brand-new email gets that
   one the first time).

If the email doesn't arrive, check Spam, and Supabase → **Authentication** → **Rate Limits**
(emails per hour). You can test Google sign-in (step 3) without any of this.

### 2. Allow the app's return address (2 minutes)

Supabase → **Authentication** → **URL Configuration** → **Redirect URLs** → **Add URL**, and add
both of these:

- `dozi://auth/callback` (the installed app)
- `exp://**` (Expo Go on your iPhone)

### 3. Google sign-in (15 minutes)

1. Supabase → **Authentication** → **Sign In / Providers** → **Google**. Copy the **Callback URL**
   it shows (`https://<project-ref>.supabase.co/auth/v1/callback`). Leave this tab open.
2. Go to <https://console.cloud.google.com>, sign in, and create a project called `Dozi` (project
   picker at the top → **New project**).
3. Open **APIs & Services** → **OAuth consent screen** (it may be called **Google Auth Platform**).
   Press **Get started**: app name `Dozi`, your email as support email, audience **External**,
   your email as contact. Finish.
4. Under **Audience** → **Test users**, add your own Gmail address. (While the app is in
   "Testing", only test users can sign in. That's what we want for now.)
5. Open **Clients** (or **Credentials** → **Create credentials** → **OAuth client ID**):
   - **Application type:** Web application
   - **Name:** `Dozi Supabase`
   - **Authorised redirect URIs** → **Add URI**: paste the Callback URL from step 1.
   - Press **Create**. Copy the **Client ID** and the **Client secret**.
6. Back in the Supabase Google tab: switch **Enable Sign in with Google** on, paste the Client ID
   and Client secret, press **Save**.

The Client secret goes only into Supabase, never into `.env`, the app or the chat.

### 4. Try it in Expo Go

```bash
cd ~/repos/DOZI
git fetch origin && git switch claude/task-3.2-sign-in && git pull   # the test branch
npm install                        # two new packages
npx expo start --go -c             # -c makes sure the .env values are picked up
```

On the iPhone: **Me** → **Account** (the row only appears when `.env` has the Supabase values).

- **Email:** type your email → **Email me a code** → type the 6 digits from the email →
  **Sign in**. You should see "Signed in. Bienvenue!" and Me → Account says "Signed in as …".
  Your notes, decks and streak are all still there.
- **Google:** **Continue with Google** → pick your Google account → you come back to Dozi signed in.
- **Sign out:** Me → Account → **Sign out**. A warning says how many changes haven't been backed
  up yet (all of them, until sync arrives in task 3.3). Your study stays on the phone.
- Then check Supabase → **Authentication** → **Users**: your email is listed.

On the Android emulator you need a new development build first (the secure storage package is
native code): `eas build -p android --profile development`.

For a shared APK, add `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` to the EAS
environment (like the feedback link in Part C). Without them the APK simply has no Account row.
