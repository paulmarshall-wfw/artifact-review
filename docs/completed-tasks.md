# Completed Tasks

Append brief entries here when project work is completed. Keep this file concise and append-only.

## 2026-06-14

- Task: Fix light and dark mode switching.
  Outcome: Replaced the static theme icon with a working light/dark toggle, applied the active theme to the document root, persisted explicit theme choices locally, added dark-mode design tokens, and moved hard-coded UI colors onto theme-aware variables for the app shell, panels, inputs, pills, review content, and ingest controls.
  Verification: `npm run lint` passed; `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 52 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5185/` confirmed the page switched from dark to light, updated `color-scheme`, changed the toggle label/pressed state, persisted after reload, and was restored to the starting dark mode afterward. The registered `5184` port was unavailable, so the UI smoke used a temporary Vite port without changing project config.
  Traceability: Git branch `main` at `d80ac8d`; no commit yet; changed React theme state and CSS theme tokens.

- Task: Promote Ingest to top-level navigation and refine ingest controls.
  Outcome: Added Ingest as the first primary tab before Document Review, moved file/URL ingest out of the Settings section, added a visible drop zone for documents and URL text drops, replaced the browser file input row with an icon-style Choose File control, removed the editable file-extension dropdown, derived format from the file name, and widened the file-name field.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 52 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5185/` confirmed the primary tab order, active Ingest page, visible drop zone, icon-style file picker, no ingest format dropdown, no horizontal overflow, and no Chrome console errors. The registered `5184` port was unavailable but not serving responses, so the UI smoke used a temporary Vite port without changing project config.
  Traceability: Git branch `main` at `d80ac8d`; no commit yet; changed React navigation/Ingest UI, styles, setup/API/verification docs, completed-task ledger, and handoff.

## 2026-06-13

- Task: Add Memo Capture-style provider registry and processing hook configuration.
  Outcome: Added a Settings Processing Hooks section for app-owned hook registration/deletion, returned hook summaries and provider catalog data from the Settings API, reshaped Provider Registry into a profile/catalog view, and changed AI task routes to choose from registered hooks instead of free-text keys. Task routes cannot be enabled through default no-op hooks until backend implementation exists.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 52 tests passed, and 2 skipped; Vite production build passed. Live checks showed `/ready` returning true, `/api/settings` returning provider catalog plus processing hooks, and `http://127.0.0.1:5184/` serving the app shell. Chrome automation was unavailable on `127.0.0.1:9222`, so no Chrome UI smoke was claimed.
  Traceability: Git branch `main` at `a898949`; no commit yet; changed provider registry lookup/settings API, processing hook repository/API/client/UI, task route validation/UI, tests, setup/API docs, completed-task ledger, and handoff.

- Task: Make database setup and workflow JSON import user-configurable.
  Outcome: Added local `.env` loading for service startup, a Settings Database panel that writes `DATABASE_URL` to `.env` and reports restart-required state, and a Workflow JSON picker that lets users choose a state-workflow definition file before validation and activation. The existing `.env` value is now active in the running service.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 50 tests passed, and 2 skipped; Vite production build passed. Local service checks showed `/ready` returning true and `/api/settings/database` reporting `DATABASE_URL` from `.env` with no restart required. Chrome automation was unavailable on `127.0.0.1:9222`, so no Chrome UI smoke was claimed.
  Traceability: Git branch `main` at `a898949`; no commit yet; changed local config loading, Settings API/client/UI, focused tests, setup/API/README docs, completed-task ledger, and handoff.

- Task: Reorganize Settings and provider task actions.
  Outcome: Replaced the flat Admin / Setup page with a Settings workspace with section navigation for Workflow, Provider Registry, AI Tasks, Landing Areas, Diagnostics, and Ingest. Added service-backed Settings APIs, predefined render slots, editable task-route metadata, task-run diagnostics listing, and slot-driven component inline AI Suggest actions while preserving proposal-only accept/reject behavior and keeping ingest blocked until an active workflow exists.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 48 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5184/` confirmed Settings sections render, predefined landing areas appear without a configured database, ingest controls stay disabled without an active workflow, desktop layout has no horizontal overflow, and Chrome reported no console errors. Narrow viewport resizing was unavailable through the current Chrome automation backend.
  Traceability: Git branch `main`; no commit yet; changed Settings API/service code, task-route migration/repositories, React API/UI, styles, focused tests, API/setup/data/verification docs, completed-task ledger, and handoff.

- Task: Split durable provider configuration into a separate Settings tab.
  Outcome: Added a Settings navigation item, moved provider registry/profile/demo-mode controls out of Providers, kept Providers focused on readiness diagnostics, and added a compact settings summary for current source/effective state.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 42 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5182/` confirmed the Settings nav item exists, Providers no longer contains the settings form, Settings contains the form, and Chrome reported no console errors.
  Traceability: Git branch `main` at `63446d3`; no commit yet; changed `README.md`, `src/App.tsx`, `src/styles.css`, setup docs, completed-task ledger, and handoff.

