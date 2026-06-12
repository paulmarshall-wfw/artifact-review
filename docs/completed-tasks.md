# Completed Tasks

Append brief entries here when project work is completed. Keep this file concise and append-only.

## 2026-06-12

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
