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

## 7 November 2026 — Android pose detection follow-up

The owner confirmed APK launch, camera permission and a full body visible in the preview during the failure. Both Pixel_7 AVD camera settings now point to Webcam0. In the original app, 54 consecutive calls on the live video element returned zero raw poses before tracker validation. The overlay therefore had no points to draw.

On Android System WebView 156.0.8078.50, the decoded frames and overlay backing canvas both measured 480 × 640. The portrait display fitted them into a 385 × 289 CSS box. Frame rotation metadata was 0°, flip was false and the preview had no CSS mirror. Media time advanced from 1.11 to 5.84 seconds and detector timestamps increased at roughly 11 calls/second. Downsampled luminance ranged from 16 to 109 out of 255. Only numeric measurements left the WebView.

The GPU initialized successfully on the emulator's OpenGL ES Translator (NVIDIA RTX 5050 Laptop GPU). For a known full-body reference rendered at 480 × 640, GPU inference returned zero poses on all four video calls and all four canvas calls. CPU inference returned one pose with 33 landmarks on every equivalent call, using the same VIDEO mode, model, WASM and thresholds. A separate eight-frame live sample gave zero poses on both delegates. The controlled test isolates a silent failure in the emulator GPU inference path. Identifying the responsible driver or GPU kernel would require lower-level tracing. [Google MediaPipe pose reference image](https://storage.googleapis.com/mediapipe-assets/pose.jpg)

The rebuilt APK selects CPU on native Capacitor Android. Browser training retains its GPU-first initialization and CPU fallback. The training page's **Inference diagnostics** panel reports the active delegate/mode, input and overlay dimensions, CSS size, screen angle, mirror setting, timestamps, completed inference count and rate, raw poses/landmarks, errors and the tracker decision. A stale-video tick has no inference result. Clock values are milliseconds, with video time relative to the stream and inference time relative to the page. The pose validation and repetition thresholds are unchanged.

Type checking, 37 unit tests, 4 Chromium regression tests and `pnpm android:build` passed. The rebuilt APK was installed and cold-launched on the Pixel 7. Its normal detector factory selected VIDEO/CPU and returned 33 landmarks on 8 of 8 reference-video frames. The diagnostic APK at the path above has SHA-256 `18dacb951dea5e3b9178d48cf32c52086e3f8721ab457bed516af1883aafa016`.

During a subsequent live check, the user stood in view of Webcam0. All 37 distinct panel samples across 11.8 seconds reported **1 raw pose and 33 raw landmarks** on VIDEO/CPU. The completed inference counter advanced from 5,609 to 5,809. The final reading was 17.1 FPS with no model error. The video and overlay were both 480 × 640, with screen rotation at 0° and preview mirroring off.

The tracker reported that neither side met its six-joint framing and visibility requirement throughout the sample. The panel identifies the failed gate but does not identify which joint failed it. Live Android pose detection is verified. Side-on extended-arm plank calibration and a physically counted push-up trial remain to be checked.

## Android hip calibration follow-up

The owner subsequently confirmed successful physical starting-plank calibration and Auto Start on Android. The previous panel had no per-joint history for the reported slow trials. Its 0% side-quality reading could result from any of six joints. The hip alignment gate uses the shoulder–hip–ankle angle. The knee gate uses hip–knee–ankle. Both use decoded pixel dimensions to correct normalized coordinates for aspect ratio.

**Live baseline on the original APK.** The owner moved into position while the Pixel 7 API 35 WebView used its normal CPU detector and Webcam0. Only numeric summaries were read. Of 181 detector calls, 98 returned zero poses. On the 83 pose frames, the first reported gate was insufficient shoulder-to-ankle horizontal span on 64 and joint visibility on 19. The width gate was 25% of 480 px, or 120 px. The original probe retained failure counts for span. The new panel reports the observed span in pixels alongside that minimum.

| Measured across pose frames | Left hip | Right hip |
| --- | --- | --- |
| Visibility | 0.997–0.999 | 0.998–0.999 |
| Presence | 0.992–1.000 | 0.994–1.000 |
| Shoulder–hip–ankle angle | 162.40–178.93° | 157.85–179.85° |
| Hip–knee–ankle angle | 157.31–179.95° | 153.39–179.96° |
| Hip displacement between successive pose frames | 0.30–40.39 px | 0.40–33.25 px |