- Task: Include full provider registry and `invoke-providers-for-tasks` runtime support.
  Outcome: Installed the full local numbered `@invoke-providers/*@0.1.0` package family, switched registry lookup to `@invoke-providers/client`, added registered adapter detection, and routed `suggest-component-revision` through `invoke-providers-for-tasks` invocation, structured output validation, app-owned task-run persistence, and proposal-only AI suggestion storage. Explicit demo mode now uses the same invocation path through a local deterministic adapter; real registry providers can run when registry/profile, adapter, and local secret readiness pass.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 42 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5182/` passed for the Providers panel with expected setup blockers and no console errors. `npm run tauri:dev` compiled and launched the macOS app; service health passed outside the sandbox at `http://127.0.0.1:4793/health`.
  Traceability: Git branch `main` at `63446d3`; no commit yet; changed provider runtime dependencies, provider runtime service code, provider readiness/registry code, review endpoint path, tests, API/setup/data/sequence docs, completed-task ledger, and handoff.

- Task: Install and wire `state-workflow-runtime`, then make provider runtime settings configurable in-app.
  Outcome: Added `state-workflow-runtime@2.0.0` as a numbered local file dependency, replaced the document workflow path with a runtime-backed adapter over app settings, kept React rendering service-derived workflow actions, and added in-app provider settings for registry URL, selected profile key, and explicit demo mode without storing raw provider secrets. Provider runtime package approval is still limited to numbered local `invoke-providers-for-tasks` packages before real adapter execution.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 41 tests passed, and 2 skipped; Vite production build passed. Chrome smoke against `http://127.0.0.1:5182/` passed for the Providers panel with expected setup blockers and no console errors. `npm run tauri:dev` compiled and launched the macOS app; service health passed outside the sandbox at `http://127.0.0.1:4793/health`. Windows smoke validation remains pending from this macOS workspace.
  Traceability: Git branch `main` at `63446d3`; no commit yet; changed workflow runtime service code, provider settings service/UI code, tests, package files, API/setup docs, completed-task ledger, and handoff.

- Task: Start desktop and cross-platform validation slice.
  Outcome: Added `src-tauri/icons/icon.png` so Tauri development builds can reach the app command layer, ran the required Chrome smoke before desktop validation, and launched the macOS Tauri shell through `npm run tauri:dev`. Windows smoke validation remains pending because this workspace is macOS-only, and remains required before any distribution work or discussion.
  Verification: `cargo check --offline` passed; Chrome smoke against `http://127.0.0.1:5182/` passed with setup/provider/workflow blockers visible, ingest/export disabled, and no Chrome console errors; `npm run tauri:dev` compiled and launched the macOS `artifact-review` app; `curl -sS http://127.0.0.1:4793/health` passed outside the sandbox while the desktop run was active.
  Traceability: Git branch `main` at `a15e70f`; no commit yet; changed Tauri icon asset, verification plan, completed-task ledger, and handoff.

- Task: Build export slice.
  Outcome: Implemented `/api/documents/:documentId/export` for same-format reviewed output across `txt`, `md`, `html`, `htm`, and URL snapshots, including optional beside-file JSON review bundles. React now exposes explicit Export and JSON bundle controls, browser/dev mode downloads returned files, and Tauri is limited to destination selection plus reveal-in-folder while the service owns export assembly and file writes.
  Verification: `npm run verify` passed with 9 test files, 1 skipped Postgres suite, 38 tests passed, and 2 skipped; `cargo check --offline` generated `src-tauri/Cargo.lock` but stopped on the existing missing Tauri icon asset at `src-tauri/icons/icon.png`.
  Traceability: Git branch `main`; no commit yet; changed export service/domain code, React API/UI code, Tauri command code, export tests, Cargo lock, gitignore, API/data/setup/sequence docs, completed-task ledger, and handoff.

