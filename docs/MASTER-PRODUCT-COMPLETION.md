# REP RIVALS gameplay and local demonstration

## Run the demonstration

Use Node 24, pnpm, the installed JDK 21 and Android SDK. Keep the pooled and direct **development** database settings in the ignored root environment. The gameplay migration is already installed there. Run one backend for both players. Two backend processes have separate room managers even when they share a database.

**1. Prepare the backend and run the private HTTPS server** in PowerShell.

```powershell
cd "C:\projects\Rep Rivals\backend"
pnpm install --frozen-lockfile
pnpm build
pnpm android:tls
$env:REP_RIVALS_DEV_DNS = 'google'
pnpm android:https
```

The optional scoped DNS fallback is needed on this workstation. The script verifies the pinned development compute and matching branch metadata on both connections before listening on loopback port 4443. Its certificate and private key stay in ignored local tooling. The public Render service is separate and stays health-only.

**2. Start the browser rival** in another terminal.

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
pnpm install --frozen-lockfile
pnpm setup:vision
$env:REP_RIVALS_API_PROXY = 'https://127.0.0.1:4443'
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path '../../.tools/android-auth-tls/res/raw/rep_rivals_dev_ca.pem').Path
pnpm dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Vite proxies both HTTP account requests and WebSocket upgrades to the same TLS listener. Node validates the local server certificate with the test CA. The browser uses a same-origin cookie. For two browser-only players, the [root README](../README.md) also describes the ordinary HTTP development backend. Use different browser profiles for separate accounts.

