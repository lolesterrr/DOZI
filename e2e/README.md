# End-to-end flows (Maestro)

`alpha-flow.yaml` walks the main path of the app: first launch → skip setup → note → deck with a
card → review → quiz.

## Run it

1. Install Maestro: https://docs.maestro.dev/getting-started/installing-maestro (Linux/macOS: one
   `curl` command; it needs Java).
2. Start the Android emulator (or plug in a phone) and install a build of the app (the `preview`
   APK from `eas build -p android --profile preview`, or the development build with Metro running).
3. From the project folder: `maestro test e2e/alpha-flow.yaml`

The flow starts with `clearState: true`, so it **erases the app's data** on that device.

It was written without a device to test on, so expect to adjust a line or two the first time.
The card fields are a rich-text editor inside a WebView, which is the likeliest place to need a
tweak.
