# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T10:40:47Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `a898949`
- Session scope: Settings database configurability, local `.env` loading, user-selected workflow JSON import, Memo Capture-style provider registry and hook configuration, and launch verification.

### Checkpoint Status

- Git HEAD: `a898949`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/setup-readiness.md`
  - `README.md`
  - `handoff.md`
  - `service/src/config/env.ts`
  - `service/src/http/server.ts`
  - `service/src/providers/registry.ts`
  - `service/src/repositories/providerTasks.ts`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
  - `tests/helpers/http.ts`
  - `tests/http-provider-settings.test.ts`
  - `tests/provider-readiness.test.ts`
- Dirty files intentionally carried from earlier in-scope work:
  - `docs/data-model.md`
  - `docs/verification-plan.md`
  - `service/src/providers/runtime.ts`
  - `service/src/repositories/taskRuns.ts`
  - `tests/postgres.integration.test.ts`
  - `tests/repositories.test.ts`
- Untracked files intentionally in scope:
  - `service/src/config/localEnv.ts`
  - `service/migrations/005_task_route_settings.sql`
  - `service/src/settings/renderSlots.ts`
- Dirty files intentionally out of scope: none observed
- Untracked files intentionally out of scope: none observed
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Artifact Review now loads local `.env` configuration during service startup and exposes database setup in Settings. The existing `.env` `DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev` is active in the running service, `/ready` returns true, and Settings reports the database URL source as `.env`.

The Workflow Settings section now lets the user select a state-workflow JSON file with the native/webview file picker before validating or importing/activating it. The bundled fixture remains available as an explicit fallback selection.

The prior Settings workspace remains in place with section navigation for Database, Workflow, Provider Registry, Processing Hooks, AI Tasks, Landing Areas, Diagnostics, and Ingest.

Provider Registry now follows the Memo Capture pattern more closely: it is a profile selection and read-only catalog screen, showing registry URL, active/bootstrap profile, provider count, active profile details, and provider rows for the selected registry profile. Artifact Review still does not own provider records.

Hook configuration is now first-class in Settings. The new Processing Hooks section registers app-owned hook keys, shows implementation/default no-op status, task usage counts, and blocks deletion while tasks reference a hook. AI task routes now select from registered hooks rather than free-text hook keys.

Implemented:

- Added `.env` parsing and source metadata to service config loading.
- Added local `.env` writer support for `DATABASE_URL`.
- Added Settings APIs:
  - `GET /api/settings/database`
  - `PATCH /api/settings/database`
- Added `database` data to `GET /api/settings`.
- Added `providerCatalog` and `processingHooks` data to `GET /api/settings`.
- Added a Settings Database panel with editable `DATABASE_URL`, readiness, source, and restart-required status.
- Added Workflow JSON file selection before validation/import activation.
- Added Settings processing hook APIs:
  - `POST /api/settings/processing-hooks`
  - `DELETE /api/settings/processing-hooks/:hookKey`
- Added service-backed Settings APIs:
  - `GET /api/settings`
  - `PATCH /api/settings/provider-registry`
  - `POST /api/settings/providers/refresh`
  - `GET /api/settings/readiness`
  - `GET /api/settings/render-slots`
  - `GET /api/settings/render-slots/:slot/actions`
  - `GET /api/settings/task-runs`
  - `PATCH /api/settings/tasks/:taskKey/route`
- Added `POST /api/components/:componentId/task-actions/:taskKey` for slot-driven component inline task actions.
- Kept `POST /api/components/:componentId/ai-suggestions` as compatibility path.
- Added predefined render slots in `service/src/settings/renderSlots.ts`.
- Added migration `005_task_route_settings.sql` for editable task route metadata: display order, enabled flag, model override, display label, and description.
- Extended provider task repository and runtime mapping so `TargetAppRuntimeService` receives persisted route metadata.
- Added Settings UI sections for database setup, workflow setup, provider registry, processing hooks, editable AI task routes, landing areas, diagnostics, and ingest.
- Changed Provider Registry UI to profile/catalog layout with read-only provider rows from the shared registry.
- Changed AI task route hook editing from free text to registered hook selection.
- Added task route validation that blocks enabling routes through default no-op hooks.
- Replaced hardcoded review-page AI Suggest button metadata with actions from `component.inline.aiSuggest`.
- Preserved proposal-only AI output: suggestions are not applied until explicit accept.
- Preserved hard ingest gate: ingest controls stay disabled until the backend reports an active workflow.

Not done:

- Chrome UI smoke for this latest change was not run because Chrome CDP was unavailable on `127.0.0.1:9222`.
- Narrow viewport Chrome validation could not be performed through the current Chrome automation backend; desktop overflow was checked.
- Windows smoke remains pending before any distribution work.

## 3. Verification

Completed:

- `npm run lint`: passed.
- `npm run verify`: passed with lint, tests, and Vite production build. Test output: 10 test files passed, 1 Postgres integration suite skipped, 52 tests passed, and 2 skipped.
- Running service check: `GET /ready` returned `{"ready":true}`.
- Running Settings check: `GET /api/settings` reported `DATABASE_URL` from `.env`, provider catalog rows from `local-dev`, and processing hook summaries for `store-ai-suggestion`, `store-draft-review-note`, and `store-section-summary`.
- Local UI reachability check: `GET http://127.0.0.1:5184/` returned the Vite app shell.
- Chrome UI smoke for this latest change was not run because Chrome CDP was unavailable on `127.0.0.1:9222`.

