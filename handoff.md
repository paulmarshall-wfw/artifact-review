# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T01:29:00Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `63446d3`
- Session scope: `state-workflow-runtime` wiring plus in-app provider runtime settings.

### Checkpoint Status

- Git HEAD: `63446d3`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `README.md`
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/setup-readiness.md`
  - `docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`
  - `package-lock.json`
  - `package.json`
  - `service/src/http/server.ts`
  - `service/src/providers/readiness.ts`
  - `service/src/providers/registry.ts`
  - `service/src/repositories/appSettings.ts`
  - `service/src/repositories/index.ts`
  - `service/src/repositories/workflows.ts`
  - `service/src/workflow/definition.ts`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
  - `tests/helpers/http.ts`
  - `tests/http-ingest.test.ts`
  - `tests/http-review.test.ts`
  - `tests/http-workflow.test.ts`
  - `tests/provider-readiness.test.ts`
  - `tests/workflow.test.ts`
- New files intentionally in scope:
  - `service/src/workflow/runtime.ts`
  - `service/src/workflow/storage.ts`
  - `tests/http-provider-settings.test.ts`
- Last verification:
  - `npm run verify`: passed
  - `npm run lint`: passed as part of verify
  - `npm test`: passed with 10 test files, 1 skipped Postgres suite, 41 tests passed, and 2 skipped
  - `npm run build`: passed as part of verify
  - Chrome smoke: passed against `http://127.0.0.1:5182/`; Providers panel rendered settings controls, expected setup blockers were visible, and Chrome reported no console errors
  - `npm run tauri:dev`: compiled and launched the macOS `artifact-review` app
  - Desktop service health: passed outside the sandbox at `http://127.0.0.1:4793/health`
- Browser validation: Chrome smoke passed.
- Tauri desktop validation: macOS `npm run tauri:dev` launched.
- Windows smoke validation: pending; not runnable from this macOS workspace.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

The document workflow path is now backed by `state-workflow-runtime@2.0.0`.

Completed now:

- Installed `state-workflow-runtime@2.0.0` as a numbered local file dependency from `../state-workflow-runtime`.
- Added a runtime storage adapter over the existing `app_settings` table for active workflow selection, item states, history, events, hook work, migration status, and failure records.
- Replaced workflow validation, activation, ingest initialization, action listing, and action execution with runtime-backed service helpers.
- Updated the document workflow fixture to runtime-compatible workflow id `document`.
- Added in-app provider runtime settings for registry URL, selected profile key, and explicit deterministic demo mode.
- Added `GET /api/provider-settings` and `PUT /api/provider-settings`.
- Kept raw provider secrets outside Postgres; provider settings store only non-secret runtime configuration.

Still incomplete or blocked:

- Real provider adapter execution remains blocked until provider runtime dependencies are explicitly approved and installed.
- Windows smoke validation remains pending and is required before any distribution work or discussion.

## 3. Current State

Working:

- `npm run verify` passes.
- Default tests skip the Postgres integration suite when `ARTIFACT_REVIEW_TEST_DATABASE_URL` is absent.
- File and URL ingest remain workflow-gated.
- Workflow status and document workflow actions come from the service/runtime, not React inference.
- Provider runtime settings are visible and editable from the Providers panel.
- Provider readiness uses saved provider settings before first-run environment values.
- Review mutations, autosave snapshots, save promotion, export, AI proposal creation, and AI accept/reject behavior remain covered.

Not yet verified:

- Live database-backed Chrome validation with populated review/suggestion data after this runtime change.
- Windows smoke validation.

## 4. Active Constraints

- Build Mode by default; do not release, publish, tag, package, install dependencies, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Backend-owned workflow state remains authoritative; React renders service-derived workflow actions.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Tauri should stay limited to native capabilities such as destination selection and reveal-in-folder.
- Do not store raw provider secrets in Postgres.

## 5. Provider Runtime Dependency Boundary

Provider runtime dependencies still requiring explicit approval before installation:

- `@invoke-providers/core@0.1.0`
- `@invoke-providers/client@0.1.0`
- `@invoke-providers/adapters@0.1.0`

Likely not needed for Artifact Review unless requirements change:

- `@invoke-providers/react@0.1.0`: optional helper package; current UI can stay app-native.
- `@invoke-providers/registry@0.1.0`: registry service package; the shared registry remains the source of truth outside Artifact Review.

## 6. Commands and Verification

Most recent verified commands:

- `npm run verify`: passed with 10 test files, 1 skipped Postgres suite, 41 tests passed, and 2 skipped; Vite production build passed.
- Focused tests: `npm test -- tests/provider-readiness.test.ts tests/http-provider-settings.test.ts tests/workflow.test.ts tests/http-workflow.test.ts tests/http-ingest.test.ts` passed with 19 tests.
- Chrome smoke against `http://127.0.0.1:5182/`: passed; Providers panel settings form rendered, setup/provider blockers were visible without `DATABASE_URL`, and Chrome console errors were empty.
- `npm run tauri:dev`: launched the macOS desktop shell.
- `curl -sS http://127.0.0.1:4793/health`: passed outside the sandbox while `npm run tauri:dev` was running.

Environment notes:

- `DATABASE_URL` was unset for browser and desktop validation, so the expected database/setup blockers rendered.
- The sandboxed loopback probe to `127.0.0.1:4793` failed while the desktop service was running, but the same health check passed outside the sandbox.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/api-contract.md`: current service endpoints and error behavior.
- `docs/setup-readiness.md`: setup blockers and in-app provider settings behavior.
- `service/src/workflow/runtime.ts`: runtime-backed document workflow helpers.
- `service/src/workflow/storage.ts`: `state-workflow-runtime` storage adapter.
- `service/src/http/server.ts`: provider settings, ingest, review mutation, save, export, and workflow API implementation.
- `service/src/providers/readiness.ts`: provider settings precedence and readiness rules.
- `src/App.tsx`: review workspace and Provider settings UI.
- `src/lib/api.ts`: typed React API client.
- `tests/http-provider-settings.test.ts`: provider settings HTTP coverage.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Run database-backed Chrome validation with an active workflow, ingested document, review records, provider settings, and export.
- Run Windows smoke validation before any distribution work or discussion.

Blocked or deferred:

- Real provider adapter execution remains blocked until the provider runtime dependencies listed above are explicitly approved and installed.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Continue from the `state-workflow-runtime` and in-app provider settings slice. Preserve backend-owned workflow state through `state-workflow-runtime`, keep provider settings non-secret and app-configurable, and do not install provider runtime dependencies, commit, release, package, publish, or discuss distribution unless explicitly approved. Windows smoke validation is still required before any distribution work or discussion.
