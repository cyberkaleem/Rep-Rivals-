# Phase 2D — Android authentication over HTTPS

**Complete for the development APK and genuine Neon development backend.** Pixel 7 / Android 15 completed registration, login, account retrieval, OS force-stop and cold relaunch, logout, and revoked-token rejection over private HTTPS. Public deployment, release signing, and physical-device authentication remain pending. The live test closed its API listener and removed its temporary ADB mappings.

## Accounts and transports

The existing Express 5 auth service owns account creation, normalized username/email lookup, Argon2id password checks, the public user projection, and Prisma session writes. Both clients use the same User and AuthenticationSession tables. The server issues a new random 256-bit token on each register/login, stores its SHA-256 digest, and checks the seven-day absolute expiry and revocation timestamp on account retrieval. Logout revokes the presented session. The existing sibling sessions can remain signed in.

| Operation | Browser | Native Android |
| --- | --- | --- |
| Register / login | POST under `/api/auth`. The server sets a host-only HttpOnly, SameSite=Lax cookie. Production adds Secure and the `__Host-` prefix. | POST under `/api/auth/native`. The native client receives the new token over HTTPS and stores it before resolving the WebView call. |
| Account | GET `me` with credentials included. Vite proxies the relative path during local development. | GET `me` with an explicit Authorization bearer header sent by native code. |
| Logout | POST `logout` with trusted Origin, JSON and cookie. | POST `logout` with bearer and JSON. Successful revocation clears local encrypted storage. A network failure reports an error and permits retry. |

Capacitor serves the APK from `https://localhost`. A relative WebView fetch resolves there and has no Vite proxy. A remote cookie design would require credentialed CORS, deliberate CSRF controls, a cross-site cookie policy and verification of WebView third-party-cookie persistence. Native HTTPS avoids that dependency and preserves the browser policy. Android receives a typed token with a distinct digest namespace. Existing browser digest lookup remains compatible with previously issued cookies. Neither transport accepts the other's credential.

## Security boundaries