- Task: Build suggestion accept/reject slice.
  Outcome: Implemented `/api/ai-suggestions/:suggestionId/accept` and `/api/ai-suggestions/:suggestionId/reject`; accepting proposed suggestions now applies the proposed text through an audited `component_revisions` row with the AI suggestion ID, while rejecting suggestions preserves suggestion history without mutating component text. React suggestion cards now expose Accept and Reject actions for proposed suggestions and keep decided suggestions visible.
  Verification: `npm run lint` passed; `npm run verify` passed with 7 test files, 1 skipped Postgres suite, 33 tests passed, and 2 skipped; Vite production build passed.
  Traceability: Git branch `main` at `b0876e6`; no commit yet; changed suggestion repository/API code, React API/UI code, focused HTTP tests, API/data/setup/sequence docs, completed-task ledger, and handoff.

- Task: Refresh completed-task ledger and handoff after provider-suggestion slice.
  Outcome: Confirmed the provider-suggestion slice entry is present, refreshed `handoff.md` as the current dirty-tree checkpoint, and kept completed work history in `docs/completed-tasks.md` instead of duplicating it in the handoff.
  Verification: `git status --short --branch`, current `handoff.md`, and current `docs/completed-tasks.md` inspection completed; no build or test commands rerun because this was a documentation-only continuity refresh.
  Traceability: Git branch `main` at `fd500fb`; changed `docs/completed-tasks.md` and `handoff.md`.

- Task: Build provider-backed suggestions proposal slice.
  Outcome: Added numbered provider task asset migration `003_provider_task_assets.sql`, registry/profile/provider readiness lookup, selected-profile precedence, provider task asset repository reads, structured `suggest-component-revision` validation, deterministic demo-mode task-run creation, proposed-only `ai_suggestions` storage, and React inspector UI for creating and viewing proposed suggestions without mutating component text.
  Verification: `npm run verify` passed with 7 test files, 1 skipped Postgres suite, 31 tests passed, and 2 skipped; Vite production build passed. Chrome smoke validation opened `http://127.0.0.1:5182/`, confirmed provider/task blockers and ingest blocking render correctly without `DATABASE_URL`, and found no Chrome console errors.
  Traceability: Git branch `main` at `fd500fb`; no commit yet; changed provider readiness/runtime service code, provider task migration/repository code, React API/UI code, focused tests, API/data/setup/sequence docs, completed-task ledger, and handoff.

- Task: Build document ingest and review workspace UI slices.
  Outcome: Added browser file selection for `txt`, `md`, `html`, and `htm` ingest, preserved URL snapshot ingest, kept ingest blocked until the backend reports an active workflow, and expanded the review workspace with component search, section grouping, expand/collapse controls, selected-component focus, inline detail/highlight controls, an open/closed detail drawer, visible autosave draft state, and backend-rendered workflow actions.
  Verification: `npm run verify` passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; Vite production build passed.
  Traceability: Git branch `main` at `7e547b8`; no commit yet; changed `src/App.tsx`, `src/styles.css`, completed-task ledger, and handoff.

- Task: Implement provider registry integration review compliance.
  Outcome: Added a service-owned provider runtime facade for task-specific readiness, invocation summaries, render-slot action derivation, task-run detail, and proposal-only AI suggestion flow; blocked future provider-backed tasks behind the shared runtime/client boundary.
  Verification: `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 43 tests passed, and 2 skipped; Vite production build passed.
  Traceability: Git branch `main` at `9edb45a`; no commit yet; changed provider runtime service code, provider readiness endpoints, task-run persistence, React API/UI, focused tests, migration `004_block_future_provider_task_hooks.sql`, API/setup/sequence docs, completed-task ledger, and handoff.

- Task: Reserve unused local ports for Artifact Review.
  Outcome: Reassigned the Artifact Review UI to `127.0.0.1:5184` and local service to `127.0.0.1:4794`, updated project config/docs, and reserved both ports in the shared local port registry.
  Verification: Shared local port registry checker passed; `npm run verify` passed with 10 test files, 1 skipped Postgres suite, 43 tests passed, and 2 skipped; Vite production build passed; final live-port check found no listeners on `5184` or `4794`.
  Traceability: Git branch `main` at `9edb45a`; no commit yet; changed `.env.example`, `AGENTS.md`, `README.md`, `package.json`, `vite.config.ts`, service/Tauri port defaults, setup/verification docs, and `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`.

## 2026-06-12

- Task: Build React API wiring and workflow setup UI.
  Outcome: Replaced the static review mock with typed React client calls and a service-backed workspace for setup readiness, provider readiness, workflow status, fixture validation/import/activation, workflow action rendering/execution, document list/detail, file and URL ingest, component text autosave, annotations, questions, evidence, highlights, and document save. Ingest controls now stay disabled until an active document workflow exists.
  Verification: `npm run lint` passed; `npm run verify` passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; Vite production build passed. Local dev server reported startup on `http://127.0.0.1:5182/` with service on `127.0.0.1:4793`, but separate sandboxed curl checks could not connect to those loopback ports.
  Traceability: Git branch `main` at `541bf88`; no commit yet; changed `src/lib/api.ts`, `src/App.tsx`, `src/styles.css`, implementation ledger docs, and handoff.