Runtime note:

- `npm run tauri:dev` remains running from the launch request. After the config loader changed, the service restarted, loaded `.env`, completed migrations, and started on `127.0.0.1:4794`; Vite remains on `127.0.0.1:5184`.

## 4. Files To Open First

- `docs/plans/02 Reorganize Artifact Review Settings And Task Actions.md`
- `service/src/config/env.ts`
- `service/src/config/localEnv.ts`
- `service/src/http/server.ts`
- `service/src/settings/renderSlots.ts`
- `service/src/repositories/providerTasks.ts`
- `service/src/providers/registry.ts`
- `service/src/providers/runtime.ts`
- `src/App.tsx`
- `src/lib/api.ts`
- `src/styles.css`
- `tests/http-provider-settings.test.ts`
- `tests/repositories.test.ts`

## 5. Current Constraints

- Build Mode by default; do not release, publish, tag, package, install dependencies, delete files, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Backend-owned workflow state remains authoritative; React renders service-derived workflow actions and readiness.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Raw provider secrets must not be stored in Postgres.
- Before future local port changes, update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`, keep `AGENTS.md` aligned, and rerun the registry checker.

## 6. Next Actions

Recommended next validation:

- Use the Settings Database panel if the local Postgres URL changes; restart Artifact Review after changing `DATABASE_URL`.
- Use Workflow Settings to choose the desired state-workflow JSON file, then validate and import/activate it.
- Use Processing Hooks to register hook keys, then select registered hooks from AI Tasks. Default no-op hooks need backend implementation before their routes can be enabled.
- Manually resize Chrome or use a supported viewport tool to validate Settings and review layouts at narrow widths.
- Run macOS Tauri smoke through `npm run tauri:dev` if desktop UI validation is requested.

Blocked:

- Windows smoke validation cannot be completed from this macOS workspace.

## 7. Ready-Made Prompt For A New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Continue from the Settings database/workflow configurability slice. The service now loads local `.env`, Settings can save `DATABASE_URL` to `.env`, the running service currently reports database readiness true, and Workflow Settings lets the user choose a state-workflow JSON file before validation/import activation. Preserve the hard ingest gate until workflow activation, keep provider output proposal-only until accept/reject, and do not commit, release, package, publish, install dependencies, or change ports unless explicitly approved.
