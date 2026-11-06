# Android Phase A — Capacitor packaging

Verification date: 6 November 2026. The existing React application builds as a native debug APK. Android account connectivity and physical push-up recognition are separate acceptance gates.

## Architecture and files

The frontend remains in `UI design/REP RIVALS Fitness Arena`. Capacitor Core, CLI and Android are pinned to **8.6.0** in its pnpm manifest and lockfile. `capacitor.config.ts` defines `REP RIVALS`, `com.reprivals.app`, and `webDir: 'dist'`. The native project is `android/` within that same frontend package.

Capacitor serves copied assets at `https://localhost` inside the Android WebView. This is an internal asset origin, not a connection to the Windows computer. No live Vite `server.url`, remote navigation allowlist, native HTTP override, or database configuration is present. Mixed content and Android cleartext traffic are disabled. Native WebView backup is disabled. Capacitor's built-in SystemBars native inset handling preserves the existing CSS around Android system bars.

The React routes, authentication code, CSS, MediaPipe modules and original tests have no source edits. The backend and migrations have no edits. Android packaging adds a Vite `android` build mode that fixes the asset base at `/` and removes development WebSocket allowances from the packaged connection policy. Normal browser builds and localhost development retain their existing configuration.

| Location | Change |
| --- | --- |
| Root `.gitignore` | Ignore `.tools/` local build prerequisites. |
| Frontend `package.json`, `pnpm-lock.yaml` | Pinned Capacitor dependencies and Android commands. |
| Frontend `capacitor.config.ts`, `tsconfig.json` | Native configuration and its TypeScript checking. |
| Frontend `vite.config.ts` | Android asset base and connection policy. |
| Frontend `scripts/check-android-assets.mjs` | Verify copied build files, versioned model/WASM and absence of database configuration. |
| Frontend `android/` | Generated Gradle wrapper, project/module configuration, MainActivity, manifest and launcher resources. |
| This document | Build results, platform differences and manual acceptance checks. |

The native template's unused Google Services integration, file-sharing provider and sample tests were removed. No Firebase service or Capacitor camera plugin is installed. Template launcher icons and splash artwork remain placeholders. Generated web copies, APKs, `.gradle/`, `.idea/`, `local.properties`, and signing keys are ignored. Commit the native source project and wrapper, not its generated output.

## Toolchain and commands

