# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T00:26:34Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `fd500fb`; branch is 11 commits ahead of `origin/main`
- Session scope: built provider-backed suggestion proposal slice.

### Checkpoint Status

- Git HEAD: `fd500fb`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/setup-readiness.md`
  - `handoff.md`
  - `service/src/http/server.ts`
  - `service/src/providers/readiness.ts`
  - `service/src/repositories/aiSuggestions.ts`
  - `service/src/repositories/index.ts`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
  - `tests/helpers/http.ts`
  - `tests/http-review.test.ts`
  - `tests/provider-readiness.test.ts`
  - `tests/repositories.test.ts`
- New files intentionally in scope:
  - `service/migrations/003_provider_task_assets.sql`
  - `service/src/providers/registry.ts`
  - `service/src/repositories/providerTasks.ts`
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - `service/migrations/003_provider_task_assets.sql`
  - `service/src/providers/registry.ts`
  - `service/src/repositories/providerTasks.ts`
- Untracked files intentionally out of scope:
  - `docs/Artefact-ReviewBuildOut.txt`
- Canonical files described:
  - `docs/completed-tasks.md`
  - `handoff.md`
- Last verification:
  - command: `npm run verify`
  - result: passed with 7 test files, 1 skipped Postgres suite, 31 tests passed, and 2 skipped; lint and Vite build also passed
  - timestamp UTC: 2026-06-13T00:22:20Z
- Browser validation:
  - Chrome opened `http://127.0.0.1:5182/` against the local dev stack.
  - Confirmed provider/task readiness blockers, disabled ingest blockers, and no Chrome console errors.
  - Limitation: `DATABASE_URL` was not configured, so migration-backed task assets, document creation, and populated suggestion UI were verified by automated tests rather than browser data flow.
- Local dev startup:
  - command: `npm run dev`
  - result: Vite reported `http://127.0.0.1:5182/`; service reported startup on `127.0.0.1:4793`; `DATABASE_URL` was unset so migrations were skipped
  - limitation: separate sandboxed curl checks to `127.0.0.1` and `localhost` could not connect even though the dev session still reported running
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: current `HEAD`, scoped dirty files, and verification evidence are accounted for; no commit, tag, release, install, or dependency change was made.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Current focus is Artifact Review provider-backed suggestion wiring while preserving proposal-only AI behavior.

Confirmed complete now:

- Numbered migration `003_provider_task_assets.sql` seeds app-owned provider task definitions, prompt versions, structured output schemas, render slots, and processing hooks.
- Provider readiness now checks selected profile precedence, registry profile/provider lookup, task assets, provider capability, local secret availability, adapter availability, no-fallback policy, and deterministic demo mode.
- Selected provider profile resolution uses saved `selectedProviderProfileKey` first, then first-run `INVOKE_PROVIDERS_PROFILE`; saved missing profiles block rather than falling back.
- `POST /api/components/:componentId/ai-suggestions` now creates a task run and proposed `ai_suggestions` record in explicit deterministic demo mode without mutating component text.
- Document detail now returns AI suggestions, and the React inspector can request and display proposed suggestions with confidence, rationale, warnings, and task-run ID.
- Typed React client calls for:
  - setup readiness and provider readiness
  - workflow status, workflow definition validation, and workflow activation
  - document list and document detail
  - file and URL ingest
  - component text autosave, annotations, questions, evidence, highlights, and document save
  - document workflow actions and component AI suggestions
- Workflow setup UI validates and imports/activates the repo-stored fixture.
- Ingest forms remain disabled until an active document workflow exists.
- File ingest now supports selecting local `txt`, `md`, `html`, and `htm` files in the browser and loading their content into the service-backed ingest flow.
- URL snapshot ingest remains wired for caller-supplied snapshot HTML or service-side URL fetch.
- Review workspace now renders repository-backed document rows, document detail, grouped review components, search, selected-component focus, expand/collapse controls, inline detail/highlight controls, open/closed detail drawer state, autosave/save feedback, review records, and backend-derived workflow actions.
- Provider suggestion button remains readiness-gated and creates proposals only when readiness passes.

Incomplete now:

- `state-workflow-runtime` is not installed or wired because dependency installation has not been explicitly approved.
- Real registry provider adapter execution is still blocked until provider runtime adapters are explicitly approved and installed.
- Suggestion accept/reject, same-format export, database-backed Chrome UI validation, and Tauri validation are still pending.

Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Continue after the provider-backed suggestion proposal slice.

Definition of done for the next workstream:

