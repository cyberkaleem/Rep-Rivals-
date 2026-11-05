# Phase 2A — backend foundation and Neon connectivity

On 5 November 2026 the compiled REP RIVALS HTTP server returned 200 from both health endpoints. The database endpoint used the configured Neon connection, executed `SELECT 1 AS ok` through Prisma and checked that exactly one row contained the numeric value `1`. This was the only application SQL used for verification.

## Run locally

Use Node 24 and pnpm 12. The verified versions were Node 24.19.0 and pnpm 12.16.1. Run these commands from the repository root on a fresh checkout.

```powershell
cd backend
pnpm install --frozen-lockfile
pnpm db:generate
pnpm dev
```

The local server defaults to loopback on port 4000. A second terminal can call the running API.

```powershell
Invoke-RestMethod http://127.0.0.1:4000/api/health
Invoke-RestMethod http://127.0.0.1:4000/api/health/database
```

For a compiled run, use `pnpm build` then `pnpm start`. The build generates the client before compiling TypeScript. The repository stores the schema and the backend's own dependency lockfile. A fresh install needs client generation before running the development server or type checking.

## Configuration and connections

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | Required server-side Neon PostgreSQL URL for application queries. Use the pooled endpoint supplied by Neon. |
| `DIRECT_URL` | Direct Neon URL for future Prisma CLI database operations. Credentials may be supplied separately for that role. |
| `PORT` | Optional TCP port for the HTTP server. |
| `HOST` | Optional bind address for the HTTP server. |
| `CORS_ORIGINS` | Optional comma-separated list of exact HTTP(S) browser origins. |

The runtime and CLI resolve the ignored repository-root `.env` relative to the configuration module. This works from both source and compiled output. Only the listed settings are selected. Process-level settings take precedence. `backend/.env.example` documents the variable names using empty placeholders.

The API accepts standard PostgreSQL URLs for Neon hosts ending in `.neon.tech`. It accepts the standard `sslmode`, `channel_binding` and `pgbouncer` URL parameters, enforces TLS certificate and hostname verification, and enables channel binding in the driver. A server process owns one Prisma client and one bounded PostgreSQL driver pool with at most four local connections, a ten-second connection timeout, a ten-second query timeout and a thirty-second idle timeout.

The Prisma CLI uses only the direct URL for database commands. Offline generation and schema validation work with the existing model-free schema. The root environment provided a pooled runtime URL. A direct migration URL still needs to be supplied when the first reviewed schema migration is ready. See [Prisma's PostgreSQL driver and URL guidance](https://www.prisma.io/docs/orm/v7/core-concepts/supported-databases/postgresql).

## Package layout

```text
backend/
  package.json, pnpm-lock.yaml, pnpm-workspace.yaml
  tsconfig.json, tsconfig.build.json, .env.example
  prisma.config.ts               CLI paths and direct datasource
  prisma/schema.prisma           PostgreSQL provider and client generator
  src/
    app.ts                       Express configuration and route registration
    server.ts                    Node HTTP listener and shutdown lifecycle
    config/env.ts                Root-file loading and setting validation
    db/client.ts                 Prisma client, driver pool and read-only probe
    db/diagnostics.ts            Safe categories for connection failures
    middleware/errors.ts         Public error responses
    routes/health.ts             Liveness and database readiness
    generated/prisma/            Generated locally
  tests/
    config.test.ts, api.test.ts   Configuration and HTTP behavior
    live-health.mjs              Opt-in live Neon test using the compiled API
```

Installed runtime packages are Express 5.3.0, Prisma Client and its PostgreSQL adapter 7.10.1, Zod 4.6.7, Helmet 8.3.0 and CORS 2.8.6. The adapter manages the `pg` driver. Development tooling includes Prisma CLI 7.10.1, TypeScript 5.9.3, tsx 4.23.15 and type declarations for Node, Express and CORS. Unit tests use Node's built-in runner. pnpm allows the required install scripts for Prisma, its engines and esbuild.

## HTTP contract

| Endpoint | Behavior |
| --- | --- |
| `GET /api/health` | Responds with 200 and `{"status":"ok","service":"rep-rivals-api"}` even during a database outage. |
| `GET /api/health/database` | Runs the query for each request. A verified result returns 200 with the same fields plus `"database":"reachable"`. A failed probe returns 503 with the public code `DATABASE_UNAVAILABLE`. |

Both endpoints validate their empty query schema. Errors use `status` and an `error` object with a stable `code` and public `message`. The central handler covers malformed JSON, oversized bodies, rejected origins and missing routes. The API sets security headers, disables response caching and limits JSON bodies to 16 KiB. Local browser defaults include the documented Vite port 5173 and the Figma configuration's default port 8443, using localhost or IPv4 loopback. Origin checks admit requests from command-line health monitors.

Database failures produce a bounded diagnostic category in server logs, such as DNS failure, authentication failure or timeout. Responses and application logs omit raw driver errors, SQL, hostnames and credentials. The frontend can later use a same-origin API proxy or an explicitly configured backend origin when its connection policy is updated.

The Express app and Node HTTP listener have separate entry points. A future Socket.IO server can attach to that listener. On SIGINT or SIGTERM, shutdown stops accepting HTTP connections, drains active requests, closes remaining HTTP connections after the grace period and disconnects Prisma.

## Verification

| Check | Observed result |
| --- | --- |
| Backend dependency installation | Frozen-lockfile install succeeded after approving the three declared build dependencies in the backend package. |
| `pnpm db:generate` and `pnpm db:validate` | Prisma 7.10.1 generated the client and accepted the schema. |
| `pnpm typecheck` and `pnpm build` | Both passed. `pnpm start` started the compiled listener on the default port. |
| `pnpm test` | All 8 backend tests passed. They exercise configuration precedence, direct URL validation, redaction, liveness, readiness, input errors, CORS and security headers. |
| `pnpm verify:live` after building | Both requests returned HTTP 200. The real Neon probe returned the expected scalar. The test closed its ephemeral loopback listener and Prisma pool. |
| Phase 1 regression | All 35 frontend unit tests and frontend type checking passed. Before/after hashes matched across the frontend source tree, including its manifest and lockfile. |

The first sandboxed HTTP tests encountered `EACCES` connecting to their local test listeners. The approved network-enabled runs above completed successfully. Git still excludes the root environment file. The Phase 1 owner-reported physical push-up test predates this backend work.

## Next milestone

Phase 2B introduces authentication. First configure the direct migration connection to a development branch, review the account and session schema, then create and inspect the first migration there. The backend provides `pnpm db:migrate:dev` for development migration creation, `pnpm db:migrate:status` for inspection, and `pnpm db:migrate:deploy` for subsequently applying reviewed migrations. Prisma's development workflow belongs on a dedicated development branch.

Phase 2A verified runtime connectivity only. Schema migrations, database writes, production hosting and frontend-to-API integration await their respective phases. No migration or table-creation command ran.
