# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Created timestamp UTC: 2026-06-12T03:28:41Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; repository initialized but no commits exist yet
- Session scope: MVP plan alignment, project bootstrap, completed-task ledger creation, and current-state handoff creation

### Checkpoint Status

- Git HEAD: unavailable; repository has no commits yet
- Working tree: dirty
- Dirty files intentionally in scope:
  - None; there are no tracked files yet
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - `.editorconfig`
  - `.env.example`
  - `.gitattributes`
  - `.github/workflows/verify.yml`
  - `.gitignore`
  - `AGENTS.md`
  - `README.md`
  - `docs/Artifact Review MVP Plan.md`
  - `docs/architecture/bootstrap-architecture.md`
  - `docs/artifact-review-provider-registry-integration-review.md`
  - `docs/completed-tasks.md`
  - `handoff.md`
  - `index.html`
  - `package.json`
  - `scripts/doctor.mjs`
  - `service/`
  - `src-tauri/`
  - `src/`
  - `tests/`
  - `tsconfig.json`
  - `vite.config.ts`
- Untracked files intentionally out of scope:
  - Ignored `.DS_Store` files under the repo are not part of the bootstrap
- Canonical files described:
  - `README.md`
  - `AGENTS.md`
  - `docs/Artifact Review MVP Plan.md`
  - `docs/artifact-review-provider-registry-integration-review.md`
  - `docs/architecture/bootstrap-architecture.md`
  - `docs/completed-tasks.md`
  - `handoff.md`
- Last verification:
  - command: `node` JSON parse of `package.json` and `src-tauri/tauri.conf.json`; `node --check scripts/doctor.mjs`; `python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"`
  - result: passed; registry checker reported only pre-existing unrelated conflicts and AGENTS gaps outside this repo
  - timestamp UTC: 2026-06-12T03:28:41Z
- Handoff freshness: fresh-to-dirty-tree
- Safe-to-continue basis: this handoff describes the current uncommitted bootstrap tree, and every listed canonical project file exists
- Next checkpoint action: install dependencies only if explicitly requested, run `npm run verify`, then commit the bootstrap if the result is acceptable

## 2. Executive Summary

Artifact Review is now bootstrapped as a Tauri 2 + React + local TypeScript service project from the documents in `docs/`.

Complete now: MVP plan alignment, repo initialization, project scaffold, provider/workflow/readiness boundaries, migrations, initial tests, README, AGENTS.md, architecture note, local port registry update, completed-task ledger, and this handoff.

Incomplete now: dependencies are not installed, no lockfile exists, `npm run verify` has not run, real provider registry client wiring is still a stub, workflow import/activation is not implemented, document ingest/export are not implemented, and there is no first commit.

The current state is safe to continue from as an uncommitted bootstrap checkpoint, not as a verified build.

Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

## 3. Current Objective

Immediate goal: turn the scaffold into a verified local development baseline.

Intended finished state: dependencies installed, lockfile generated, typecheck/tests/build passing, local service and UI launchable on registered ports, and the initial bootstrap committed when approved.

Definition of done for the next workstream: `npm run verify` passes or failures are fixed and documented; any remaining runtime blockers are explicit.

## 4. Current State

### Working

- Git repo exists on branch `main`.
- Root scripts are defined in `package.json`.
- Tauri/Vite UI port is fixed at `127.0.0.1:5182`.
- Local TypeScript service port is fixed at `127.0.0.1:4793`.
- Shared port registry has Artifact Review rows for UI, service, and Postgres.
- README and AGENTS.md document commands, ports, runtime notes, and constraints.
- Initial React workspace shell renders review/setup/readiness surfaces.
- Local service exposes planned health/readiness/provider/document API boundaries in code.
- Postgres migration files define the planned MVP schema.
- Initial Vitest tests exist for parser stability and provider profile/readiness behavior.

### Partially Working

- Provider runtime is scaffolded, but registry-backed invocation is intentionally not wired yet.
- Workflow readiness is scaffolded, but workflow import/activation is not implemented.
- Ingest endpoints exist, but currently return the planned workflow setup blocker.
- AI Suggest endpoint exists, but returns a readiness blocker or implementation stub.

