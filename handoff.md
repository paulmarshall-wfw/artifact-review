# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T08:50:57Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `935d185`; branch is 7 commits ahead of `origin/main`
- Session scope: continued Build Slice 3 with URL snapshot ingest

### Checkpoint Status

- Git HEAD: `935d185`
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
  - `tests/http-ingest.test.ts`
  - `tests/parser.test.ts`
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - None
- Untracked files intentionally out of scope:
  - None
- Last verification:
  - command: `npm run verify`
  - result: passed with 6 test files, 1 skipped Postgres suite, 25 tests passed, and 2 skipped; lint and Vite build also passed
  - timestamp UTC: 2026-06-12T08:50:49Z
- Last Postgres integration verification:
  - command: `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres`
  - result: passed with 2 tests
  - timestamp UTC: 2026-06-12T06:55:02Z
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD` and all dirty files are accounted for; full local verification passed after this slice.

## 2. Executive Summary

Current focus is Artifact Review backend-owned workflow plus ingest.

Confirmed complete now:

- Build Slice 1 persistence foundation and isolated Postgres validation.
- Build Slice 2 workflow validation, activation, status, allowed actions, guarded transitions, and HTTP endpoint coverage.
- Build Slice 3 file ingest for `txt`, `md`, `html`, and `htm`.
- Build Slice 3 URL snapshot ingest.
- `txt` ingest creates stable sentence components with source ranges.
- `md` ingest creates stable Markdown heading, prose sentence, and bullet components with source ranges; headings also anchor section IDs for following content.
- `html`/`htm` ingest creates stable paragraph sentence, HTML list item, and table body row components with source ranges; headings anchor sections and are not inline review targets.
- URL snapshot ingest accepts caller-supplied snapshot HTML or fetches `http`/`https` URLs, reuses the HTML parser, and stores source/fetch metadata.
- Ingest creates document, version `1`, parser metadata, review components, and initial workflow entry state when database and active workflow are configured.
- Continuity docs refreshed for the current dirty tree.

Incomplete now:

- `state-workflow-runtime` is not installed or wired.
- Review mutations, autosave, provider invocation, suggestion accept/reject, export, browser UI validation, and Tauri validation are still pending.

Safe to continue from this dirty tree. Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue Build Slice 3 beyond URL snapshot ingest.

Definition of done for the next workstream:

- Add autosave staged review changes without making React the owner of durable document mutations.
- Preserve stable component IDs, source mappings, and imported source snapshots.
- Keep ingest blocked with `workflow_not_configured` when no active workflow exists.
- Keep the repo workflow fixture importable but never auto-activated.
- Preserve backend-owned workflow state and render allowed actions from service responses.
- Do not install `state-workflow-runtime` or other dependencies unless explicitly approved.

## 4. Current State

### Working

- `npm run verify` passes.
- `npm run test:postgres` passed previously when `ARTIFACT_REVIEW_TEST_DATABASE_URL` pointed at a reachable isolated Postgres database.
- Default tests skip the Postgres integration suite when the URL is absent.
- Service startup runs migrations when `DATABASE_URL` is configured.
- Migrations are idempotent against real Postgres.
- Repositories round-trip document, version, component, app setting, task run, suggestion, and active workflow records against real Postgres.
- `/api/workflow/status`, `/api/workflow/definitions/validate`, `/api/workflow/activate`, `/api/workflow/documents/:documentId/actions`, and `/api/workflow/documents/:documentId/actions/:actionId` are implemented and covered by HTTP tests.
- `/api/ingest/file` supports `{ name, format: "txt" | "md" | "html" | "htm", content }` when database and active workflow are configured.
- `/api/ingest/url` supports `{ url, name?, snapshotHtml? }` when database and active workflow are configured; it accepts supplied snapshot HTML or fetches `http`/`https` URLs.
- `txt` ingest creates source-range-backed sentence components and starts the document in the active workflow entry state.
- `md` ingest creates source-range-backed heading, sentence, and bullet components, including ordered-list items as bullet components.
- `html`/`htm` ingest creates source-range-backed paragraph sentence, HTML list item, and table body row components; headings become section anchors only.
- URL snapshot ingest creates source-range-backed paragraph sentence, HTML list item, and table body row components; parser metadata records source URL, snapshot source, and fetch status/content type/final URL when fetched.
- `/api/setup-readiness` uses persisted active workflow state.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Workflow activation is API-only; no UI surface exists yet.
- Ingest supports local `txt`, `md`, `html`, and `htm` files plus URL snapshots through the service API only.

### Not Working Yet

- `state-workflow-runtime` adapter.
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

- `npm run verify`: passed at 2026-06-12T08:50:49Z.
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
- `service/src/domain/parser.ts`: plain-text, Markdown, and HTML parsers plus source-range behavior.
- `service/src/http/server.ts`: workflow and ingest API implementation.
- `service/src/workflow/definition.ts`: workflow validation and action derivation.
- `tests/http-ingest.test.ts`: ingest HTTP coverage.
- `tests/http-workflow.test.ts`: workflow endpoint coverage.
- `tests/helpers/http.ts`: in-process Express request harness.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Implement autosave staged review changes as repository-backed service behavior.
- Add focused autosave tests that prove saved staging state does not mutate imported source snapshots or bypass workflow ownership.

Blocked:

- Provider-backed behavior remains blocked until real registry client integration and selected-profile handling are implemented.

Later:

- Implement review mutation endpoints.
- Wire provider-backed suggestions as proposal-only records.
- Implement same-format export.
- Run browser UI and Tauri desktop validation after user-facing flows are wired.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `docs/data-model.md`, `service/src/domain/parser.ts`, `service/src/http/server.ts`, `tests/http-ingest.test.ts`, and `tests/http-workflow.test.ts` first. Continue Build Slice 3 with autosave staged review changes, preserving backend-owned workflow state, stable component IDs, source mappings, and immutable imported source snapshots. Distinguish confirmed repo state from recommendations, and load broader context only from canonical docs when the immediate task requires it.