- Task: Continue the next three app build slices with autosave, review mutations, and save promotion.
  Outcome: Added a review repository and service endpoints for component text edits, annotations, questions, evidence, highlights, mutation autosave snapshots, and document save-to-version promotion. Component edits now create audited `component_revisions`, review mutations create `autosave_snapshots` without touching imported source snapshots, document detail returns review records, and save creates a new review-state version while preserving the original source snapshot.
  Verification: `npm run verify` passed with 7 test files, 1 skipped Postgres suite, 28 tests passed, and 2 skipped; lint and Vite build also passed.
  Traceability: Git branch `main` at `3cdffed`; no commit yet; changed review repository/API code, review HTTP tests, API/data/implementation/verification docs, completed-task ledger, and handoff.

- Task: Continue Build Slice 3 with URL snapshot ingest.
  Outcome: Implemented `/api/ingest/url` as a repository-backed URL snapshot ingest path; it now requires database and active workflow readiness, accepts caller-supplied snapshot HTML or fetches `http`/`https` URLs, reuses the HTML parser, stores document/version/component records with `sourceType: "url"` and `originalFormat: "url_snapshot"`, and records URL/fetch parser metadata.
  Verification: `npm run verify` passed with 6 test files, 1 skipped Postgres suite, 25 tests passed, and 2 skipped; lint and Vite build also passed.
  Traceability: Git branch `main` at `935d185`; no commit yet; changed URL ingest service code, HTTP ingest tests, API/data/implementation/verification docs, completed-task ledger, and handoff.

- Task: Continue Build Slice 3 with HTML/HTM ingest.
  Outcome: Added HTML/HTM file ingest beside existing plain-text and Markdown ingest; HTML parsing now creates stable paragraph sentence, HTML list item, and table body row components with source ranges, decodes common entities, ignores script/style content, and uses headings as section anchors rather than inline review targets.
  Verification: `npm run verify` passed with 6 test files, 1 skipped Postgres suite, 22 tests passed, and 2 skipped; lint and Vite build also passed.
  Traceability: Git branch `main` at `935d185`; no commit yet; changed HTML parser/HTTP ingest code, parser and HTTP ingest tests, API/data/implementation/verification docs, completed-task ledger, and handoff.

- Task: Continue Build Slice 3 with Markdown ingest.
  Outcome: Added Markdown file ingest beside existing plain-text ingest; Markdown parsing now creates stable heading, prose sentence, and bullet components with source ranges and section anchors while preserving original format and parser metadata in repository-backed document/version records.
  Verification: `npm run verify` passed with 6 test files, 1 skipped Postgres suite, 19 tests passed, and 2 skipped.
  Traceability: Git branch `main` at `27ca35b`; no commit yet; changed parser/HTTP ingest code, parser and HTTP ingest tests, API/data/implementation/verification docs, completed-task ledger, and handoff.

- Task: Add workflow endpoint coverage and first `txt` ingest.
  Outcome: Added in-process HTTP endpoint tests for workflow validation, activation, status, allowed actions, invalid transitions, and file ingest; implemented `txt` ingest to create a document, version `1`, stable sentence components with source ranges, parser metadata, and the active workflow entry state.
  Verification: `npm run verify` passed with 6 test files, 1 skipped Postgres suite, 16 tests passed, and 2 skipped.
  Traceability: Git branch `main` at `46a1690`; no commit yet; changed service parser/HTTP code, HTTP tests, parser tests, and docs.

- Task: Refresh completed-task ledger and handoff after workflow operations.
  Outcome: Confirmed the build-work ledger entry was already present, appended this concise continuity refresh entry, and refreshed `handoff.md` as the current dirty-tree checkpoint without duplicating completed-task history.
  Verification: `git status --short --branch` and current `handoff.md`/`docs/completed-tasks.md` inspection completed; no build or test commands rerun because this was documentation-only continuity work.
  Traceability: Git branch `main` at `ed04eaf`; changed `docs/completed-tasks.md` and `handoff.md`.

