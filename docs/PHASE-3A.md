# Phase 3A — Public API activation

**Blocked at Render ingress verification.** On 7 November 2026 the public liveness check, local development-database suite and hosted-origin Android build passed. Public registration is still closed. The next deployment can collect the missing ingress evidence while authentication remains unreachable.

## Service and trust boundary

Work began on a clean `main` at `937e1525fc54c97fed5f5b391ca5f859cf31e95f`. The operator reports a manual Singapore Node web service tracking main, a pooled Neon development secret, a placeholder HTTPS browser origin, health-only mode and no trusted proxies. The public checks below corroborate the routing behavior. The live plan, commit, environment and private logs still require Dashboard verification. There was no connected Render management API, and the desktop browser tool could not establish the Dashboard URL safely. No live settings were changed.

Render documents that its public load balancer redirects HTTP to HTTPS, terminates TLS and sends HTTP to Express. Free web services cannot receive private-network traffic. Other plans can have a private path to the same HTTP server. Confirm the actual service and all paths before assigning trust. [Web services](https://render.com/docs/web-services) · [Private networking](https://render.com/docs/private-network)

The current code supports an explicit IP/CIDR allowlist. Express starts with the socket peer and reads X-Forwarded-For from the right to the nearest untrusted address. On a trusted socket, Express uses the first X-Forwarded-Proto value for the request protocol. An upstream appending a trusted protocol after a caller-controlled value would be unsafe. Trusting too few intermediaries can give many players a single rate-limit bucket. No service-specific stable inbound ranges, hop-count guarantee or protocol-header overwrite contract were established in this run. A successful edge redirect does not establish those properties inside Express. [Express proxy guide](https://expressjs.com/en/guide/behind-proxies/) · [Render outbound IP ranges](https://render.com/docs/outbound-ip-addresses)

Keep the proxy allowlist unset until the ingress boundary is verified. Render also documents CF-Connecting-IP as an edge-overwritten client address on its public path and warns that callers can supply the leftmost X-Forwarded-For entry. The existing limiter uses Express request IP. Switching it to an edge header would require a verified ingress-only listener, effective HTTPS enforcement, and a reviewed change shared by both auth transports. A fixed hop count has the same topology dependency. [Render client IP guidance](https://render.com/articles/host-pocketbase-on-render)

## Runtime and operator configuration

| Setting | Purpose |
| --- | --- |
| `NODE_ENV`, `NODE_VERSION`, `HOST`, `PORT` | Production, the pinned Node runtime, all-interface binding, and Render's injected listener port. |
| `REP_RIVALS_HEALTH_ONLY` | Explicit smoke-mode switch. Only the exact GET liveness request succeeds when enabled. |
| `DATABASE_URL` | Server-only pooled connection for this development deployment. `DIRECT_URL` is for operator workflows and is unnecessary on the service. |
| `CORS_ORIGINS` | Comma-separated exact HTTPS browser origins, without paths or trailing slashes. Keep the existing reserved .invalid placeholder while no web frontend is deployed. Native calls send no browser Origin. |
| `TRUSTED_PROXY_CIDRS` | Comma-separated literal peer addresses or CIDRs for a verified proxy chain. Omit while unverified. |
| `REP_RIVALS_INGRESS_PROBE_ID` | Temporary, randomly generated 32-character lowercase hex value for correlating marked health probes with private service logs. Remove after inspection. |

In Dashboard → **rep-rivals-api → Settings**, verify branch and deployed revision, region, instance type and number of instances. Use root `backend`, build `corepack enable && pnpm install --frozen-lockfile --prod=false && pnpm build`, normal start `node dist/server.js`, and health path `/api/health`. The build generates Prisma Client without migrating. The local Blueprint now defaults to health-only and leaves proxy trust unset. A manual service must be configured in its Dashboard.

## Verify ingress before activation

1. Obtain approval to publish the reviewed revision and deploy it **with the safeguard enabled**. In the service runtime run `node scripts/verify-render-development.mjs`. If shell access is unavailable, use the temporary start command below. This preflight accepts only the owner-confirmed development pool and checks the live Neon endpoint and branch IDs over hostname-verified TLS. It issues one metadata SELECT, prints a generic result and needs no direct connection secret. A nonzero exit stops the command chain.
2. To measure ingress on a health-only deployment, set the temporary probe ID and use the following start command from the backend root. The preload refuses to start outside explicit health-only mode. It adds no route or response field. Database connectivity is required for this one diagnostic deployment because its start command includes the preflight.

   ```sh
   node scripts/verify-render-development.mjs && node --import ./scripts/observe-render-ingress.mjs dist/server.js
   ```

3. Use two controlled networks with independently known, distinct public egress IPs. From each, make a clean HTTPS GET and a second GET with forged headers. Supply the same probe ID privately. Use the exact health path and no cookies or auth. Example in PowerShell, with the probe ID and the current source's known egress IP in the two local variables.

   ```powershell
   $health = 'https://rep-rivals-api.onrender.com/api/health'
   $headers = @{ 'X-Rep-Rivals-Probe' = $probeId; 'X-Rep-Rivals-Expected-IP' = $knownPublicIp }
   Invoke-RestMethod $health -Headers $headers
   $headers['X-Forwarded-Proto'] = 'http'
   $headers['X-Forwarded-For'] = '192.0.2.123'
   $headers['CF-Connecting-IP'] = '192.0.2.123'
   Invoke-RestMethod $health -Headers $headers
   ```

4. Inspect the service's private logs. The observer records at most 12 marked samples per process, reporting the socket peer and header comparisons. Index zero means the expected client is the rightmost forwarded address. A negative index means the expected address was absent. Use canonical IP text for the comparison. Check that the protocol remains exactly HTTPS and the real client is distinguishable on both networks. Record whether the forged address survives and where the trust boundary lies. The probe ID, submitted egress IP, raw forwarding chain, cookies and bearer credentials are excluded from its output.
5. Obtain Render confirmation of the supported peer identities, intermediary addresses, header sanitization and absence of a shorter bypass for this service and plan. Observed socket IPs are samples, not a durable CIDR allocation. If Render supports only the overwritten edge-header approach, keep health-only enabled and review that implementation before activation. Avoid guessed private ranges, outbound IPs or unconditional proxy trust.
6. Once the boundary and hosted branch pass, seek explicit approval to activate. Remove the observer startup/preload and probe ID, configure the verified CIDRs if using the existing Express path, retain the production and CORS settings, and set the smoke switch to literal `false`. For the development service use `node scripts/verify-render-development.mjs && node dist/server.js` to check the branch on each full-service start. Save and deploy through the approved workflow. Check service health and actual limiter behavior immediately.

**Rollback.** Stop sensitive tests. In Environment restore `REP_RIVALS_HEALTH_ONLY=true`. In Settings restore `node dist/server.js` so rollback works even during a database outage. Remove temporary observation settings and unverified trust entries. Save and deploy an approved revision containing the safeguard. Verify exact GET health returns 200 and HEAD health, GET database health, GET native and browser account retrieval, and POST login with empty JSON return 404. Use no real credentials.

## Clients and build

Browser requests continue through the same-origin web proxy using host-only HttpOnly cookies, Secure in production, SameSite=Lax, exact trusted origins on writes and JSON validation. Android uses native OkHttp to the compiled public origin, with platform TLS and hostname verification, no cookies and redirects disabled. The native bridge returns public account fields to React. The origin-bound AndroidKeyStore AES-GCM vault retains the bearer across process restarts. Logout revokes the server session before clearing the local credential. A 401 during restoration clears it, while a connection failure permits retry. Both transports share users, Argon2id and seven-day revocable sessions. Only scoped token hashes are stored in Neon.

Build the hosted **debug** APK from the frontend directory using the installed JDK 21 and Android SDK.

```powershell
$env:REP_RIVALS_EMULATOR_TLS = '0'
$env:REP_RIVALS_ANDROID_API_ORIGIN = 'https://rep-rivals-api.onrender.com'
pnpm android:build
```

Inspect from `backend` with `./scripts/inspect-android-apk.ps1 -Flavor Hosted -ExpectedOrigin 'https://rep-rivals-api.onrender.com'`. Set `ANDROID_HOME` to the SDK. APK output is `UI design/REP RIVALS Fitness Arena/android/app/build/outputs/apk/debug/app-debug.apk`. SHA-256 for the inspected build is `CD6D4F1511802A12C5EE2564BB31289DAB1AA67A3337F93886A1BB9DE9162ACC`.

## Verification record

| Scope | Result |
| --- | --- |
| Public HTTPS | Exact GET health returned 200 and the expected service JSON. HEAD health, GET health with a trailing slash, database health and both account GETs returned 404. An HTTP GET with forged forwarding headers returned 301 to the exact HTTPS health URL. No hosted credentials were submitted. |
| Local backend | TypeScript, Prisma schema validation, production build and 18/18 backend tests passed. New tests rotate injected IPs from an untrusted socket, exercise two clients through a simulated trusted peer, and verify the shared browser/native 20-attempt, 15-minute limit. Attempt 21 returned 429 for the first client and the second retained its allowance. The library emitted its expected untrusted-forwarding diagnostic. Initial sandboxed loopback requests failed with EACCES and the permitted rerun passed. The limiter is per process and resets on restart. Scaling requires a shared counter or equivalent ingress enforcement. |
| Neon and browser | Both development connections returned the pinned endpoint and same branch ID. Production-mode local health and database readiness returned 200 with real Prisma SELECT 1. The pooled-only preflight rejected a wrong compute before connection. Workstation DNS required the existing scoped development resolver for its positive check. Chromium and live API tests passed registration, normalized duplicates, invalid credentials, account retrieval, persistence, refresh, expiry, logout, revoked replay, CSRF and cleanup. No migrations or production access. The hosted runtime pool still needs its own check. |
| Observer | Local real HTTP listener test verified full-mode refusal, exact-path and probe filtering, successful health responses, unchanged auth 404, 12-sample cap, and exclusion of the marker, expected client address and Authorization sentinel from the test log. Hosted observations are pending. |
| Frontend and Android | TypeScript, web production build, 56/56 CV-related unit tests, 7/7 Chromium training tests, Capacitor sync, asset verification and Gradle assembleDebug passed. The inspected APK installed and cold-launched on Pixel_7, API 35. The ADB reverse list was empty. Package ID and public origin matched. Manifest inspection confirmed cleartext and backup disabled, expected camera/internet and internal receiver permissions, and no emulator CA or network trust override. The known credential, database URI and private-key scans passed. |
| CV | All 14 web files matched the build, including the versioned WASM and model. Model SHA-256 was `59929e1d1ee95287735ddd833b19cf4ac46d29bc7afddbbf6753c459690d574a`. On the installed APK, the packaged model ran in Android CPU / VIDEO mode and yielded one 33-landmark pose on each of six frames of a local reference fixture. A temporary debugger forward was removed after the check. The earlier four real push-ups remain the physical baseline. No new exercise or physical-device authentication test took place. |
| Android auth | Phase 2D verified native registration, login, account restoration after force-stop, logout, replay and expiry denial, invalid password, outage and retry over private development HTTPS. The public-host equivalents, OS reboot persistence, hosted server-side revocation, and deployed limiter identity remain pending. |

## Hosted acceptance after authorization

Verify HTTPS liveness and database readiness, unauthenticated native account retrieval (401 rather than an HTTPS error), denied foreign browser origins, invalid login, forged forwarding headers and rate-limit separation from two controlled clients. Keep the limit test separate from the test player's IP or allow its window to elapse. Hosting a browser frontend requires its own real trusted origin and same-origin API routing. The placeholder does not enable a public web client.

Use an isolated Pixel 7 emulator with the inspected hosted APK and empty ADB reverse list. Register a random disposable user. Match the returned account ID to that row on the verified development branch, force-stop, relaunch and verify the same account. Log out, check revocation and protected-route denial. For an exact app-session replay on a disposable debug emulator, keep its origin-bound encrypted preference state only in test-process memory before logout, then replay that state on the same installation after logout. Verify 401 and local clearing. Keep credentials outside JavaScript and logs. Exercise a wrong password, subsequent valid login, expiry of only that disposable session, and a device-side outage and retry without interrupting the public service. Remove only the matching disposable account and its sessions. The existing private HTTPS Android harness establishes a local listener and ADB reverse; it is unsuitable for this public acceptance run.

Express continues to expose a Node HTTP server suitable for Socket.IO. Future native socket authentication can exchange the existing session for a short-lived, scoped ticket and validate membership server-side. A hosted multiplayer rollout needs coordinated limiting and reconnect handling.

## Changed files

- `backend/scripts/observe-render-ingress.mjs` — temporary private-log probe for a health-only deployment.
- `backend/scripts/verify-render-development.mjs` — pooled-only development identity preflight.
- `backend/tests/native-auth.test.ts` — client-IP spoofing, shared limits and independent-client tests.
- `render.yaml` — default to health-only and omit unverified proxy input.
- `docs/PHASE-3A.md` — verification record and activation/rollback instructions.
