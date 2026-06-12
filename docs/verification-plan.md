# Verification Plan

This plan defines the pre-build and MVP verification path for Artifact Review. Keep the root verification command useful and avoid relying on manual checks for behavior that can be tested cheaply.

## Current Verified Baseline

As of 2026-06-12:

- `npm install` completes and generates `package-lock.json`.
- `npm audit --json` reports zero vulnerabilities.
- `npm run verify` passes.
- Current automated tests: parser stability and source ranges, provider readiness policy, migration-file loading, repository mapping/query behavior, workflow HTTP endpoints, `txt`/`md`/`html`/`htm` file ingest HTTP behavior, URL snapshot ingest HTTP behavior, review mutation HTTP behavior, autosave snapshot creation, and save-to-version promotion.
- `npm run dev:service` starts the service on `127.0.0.1:4793` when allowed to bind local IPC/ports.
- `/health` returns liveness; `/ready` and `/api/setup-readiness` return expected setup blockers when env is not configured.

## Root Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install numbered dependencies and refresh the lockfile. |
| `npm run lint` | Typecheck React/Vite and service TypeScript. |
| `npm test` | Run Vitest test suite. |
| `npm run test:postgres` | Run opt-in Postgres integration tests when `ARTIFACT_REVIEW_TEST_DATABASE_URL` is configured. |
| `npm run build` | Typecheck and build the Vite UI. |
| `npm run verify` | Run lint, tests, and build as the main local verification path. |
| `npm run doctor` | Inspect service health/readiness when the local service is running. |

## Postgres Integration Harness

`npm run test:postgres` validates the migration runner and repositories against a configured Postgres database. Set `ARTIFACT_REVIEW_TEST_DATABASE_URL` to a disposable local database URL before running it.

The test creates a temporary schema named `artifact_review_test_<uuid>`, runs migrations in that schema, verifies idempotency, round-trips repository records, and drops only the temporary schema during cleanup. Do not point this variable at a production database.

## Test Coverage To Add First

Implement these before or with the related feature slices:

- registry unavailable blocks provider-backed actions with a readiness reason
- saved missing `selectedProviderProfileKey` does not fall back to `INVOKE_PROVIDERS_PROFILE`
- missing secret reference blocks provider invocation before adapter execution
- `externalSend: true` is visible before AI Suggest invocation
- invalid structured provider output stores a failed task run and no suggestion
- successful AI Suggest stores a proposed suggestion and does not mutate component text
- accepting a suggestion creates an audited component revision
- rejecting a suggestion preserves history without mutating component text
- export round trip for every MVP format

## Manual Smoke Checks

Use manual checks only after the implementation slice has automated coverage:

- local service starts on `127.0.0.1:4793`
- UI starts on `http://127.0.0.1:5182`
- setup readiness shows database, workflow, and provider blockers clearly
- Tauri shell starts through `npm run tauri:dev`
- document import surface blocks clearly when no active workflow exists
- provider-backed buttons are disabled with concrete readiness reasons

Use Chrome for browser validation unless explicitly directed otherwise.

## Release Boundary

Build Mode is the default. Do not create release packages, tags, published images, or distribution artifacts unless explicitly requested.
