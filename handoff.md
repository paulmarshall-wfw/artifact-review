# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T11:52:01Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `541bf88`; branch is 9 commits ahead of `origin/main`
- Session scope: built React API wiring plus workflow fixture setup UI.

### Checkpoint Status

- Git HEAD: `541bf88`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/completed-tasks.md`
  - `docs/implementation-sequence.md`
  - `handoff.md`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
- Untracked files intentionally out of scope:
  - `docs/Artefact-ReviewBuildOut.txt`
- Last verification:
  - command: `npm run verify`
  - result: passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; lint and Vite build also passed
  - timestamp UTC: 2026-06-12T11:50:55Z
- Local dev startup:
  - command: `npm run dev`
  - result: Vite reported `http://127.0.0.1:5182/`; service reported startup on `127.0.0.1:4793`; `DATABASE_URL` was unset so migrations were skipped
  - limitation: separate sandboxed curl checks to `127.0.0.1` and `localhost` could not connect even though the dev session still reported running
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD`, scoped dirty files, and verification evidence are accounted for; no commit, tag, release, install, or dependency change was made.

## 2. Executive Summary

Current focus is Artifact Review React wiring over the already-implemented service endpoints.

Confirmed complete now:

- Typed React client calls for:
  - setup readiness and provider readiness
  - workflow status, workflow definition validation, and workflow activation
  - document list and document detail
  - file and URL ingest
  - component text autosave, annotations, questions, evidence, highlights, and document save
  - document workflow actions
- Workflow setup UI validates and imports/activates the repo-stored fixture.
- Ingest forms remain disabled until an active document workflow exists.
- Review workspace now renders repository-backed document rows, document detail, review components, autosave/save feedback, review records, and backend-derived workflow actions.
- Provider suggestion button remains readiness-gated and does not invoke provider runtime.

Incomplete now:

- `state-workflow-runtime` is not installed or wired.
- Provider invocation, suggestion accept/reject, same-format export, Chrome browser UI validation, and Tauri validation are still pending.
- A separate sandboxed HTTP smoke could not connect to the local dev ports despite startup logs.

Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue after React API wiring and workflow setup UI.

Definition of done for the next workstream:

- Wire provider-backed suggestions as proposal-only records after real registry/provider readiness is available.
- Implement suggestion accept/reject as separate audited user actions.
- Preserve backend-owned workflow state; React must keep rendering allowed actions from service responses.
- Preserve stable component IDs, source mappings, original text hashes, and imported source snapshots.
- Do not install `state-workflow-runtime`, provider runtime packages, or other dependencies unless explicitly approved.

## 4. Current State

### Working

- `npm run verify` passes.
- Default tests skip the Postgres integration suite when `ARTIFACT_REVIEW_TEST_DATABASE_URL` is absent.
- Service startup runs migrations when `DATABASE_URL` is configured.
- `/api/workflow/status`, `/api/workflow/definitions/validate`, `/api/workflow/activate`, `/api/workflow/documents/:documentId/actions`, and `/api/workflow/documents/:documentId/actions/:actionId` are implemented and covered.
- `/api/ingest/file` supports `txt`, `md`, `html`, and `htm` when database and active workflow are configured.
- `/api/ingest/url` supports caller-supplied snapshot HTML or fetched `http`/`https` URL snapshots.
- `/api/components/:componentId` edits current component text and writes an audit revision.
- Annotation, question, evidence, and highlight endpoints write review records and autosave snapshots.
- `/api/documents/:documentId/save` creates a new review-state document version while preserving the imported source snapshot.
- React calls the current API surface through `src/lib/api.ts`.
- React workflow setup UI can validate and activate the bundled fixture.
- React ingest UI is blocked until `GET /api/workflow/status` reports an active workflow.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Provider readiness is visible and gates UI affordances, but provider invocation is still unimplemented.
- Save stores JSON review-state snapshots; same-format export is intentionally deferred to Build Slice 6.

### Not Working Yet

- `state-workflow-runtime` adapter.
- Provider-backed suggestions.
- Suggestion accept/reject.
- Same-format export.

### Not Yet Verified

- Chrome/browser UI validation.
- `npm run tauri:dev`
- Tauri desktop validation.

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

- `npm run lint`: passed.
- `npm run verify`: passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; Vite production build passed.
- `npm run dev`: reported Vite and service startup, but separate curl checks could not connect from this sandbox context.

Environment notes:

- `DATABASE_URL` was unset for the default verification and dev-start path.
- Repo-local handoff helper scripts are absent; freshness is manually grounded from `git status`, `HEAD`, file inspection, and verification evidence.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining work.
- `docs/api-contract.md`: current and reserved service endpoints.
- `src/lib/api.ts`: React API client types and calls.
- `src/App.tsx`: React workflow setup, ingest, review, mutation, save, and workflow-action UI.
- `src/styles.css`: current workspace layout.
- `service/src/http/server.ts`: workflow, ingest, review mutation, autosave, and save API implementation.
- `tests/http-review.test.ts`: review mutation, autosave, and save endpoint coverage.
- `tests/http-ingest.test.ts`: ingest HTTP coverage.
- `tests/http-workflow.test.ts`: workflow endpoint coverage.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Run Chrome/browser UI validation once a reachable dev server with a configured database is available.
- Run `npm run tauri:dev` after browser UI validation.
- Begin provider-backed suggestion wiring only after registry/profile readiness and selected-profile behavior are in place.

Blocked or deferred:

- Provider-backed behavior remains blocked until real registry client integration and selected-profile handling are implemented.
- Same-format export remains Build Slice 6.

Later:

- Implement suggestion accept/reject.
- Implement same-format export.
- Run Tauri desktop validation for native shell behavior.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `src/lib/api.ts`, `src/App.tsx`, `src/styles.css`, and `service/src/http/server.ts` first. Continue after the React API wiring and workflow setup UI. Preserve backend-owned workflow state, stable component IDs, source mappings, original text hashes, immutable imported source snapshots, and provider proposal-only boundaries. Do not install dependencies, commit, release, or wire provider/runtime packages unless explicitly approved.
