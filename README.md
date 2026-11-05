# REP RIVALS

Camera-powered workout competition, under development. Players can register, log in, restore their session and open their account. Accounts and sessions persist on the Neon development branch. Local push-up training has passed an initial real-world test reported by the project owner. See the [authentication setup and Phase 2B verification](docs/PHASE-2B.md) and [backend foundation](docs/PHASE-2A.md).

## Run the camera phase

Prerequisites: Node 22.12+ or Node 24+, pnpm, a browser with WebAssembly and camera support. Verified here with Node 24.19.0 and pnpm 12.16.1; the existing `.mise.toml` specifies Node 22 and pnpm 10.34.3.

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
pnpm install --frozen-lockfile
pnpm setup:vision
pnpm dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173/training`. Setup downloads Google's versioned lite pose model, verifies its SHA-256, and copies the installed MediaPipe package's matching WASM files into ignored `public/vision/`. Model inference runs locally. Build and dev commands fail with instructions if assets are missing. Run setup again after upgrading MediaPipe. Commit source and the lockfile, not generated models or build output.

No environment variables or credentials are needed for this phase. Root `.env` is untouched and ignored. Do not add a Vite `envDir` pointing to the repository root or put database credentials in `VITE_*` variables.

The HTML connection policy allows same-origin requests and loopback development WebSockets. Vite proxies same-origin account requests under `/api` to the backend. MediaPipe's external usage telemetry is blocked. The existing Google Fonts stylesheet is external. See [MediaPipe's privacy notice](https://developers.google.com/edge/mediapipe/solutions/tasks#mediapipe_tasks_privacy_notice).

## What works

- Explicit camera permission, local preview, optional landmark overlay and mirrored display.
- MediaPipe Tasks Vision VIDEO inference (lazy-loaded), GPU with CPU fallback, one person, at most 20 inferences/sec, duplicate decoded-frame rejection.
- Aspect-ratio-correct elbow angles; visibility, framing, basic plank/alignment checks; stable left/right tracking side.
- Starting-pose calibration with a timed hold, smoothing and hysteresis, full top-bottom-top acceptance, sequence numbers and local session identity.
- Tracking loss drops incomplete cycles without erasing accepted reps. Sustained loss requires recalibration.
- Start/end controls, elapsed time and unsaved local results. Preview/calibration does not count reps.
- Stops camera tracks, inference loops and MediaPipe on end, navigation, hidden tab, device disconnection, or initialization failure. Cancellation during pending initialization also releases resources when they arrive.

The measurements are heuristic proxies, **not clinically validated form assessment**. No video recording, uploads, socket connection, persistence, or rewards are part of this phase. No simulation feeds the real camera counter.

## Structure and integration boundaries

```text
Rep Rivals/
  docs/                         specification, phase status and physical test checklist
  backend/                      Express HTTP server, Prisma client and health checks
  UI design/REP RIVALS Fitness Arena/
    src/app/AppRouter.tsx       real /training route and labeled design reference
    src/features/
      computer-vision/         geometry, counter, pose tracker, camera ownership, hook
      solo-training/          presentation and styles
    scripts/                   reproducible local vision assets
    tests/browser/             permission, responsiveness and model smoke tests
```

`AcceptedRep` in `computer-vision/types.ts` carries local evidence. The hook accepts an `onRep` callback for later networking integration. The server will need to authenticate the player and validate ordering, rate and match state before broadcasting an official score. Camera frames and pose history stay on the device.

## Checks

```powershell
pnpm test
pnpm typecheck
pnpm build
pnpm exec playwright install chromium
pnpm test:browser
```

Browser tests use Chromium's explicitly fake camera test pattern. They test model initialization, inference on a no-person feed, permission errors and resource release. They do **not** establish physical rep-count accuracy. Playwright starts and stops a local Vite server on port 5173; that port must be free.

See [phase status and real-device checklist](docs/PHASE-1.md). A complete two-player demonstration is not available yet.

## Deployment and remaining scope

Not deployed. A future static deployment must run `pnpm setup:vision` before `pnpm build`, publish `dist`, and rewrite application routes to `index.html` while serving model/WASM assets as files. Camera access requires HTTPS except on localhost. Plain HTTP to a LAN IP generally cannot access the camera.

Remaining P0 work includes player profiles, saved workouts, private Socket.IO rooms, server-controlled timing and scoring, transactional results and rewards, and animated 3D avatars. P1 covers dashboard/history, ranks, daily challenges and cosmetics. The [master specification](docs/MASTER-SPECIFICATION.md) lists the later exercise detectors and matchmaking features.

The backend uses a pooled Neon connection for application traffic. Future migrations require a separate direct connection. Plan to host the HTTP and Socket.IO server on a persistent Node host.

References: [MediaPipe web guide](https://developers.google.com/edge/mediapipe/solutions/vision/pose_landmarker/web_js), [PoseLandmarker API](https://developers.google.com/edge/api/mediapipe/js/tasks-vision.poselandmarker). The installed package declarations were checked for the timestamped `detectForVideo(video, timestampMs)` signature.
