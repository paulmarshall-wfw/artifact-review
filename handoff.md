# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T07:09:38Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `ed04eaf`; branch is 4 commits ahead of `origin/main`
- Session scope: Build Slice 1 validation completed; Build Slice 2 workflow operations started; continuity docs refreshed

### Checkpoint Status

- Git HEAD: `ed04eaf`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `README.md`
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `package.json`
  - `service/src/http/server.ts`
  - `service/src/repositories/documents.ts`
  - `service/src/repositories/index.ts`
  - `tests/repositories.test.ts`
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - `service/src/repositories/workflows.ts`
  - `service/src/workflow/definition.ts`
  - `tests/postgres.integration.test.ts`
  - `tests/workflow.test.ts`
- Untracked files intentionally out of scope:
  - None
- Canonical files described:
  - `handoff.md`
  - `docs/completed-tasks.md`
  - `docs/implementation-sequence.md`
  - `docs/api-contract.md`
  - `docs/data-model.md`
  - `docs/verification-plan.md`
- Last verification:
  - command: `npm run verify`
  - result: passed with 4 test files, 1 skipped Postgres suite, 10 tests passed, and 2 skipped
  - timestamp UTC: 2026-06-12T06:57:07Z
- Last Postgres integration verification:
  - command: `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`
  - result: passed with 2 tests
  - timestamp UTC: 2026-06-12T06:55:02Z
- Last service smoke:
  - command: `DATABASE_URL=<isolated local Postgres URL> npm run dev:service`
  - result: passed for `/ready`, workflow validation, workflow activation, setup readiness, and active workflow status; service stopped with SIGINT
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD` and all dirty/untracked files are accounted for; last code verification and service smoke are recorded; this handoff points to the completed-task ledger instead of duplicating task history.
- Next checkpoint action: add HTTP-level workflow endpoint tests, then verify before commit or further handoff refresh.

## 2. Executive Summary

Current focus is Artifact Review persistence and backend-owned workflow operations.

Confirmed complete now:

- Build Slice 1 persistence foundation and isolated Postgres validation.
- Initial Build Slice 2 service-owned workflow validation, activation storage, status, allowed-actions, and guarded transition endpoints.
- Continuity docs refreshed for the current dirty tree.

Incomplete now:

- `state-workflow-runtime` is not installed or wired.
- HTTP-level workflow endpoint tests are not added.
- Ingest, review mutations, autosave, provider invocation, suggestion accept/reject, export, browser UI validation, and Tauri validation are still pending.

Safe to continue from this dirty tree. Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue Build Slice 2 until workflow operations have durable endpoint coverage, then start Build Slice 3 ingest.

Definition of done for the next workstream:

- Add HTTP-level tests for workflow validation, activation, allowed actions, and invalid transition rejection.
- Decide whether to install/wire `state-workflow-runtime` now; do not install dependencies unless explicitly approved.
- Keep the repo workflow fixture importable but never auto-activated.
- Preserve backend-owned workflow state and render allowed actions from service responses.

## 4. Current State

### Working

- `npm run verify` passes.
- `npm run test:postgres` passes when `ARTIFACT_REVIEW_TEST_DATABASE_URL` points at a reachable isolated Postgres database.
- Default tests skip the Postgres integration suite when the URL is absent.
- Service startup runs migrations when `DATABASE_URL` is configured.
- Migrations are idempotent against real Postgres.
- Repositories round-trip document, version, component, app setting, task run, suggestion, and active workflow records against real Postgres.
- `/api/workflow/status`, `/api/workflow/definitions/validate`, `/api/workflow/activate`, `/api/workflow/documents/:documentId/actions`, and `/api/workflow/documents/:documentId/actions/:actionId` are implemented.
- `/api/setup-readiness` uses persisted active workflow state.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Workflow activation is API-only; no UI surface exists yet.
- Document workflow action endpoints require existing documents; ingest is still blocked.

### Not Working Yet

- `state-workflow-runtime` adapter.
- Document ingest and component model creation.
- Review mutations, autosave, provider-backed suggestions, suggestion accept/reject, and export.

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

- `npm run verify`: passed at 2026-06-12T06:57:07Z.
- `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`: passed at 2026-06-12T06:55:02Z.
- `git diff --check`: passed before this continuity refresh.

Environment notes:

- `DATABASE_URL` was unset at session start.
- `psql` and `pg_isready` were not on PATH.
- Docker socket and local network checks required approval.
- A local `memo-capture-postgres-16-8` container using `postgres:16.8-alpine` was already running on port `5432`.
- Isolated database `artifact_review_test` exists in that container for Artifact Review validation.
- Repo-local handoff helper scripts are absent; freshness is manually grounded from `git status`, `HEAD`, file inspection, and verification evidence.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining workflow/ingest work.
- `docs/api-contract.md`: current and reserved service endpoints.
- `docs/data-model.md`: persistence ownership and workflow storage notes.
- `service/src/workflow/definition.ts`: workflow validation and action derivation.
- `service/src/repositories/workflows.ts`: active workflow persistence.
- `service/src/http/server.ts`: workflow API implementation.
- `tests/workflow.test.ts`: workflow validation unit coverage.
- `tests/postgres.integration.test.ts`: opt-in real Postgres integration harness.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Add HTTP-level tests for workflow validation, activation, allowed actions, and invalid transition rejection.
- Decide whether to install/wire `state-workflow-runtime` now, or keep the internal workflow layer until ingest starts.
- Start Build Slice 3 ingest by making `txt` file ingest create a document, first version, stable components, and initial workflow state from the active workflow entry state.
- Keep ingest blocked with `workflow_not_configured` when no active workflow exists.

Blocked:

- Provider-backed behavior remains blocked until real registry client integration and selected-profile handling are implemented.

Later:

- Implement review mutation endpoints and autosave.
- Wire provider-backed suggestions as proposal-only records.
- Implement same-format export.
- Run browser UI and Tauri desktop validation after user-facing flows are wired.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `service/src/workflow/definition.ts`, `service/src/http/server.ts`, `tests/workflow.test.ts`, and `tests/postgres.integration.test.ts` first. Continue with HTTP-level workflow endpoint tests, then decide whether `state-workflow-runtime` should be installed before starting `txt` ingest. Distinguish confirmed repo state from recommendations, and load broader context only from canonical docs when the immediate task requires it.