- React uses its existing account routes, forms, retry handling and private account screen. The Capacitor bridge accepts four account operations, targets a build-configured HTTPS origin and returns only status and public account fields. Android Back uses WebView history when available.
- The native plugin checks the top-level packaged origin and serializes operations across activity recreation. OkHttp 5.4.0 uses ordinary TLS peer/hostname validation, disables redirects and transparent retries, and has no cookie jar. Version 5.4.0 supports the project's compile SDK 36. No secure-storage plugin was introduced.
- AndroidKeyStore generates a non-exportable AES-256 key. AES-GCM uses a fresh provider-generated IV. The stored value contains the IV and authenticated ciphertext in private preferences. The API origin is authenticated as associated data and determines the storage slot. App backups are disabled. Hardware backing depends on the device. [Android Keystore](https://developer.android.com/privacy-and-security/keystore)
- The native API requires HTTPS and rejects browser Origin, Cookie and Sec-Fetch-Site headers, ambiguous authorization and query parameters. Browser POSTs retain explicit trusted Origin and JSON requirements. Browser routes reject Authorization credentials. CORS uses the configured allowlist. These checks separate transports. Authentication relies on valid credentials, not a claimed origin or APK identity.
- Both transports share one registration/login limit of 20 attempts per IP per 15 minutes, Zod validation, bounded JSON bodies, safe errors and no-store responses. The service performs server-side expiry and revocation checks. A stolen, still-valid bearer is replayable until expiry or revocation. Device compromise and injection into trusted app content remain relevant risks.
- The APK disables Capacitor argument logging because bridge debug logs can contain passwords. The packaged CSP retains same-origin connections, permits local WASM execution and restricts scripts and frames. Session tokens stay outside React, browser storage, URLs and normal application logs. The live test looked for its disposable secrets in JS storage, native preferences and sampled app logs without printing them.

## Run locally on Windows

Use the repository's Node 24, pnpm 12, JDK 21, and SDK 36 toolchain. The ignored root environment holds the backend-only database settings. The development TLS helper uses OpenSSL, including the copy installed with Git for Windows. It creates a short-lived certificate for the loopback IP in ignored `.tools/android-auth-tls/`, removes the CA signing key after issuance and retains the local server key. No workstation or emulator-wide CA installation is required.

**1. Build and start the private HTTPS backend.** From the repository root, run the following in a terminal and leave it open for manual Android use.

```powershell
cd backend
pnpm install --frozen-lockfile
pnpm build
pnpm android:tls
pnpm android:https
```

Startup first verifies the direct and pooled endpoints against the previously confirmed development compute and matching live Neon branch metadata. During verification, the Windows resolver returned ENOTFOUND/EREFUSED. Google Public DNS returned valid A records, and TLS-verified metadata checks succeeded. On this machine, if that failure recurs, set `$env:REP_RIVALS_DEV_DNS = 'google'` in the backend terminal before starting the helper. This opts in to sending the two verified public DNS names to Google over HTTPS. The override is scoped to the development process and preserves PostgreSQL hostname and certificate validation.

**2. Build and install the emulator variant.** From the repository root in another terminal:

```powershell
cd 'UI design/REP RIVALS Fitness Arena'
pnpm install --frozen-lockfile
$env:JAVA_HOME = 'C:\projects\Rep Rivals\.tools\jdk-21.0.13+9'
$env:ANDROID_HOME = 'C:\Users\capts\AppData\Local\Android\Sdk'
$env:REP_RIVALS_EMULATOR_TLS = '1'
pnpm android:build
$adb = Join-Path $env:ANDROID_HOME 'platform-tools/adb.exe'
& $adb -s emulator-5554 reverse tcp:4443 tcp:4443
& $adb -s emulator-5554 install -r 'android/app/build/outputs/apk/debug/app-debug.apk'
& $adb -s emulator-5554 shell am start -n com.reprivals.app/.MainActivity
```

The listener binds to Windows loopback. ADB reverse carries TLS to it. Only this explicitly selected debug variant trusts the local public CA for the exact loopback IP. All other domains use system trust. Cleartext stays disabled. When finished, stop the backend with Ctrl+C and remove the mapping with `adb -s emulator-5554 reverse --remove tcp:4443`. Rotating the local CA requires rebuilding the emulator APK.

**Browser development.** Use `pnpm dev` in the backend and `pnpm dev --host 127.0.0.1 --port 5173` in the frontend after `pnpm setup:vision`. The browser uses its existing same-origin proxy.

## Hosting and configuration

No authorized public hosting project was configured. The Render Blueprint prepares a single Node web service tied to the backend directory with automatic deploys off, dependency installation, Prisma client generation/TypeScript compilation, compiled Node startup and an HTTP health probe. It performs no migration. Express keeps its HTTP server, bounded PostgreSQL pool and shutdown handling. A future Socket.IO server can attach to that same listener.

| Provider | Development consideration |
| --- | --- |
| Render (prepared) | Free web services share 750 instance-hours per workspace/month and sleep after 15 minutes without inbound traffic. The cold start can outlast the Android request timeout. Paid compute is appropriate when an always-on match server is required. Render routes HTTPS and WebSocket upgrades to the same service port. [Free service limits](https://render.com/docs/free) · [WebSocket support](https://render.com/docs/websocket) |
| Railway | The Free plan includes a small monthly usage allowance. Hobby starts at $5/month including $5 of usage, with additional usage billed. [Railway plans](https://docs.railway.com/pricing/plans) |
| Fly.io | Machines have usage- and region-dependent pricing. Costs also depend on runtime, storage and network traffic. [Fly.io pricing](https://docs.fly.io/about/pricing) |

| Names | Scope |
| --- | --- |
| `DATABASE_URL`, `DIRECT_URL` | Secrets. Provide pooled runtime credentials only to the server. Direct credentials are needed by approved database administration and guarded development tests. The hosted runtime does not need the direct credential for ordinary requests. |
| `NODE_ENV`, `HOST`, `PORT`, `CORS_ORIGINS` | Backend environment. Use production mode, bind to the provider interface and injected port, and configure exact HTTPS browser origins. |
| `TRUSTED_PROXY_CIDRS` | Backend ingress policy. Forwarding is untrusted by default. Supply verified immediate ingress IPs/CIDRs with a verified forwarding chain. |
| `REP_RIVALS_ANDROID_API_ORIGIN` | Public HTTPS DNS origin for a hosted APK. Use a bare origin with no credentials, path, query or fragment. |
| `REP_RIVALS_EMULATOR_TLS` | Debug-only opt-in to private loopback HTTPS and domain-scoped development trust. |
| `REP_RIVALS_DEV_DNS`, `OPENSSL_EXE`, `ADB_EXE`, `ANDROID_SERIAL` | Optional local development/test settings. |
| `REP_RIVALS_API_PROXY` | Vite server-side local browser proxy target. |

To deploy, authorize the GitHub repository and Render project, review the Blueprint, inject server settings via the provider, and manually deploy. Configure trusted ingress only after verifying that external clients cannot reach Express directly or control forwarded client-IP/protocol headers. Provider **outbound** ranges are unsuitable for identifying inbound proxies. If the proxy topology cannot be verified, keep forwarding untrusted and resolve ingress with the provider before enabling native auth there. Check both health endpoints, actual HTTPS enforcement and rate-limit keying behind that ingress. The in-memory limit resets on restart and needs a shared store for multiple instances. [Express proxy guidance](https://expressjs.com/en/guide/behind-proxies.html)

For a hosted build, clear `REP_RIVALS_EMULATOR_TLS`, set the approved public `REP_RIVALS_ANDROID_API_ORIGIN`, run `pnpm android:sync`, then `android\gradlew.bat -p android :app:assembleRelease` from the frontend directory. Release signing and signing secrets belong in the approved distribution process. Repeat the native auth smoke test over the deployed URL on an emulator and a physical device. Repeat the browser flow behind the deployed web reverse proxy.

## Verification record

| Evidence | Observed result |
| --- | --- |
| Previous Phase 2D run, backend and browser | Backend and frontend type checks and builds passed. Prisma 7.10.1 validated the schema. All 14 backend tests passed, including origin/CSRF, transport isolation, spoofed forwarding and shared rate limiting. Liveness and the real Prisma SELECT 1 readiness probe returned HTTP 200. Chromium registration/login, correct account, refresh, expiry, logout and replay checks passed. |
| Previous Phase 2D run, Android | The actual Pixel 7/API 35 app registered a disposable user; a separate database observer verified the Argon2id hash and stored digest. A new OS process restored the account. Stopping the HTTPS listener produced a connection error, and retry succeeded after restart. Logout cleared the credential and revoked the database session. Replay returned 401. Bad-password, subsequent login, expiry, protected-route and cleanup checks passed. Earlier runs exposed a test-observer routing bug; the corrected suite passed end to end. |
| Data safety | Both connections matched the owner-verified Neon development compute and live branch metadata before writes. The suites cleaned up only their disposable accounts and sessions. No schema change, migration or production database operation. |
| CV regression | All 56 unit tests and seven Chromium regression tests passed in the implementation run. The continuation repeated the 56 unit tests and both TypeScript checks plus the compiled backend build. CV/training sources and tracked browser tests matched their pre-implementation SHA-256 fingerprint. |
| Final APK inspection | All 14 web build files matched their APK entries, including the versioned model and WASM. Both emulator debug and unsigned release inspection artifacts passed checks for known root DB URLs/passwords, environment files, private-key materials and unexpected permissions. Package ID is `com.reprivals.app`. Camera and Internet are present, alongside AndroidX's app-scoped signature permission. Backup and cleartext are disabled. |
| Export and TLS review | Both manifests export the launcher and AndroidX profile installer receiver. The latter requires the privileged DUMP permission. The AndroidX initialization provider is private. The emulator trust anchor is restricted to the loopback IP, with system trust elsewhere. The compiled release inspection APK contains neither the development CA nor the emulator origin, has no network-security override and is not debuggable. |
| Final WebView runtime | Installed debug APK loaded the packaged detector in VIDEO mode on CPU. Six of six frames from a public reference pose rendered as video returned one pose with 33 landmarks. The owner's earlier four physical repetitions remain the physical baseline. No new physical exercise trial was performed. |

Debug APK: `UI design/REP RIVALS Fitness Arena/android/app/build/outputs/apk/debug/app-debug.apk`. SHA-256: `5c6abf42c13e0a5244dad716ffd5a4b8347f60925a202f6265e462e7fd5122eb`. The unsigned release used a reserved, non-routable inspection hostname to exercise release packaging; it is not a deployment artifact.

To repeat the real live tests, build both projects and use a free test port. Run `pnpm verify:auth` in the backend for browser coverage. For the emulator, build the TLS-enabled debug variant, stop any manual listener on port 4443, boot Pixel_7, then run `pnpm verify:android` in the backend. The suite owns its temporary HTTPS listener and ADB mappings. To inspect the built emulator APK, run `./scripts/inspect-android-apk.ps1` in PowerShell 7 from the backend with `ANDROID_HOME` pointing to the SDK. The continuation corrected the SDK path for inspection and tightened the verifier's compiled-origin, package, manifest and permission assertions.

## Changed files

Paths in each row are relative to its named directory. The frontend directory is `UI design/REP RIVALS Fitness Arena`.

| Directory | Files |
| --- | --- |
| Repository | `render.yaml`, `docs/PHASE-2D.md` |
| Backend | `.env.example`, `package.json`, `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/auth/service.ts`, `src/auth/session.ts`, `src/routes/auth.ts` |
| Backend scripts and tests | `scripts/development.mjs`, `scripts/dev-dns.mjs`, `scripts/dev-https.mjs`, `scripts/emulator-tls.mjs`, `scripts/inspect-android-apk.ps1`, `tests/native-auth.test.ts`, `tests/live-android.mjs` |
| Frontend | `capacitor.config.ts`, `vite.config.ts`, `src/features/auth/api.ts`, `scripts/check-android-assets.mjs` |
| Frontend Android app | `android/app/build.gradle`, `android/app/src/emulatorTls/AndroidManifest.xml`, `android/app/src/emulatorTls/res/xml/emulator_auth_network.xml` |
| Frontend Android Java, under `android/app/src/main/java/com/reprivals/app/` | `MainActivity.java`, `AccountPlugin.java`, `SessionVault.java` |

Player profiles can now use the verified server-derived account ID. Future Socket.IO work should authenticate the handshake server-side, recheck session validity as appropriate, and authorize room membership independently. Native socket credentials should remain behind the native boundary or be exchanged for narrowly scoped, short-lived socket tickets. Server-authoritative scoring belongs to that future phase.
