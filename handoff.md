# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T06:07:27Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `27a5964`
- Session scope: Settings workspace reorganization, provider task route metadata, render-slot actions, diagnostics, and ingest gating.

### Checkpoint Status

- Git HEAD: `27a5964`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/setup-readiness.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `service/src/http/server.ts`
  - `service/src/providers/runtime.ts`
  - `service/src/repositories/providerTasks.ts`
  - `service/src/repositories/taskRuns.ts`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
  - `tests/http-provider-settings.test.ts`
  - `tests/postgres.integration.test.ts`
  - `tests/provider-readiness.test.ts`
  - `tests/repositories.test.ts`
- Untracked files intentionally in scope:
  - `service/migrations/005_task_route_settings.sql`
  - `service/src/settings/renderSlots.ts`
- Dirty files intentionally out of scope: none observed
- Untracked files intentionally out of scope: none observed
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Artifact Review now has a Settings workspace instead of the flat `Admin / Setup` screen. Settings uses a left section navigator and focused detail panel for Workflow, Provider Registry, AI Tasks, Landing Areas, Diagnostics, and Ingest.

Implemented:

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
- Added Settings UI sections for workflow setup, provider registry, editable AI task routes, landing areas, diagnostics, and ingest.
- Replaced hardcoded review-page AI Suggest button metadata with actions from `component.inline.aiSuggest`.
- Preserved proposal-only AI output: suggestions are not applied until explicit accept.
- Preserved hard ingest gate: ingest controls stay disabled until the backend reports an active workflow.

Not done:

- Database-backed Chrome smoke with active workflow, populated task routes, and sample ingested document was not run because this validation pass used no `DATABASE_URL`.
- Narrow viewport Chrome validation could not be performed through the current Chrome automation backend; desktop overflow was checked.
- macOS Tauri smoke was not rerun for this UI slice.
- Windows smoke remains pending before any distribution work.

## 3. Verification

Completed:

- `npm run lint`: passed.
- `npm test`: passed with 10 test files, 1 skipped Postgres suite, 48 tests passed, and 2 skipped.
- `npm run verify`: passed with lint, tests, and Vite production build.
- Chrome smoke on `http://127.0.0.1:5184/`: passed for:
  - app load with no console errors
  - Settings navigation and all six sections render
  - predefined landing areas render without a configured database
  - Ingest inputs and submit buttons remain disabled without active workflow
  - desktop viewport has no horizontal overflow

Chrome limitation:

- The Chrome backend could not resize the viewport; `window.resizeTo` was unavailable. Narrow/mobile validation remains unverified.

Runtime note:

- `npm run dev` was started for validation. The service reported migrations skipped because `DATABASE_URL` was not configured and started on `127.0.0.1:4794`; Vite started on `127.0.0.1:5184`.

## 4. Files To Open First

- `docs/plans/02 Reorganize Artifact Review Settings And Task Actions.md`
- `service/src/http/server.ts`
- `service/src/settings/renderSlots.ts`
- `service/src/repositories/providerTasks.ts`
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

- Run with a configured `DATABASE_URL`, activate the workflow, verify task routes load from Postgres, and check `component.inline.aiSuggest` actions with a sample ingested document.
- Manually resize Chrome or use a supported viewport tool to validate Settings and review layouts at narrow widths.
- Run macOS Tauri smoke through `npm run tauri:dev` if desktop UI validation is requested.

Blocked:

- Windows smoke validation cannot be completed from this macOS workspace.

## 7. Ready-Made Prompt For A New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Continue from the Settings workspace and provider task route metadata slice. The app now exposes service-backed Settings endpoints, predefined render slots, editable task routes, task-run diagnostics, and slot-driven component inline AI Suggest actions. Preserve the hard ingest gate until workflow activation, keep provider output proposal-only until accept/reject, and do not commit, release, package, publish, install dependencies, or change ports unless explicitly approved.
