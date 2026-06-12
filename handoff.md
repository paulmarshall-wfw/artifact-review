# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-12T06:40:00Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `de22bd7`
- Session scope: Build Slice 1 persistence foundation started

### Checkpoint Status

- Git HEAD: `de22bd7`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `service/src/http/server.ts`
  - `service/src/index.ts`
- Untracked files intentionally in scope:
  - `service/src/db/lifecycle.ts`
  - `service/src/db/migrations.ts`
  - `service/src/repositories/`
  - `tests/repositories.test.ts`
- Dirty or untracked files intentionally out of scope:
  - None
- Last verification:
  - command: `npm run verify`
  - result: passed with 3 test files and 7 tests
  - timestamp UTC: 2026-06-12T06:38:04Z
- Last service smoke:
  - sandboxed `npm run dev:service` failed with the known `tsx` IPC `listen EPERM`
  - approved local `npm run dev:service` started on `127.0.0.1:4793`
  - `GET /health` returned `status: ok`
  - `GET /ready` returned expected `DATABASE_URL is not configured.`
  - `GET /api/documents` returned `{"documents":[]}`
  - `GET /api/setup-readiness` returned expected database, provider, demo-mode, and workflow blockers
- Handoff freshness: fresh-to-dirty-tree

## 2. Executive Summary

Artifact Review has moved from the pre-build baseline into Build Slice 1.

Completed in this slice:

- Added service database lifecycle helpers.
- Added a transactional migration runner that loads numbered SQL files, tracks checksums in `schema_migrations`, skips already-applied migrations, and fails on checksum drift.
- Runs migrations during service startup when `DATABASE_URL` is configured; startup still works without `DATABASE_URL` and reports readiness blockers.
- Added repositories for documents, document versions, review components, app settings, task runs, and AI suggestions.
- Wired repository-backed reads into existing document and task-run API endpoints when a database is configured.
- Provider readiness now considers a saved `selectedProviderProfileKey` from `app_settings` before the first-run environment fallback when repositories are available.
- Added deterministic tests for migration file loading and repository mapping/query behavior.
- Updated implementation and verification docs plus the completed-task ledger.

Still incomplete:

- No configured Postgres migration run was performed in this session.
- No ingest, workflow activation, review mutation, AI invocation, suggestion accept/reject mutation, autosave, or export implementation exists yet.
- No Tauri desktop validation was run.

## 3. Current Objective

Continue Build Slice 1 only if a configured isolated Postgres database is available, then move to Build Slice 2.

Definition of done for the remaining persistence foundation:

- migrations apply cleanly and idempotently against an isolated Postgres database
- repository operations are verified against that database
- any required test database setup is documented
- `npm run verify` still passes

## 4. Current State

### Working

- Root scripts are still defined in `package.json`.
- `npm run verify` passes.
- Service startup skips migrations cleanly when `DATABASE_URL` is absent.
- Service startup runs the migration lifecycle before binding when `DATABASE_URL` is present.
- Migration files are loaded deterministically and checksumed.
- Repository classes compile and are covered by deterministic tests.
- `/api/documents` remains safe without a database and returns an empty list.
- `/api/documents/:documentId` and `/api/task-runs/:taskRunId` can read from repositories when a database exists.
- Provider readiness can use persisted selected profile settings when app settings are available.

### Partially Working

- The migration runner is implemented but not yet validated against a real configured Postgres database in this session.
- Repositories are implemented and unit-tested for mapping/query behavior, but not integration-tested against Postgres.
- API endpoints use repositories for reads only; mutation flows are still reserved for later slices.

### Not Working Yet

- No workflow import/activation.
- No document ingest.
- No component edit, annotation, question, evidence, or highlight mutations.
- No provider-backed task invocation.
- No suggestion accept/reject mutations.
- No export.

## 5. Active Constraints

- Apply `engineering-project-standard` for repo setup, maintenance, versioning, and stack-selection work.
- Apply `web-app-design-standard` for frontend UI design, scaffolding, review, or refinement work.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Build Mode by default; do not release, publish, tag, or package unless explicitly requested.
- Never use `latest`; use numbered versions.
- Artifact Review is an `invoke-providers-for-tasks` target app, not a provider registry owner.
- Shared registry owns provider catalog/profile/config records; Artifact Review owns selected profile settings, tasks, prompts, schemas, hooks, task runs, suggestions, documents, workflow transitions, and domain mutations.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Backend-owned workflow state is authoritative; React renders allowed actions from the service.
- Do not store raw provider secrets in Postgres.
- Before changing local ports, update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`.

## 6. Commands and Verification

Verified this session:

- `npm run verify`: passed with 3 test files and 7 tests.
- `npm run dev:service`: sandboxed attempt failed with `listen EPERM` on the `tsx` local IPC pipe; approved local start succeeded.
- `curl -sS http://127.0.0.1:4793/health`: returned service liveness.
- `curl -sS http://127.0.0.1:4793/ready`: returned expected missing `DATABASE_URL` blocker.
- `curl -sS http://127.0.0.1:4793/api/documents`: returned empty list without database configuration.
- `curl -sS http://127.0.0.1:4793/api/setup-readiness`: returned expected setup blockers.

Not verified this session:

- migration application against a real Postgres database
- repository integration tests against Postgres
- `npm run dev`
- `npm run tauri:dev`
- browser UI or desktop visual verification

## 7. Files to Open First

- `AGENTS.md`
- `README.md`
- `docs/implementation-sequence.md`
- `docs/data-model.md`
- `docs/api-contract.md`
- `docs/verification-plan.md`
- `service/src/db/migrations.ts`
- `service/src/db/lifecycle.ts`
- `service/src/repositories/`
- `service/src/http/server.ts`
- `service/src/index.ts`
- `tests/repositories.test.ts`
- `docs/completed-tasks.md`

## 8. Next Actions

Next:

- Configure an isolated Postgres database for Artifact Review tests.
- Run service startup with `DATABASE_URL` and verify migrations create `schema_migrations` plus MVP tables.
- Add database-backed repository integration tests or a documented deterministic Postgres test harness.
- Continue to Build Slice 2: workflow definition import validation, activation, active workflow status, and allowed document actions.

Blocked:

- Database-backed validation is blocked until `DATABASE_URL` or a dedicated test database URL points to available Postgres.
- Provider-backed behavior is blocked until real registry client integration and selected profile handling are implemented.

Later:

- Implement ingest and stable component persistence.
- Implement review mutations and autosave.
- Wire provider-backed suggestions as proposal-only records.
- Implement same-format export.
