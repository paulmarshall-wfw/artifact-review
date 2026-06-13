# Verification Plan

This plan defines the pre-build and MVP verification path for Artifact Review. Keep the root verification command useful and avoid relying on manual checks for behavior that can be tested cheaply.

## Current Verified Baseline

As of 2026-06-13:

- `npm install` completes and generates `package-lock.json`.
- `npm audit --json` reports zero vulnerabilities.
- `npm run verify` passes.
- `cargo check --offline` passes for the Tauri app after adding `src-tauri/icons/icon.png`.
- Chrome smoke against `http://127.0.0.1:5184/` passes with the expected Settings/provider/workflow blockers visible, predefined landing areas listed, ingest disabled without an active workflow, desktop layout without horizontal overflow, and no Chrome console errors.
- `npm run tauri:dev` launches the macOS desktop shell; the desktop-launched service reports healthy at `http://127.0.0.1:4794/health`.
- Current automated tests: parser stability and source ranges, provider readiness policy, migration-file loading, repository mapping/query behavior, task-route mapping/update behavior, Settings HTTP endpoints, render-slot listing, task-run diagnostics listing, workflow HTTP endpoints, `txt`/`md`/`html`/`htm` file ingest HTTP behavior, URL snapshot ingest HTTP behavior, review mutation HTTP behavior, autosave snapshot creation, and save-to-version promotion.
- `npm run dev:service` starts the service on `127.0.0.1:4794` when allowed to bind local IPC/ports.
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

1. Local Chrome smoke:
   - local service starts on `127.0.0.1:4794`
   - UI starts on `http://127.0.0.1:5184`
   - setup readiness shows database, workflow, and provider blockers clearly
   - Settings shows Workflow, Provider Registry, AI Tasks, Landing Areas, Diagnostics, and Ingest sections
   - predefined landing areas show current task assignments or clear empty assignment state
   - document import surface blocks clearly when no active workflow exists
   - provider-backed buttons are disabled with concrete readiness reasons
   - desktop layout has no horizontal overflow; narrow viewport should be checked when Chrome automation supports resizing or by a manual resize
   - Chrome console has no errors
2. macOS desktop smoke:
   - Tauri shell starts through `npm run tauri:dev`
   - desktop-launched service reports healthy at `http://127.0.0.1:4794/health`
   - export destination selection and reveal-in-folder are checked when a reviewed document exists
3. Windows desktop smoke:
   - run the equivalent Windows Tauri smoke validation before any distribution work or discussion
   - confirm the Windows save dialog path in `src-tauri/src/lib.rs` before treating the slice as cross-platform complete

Use Chrome for browser validation unless explicitly directed otherwise.

## Release Boundary

Build Mode is the default. Do not create release packages, tags, published images, or distribution artifacts unless explicitly requested.