Verified package tooling is Node 24.19.0 and pnpm 12.16.1. The native template uses Android Gradle Plugin 8.13.0, Gradle 8.14.3, Java 21 source compatibility, minSdk 24 and compile/target SDK 36. A target SDK of 36 can run on the available API 35 emulator. [Capacitor 8 requirements](https://capacitorjs.com/docs/updating/8-0)

The installed Android Studio is 2026.1.3 and bundles Java 25. Gradle 8.14.3 needs a compatible runtime, so this workspace uses checksum-verified Temurin **21.0.13+9** under ignored `.tools/`. No system Java setting was changed. SDK Platform 36 revision 2 and Build Tools 35.0.0 were added from checksum-verified official Google archives to the existing SDK. Previously installed SDKs and the Pixel 7 AVD were retained. The Gradle wrapper uses the smaller official binary distribution with a pinned SHA-256. [Gradle Java compatibility](https://docs.gradle.org/current/userguide/compatibility.html)

From a fresh checkout, install JDK 21, SDK Platform 36, Build Tools 35.0.0 and Android Platform Tools through your normal toolchain setup. Configure `ANDROID_HOME` or ignored `android/local.properties` for your SDK. In Android Studio choose JDK 21 under Settings → Build, Execution, Deployment → Build Tools → Gradle. This machine also has an ignored `android/.gradle/config.properties` with its local JDK path for `GRADLE_LOCAL_JAVA_HOME`.

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
pnpm install --frozen-lockfile
$env:JAVA_HOME = 'C:\projects\Rep Rivals\.tools\jdk-21.0.13+9'
pnpm typecheck
pnpm test
pnpm android:build
pnpm android:open
```

`android:build` is a Windows command. It runs `android:sync` before `gradlew.bat assembleDebug`. `android:sync` runs the existing `setup:vision`, builds with `--mode android`, executes normal `cap sync android`, then verifies the copied assets. No Vite server is needed to run the APK. Re-run it after changing web code. On other operating systems run `./gradlew assembleDebug` from `android/` after `pnpm android:sync`.

The browser workflow remains available.

```powershell
pnpm setup:vision
pnpm dev --host 127.0.0.1 --port 5173
# In another terminal, start the unchanged backend using docs/PHASE-2B.md.
```

For a browser production build use `pnpm build`. It writes the shared `dist` directory. Always run `pnpm android:sync` again before building the APK. To run the existing browser suite on an unoccupied port, set `$env:REP_RIVALS_TEST_PORT='5183'` and run `pnpm test:browser`.

## Camera and local inference

The application declares `INTERNET` and `CAMERA`. Camera hardware is optional so the existing missing-camera handling can run. No microphone, broad storage, location or media-library permissions were added. The merged APK also contains AndroidX's app-scoped signature permission `com.reprivals.app.DYNAMIC_RECEIVER_NOT_EXPORTED_PERMISSION`, which protects internal broadcast receivers and grants no device capability.

The existing `getUserMedia({audio:false, video:...})` request runs only after the player enables the camera. Capacitor 8.6.0's installed `BridgeWebChromeClient.onPermissionRequest` maps WebView video capture to Android's `CAMERA` runtime permission, waits for the platform result, then grants or denies the WebView request. The standard BridgeActivity retains that handler. No unconditional permission-grant code was added. See the [Android WebView permission contract](https://developer.android.com/reference/android/webkit/PermissionRequest).

`setup:vision` copies WASM from `@mediapipe/tasks-vision` 1.2.0 and verifies the official Lite model version 1 against SHA-256 `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. Vite includes `public/vision` in `dist/vision`, and Capacitor copies it to `android/app/src/main/assets/public/vision`. The verifier checks every build file against its copied counterpart and checks the model and installed WASM independently. The Android HTML retains `connect-src 'self'`, so inference assets load locally and external SDK telemetry remains blocked.

## Authentication compatibility

| Browser today | Packaged Android today |
| --- | --- |
| Relative `/api/auth/*` reaches the Vite proxy, then the local Express server. | `/api/auth/*` resolves against the internal WebView asset origin. There is no API proxy in the APK. |
| Cookie requests use `credentials: 'include'`. | The same frontend code is retained, but no reachable account service is configured. |
| Backend POSTs require an allowlisted Origin and JSON. Production cookies use Secure, HttpOnly and SameSite=Lax. | A remote HTTPS API would be cross-site from `https://localhost`. Allowing the origin alone would not fix SameSite=Lax cookie delivery. |

Android registration, login, account retrieval and session restoration are **not ready** in this phase. No real credentials should be entered during packaging tests. No API destination, emulator-host HTTP address, Neon URL or password was embedded. The browser API proxy remains server-side Vite configuration and is not bundled as the Android backend.

Before enabling Android accounts, deploy a trusted HTTPS API and explicitly design its native origin and cookie transport. A WebView fetch approach needs an exact API destination in the frontend and CSP, exact credentialed CORS, preserved CSRF protections, and a reviewed cross-site cookie policy. SameSite=None requires Secure, and WebView third-party-cookie restrictions must also be tested. Do not broadly disable CSRF, permit arbitrary origins, enable cleartext traffic, or assume that `https://localhost` uniquely identifies this application. If native networking or a different session transport is selected, review credential storage and revocation separately. No such changes were made here.

## Verification record

| Check | Result |
| --- | --- |
| pnpm installation | Matching Capacitor 8.6.0 packages installed. |
| `pnpm typecheck` | Passed, including Capacitor configuration. |
| `pnpm test` | All 35 existing CV/camera/tracker tests passed. |
| `pnpm test:browser` on port 5183 | All 4 Chromium tests passed, including real MediaPipe initialization against a fake test-pattern feed and camera cleanup. |
| `pnpm build` | Browser production build passed. |
| `pnpm android:sync` | Asset setup, Android production build, Capacitor sync and copied-asset verification passed. |
| Gradle debug build | Passed with JDK 21 and the installed SDK components. The complete documented `pnpm android:build` command also passed without special network flags. |
| APK inspection | Correct package ID/name, minSdk 24, targetSdk 36, camera/Internet permissions and disabled cleartext/backup. All 14 built web files match their APK entries. Model and WASM checksum checks passed. |
| Secret checks | All uncompressed APK entries checked against the actual root database URLs and passwords without printing their values. No matches. No environment files or database configuration found in packaged assets. Root `.env` remains ignored and untracked. |
| Source preservation | Git comparison confirms no changes in backend, frontend `src/`, or original tests. No database connection or migration was run. |
| Android Studio | `pnpm android:open` executed, but the project window was not confirmed. Desktop interaction was stopped by the user with Escape before completing verification. |
| Emulator runtime | Pixel_7 API 35 emulator detected. APK installation, launch, camera permission prompts and inference were not tested. |
| Real-person Android push-up counting | Not performed. |
| Android authentication | Blocked on a secure API integration decision. No login success claimed. |

Initial build setup encountered a Gradle distribution timeout and Java repository DNS/TLS failures. The official distribution was downloaded with PowerShell, verified, and placed in Gradle's wrapper cache. Dependency resolution subsequently progressed using TLS 1.2. No certificate verification was disabled, no HTTP repository was added, and no machine-specific proxy was committed.

The final build still emits the Capacitor template's `flatDir` repository warnings. An earlier run also warned about the newer installed SDK metadata format. Neither prevented the completed build. The desktop UI step remains unverified because Computer Use was stopped, not because Gradle failed.

## Generated APK

```text
C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena\android\app\build\outputs\apk\debug\app-debug.apk
```

The final APK is 26,516,146 bytes (about 25.3 MiB), debug signed, with SHA-256 `b36e247ea4f81014eb48a909f37113873cc4278938919c65016dac9ba899d721`. It is not a release-signed store artifact.

To install manually on the existing emulator, run from the frontend directory.

```powershell
& 'C:\Users\capts\AppData\Local\Android\Sdk\platform-tools\adb.exe' -s emulator-5554 install -r 'android\app\build\outputs\apk\debug\app-debug.apk'
& 'C:\Users\capts\AppData\Local\Android\Sdk\platform-tools\adb.exe' -s emulator-5554 shell am start -n com.reprivals.app/.MainActivity
```

Alternatively, open the frontend's `android/` folder in Android Studio, select JDK 21 and Pixel 7, and run the app. Confirm the project path before building if Studio still shows a different project.

## Required manual emulator and device checks

Use the installed APK on Pixel 7 / Android 15 / API 35 and repeat on a physical Android phone. The current AVD uses an emulated front camera and a virtual-scene rear camera. These feeds cannot establish physical push-up accuracy.

1. Cold-launch the APK without Vite. Navigate home → training → back and open login/registration. Check text, touch targets, keyboard, system insets, rotation, Android Back and process relaunch.
2. Confirm no camera prompt appears on launch or navigation. Tap Enable camera, deny permission and check the error. Retry, grant permission, and confirm a moving preview. Test permission revocation through Android Settings and recovery.
3. Verify that packaged model/WASM loads without network access. Check zero calibration and zero reps when no complete person is visible. An initialized model or a moving emulator feed is not a successful physical pose test.
4. Disable the camera, leave training, background the app, lock/unlock, rotate and resume. Confirm camera indicators turn off when appropriate and no duplicate loops or invented reps occur.
5. On a physical device, calibrate a fully visible side-on person and compare 10 independently counted push-ups with accepted reps. Repeat facing both directions. Test partial reps, occlusion, lighting and tracking loss. Record latency, accuracy and thermal behavior.
6. After the future secure Android API integration, test real registration, login, refresh/relaunch persistence, expiration and logout invalidation against development. Check HttpOnly/Secure cookies and CSRF rejection on the actual WebView.

Release signing, store distribution, final icon/splash branding, Android authentication and physical-device CV acceptance remain future work. Use an updated Android System WebView; the native minSdk alone does not establish compatibility with an old WebView's JavaScript, WebGL or MediaPipe runtime. No backend, migration, database, multiplayer, rewards or avatar work is part of this phase.