**3. Build, install and open the emulator APK.** Boot the Pixel_7 API 35 AVD. Use a third PowerShell terminal.

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
$env:JAVA_HOME = 'C:\projects\Rep Rivals\.tools\jdk-21.0.13+9'
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:REP_RIVALS_EMULATOR_TLS = '1'
pnpm android:build
$adb = Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
& $adb -s emulator-5554 reverse tcp:4443 tcp:4443
& $adb -s emulator-5554 install -r 'android/app/build/outputs/apk/debug/app-debug.apk'
& $adb -s emulator-5554 shell am start -n com.reprivals.app/.MainActivity
```

This is the private demo debug variant. Its network policy trusts the project test CA only for the emulator loopback endpoint. The compiled WebView policy allows its configured WSS destination. A hosted variant uses the existing public-origin build setting and excludes development trust. Public gameplay depends on the separate [Render ingress and activation work](PHASE-3A.md). Rebuild the APK after rotating its test certificate.

**4. Present the workout and match.**

1. Register separate players on the emulator and in Chromium. Open the dashboard and select an outfit. New accounts start with zero balances.
2. From the dashboard select **Train solo**, enable the camera, and hold a side-on starting plank. Start manually or enable Auto Start. Complete full push-ups and select **End session**. Compare the local count with the saved official count in the profile. From Home, solo training defaults to local-only and requires no account traffic.
3. Host a room in the arena. Enter the eight-character code on the other client. Each player enables their camera and calibrates before selecting **Ready to battle**. Allow five seconds of countdown, then compete for 60 seconds. The server broadcasts both scores.
4. At the deadline inspect the winner or draw, scores and base match reward. Open the dashboard for history, lifetime totals and any daily bonuses. Return to the lobby for another round.
5. For a two-person physical demonstration, each device needs an independent camera view. When the emulator and desktop share one webcam, use the repeatable fixture demonstration below to exercise networking. Stop the private listener and remove the temporary mapping when finished with `adb -s emulator-5554 reverse --remove tcp:4443`.

## Architecture and data

React keeps the theme, original hero art, account screens and camera UI. Home links to the real arena, training and dashboard. The old Figma preview component remains in source and is outside the playable routes. The player hub has dashboard, profile/history and progression URLs. Results are a state of the private arena. Data comes from the authenticated server. Empty accounts display empty history.

The unchanged MediaPipe tracker invokes its existing accepted-rep callback after a complete validated movement cycle. The solo page can open a server-timed activity when training actually starts. Selecting End finalizes it. Hiding or abandoning the camera leaves the interrupted session unsaved. If connectivity fails, the local count continues. An unconfirmed save must be checked in history; a client never replays offline totals for credit. An interrupted solo activity can be discarded and expires after 30 minutes.

Prisma migration `20261108000100_gameplay` added four tables. The reviewed SQL was checked against SHA-256 `d5464c1f841b8bb114ede5af51f5e277cecce90d960a375eb4496eb5f6fab0ec`. Before deployment the pinned development database contained only users, authentication sessions and Prisma migration history. Both pool and direct runtime metadata were verified. After deployment the development branch ID was `br-flat-hat-b35pchm8`, Prisma recorded the expected finished checksum, and all four tables had their check constraints.

| Table | Responsibility |
| --- | --- |
| PlayerProfile | One customization row per existing user. Older users receive the default ember kit until they select an outfit. |
| Activity | Server-assigned workout or match UUID, kind, start and end. Only completed activities are durable. |
| ActivityPlayer | Unique activity/user pair, accepted score, outcome and server acceptance offsets. The array length must match the score. |
| Reward | Unique user/source ledger entries, nonnegative XP and crystals. Balances and rank are derived from the ledger; there is no independent writable balance. |

The activity, all participants, rewards and daily bonuses commit together. Retrying an already inserted activity cannot pay it twice. Lifetime statistics are aggregated independently of the latest 25 history entries. Daily progress and completion are determined by unique UTC-day reward records. Table relationships reuse the account UUID. Camera frames, landmarks and pose histories are never persisted.

## Authentication and wire protocol

Browser and Android reuse their existing account routes, Argon2id hashes and revocable sessions. Authenticated JSON POST to `/api/auth/ticket` (browser) or `/api/auth/native/ticket` (Android) mints a 32-byte random single-use game ticket with a 15-second lifetime. Ticket issuance uses the existing browser Origin/CSRF or native HTTPS checks. Only a digest is kept in server memory. The pending ticket is bound to its origin and session. A fresh issue replaces an unused ticket for that session.

On Android the fixed native bridge operation reads the encrypted vault and returns only the short-lived ticket and public API origin. React opens Socket.IO with the ticket in the handshake auth payload. Persistent bearer credentials remain native. The server requires an allowed WebSocket Origin, consumes the ticket, validates the session again and derives the player identity. Connections revalidate on commands, with at most a two-second cache for rep intake and a 15-second periodic check for idle connections. Health-only startup attaches neither the game router nor Socket.IO.

| Client command | Server behavior |
| --- | --- |
| profile / outfit | Return the caller's progression or persist an allowlisted kit. |
| create {kind} / join {code} | Open solo or private battle activity, or take the second slot. One unfinished activity per user. |
| ready {id} | Both members must be ready and online. Publish one start time and deadline. |
| rep {id, seq, observed} | Validate membership, room, state, increasing sequence and observed timestamp, a fresh event within three seconds of receipt and the match window. Validate at least 500 ms between accepted server receipt offsets, including the first rep. Queued events older than 1.5 seconds are dropped. |
| finish {id} / leave {id} | The owner may finish or discard solo training. Lobby members can cancel a pending room. Active battles retain their original deadline. |

Commands are acknowledged. A `welcome` snapshot and `room` updates carry server time, member presence, score, phase and result. Raw client score totals have no command. An accepted rep advances the official sequence and score. Socket packets are bounded, schema-validated and serialized per connection. Access to a private code alone grants no account identity.

Battle phases are WAITING, READY, COUNTDOWN, ACTIVE, SAVING and COMPLETED. The in-memory single-process clock starts the five-second countdown once and fixes the deadline 60 seconds after the start. Two competitors maximum. Scores lock at the deadline, then persistence retries transient failures before the result is broadcast. Disconnecting or backgrounding stops local capture without pausing the server clock. Reconnect with a new ticket to recover the same active room. Waiting rooms and completed snapshots expire after ten minutes. A server restart abandons unfinished rooms without issuing rewards. Committed history survives restarts. Horizontal scaling and durable live-room recovery are deferred.

## Rewards and 3D rendering

Each accepted rep earns 5 XP. Each full group of three earns one crystal. A winner with at least one accepted rep earns an additional 25 XP and three crystals. An activity with zero accepted reps earns nothing. Draws receive base rep rewards. Each UTC day, finishing one activity with five or more accepted reps adds 15 XP and two crystals. Completing a battle with at least one accepted rep adds another 10 XP and one crystal once per day. Noob starts at 0 XP, Elite at 300, Titan at 1,500. All three outfits are free. Crystals have no monetary value.

Three.js renders low-poly articulated humanoids with torso, head, limbs, kits and joint pivots. The lobby uses an idle pose, ready players take their stance, and each score increase triggers its player's push-up motion. A win raises the arms; defeat and draws use distinct end poses. The GPU scene is lazy-loaded and capped to roughly 25 frames/second with limited pixel density. It pauses offscreen and on hidden pages and disposes geometry, materials, observers, animation callbacks and the renderer. Context loss displays an explicit retry fallback. Visual animation cannot issue scores.

Server validation constrains timing, identity and duplication. Plausible fabricated movement from a modified client remains possible. The local demo is designed for friendly competition. Independently attested motion, paid cosmetics, public matchmaking, release signing and distributed servers are outside this implementation.

## Repeatable verification

Run `pnpm typecheck`, `pnpm db:validate`, `pnpm build`, `pnpm test`, `pnpm verify:auth`, and `pnpm verify:game` in the backend. The last two use disposable development accounts. The game test runs an actual 60-second round with two authenticated socket clients. It tests denial and reuse of tickets, ordering, duplicate rejection, reconnection, deadline enforcement, database idempotency, daily rewards and history using explicit protocol fixtures.

In the frontend run `pnpm typecheck`, `pnpm test`, `pnpm build`, and `pnpm test:browser`. Finish Android asset setup/build before starting the browser regressions; setup rewrites the files that Vite watches.

For the linked emulator/browser test, install the local APK, boot Pixel_7 and leave ports 4443 and 5173 free. The harness owns its temporary listener, Vite server, ADB mapping and disposable accounts. From the backend:

```powershell
$env:ANDROID_HOME = "$env:LOCALAPPDATA\Android\Sdk"
$env:NODE_EXTRA_CA_CERTS = (Resolve-Path '../.tools/android-auth-tls/res/raw/rep_rivals_dev_ca.pem').Path
$env:REP_RIVALS_DEV_DNS = 'google'
$env:REP_RIVALS_VERIFY_GAME = '1'
pnpm verify:android
./scripts/inspect-android-apk.ps1 -Flavor Emulator
```

The emulator uses the actual packaged app. The isolated Chromium rival substitutes deterministic landmarks at the detector boundary, then uses the normal counter, callback, UI and authenticated network path. The fixture is confined to the test browser. Two-person physical counting, physical-device performance and public Render multiplayer are separate acceptance tasks.

## Verification record — 8 November 2026

| Check | Observed result |
| --- | --- |
| Backend and database | TypeScript, Prisma validation, production build, all 20 backend unit tests and the Neon-backed auth and game checks passed. The development branch metadata, finished migration checksum and four gameplay tables matched. No migration was run during the continuation. |
| Protocol and rewards | The protocol suite exercised the two-player limit, duplicate and out-of-order events, reconnect, deadline, winner and draw handling. Concurrent finalization and another eligible match did not duplicate ledger entries or the daily bonus. |
| Browser and CV regression | Frontend TypeScript and production build passed. All 56 existing CV tests and all seven browser regression tests passed across the implementation and continuation. No changes to the computer-vision source directory. |
| Saved solo workout | A separately authenticated Chromium player calibrated against deterministic test landmarks, started solo training, completed one full cycle and ended the session. The UI reported one official saved rep and the entry appeared in history. This checks the production callback, transport and persistence path, not human detection accuracy. |
| Pixel 7 versus Chromium | The packaged app and browser used the same local HTTPS server with separate accounts. Both saw the countdown; the emulator received the browser's accepted fixture rep. The server closed the 60-second round. The browser won 1–0. Its profile contained one solo workout, one win, two total reps, 45 XP and four crystals. The emulator displayed the named winner and saved history. Hardware Back from progression returned to the profile. |
| Native auth | On the final APK, registration, cold relaunch and session restore, outage and retry, logout, revoked-credential replay denial, invalid password and expiry all passed. The harness cleaned up its disposable accounts and sessions. |
| 3D and packaging | The Pixel 7 submitted indexed WebGL geometry. Sampled pixels from the avatar canvas placed the two outfit colors at distinct positions, and the portrait view fit the viewport. This was a rendering smoke test, not a handset frame-rate benchmark. Capacitor sync, Gradle debug build and APK inspection passed. All 17 packaged web files matched; the pinned MediaPipe model and WASM assets were present. The inspection matched the emulator API origin and its scoped CA trust and passed credential scans. |
| Human camera trial | The real emulator camera initialized MediaPipe in VIDEO mode on CPU and intermittently returned 33 landmarks. During a five-minute attempt, a right-side sample showed shoulder confidence 0.992, hip 0.007, knee 0.075 and ankle 0.037. Tracking did not sustain calibration. The app accepted zero reps; no human workout or reward was verified. The camera was closed and the disposable account removed. No camera frames were retained. |

The final evaluator fixes separate a completed solo result from the battle lobby, restrict room updates to current members and prevent a discarded React effect from requesting a ticket that invalidates the live connection. Android navigation was tested with a real link tap and a hardware Back event.

**Artifact:** `UI design/REP RIVALS Fitness Arena/android/app/build/outputs/apk/debug/app-debug.apk`, package `com.reprivals.app`, SHA-256 `3D775328704A47B3727C1DB8655D2F1066EF1F1A21F84E8A6445EC339D8EF711`. This APK is for the private emulator demo. Render settings were not changed.

**Acceptance:** The automated local evaluator demonstration passed. A saved workout from new human Android camera input is still pending. Retry the supervised procedure below with the hip, knee and ankle fully visible side-on. The earlier four-push-up test remains detector evidence only; it did not establish a saved workout in this build. Two people exercising simultaneously and a physical Android handset were not tested.

## Reviewed working tree

Implementation started from `d5d5c74` on `main`. The following 33 files make up the product change, including the prior interrupted work. Generated bundles, build output and test credentials are excluded.

- `README.md`
- `UI design/REP RIVALS Fitness Arena/android/app/src/main/java/com/reprivals/app/AccountPlugin.java`
- `UI design/REP RIVALS Fitness Arena/package.json`
- `UI design/REP RIVALS Fitness Arena/pnpm-lock.yaml`
- `UI design/REP RIVALS Fitness Arena/scripts/check-android-assets.mjs`
- `UI design/REP RIVALS Fitness Arena/src/app/AppRouter.tsx`
- `UI design/REP RIVALS Fitness Arena/src/features/auth/AccountPages.tsx`
- `UI design/REP RIVALS Fitness Arena/src/features/auth/api.ts`
- `UI design/REP RIVALS Fitness Arena/src/features/solo-training/TrainingPage.tsx`
- `UI design/REP RIVALS Fitness Arena/vite.config.ts`
- `backend/package.json`
- `backend/pnpm-lock.yaml`
- `backend/prisma/schema.prisma`
- `backend/scripts/dev-https.mjs`
- `backend/src/app.ts`
- `backend/src/routes/auth.ts`
- `backend/src/server.ts`
- `backend/tests/live-android.mjs`
- `UI design/REP RIVALS Fitness Arena/src/features/game/Avatars.tsx`
- `UI design/REP RIVALS Fitness Arena/src/features/game/GamePages.tsx`
- `UI design/REP RIVALS Fitness Arena/src/features/game/SoloPersistence.ts`
- `UI design/REP RIVALS Fitness Arena/src/features/game/connection.ts`
- `UI design/REP RIVALS Fitness Arena/src/features/game/game.css`
- `UI design/REP RIVALS Fitness Arena/tests/live/game-rival.mjs`
- `backend/prisma/migrations/20261108000100_gameplay/migration.sql`
- `backend/src/game/arena.ts`
- `backend/src/game/socket.ts`
- `backend/src/game/store.ts`
- `backend/tests/android-game.mjs`
- `backend/tests/android-workout.mjs`
- `backend/tests/arena.test.ts`
- `backend/tests/live-game.mjs`
- `docs/MASTER-PRODUCT-COMPLETION.md`

## Supervised Android workout test

With a participant present and Webcam0 configured for the Pixel_7 emulator, set `REP_RIVALS_VERIFY_PHYSICAL` to `1` in the backend test terminal and run `pnpm verify:android`. Leave `REP_RIVALS_VERIFY_GAME` unset for a solo-only run. This option explicitly opens the real Android training camera for the disposable test account. Place the laptop side-on and keep the whole body in view. Hold the starting plank through calibration and the five-second Auto Start countdown. Once training starts, perform three controlled push-ups. The test ends the workout after the on-screen count reaches three, checks the official count, history, XP, crystals and unique reward entry against Neon development, and cleans up its records. The harness reports only status and counts. Set neither test flag for ordinary interactive use.