Both hip confidence and alignment passed on the measured pose frames. Both the original and revised trackers withheld calibration when evaluated on these same outputs. The wide displacement range includes the player moving into position. An independent on-device control, using the public reference pose translated horizontally by up to 2 px, produced 33 landmarks on all 16 calls. The user's earlier slow but successful trials have no saved per-joint measurements.

The following controlled inputs exercised the original and revised trackers at 480 × 640 with a fresh observation every 60 ms. All single-interruption trials had reached 85% of the 1,200 ms hold before the interruption.

| Input | Original calibration | Revised Android preview |
| --- | --- | --- |
| One hip visibility dip from 0.95 to 0.59, alignment 180° | Reset to zero. Ready at 2,340 ms. | Paused at 85%. Ready at 1,320 ms. |
| Hip moved 4 px. Hip angle changed from 151.23° to 148.37°, knee from 158.40° to 156.37°, visibility stayed 0.95. | Reset to zero. Ready at 2,340 ms. | Paused at 85%. Ready at 1,320 ms. |
| Left side visibility 0.95 with a 132.85° hip. Right side visibility 0.90 and straight. | Selected left. Still waiting at 3,600 ms. | Selected right. Ready at 1,200 ms. |

**Acceptance limits.** Visibility remains ≥0.60, normalized coordinates must lie within [0.015, 0.985], hip and knee angles must be ≥150°, and the extended elbow must be ≥155°. Body span, slope, wrist positioning and the 1,200 ms hold retain their original limits. The MediaPipe model's detection, presence and tracking confidence settings remain 0.5. Per-landmark presence is displayed when the SDK supplies it. It is separate from the model-level presence threshold.

**Android preview timing.** Calibration requires at least 12 fresh, valid observations and 1,200 ms between consecutive valid observations. A marginal hip sample can pause an incomplete hold within a cumulative 180 ms interruption budget. The time from the last valid frame through recovery earns zero credit. The pause bands are 0.55–<0.60 hip visibility and 147–<150° hip alignment. The raw knee, elbow, framing and other joint checks must still pass. A reference hip averaged from up to three accepted observations within 180 ms must remain aligned, and the raw hip must be within 1% of the frame diagonal of that reference. The reference is used only to distinguish small fluctuations from movement. Every credited observation uses the raw hip. Missing or offscreen joints, larger deviations, persistent occlusion, resolution changes and frame gaps over 400 ms clear the evidence.

Before locking a side, Android preview prefers a side that meets the starting-plank gates. A held side keeps its own evidence. The modern Android WebView uses presented-frame media timestamps to skip repeats even when the playback clock advances. A failed observation cancels a pending Auto Start. Counting uses the existing raw-frame geometry and full-cycle state machine.

**On-device readings.** Open **Inference diagnostics → Left joint readings / Right joint readings**. Each row shows normalized x/y, visibility, optional presence and framing status. The panel also reports native-pixel hip displacement since the previous frame, elbow/hip/knee angles, hold time and valid observation count. **Last hold interruption** retains a numeric reason so a brief dropout remains inspectable between UI refreshes. A dash means unavailable.

**Verification.** TypeScript, 56 unit tests, seven Chromium tests and the Android debug build passed. Tests cover isolated hip jitter, brief and repeated dips, persistent occlusion, missing joints, true misalignment, insufficient horizontal span, recovery, side choice, minimum observations, duplicate presentations, cancellation of Auto Start and partial-rep rejection.

The final APK was installed on Pixel_7 and cold-launched. On the training page, the on-device check observed 10 fresh VIDEO/CPU inferences at 480 × 640, six diagnostic rows per side and no reported model error. The check stopped the camera. APK SHA-256: `52c8b0a7d12fa56d8a02aea8e5d4201f2148559f46bb6c2c64b831e359cfd3d6`.

For the next physical trial, position the camera level and side-on so the shoulder and ankle are both visible and horizontally separated by at least a quarter of the camera image. Check the measured span first, then inspect **Last hold interruption** if progress resets. Compare several time-to-ready trials in the same position. Physical Android rep accuracy still requires an independently counted exercise trial.
