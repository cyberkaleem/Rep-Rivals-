# Phase 2B — authentication and sessions

On 5 November 2026, a Chromium client registered and logged in through the built React application and retrieved its own saved account from the Neon `development` branch. Refresh restored the session. Logging out revoked it on the server. A separate API check closed and recreated the HTTP listener, Prisma client and pool within the test process, then retrieved the account using its original session.

## Run locally

Start the backend and frontend in separate PowerShell terminals. A fresh checkout needs the dependencies, generated Prisma client and camera assets. The development branch already has the authentication migration.

```powershell
cd "C:\projects\Rep Rivals\backend"
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

```powershell
cd "C:\projects\Rep Rivals\UI design\REP RIVALS Fitness Arena"
pnpm install --frozen-lockfile
pnpm setup:vision
pnpm dev --host 127.0.0.1 --port 5173
```

Open [registration](http://127.0.0.1:5173/register), [login](http://127.0.0.1:5173/login) or [your account](http://127.0.0.1:5173/account). The existing home screen links to the account area. The local camera training route remains available independently.

## Database and migration

Prisma CLI, Client and PostgreSQL adapter are all **7.10.1**. The server reads the pooled `DATABASE_URL` and Prisma CLI uses `DIRECT_URL`. Both come from the backend configuration loader described in [Phase 2A](PHASE-2A.md).

| Model / table | Persistent data and constraints |
| --- | --- |
| `User` / `users` | UUID primary key, normalized username and email with independent unique indexes, encoded Argon2id password hash, timezone-aware creation and update times. Database checks enforce the username format and normalized email. |
| `AuthenticationSession` / `authentication_sessions` | UUID primary key, required user foreign key, unique SHA-256 token digest, creation and expiration times, nullable revocation timestamp. Indexes cover user and expiry. Checks enforce the digest format and positive lifetime. |

The SQL was generated using an offline Prisma schema diff and reviewed before deployment. The reviewed file wraps its two table creations, indexes and foreign key in one transaction. Before applying it, the operator checked the pooled and direct hostnames against the compute ID supplied from the development branch in Neon Console. Both live connections reported that compute ID and the same Neon branch ID. The direct connection found **zero public relations** of the checked table, view, sequence and index types.

The deployment repeated the identity and inventory checks, verified the reviewed file's SHA-256, pinned the verified direct URL for the CLI invocation, then ran `prisma migrate deploy`. A post-deployment query found `users`, `authentication_sessions`, and `_prisma_migrations` with one finished entry for `20261105000100_init_auth`. Only development was accessed. The migration is available for review in [migration.sql](../backend/prisma/migrations/20261105000100_init_auth/migration.sql).

## Authentication flow

1. Registration normalizes the email and username by trimming and lowercasing them. Usernames accept 3–24 ASCII letters, digits or underscores. Passwords accept 15–128 characters. The server hashes the password with Argon2id using a random salt, 19 MiB of memory, two iterations and one lane. One Prisma nested write creates the account and its first session atomically. [Password hashing guidance](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html)
2. Login verifies the stored hash and issues a fresh random 256-bit token. An unknown email takes a dummy verification path and produces the same credential error as an incorrect password. The database stores only the SHA-256 digest of the high-entropy token.
3. The token travels in a host-only, HttpOnly cookie with `SameSite=Lax`, path `/`, and a seven-day lifetime. Production uses `Secure` and the `__Host-` prefix. Each account lookup checks the digest, revocation time and absolute expiration against the database.
4. The React account page requests `/me` on entry and after refresh. A 401 sends the visitor to login. Network errors give the player a retry action. The browser uses credentialed requests without storing credentials in application storage.
5. Logout timestamps the current session's revocation before clearing the cookie. A replay of a copied cookie then fails. Each device can have an independent session.

All auth POST requests require a trusted `Origin` and a JSON body, including `{}` for logout. The API combines this CSRF check with exact-origin CORS and a shared limit of 20 registration/login attempts per client IP per 15 minutes. The public user projection contains only `id`, `username`, `email` and `createdAt`. Cookie responses use the existing no-store policy.

| Endpoint | Request | Success | Common errors |
| --- | --- | --- | --- |
| POST `/api/auth/register` | username, email, password | 201 with `{user}` and session cookie | 400 invalid input, 409 duplicate account |
| POST `/api/auth/login` | email, password | 200 with `{user}` and fresh cookie | 400 invalid input, 401 invalid credentials |
| GET `/api/auth/me` | session cookie | 200 with `{user}` | 401 missing, invalid, expired or revoked session |
| POST `/api/auth/logout` | empty JSON object and current cookie | 204 and cleared cookie | 403 untrusted origin, 415 unsupported content |

## Verification record

| Check | Result |
| --- | --- |
| Backend `pnpm typecheck`, `pnpm build`, `pnpm test` | Passed, including all 10 unit/HTTP tests. Production cookie attributes and the HTTPS origin requirement were checked. |
| Frontend `pnpm typecheck`, `pnpm build`, `pnpm test` | Passed, including all 35 camera, tracking and counter tests. |
| Backend `pnpm verify:auth` | Passed against development using the compiled API and built frontend. Covered anonymous access, CSRF rejection, invalid input, successful registration, normalized duplicates for both identifiers, successful and failed logins, safe response fields, durable Argon2id hash and session digest, restoration after server restart, expiry rejection, revocation, replay rejection and HTTP 429. |
| Live Chromium auth flow (part of `verify:auth`) | Private route redirected to login. Registration opened the correct account, refresh restored it, the cookie was HttpOnly, and the password and token were absent from JS-accessible storage. Login and logout succeeded, then protected access redirected to login again. |
| Existing Chromium camera suite | All 4 tests passed using an isolated port. The first launch found port 5173 occupied and stopped before running tests. The rerun used `REP_RIVALS_TEST_PORT=5183`. Git showed no changes in the computer-vision implementation. |

To repeat the live suite, build both packages, install Chromium with `pnpm exec playwright install chromium` in the frontend package, then run `pnpm verify:auth` in the backend package. The suite verifies the development identity before writing. It starts its own API and a Vite preview on port 5174, creates two randomly named test accounts, and removes only those accounts and their sessions in cleanup. The session-expiry case backdates one of its own records. The completed run cleaned up both accounts.

## Operational limits

Vite proxies same-origin `/api` requests to the loopback backend. `REP_RIVALS_API_PROXY` can override the destination in the Vite server process. For deployment, route `/api` to the backend at the frontend's public origin, terminate HTTPS, set `NODE_ENV=production`, and supply explicit HTTPS `CORS_ORIGINS`. Production deployment and browser behavior behind a real TLS proxy remain unverified.

Rate limiting uses process memory. A restart clears its counters, and a reverse proxy may group users under one IP until trusted proxy hops are configured for that deployment. Multi-instance hosting would need coordinated limits. Expired and revoked rows retain their timestamps for later cleanup. Email verification, account recovery, player profiles and rewards are future work.

## Changed files

Paths below are relative to the named package.

| Location | Files |
| --- | --- |
| Repository root | `README.md`, `docs/PHASE-2B.md` |
| Backend package | `.env.example`, `package.json`, `pnpm-lock.yaml`, `prisma/schema.prisma`, `prisma/migrations/migration_lock.toml`, `prisma/migrations/20261105000100_init_auth/migration.sql` |
| Backend implementation | `src/app.ts`, `src/server.ts`, `src/config/env.ts`, `src/auth/service.ts`, `src/auth/session.ts`, `src/routes/auth.ts` |
| Backend verification | `scripts/development.mjs`, `tests/auth.test.ts`, `tests/live-auth.mjs` |
| Existing Figma frontend | `src/App.tsx`, `src/app/AppRouter.tsx`, `src/features/auth/AccountPages.tsx`, `src/features/auth/api.ts`, `src/features/auth/account.css`, `vite.config.ts` |
| Frontend verification | `tests/live/account.mjs`, `playwright.config.ts`, `tests/browser/training.spec.ts` |
