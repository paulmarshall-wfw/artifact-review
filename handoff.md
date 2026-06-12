# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T07:18:00Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `46a1690`; branch is 5 commits ahead of `origin/main`
- Session scope: completed workflow endpoint coverage and first Build Slice 3 `txt` ingest

### Checkpoint Status

- Git HEAD: `46a1690`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `service/src/domain/parser.ts`
  - `service/src/http/server.ts`
  - `tests/parser.test.ts`
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - `tests/helpers/http.ts`
  - `tests/http-ingest.test.ts`
  - `tests/http-workflow.test.ts`
- Untracked files intentionally out of scope:
  - None
- Last verification:
  - command: `npm run verify`
  - result: passed with 6 test files, 1 skipped Postgres suite, 16 tests passed, and 2 skipped
  - timestamp UTC: 2026-06-12T07:16:48Z
- Last Postgres integration verification:
  - command: `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`
  - result: passed with 2 tests
  - timestamp UTC: 2026-06-12T06:55:02Z
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD` and all dirty/untracked files are accounted for; full local verification passed after this slice.

## 2. Executive Summary

Current focus is Artifact Review backend-owned workflow plus ingest.

Confirmed complete now:

- Build Slice 1 persistence foundation and isolated Postgres validation.
- Build Slice 2 workflow validation, activation, status, allowed actions, guarded transitions, and HTTP endpoint coverage.
- First Build Slice 3 `txt` file ingest: creates document, version `1`, stable sentence components with source ranges, parser metadata, and initial workflow entry state.
- Continuity docs refreshed for the current dirty tree.

Incomplete now:

- `state-workflow-runtime` is not installed or wired.
- `md`, `html`, `htm`, and URL snapshot ingest are not implemented.
- Review mutations, autosave, provider invocation, suggestion accept/reject, export, browser UI validation, and Tauri validation are still pending.

Safe to continue from this dirty tree. Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue Build Slice 3 beyond `txt` ingest.

Definition of done for the next workstream:

- Add `md` ingest after the existing `txt` ingest shape.
- Preserve stable component IDs and source mappings.
- Keep ingest blocked with `workflow_not_configured` when no active workflow exists.
- Keep the repo workflow fixture importable but never auto-activated.
- Preserve backend-owned workflow state and render allowed actions from service responses.
- Do not install `state-workflow-runtime` or other dependencies unless explicitly approved.

## 4. Current State

### Working

- `npm run verify` passes.
- `npm run test:postgres` passes when `ARTIFACT_REVIEW_TEST_DATABASE_URL` points at a reachable isolated Postgres database.
- Default tests skip the Postgres integration suite when the URL is absent.
- Service startup runs migrations when `DATABASE_URL` is configured.
- Migrations are idempotent against real Postgres.
- Repositories round-trip document, version, component, app setting, task run, suggestion, and active workflow records against real Postgres.
- `/api/workflow/status`, `/api/workflow/definitions/validate`, `/api/workflow/activate`, `/api/workflow/documents/:documentId/actions`, and `/api/workflow/documents/:documentId/actions/:actionId` are implemented and covered by HTTP tests.
- `/api/ingest/file` supports `{ name, format: "txt", content }` when database and active workflow are configured.
- `txt` ingest creates source-range-backed sentence components and starts the document in the active workflow entry state.
- `/api/setup-readiness` uses persisted active workflow state.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Workflow activation is API-only; no UI surface exists yet.
- Ingest supports `txt` only.

### Not Working Yet

- `state-workflow-runtime` adapter.
- `md`, `html`, `htm`, and URL snapshot ingest.
- Review mutation endpoints, autosave, provider-backed suggestions, suggestion accept/reject, and export.

### Not Yet Verified

- `npm run dev`
- `npm run tauri:dev`
- Chrome/browser UI validation
- Tauri desktop validation

## 5. Active Constraints

- Build Mode by default; do not release, publish, tag, package, install dependencies, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Artifact Review is an `invoke-providers-for-tasks` target app; the shared registry owns provider catalog/profile/config records.
- Artifact Review owns selected profile settings, tasks, prompts, schemas, hooks, task runs, suggestions, documents, workflow transitions, and domain mutations.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Backend-owned workflow state is authoritative; React renders allowed actions from the service.
- Do not store raw provider secrets in Postgres.
- Before changing local ports, update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`.

## 6. Commands and Verification

Most recent verified commands:

- `npm run verify`: passed at 2026-06-12T07:16:48Z.
- `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`: passed at 2026-06-12T06:55:02Z.

Environment notes:

- `DATABASE_URL` was unset for the default verification path.
- `psql` and `pg_isready` were not on PATH in the previous session.
- A local `memo-capture-postgres-16-8` container using `postgres:16.8-alpine` was previously available on port `5432`.
- Isolated database `artifact_review_test` previously existed in that container for Artifact Review validation.
- Repo-local handoff helper scripts are absent; freshness is manually grounded from `git status`, `HEAD`, file inspection, and verification evidence.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining ingest work.
- `docs/api-contract.md`: current and reserved service endpoints.
- `docs/data-model.md`: persistence ownership and ingest storage notes.
- `service/src/domain/parser.ts`: plain-text parser and source-range behavior.
- `service/src/http/server.ts`: workflow and ingest API implementation.
- `service/src/workflow/definition.ts`: workflow validation and action derivation.
- `tests/http-ingest.test.ts`: first ingest HTTP coverage.
- `tests/http-workflow.test.ts`: workflow endpoint coverage.
- `tests/helpers/http.ts`: in-process Express request harness.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Add `md` ingest using the same repository-backed document/version/component flow as `txt`.
- Add parser tests for `md` component stability and source ranges.
- Decide after `md` ingest whether `html`/`htm` should share a parser abstraction before implementing URL snapshots.

Blocked:

- Provider-backed behavior remains blocked until real registry client integration and selected-profile handling are implemented.

Later:

- Implement review mutation endpoints and autosave.
- Wire provider-backed suggestions as proposal-only records.
- Implement same-format export.
- Run browser UI and Tauri desktop validation after user-facing flows are wired.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `service/src/domain/parser.ts`, `service/src/http/server.ts`, `tests/http-ingest.test.ts`, and `tests/http-workflow.test.ts` first. Continue Build Slice 3 with `md` ingest, preserving backend-owned workflow state, stable component IDs, and source mappings. Distinguish confirmed repo state from recommendations, and load broader context only from canonical docs when the immediate task requires it.
