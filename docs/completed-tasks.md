# Completed Tasks

Append brief entries here when project work is completed. Keep this file concise and append-only.

## 2026-06-13

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