### Not Working Yet

- Dependency install has not been run.
- No `package-lock.json` exists yet.
- No Tauri Cargo lockfile exists yet.
- No Postgres migration runner exists yet.
- No actual document persistence repositories exist yet.
- No accept/reject mutation flow is implemented yet.
- No export implementation exists yet.

### Not Yet Verified

- `npm install`
- `npm run lint`
- `npm test`
- `npm run build`
- `npm run verify`
- `npm run dev`
- `npm run tauri:dev`
- Browser or desktop visual verification

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

Likely next commands:

- `npm install`
- `npm run verify`
- `npm run dev`
- `npm run tauri:dev`
- `npm run doctor`

Prerequisites:

- Node/npm available locally.
- Rust/Tauri prerequisites available for `npm run tauri:dev`.
- Postgres configured through `DATABASE_URL` for database-backed checks.
- Provider registry URL/profile configured for provider-backed behavior.

Most recent verified command results:

- `node` JSON parse of `package.json` and `src-tauri/tauri.conf.json`: passed
- `npm pkg get name version scripts.verify`: passed
- `node --check scripts/doctor.mjs`: passed
- `python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"`: passed with pre-existing unrelated warnings only

Unverified areas:

- Dependency resolution and generated lockfiles
- TypeScript compile
- Vitest execution
- Vite build
- Tauri build/dev startup
- Runtime service startup
- UI rendering in browser or Tauri shell

Handoff helper status:

- `scripts/handoff_status.py` is not present in this newly bootstrapped repo.
- `scripts/verify_handoff_freshness.py` is not present in this newly bootstrapped repo.
- Freshness is recorded manually from `git status --short`, branch state, and file existence checks.

## 7. Files to Open First

- `AGENTS.md`: repo-local instructions, commands, runtime notes, and constraints.
- `README.md`: setup, ports, runtime boundaries, and verification commands.
- `docs/Artifact Review MVP Plan.md`: canonical MVP implementation plan.
- `docs/artifact-review-provider-registry-integration-review.md`: provider registry boundary review that the plan must comply with.
- `docs/architecture/bootstrap-architecture.md`: current architecture and first implementation slices.
- `package.json`: root scripts and numbered dependency versions.
- `service/src/http/server.ts`: current API/readiness scaffold.
- `service/src/providers/readiness.ts`: provider profile/readiness policy.
- `src/App.tsx`: current React workspace scaffold.
- `service/migrations/`: current database schema baseline.
- `docs/completed-tasks.md`: append-only completed work history.

## 8. Next Actions

Next:

- Install dependencies when explicitly approved or requested.
- Run `npm run verify`.
- Fix any verification failures from the scaffold.
- Launch the service/UI and inspect readiness behavior.
- Commit the initial bootstrap only if requested.

Blocked:

- Full verification is blocked until dependencies are installed.
- Database-backed behavior is blocked until `DATABASE_URL` points to an available Postgres database and migrations can run.
- Provider-backed behavior is blocked until real registry client integration and selected profile handling are implemented.

Later:

- Add migration runner and repositories.
- Implement workflow import/activation.
- Implement `txt`, then `md`, then `html`/URL ingest.
- Wire real registry-backed provider readiness and invocation.
- Implement suggestion accept/reject audit flow.
- Implement export.

## 9. Ready-Made Prompt for Starting a New Thread

Read `/Users/paulmarshall/Software Development/artifact-review/handoff.md` as the hot current-state source. Do not reload broad history unless needed. Open `AGENTS.md`, `README.md`, `docs/Artifact Review MVP Plan.md`, `docs/artifact-review-provider-registry-integration-review.md`, `docs/architecture/bootstrap-architecture.md`, `package.json`, `service/src/http/server.ts`, `service/src/providers/readiness.ts`, `src/App.tsx`, and `service/migrations/` first. Continue with the listed next actions in order, distinguish confirmed current state from new recommendations, and do not install dependencies, commit, release, publish, or change ports unless explicitly requested.
