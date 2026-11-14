# Run JARVIS on an Android TV (experimental test build)

This installs JARVIS **on** the television. The existing phone-to-TV ADB remote
feature is a different workflow. No physical television has been tested for these
changes by this development session.

User-reported target: Synix TV, device name `GoogleTV4254`, Android TV OS 14.
CPU ABI reported over the user's successful ADB connection: `armeabi-v7a, armeabi`.
This is a **32-bit ARM Android OS**; the existing ARM64-only workflow cannot produce
an installable APK for it. The new universal test APK includes ARMv7. Android 14
clears the API-level requirement; WebView behavior and the physical tests below
remain unverified. A more specific model number was not present in the supplied
About-screen information.

## Check the television

Open Settings → Device Preferences (or System) → About and record the exact model
and Android version. Android 7.0 / API 24 is the application's minimum. A smart TV
with a non-Android operating system cannot install this APK.

Enable developer options by selecting Build in About seven times, then enable the
TV's USB/network debugging option. On a computer with Android platform-tools,
connect using the address and port displayed by the TV. Older TVs commonly use
`adb connect TV_IP:5555`; newer wireless debugging may first need
`adb pair TV_IP:PAIRING_PORT` and then `adb connect TV_IP:DEBUG_PORT`. Accept the
connection prompt on the TV. Keep debugging on a trusted local network.

```sh
adb shell getprop ro.product.model
adb shell getprop ro.build.version.release
adb shell getprop ro.build.version.sdk
adb shell getprop ro.product.cpu.abilist
# If abilist is empty:
adb shell getprop ro.product.cpu.abi
adb shell dumpsys webviewupdate
```

Use the OS ABI, not a listing of the processor's hardware capabilities:

| ABI returned | Required native build |
| --- | --- |
| `arm64-v8a` | Tauri `aarch64` |
| `armeabi-v7a` (even on a 64-bit chip) | Tauri `armv7` |
| `x86` or `x86_64` only | Separate Intel build; the ARM test APK will not install |

The test APK includes both ARM ABIs. Update Android System WebView through the
TV's supported system/store mechanism before testing. Old or missing WebView can
prevent the React/Tauri app from starting even when the Android API level passes.
Some TV vendors do not provide an updatable compatible WebView.

## Build and download

The separate workflow `.github/workflows/tv-apk.yml` uses Node 24, Java 17, stable
Rust with both Android ARM targets, SDK 36 and pinned NDK 27.2.12479018. It runs the
web checks, builds a debug-signed universal APK, runs Kotlin tests, and checks the
APK's signature, ZIP alignment, test package, API level, launcher entry, banner,
optional hardware and both ARM native libraries.

