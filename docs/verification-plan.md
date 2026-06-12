# Verification Plan

This plan defines the pre-build and MVP verification path for Artifact Review. Keep the root verification command useful and avoid relying on manual checks for behavior that can be tested cheaply.

## Current Verified Baseline

As of 2026-06-12:

- `npm install` completes and generates `package-lock.json`.
- `npm audit --json` reports zero vulnerabilities.
- `npm run verify` passes.
- Current automated tests: parser stability and provider readiness policy.
- `npm run dev:service` starts the service on `127.0.0.1:4793` when allowed to bind local IPC/ports.
- `/health` returns liveness; `/ready` and `/api/setup-readiness` return expected setup blockers when env is not configured.

## Root Commands

| Command | Purpose |
| --- | --- |
| `npm install` | Install numbered dependencies and refresh the lockfile. |
| `npm run lint` | Typecheck React/Vite and service TypeScript. |
| `npm test` | Run Vitest test suite. |
| `npm run build` | Typecheck and build the Vite UI. |
| `npm run verify` | Run lint, tests, and build as the main local verification path. |
| `npm run doctor` | Inspect service health/readiness when the local service is running. |

## Test Coverage To Add First

Implement these before or with the related feature slices:

- migration runner applies migrations in order and is idempotent
- repository tests for documents, document versions, components, task runs, suggestions, and app settings
- parser tests for `txt`, `md`, `html`, `htm`, and URL snapshot inputs
- component ID stability across autosave and save
- no active workflow blocks ingest with setup guidance
- valid workflow initializes a new document to the first entry state
- invalid workflow transitions are rejected by the service
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