- Task: Continue build with Postgres validation and workflow operations.
  Outcome: Added an opt-in isolated Postgres integration harness, validated migration idempotency and repository round trips against local Postgres, added workflow definition validation, active workflow storage, workflow status, allowed document actions, and guarded workflow transition endpoints.
  Verification: `ARTIFACT_REVIEW_TEST_DATABASE_URL=<isolated local Postgres URL> npm run test:postgres` passed with 2 tests; `npm run verify` passed with 4 test files, 1 skipped Postgres suite, 10 tests passed, and 2 skipped; service smoke against isolated Postgres confirmed `/ready`, workflow validation, workflow activation, setup readiness, and active workflow status.
  Traceability: Git branch `main` at `ed04eaf`; no commit yet; changed service workflow/persistence code, tests, package scripts, and docs.

- Task: Start Build Slice 1 persistence foundation.
  Outcome: Added service startup migration lifecycle, transactional migration runner with checksum tracking, app repositories for documents, document versions, review components, app settings, task runs, and AI suggestions, and repository-backed document/task-run reads where the current API contract already reserves them.
  Verification: `npm run verify` passed with 3 test files and 7 tests; sandboxed `npm run dev:service` hit the known `tsx` IPC `listen EPERM`, then approved local startup succeeded; `/health`, `/ready`, `/api/documents`, and `/api/setup-readiness` returned expected responses without `DATABASE_URL`.
  Traceability: Git branch `main`; no commit yet; changed service persistence code, tests, and docs.

- Task: Align MVP plan with provider registry integration review.
  Outcome: Updated the MVP plan to define Artifact Review as an `invoke-providers-for-tasks` target app with explicit provider runtime boundaries, named tasks, readiness checks, proposal-only AI suggestions, workflow boundaries, UI placement, and review-driven tests.
  Verification: Documentation consistency pass completed; no automated tests run because this was a documentation-only update.
  Traceability: Git branch `main`; no commit yet; changed `docs/Artifact Review MVP Plan.md`.

- Task: Bootstrap Artifact Review project.
  Outcome: Initialized the repo and added a Tauri 2 + React + local TypeScript service scaffold, Postgres migrations, readiness/provider/workflow API stubs, parser and provider-readiness tests, README, AGENTS.md, architecture notes, and CI verification workflow.
  Verification: `node` JSON config parse passed; `node --check scripts/doctor.mjs` passed; shared local port registry checker passed with only pre-existing unrelated warnings; `npm install` and `npm run verify` not run.
  Traceability: Git branch `main`; no commit yet; bootstrap scaffold is an untracked dirty tree in `/Users/paulmarshall/Software Development/artifact-review`.

- Task: Record workflow review and review workspace UI/UX direction.
  Outcome: Validated the repo-stored `artifact-review_workflow` definition as an explicit import/activation artifact and documented the editor-first review workspace layout in `docs/design/review-workspace-ui-ux.md`.
  Verification: `state-workflow-runtime` validator returned `valid: true`; read back `docs/design/review-workspace-ui-ux.md` after creation.
  Traceability: Git branch `main` at `95c911c`; changed `docs/design/review-workspace-ui-ux.md`; reviewed `docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`.

- Task: Complete pre-build readiness baseline.
  Outcome: Installed dependencies, generated `package-lock.json`, added Vite env typing, patched Vite and Vitest to non-vulnerable numbered versions, corrected the workflow fixture so internal `ingestion` documents stay out of the visible `Needs Review` bucket, and added API, data model, setup/readiness, verification, and implementation-sequence documents.
  Verification: `npm audit --json` reported zero vulnerabilities; `node` JSON parse of `docs/workflow/artifact-review-0.1.0-state-workflow-definition.json` passed; `npm run verify` passed with 2 test files and 3 tests; `npm run dev:service` started the service and `/health`, `/ready`, and `/api/setup-readiness` returned expected responses.
  Traceability: Git branch `main` at `3d47cd2`; no commit yet; changed `README.md`, `docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`, `package.json`, and added pre-build docs, `package-lock.json`, and `src/vite-env.d.ts`.

- Task: Refresh continuity documents after pre-build commit.
  Outcome: Updated `handoff.md` to describe committed baseline `5cc1f22` and recorded this completed-task ledger refresh without duplicating completed work history in the handoff.
  Verification: Git status was clean at `5cc1f22` before the continuity refresh; no build or test commands were rerun because only continuity documents changed.
  Traceability: Git branch `main` at `5cc1f22`; changed `handoff.md` and `docs/completed-tasks.md`.

- Task: Refresh persistence-slice ledger traceability.
  Outcome: Confirmed the Build Slice 1 persistence foundation entry is present and appended current committed traceability without rewriting older ledger entries.
  Verification: Read `docs/completed-tasks.md`; `git status --short` was clean before this ledger-only update; no build or test commands rerun.
  Traceability: Git branch `main` at `f8010ac`; changed `docs/completed-tasks.md`.