Open [nattex12/jarvis → Actions → Android TV test APK](https://github.com/nattex12/jarvis/actions/workflows/tv-apk.yml).
If GitHub shows **I understand my workflows, go ahead and enable them**, enable
Actions for the fork first. Click **Run workflow**, select **main**, then click the
green **Run workflow** button. Refresh the page and open the new run. Wait for the
`apk` job to finish successfully, then use its summary's **Download jarvis-tv-test-apk**
link or the **Artifacts → jarvis-tv-test-apk** entry at the bottom of the run page.
Download the ZIP and extract `JARVIS-TV-test-arm-universal.apk`. Sign into GitHub
to run workflows and download artifacts. Artifacts expire after 14 days.
Changes to `.github/workflows/tv-apk.yml` on `main` or `codex/android-tv`
also run it automatically. Android SDK setup uses the action's supported
`accept-android-sdk-licenses: 'true'` input and an explicit package list;
the obsolete SDK package `tools` is excluded.
`SHA256SUMS`, APK metadata, signing output and commit SHA accompany it.
An unexecuted workflow is not evidence that an APK exists or that the build passes.

To build locally with the same toolchain configured:

```sh
cd jarvis-studio-gui
npm ci
# For a fresh package after switching from another build, clear only app outputs:
JARVIS_TV_TEST=1 bash src-tauri/gen/android/gradlew --project-dir src-tauri/gen/android :app:clean
JARVIS_TV_TEST=1 CARGO_BUILD_JOBS=2 npx tauri android build --ci --debug --apk --target aarch64 armv7
cd src-tauri/gen/android
bash ./gradlew :tauri-plugin-phone:testDebugUnitTest
```

The local output is
`jarvis-studio-gui/src-tauri/gen/android/app/build/outputs/apk/universal/debug/app-universal-debug.apk`.
Do **not** run `tauri android init` over the tracked project.

## Install and start

The opt-in `JARVIS_TV_TEST=1` build uses `com.jarvis.app.tvtest`, labelled
**JARVIS TV Test**. Its data and signature are separate from `com.jarvis.app`.
No release signing secrets are needed. Keep this APK for testing; it is debuggable
and is not a production release. Fresh CI runs may have different debug keys, so a
later test APK might not update an older test install. Do not uninstall to resolve
a signature conflict without backing up anything needed from that test install.

```sh
adb install -r JARVIS-TV-test-arm-universal.apk
adb shell am start -n com.jarvis.app.tvtest/com.jarvis.app.MainActivity
```

Alternatively copy the APK to a USB drive, open it with a TV file manager, and
allow **Install unknown apps** for that file manager when prompted. Menu labels
vary by TV. Open **JARVIS TV Test** from the TV launcher afterward.

Installation errors: `NO_MATCHING_ABIS` means the wrong CPU build;
`OLDER_SDK` means Android is below API 24; `UPDATE_INCOMPATIBLE` usually means a
different signing key for the same test package. Do not remove your main JARVIS app.

## Remote controls and remaining television acceptance

Native TV mode is selected from Android's television UI mode and marked in the
WebView user agent. `?tv=1` enables the same UI navigation in a browser for testing.
D-pad moves between controls; OK activates buttons; focus has a cyan outline.
Dialogs contain focus and restore it when closed. Fields retain caret editing;
Up at the beginning or Down at the end leaves a text area. Left/Right adjust
sliders/selects; Up/Down leave them. Back uses the existing native panel/back path.
A Bluetooth/USB keyboard or the TV's companion-phone keyboard helps enter API keys.

The reproducible Chromium smoke check is `scripts/tv-navigation.smoke.cjs`.
With Vite running on port 1420 and system Chromium installed, install Playwright
outside the checkout (no dependency/lockfile changes) and run:

```sh
npm install --prefix /tmp/jarvis-tv-browser playwright
NODE_PATH=/tmp/jarvis-tv-browser/node_modules node scripts/tv-navigation.smoke.cjs
```

`CHROMIUM_PATH` and `JARVIS_TEST_URL` override the default binary/server. The smoke
check tests the rendered app's TV focus setup and a real DOM fixture's spatial
movement, dialog containment/restoration, text caret, field escape and scrolling.

Test these on the actual TV, using only the remote first:

- Install, launcher banner, cold start, landscape layout, readable text and no
  overscan clipping at the TV's configured resolution.
- First-run guide, exploration without keys, settings, every needed input field,
  API-key entry, chat Send/Stop, long-list scrolling, nested dialogs, Back, Home,
  and resume. Check for lost focus, duplicate OK activation, or a keyboard trap.
- Configure your own provider key in the app; verify a typed chat response before
  trying voice. Keys belong in app settings, never source files or build logs.
- Microphone permission and actual recording, push-to-talk, spoken replies and
  optional wake word. A remote's voice-search microphone often belongs only to
  the system assistant; its presence does not mean JARVIS can capture audio.
  A supported USB/Bluetooth microphone may be needed. Never assume always-listening
  works in standby or in the background on this vendor's firmware.
- Optional accessibility control and opening TV apps (including apps with only a
  Leanback launcher activity). Enable only permissions needed for the test.
  Phone features such as SMS, calls, camera, biometrics, Clock intents and some
  settings controls may be absent or restricted on TVs. A TV launcher entry does
  not establish that every phone feature works.

Do not use the upstream phone release updater for this separate TV test package.
Do not run `adb shell am force-stop`: the repository documents that it can disable
accessibility. Relaunch with `am start` or reinstall the matching test APK instead.

For startup failures, capture the relevant crash locally with
`adb logcat -b crash -d` and inspect it for secrets before sharing. Record the
WebView version and ABI along with the failure. Browser checks cannot certify
native WebView behavior, permissions, microphone routing or vendor power handling.
