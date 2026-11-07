# Phase 1 — real camera push-up counter

Implemented on 2026-11-01. This phase is code-complete pending the checks listed below; it is not evidence that the full game works.

## Optional Auto Start — 7 November 2026

On the training page, select **Auto Start** beside the camera options, enable the camera, and move into the starting plank. Once calibration confirms the extended-arm top position, the preview displays a five-second countdown. Hold the position until the countdown ends, then begin the first push-up. The session clock and counting start together. The toggle defaults to off each time the training page opens. **Start training** remains available after calibration, including during the countdown.

Fresh pose frames advance the countdown. Losing the required position, losing tracking, or exceeding the tracker's existing 400 ms frame-gap limit requires a fresh five seconds. Turning Auto Start off or selecting **Recalibrate** also clears the countdown. Stopping, ending, hiding, or leaving training clears the pending start and releases the camera. Both start methods enter the same workout through a single guarded action.

Type checking, 40 unit tests, 7 Chromium tests and the Android debug build passed. The browser tests exercised countdown interruptions, manual override, session cleanup and the first counted rep using controlled landmark sequences. The Android owner previously confirmed physical starting-position calibration. A live hands-free countdown followed by a physical rep on the updated APK remains a manual check.

## Implementation checklist

- [x] Separate camera lifecycle, MediaPipe initialization, geometry, counter, tracker and React presentation.
- [x] Camera permission/error handling, local preview, optional overlay, calibration, actual inference.
- [x] Full-range cycle proxy with temporal smoothing, hysteresis, minimum/maximum duration and duplicate rejection.
- [x] Visibility and posture gating, stable tracking side, tracking-loss recovery and camera cleanup.
- [x] Labeled local-only result and clear separation from Figma simulation.
- [x] Unit tests, type checking and production build.
- [x] Four Chromium browser checks, including real MediaPipe on a fake test-pattern camera.
- [ ] Physical webcam accuracy and threshold tuning across people/devices.
- [ ] Full-game acceptance: accounts → two real players → persisted authoritative result.

## Verification record

Commands: dependency installation using `pnpm add`, `pnpm setup:vision`, `pnpm test`, `pnpm typecheck`, `pnpm build`, `pnpm exec playwright install chromium`, `pnpm test:browser`.

35 unit tests passed: full/partial/repeated cycles, initial top and sustained bottom, preview gating, jitter, rapid/slow cycles, duplicate/out-of-order timestamps, frame gaps, tracking loss, recalibration, aspect ratio and degenerate geometry, missing/offscreen landmarks, standing/bent posture rejection, both tracking sides, synthetic landmark pipeline, permission error messages, late camera/model cancellation, duplicate loop prevention, stale frames, model failure, disconnection, secure contexts and cleanup.

TypeScript and Vite production build passed. Initial type-check errors (switch fallthrough and ES2020 `replaceAll` compatibility) were fixed and rerun successfully. Initial sandbox npm DNS access failed; authorized network execution resolved it. Browser results are recorded after the run below.

Browser testing found navigation assertions running before React committed the route; exit links now stop the camera immediately and the test awaits navigation. A subsequent network assertion detected MediaPipe's automatic external metrics POST. An HTML `connect-src` policy now blocks that traffic while serving inference assets locally. The existing formatter also damaged two TypeScript declarations; those were corrected using an explicit result interface and initialized promise resolver. All checks are rerun after these corrections.

No physical person has been observed or counted in this development environment. No database or multiplayer tests have run because those modules are not implemented. Root `.env` contents were not read.

**Final automated result:** 35 unit tests and 4 Chromium tests passed; `pnpm typecheck` and `pnpm build` passed. Browser tests covered navigation, no automatic permission prompt, responsive widths 320/390/768/1440, denied/missing-camera errors, actual model initialization and inference against Chromium's fake video pattern, no false calibration/reps, stop/restart/navigation track cleanup, and no outgoing POST requests under the connection policy. Desktop and mobile screenshots were visually inspected. The fake feed verifies runtime wiring, not real-person recognition. Browser execution required an authorized unsandboxed local test run; the test server was stopped afterwards. No final automated failures remain.

Files changed: root `.gitignore`, `README.md`, this status document and the preserved master specification; frontend `package.json`/lockfile, `index.html`, `src/main.tsx`, a small training-link change in `src/App.tsx`, new `src/app`, `src/features/computer-vision`, `src/features/solo-training`, asset setup/check scripts, Vitest/Playwright configs and tests. Existing hero imagery and Figma reference pages were retained. No backend or environment files were created or changed.

## Starting thresholds

Central configuration: `src/features/computer-vision/pushUpCounter.ts` and `geometry.ts`.

- Top ≥155°, leave top <145°; bottom ≤100°, leave bottom >110°.
- 150 ms posture confirmation; 1200 ms stable-top calibration.
- 70 ms EMA smoothing time; 700 ms minimum cycle, 15 s maximum; 250 ms cooldown.
- >400 ms frame gap invalidates the in-flight cycle; 1200 ms loss requires recalibration.
- Required-side visibility ≥0.6; full shoulder/elbow/wrist/hip/knee/ankle framing; hip/knee alignment ≥150° and near-horizontal body checks.

These are configurable starting heuristics. They may reject valid push-ups or admit non-push-up movements. Tune using real examples and record false positives/negatives rather than claiming biomechanical correctness. A single visible person is assumed; overlapping people, occlusion, front-on views and moving cameras are unsupported conditions.

## Physical acceptance checklist — not yet run

1. Open `/training` on localhost or HTTPS. Confirm camera permission is requested only after Enable camera.
2. Deny permission, retry after allowing; test a disconnected/busy camera.
3. With no person and then partial body visible, verify zero reps and no calibration.
4. Use a stable side camera showing the whole body with sufficient lighting. Hold a straight plank with extended arms for calibration. Repeat facing both directions.
5. Start training. Perform 10 controlled full push-ups; independently count and compare. Repeat at slow and normal pace and on more than one person/device.
6. Try half reps, small elbow oscillations, standing arm bends and a held bottom: no accepted cycles should occur.
7. Leave the frame mid-rep. Return at the top; no invented rep. After prolonged loss, verify recalibration and preservation of accepted count.
8. Check mirror/overlay toggles do not alter count; verify preview-mode push-ups never count.
9. End the session, navigate away, hide the tab, and unplug the camera separately. Verify the browser camera indicator turns off and the count freezes.
10. Verify timer and local result; refresh must not imply that unsaved data persisted.
11. Record inference latency, UI responsiveness, mobile thermal behavior and camera angle/lighting. Consider a compatible inference worker only if profiling justifies it.

Record device, browser, camera orientation, actual/accepted counts and false positives/negatives. Until this is done, real-camera accuracy remains unverified.
