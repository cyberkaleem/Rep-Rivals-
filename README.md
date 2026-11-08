# REP RIVALS

A camera-powered push-up arena for Android and the web. Train locally, save an authenticated workout, or invite another player into a private 60-second match. MediaPipe runs on the device. The Node server accepts ordered rep events, broadcasts the score and saves completed results and rewards in Neon PostgreSQL.

## Play the local demo

Use the [product demo runbook](docs/MASTER-PRODUCT-COMPLETION.md) for the Android APK, the private HTTPS server and a Chromium rival on the same computer. Both players must connect to the **same running backend process**. Public Render is still in health-only mode.

For browser-only play, run these commands in separate PowerShell terminals with the ignored development database environment configured:

```powershell
cd "C:\projects\Rep Rivals\backend"
pnpm install --frozen-lockfile
pnpm build
pnpm dev
```

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
pnpm install --frozen-lockfile
pnpm setup:vision
pnpm dev --host 127.0.0.1 --port 5173
```

Open `http://127.0.0.1:5173`. Use separate browser profiles for two players. The **Solo training** entry works offline once the web assets are available. Choose **Save to player profile** while signed in for server scoring. The dashboard's training link selects saving automatically.

## Gameplay

- Side-on calibration, optional Auto Start, and full top → bottom → top rep recognition.
- Private rooms, readiness, countdown, live scores, reconnect and official results.
- Player history, Noob → Elite → Titan progression, crystals and two UTC daily challenges.
- Articulated Three.js athletes with persistent outfit colors and animations driven by match state and accepted scores.

The app sends score events and account traffic. Camera frames and landmark histories stay on the device. A client can fabricate plausible rep events; a server-accepted score is not proof of physical form.

See the [camera baseline](docs/PHASE-1.md), [Android packaging](docs/ANDROID-PHASE-A.md), [session security](docs/PHASE-2D.md), [Render activation status](docs/PHASE-3A.md), and [product verification and limitations](docs/MASTER-PRODUCT-COMPLETION.md).
