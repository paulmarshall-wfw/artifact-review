# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T11:33:58Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `3cdffed`; branch is 8 commits ahead of `origin/main`
- Session scope: continued the next three app build slices: autosave staged review changes, human review mutations, and save-to-version promotion.

### Checkpoint Status

- Git HEAD: `3cdffed`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `service/src/http/server.ts`
  - `service/src/repositories/index.ts`
- Untracked files intentionally in scope:
  - `service/src/repositories/review.ts`
  - `tests/http-review.test.ts`
- Dirty or untracked files intentionally out of scope:
  - None
- Last verification:
  - command: `npm run verify`
  - result: passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; lint and Vite build also passed
  - timestamp UTC: 2026-06-12T11:33:47Z
- Last Postgres integration verification:
  - command: `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`
  - result: passed with 2 tests
  - timestamp UTC: 2026-06-12T06:55:02Z
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD` and all dirty/untracked files are accounted for; full local verification passed after this slice.

## 2. Executive Summary

Current focus is Artifact Review backend-owned review behavior before provider assistance.

Confirmed complete now:

- Build Slice 1 persistence foundation and isolated Postgres validation.
- Build Slice 2 workflow validation, activation, status, allowed actions, guarded transitions, and HTTP endpoint coverage.
- Build Slice 3 file ingest for `txt`, `md`, `html`, and `htm`.
- Build Slice 3 URL snapshot ingest.
- Build Slice 3 autosave support for staged review mutations.
- Build Slice 4 backend review mutation surface:
  - `PATCH /api/components/:componentId`
  - `POST /api/components/:componentId/annotations`
  - `POST /api/components/:componentId/questions`
  - `POST /api/components/:componentId/evidence`
  - `PATCH /api/components/:componentId/highlight`
  - `POST /api/documents/:documentId/save`
- Component edits create audited `component_revisions`.
- Annotation, question, evidence, and highlight mutations create `autosave_snapshots`.
- Save creates a new `document_versions` row with the imported source snapshot preserved and JSON review-state data in `current_snapshot`.
- Document detail now returns review records alongside document, versions, and components.

Incomplete now:

- `state-workflow-runtime` is not installed or wired.
- React UI wiring for ingest/review/edit/save is still pending.
- Provider invocation, suggestion accept/reject, export, browser UI validation, and Tauri validation are still pending.

Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue after the service-backed review mutation/save slices.

Definition of done for the next workstream:

- Wire the React review workspace to repository-backed document list/detail, review components, mutations, autosave status, and save.
- Preserve backend-owned workflow state and render allowed actions from service responses.
- Keep provider-backed suggestions proposal-only and blocked until registry/provider readiness is actually wired.
- Preserve stable component IDs, source mappings, original text hashes, and imported source snapshots.
- Do not install `state-workflow-runtime`, provider runtime packages, or other dependencies unless explicitly approved.

## 4. Current State

### Working

- `npm run verify` passes.
- Default tests skip the Postgres integration suite when `ARTIFACT_REVIEW_TEST_DATABASE_URL` is absent.
- `npm run test:postgres` passed previously when pointed at an isolated local Postgres database.
- Service startup runs migrations when `DATABASE_URL` is configured.
- Migrations are idempotent against real Postgres.
- Repositories round-trip document, version, component, app setting, task run, suggestion, and active workflow records against real Postgres.
- `/api/workflow/status`, `/api/workflow/definitions/validate`, `/api/workflow/activate`, `/api/workflow/documents/:documentId/actions`, and `/api/workflow/documents/:documentId/actions/:actionId` are implemented and covered.
- `/api/ingest/file` supports `txt`, `md`, `html`, and `htm` when database and active workflow are configured.
- `/api/ingest/url` supports caller-supplied snapshot HTML or fetched `http`/`https` URL snapshots.
- `/api/components/:componentId` edits current component text and writes an audit revision.
- Annotation, question, evidence, and highlight endpoints write review records and autosave snapshots.
- `/api/documents/:documentId/save` creates a new review-state document version while preserving the imported source snapshot.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Workflow activation is API-only; no UI surface exists yet.
- Review mutation endpoints are service-backed but not yet wired into React.
- Save stores JSON review-state snapshots; same-format export is intentionally deferred to Build Slice 6.

### Not Working Yet

- `state-workflow-runtime` adapter.
- Provider-backed suggestions.
- Suggestion accept/reject.
- Same-format export.
- Review workspace UI wiring.

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

- `npm run verify`: passed at 2026-06-12T11:33:47Z.
- `npm run lint`: passed during `npm run verify`.
- `npm test`: passed during `npm run verify` with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped.
- `npm run build`: passed during `npm run verify`.
- `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`: passed at 2026-06-12T06:55:02Z.

Environment notes:

- `DATABASE_URL` was unset for the default verification path.
- `psql` and `pg_isready` were not on PATH in the previous session.
- A local `memo-capture-postgres-16-8` container using `postgres:16.8-alpine` was previously available on port `5432`.
- Isolated database `artifact_review_test` previously existed in that container for Artifact Review validation.
- Repo-local handoff helper scripts are absent; freshness is manually grounded from `git status`, `HEAD`, file inspection, and verification evidence.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining work.
- `docs/api-contract.md`: current and reserved service endpoints.
- `docs/data-model.md`: persistence ownership and review storage notes.
- `service/src/http/server.ts`: workflow, ingest, review mutation, autosave, and save API implementation.
- `service/src/repositories/review.ts`: review records, autosave, and component revision repository behavior.
- `service/src/repositories/documents.ts`: document, version, and component repository behavior.
- `tests/http-review.test.ts`: review mutation, autosave, and save endpoint coverage.
- `tests/http-ingest.test.ts`: ingest HTTP coverage.
- `tests/http-workflow.test.ts`: workflow endpoint coverage.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Wire the React review workspace to document list/detail, review components, review mutations, autosave state, and save.
- Keep the UI dense and stable: durable shell, document list/detail, inline review controls, and save/autosave state.
- Add focused UI/service tests for the wired review flows where practical.

Blocked or deferred:

- Provider-backed behavior remains blocked until real registry client integration and selected-profile handling are implemented.
- Same-format export remains Build Slice 6.
- Tauri desktop validation should wait until user-facing review flows are wired.

Later:

- Wire provider-backed suggestions as proposal-only records.
- Implement suggestion accept/reject.
- Implement same-format export.
- Run Chrome/browser UI and Tauri desktop validation after user-facing flows are wired.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty/untracked tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `docs/data-model.md`, `service/src/http/server.ts`, `service/src/repositories/review.ts`, `service/src/repositories/documents.ts`, and `tests/http-review.test.ts` first. Continue by wiring the React review workspace to repository-backed document detail, review mutations, autosave state, and save. Preserve backend-owned workflow state, stable component IDs, source mappings, original text hashes, and immutable imported source snapshots. Do not install dependencies, commit, release, or wire provider/runtime packages unless explicitly approved.