- Run database-backed Chrome/browser UI validation once a reachable dev server with `DATABASE_URL` is available.
- Run `npm run tauri:dev` after browser UI validation.
- Wire real registry provider adapter execution once the provider runtime dependency is explicitly approved and installed.
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
- React file ingest accepts local file selection for `txt`, `md`, `html`, and `htm`, then submits the loaded text to `/api/ingest/file`.
- `/api/components/:componentId` edits current component text and writes an audit revision.
- Annotation, question, evidence, and highlight endpoints write review records and autosave snapshots.
- `/api/documents/:documentId/save` creates a new review-state document version while preserving the imported source snapshot.
- React calls the current API surface through `src/lib/api.ts`.
- React workflow setup UI can validate and activate the bundled fixture.
- React ingest UI is blocked until `GET /api/workflow/status` reports an active workflow.
- React review UI supports component search, section grouping, expand/collapse, selected-component focus, inline highlight/detail controls, detail drawer open/close state, and visible unsaved draft state.
- Provider task assets are seeded by `003_provider_task_assets.sql`.
- `/api/provider-readiness` and `/api/provider-readiness/tasks/:taskKey` use registry/profile/provider/task readiness context.
- `/api/components/:componentId/ai-suggestions` stores proposed suggestions only in explicit deterministic demo mode.
- React component detail shows provider readiness and proposed AI suggestions.

### Partially Working

- Workflow operations are backend-owned but not yet backed by `state-workflow-runtime`.
- Provider readiness is visible and gates UI affordances; deterministic demo suggestions work, while real provider adapter execution remains blocked.
- Save stores JSON review-state snapshots; same-format export is intentionally deferred to Build Slice 6.

### Not Working Yet

- `state-workflow-runtime` adapter remains blocked until dependency installation is explicitly approved.
- Suggestion accept/reject.
- Same-format export.
- Real registry provider adapter execution.

### Not Yet Verified

- Browser UI validation with a configured database, active workflow, real ingested document, and populated suggestion history.
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
- `npm run verify`: passed with 7 test files, 1 skipped Postgres suite, 31 tests passed, and 2 skipped; Vite production build passed.
- `npm run dev`: reported Vite on `http://127.0.0.1:5182/` and service startup on `127.0.0.1:4793`; Chrome smoke validation passed with no console errors.

Environment notes:

- `DATABASE_URL` was unset for the default verification and dev-start path.
- Repo-local handoff helper scripts are absent; freshness is manually grounded from `git status`, `HEAD`, file inspection, and verification evidence.

## 7. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining work.
- `docs/api-contract.md`: current and reserved service endpoints.
- `src/lib/api.ts`: React API client types and calls.
- `src/App.tsx`: React workflow setup, file/URL ingest, review, grouped components, drawer state, mutation, save, and workflow-action UI.
- `src/styles.css`: current workspace layout.
- `service/src/http/server.ts`: workflow, ingest, review mutation, autosave, and save API implementation.
- `service/src/providers/readiness.ts`: selected-profile, registry, task asset, and adapter readiness checks.
- `service/src/providers/registry.ts`: narrow registry HTTP lookup for profiles and providers.
- `service/src/repositories/providerTasks.ts`: app-owned task/prompt/schema/hook asset reads.
- `service/migrations/003_provider_task_assets.sql`: seeded MVP provider task assets.
- `tests/http-review.test.ts`: review mutation, autosave, and save endpoint coverage.
- `tests/http-ingest.test.ts`: ingest HTTP coverage.
- `tests/http-workflow.test.ts`: workflow endpoint coverage.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Run Chrome/browser UI validation once a reachable dev server with a configured database is available.
- Run `npm run tauri:dev` after browser UI validation.
- Implement suggestion accept/reject as separate audited user actions.

Blocked or deferred:

- Real provider adapter execution remains blocked until provider runtime dependencies are explicitly approved and installed.
- Same-format export remains Build Slice 6.

- Implement same-format export.
- Run Tauri desktop validation for native shell behavior.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `AGENTS.md`, `docs/implementation-sequence.md`, `docs/api-contract.md`, `src/lib/api.ts`, `src/App.tsx`, `src/styles.css`, `service/src/http/server.ts`, `service/src/providers/readiness.ts`, `service/src/providers/registry.ts`, `service/src/repositories/providerTasks.ts`, and `service/migrations/003_provider_task_assets.sql` first. Continue after the provider-backed suggestion proposal slice. Preserve backend-owned workflow state, stable component IDs, source mappings, original text hashes, immutable imported source snapshots, and provider proposal-only boundaries. Do not install dependencies, commit, release, or wire provider/runtime packages unless explicitly approved.
