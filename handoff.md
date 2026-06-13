# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T01:41:00Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `63446d3`
- Session scope: full provider registry and `invoke-providers-for-tasks` runtime support.

### Checkpoint Status

- Git HEAD: `63446d3`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `README.md`
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/setup-readiness.md`
  - `handoff.md`
  - `package-lock.json`
  - `package.json`
  - `service/src/http/server.ts`
  - `service/src/providers/readiness.ts`
  - `service/src/providers/registry.ts`
  - `tests/provider-readiness.test.ts`
- New files intentionally in scope:
  - `service/src/providers/runtime.ts`
- Last verification:
  - `npm run verify`: passed
  - `npm run lint`: passed as part of verify
  - `npm test`: passed with 10 test files, 1 skipped Postgres suite, 42 tests passed, and 2 skipped
  - `npm run build`: passed as part of verify
  - Chrome smoke: passed against `http://127.0.0.1:5182/`; Providers panel rendered expected setup blockers and Chrome reported no console errors
  - `npm run tauri:dev`: compiled and launched the macOS `artifact-review` app
  - Desktop service health: passed outside the sandbox at `http://127.0.0.1:4793/health`
- Windows smoke validation: pending; not runnable from this macOS workspace.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Artifact Review now includes the full local numbered `invoke-providers-for-tasks` package family and routes provider-backed suggestions through the shared runtime path.

Completed now:

- Installed local file dependencies:
  - `@invoke-providers/core@0.1.0`
  - `@invoke-providers/client@0.1.0`
  - `@invoke-providers/adapters@0.1.0`
  - `@invoke-providers/react@0.1.0`
  - `@invoke-providers/registry@0.1.0`
- Switched registry lookup to the shared `RemoteRegistryClient` from `@invoke-providers/client`.
- Added registered adapter detection to provider readiness.
- Added `service/src/providers/runtime.ts` to own provider adapters, secret-resolution behavior, `invoke-providers-for-tasks` invocation, structured output validation, task-run mapping, and proposal-only suggestion output.
- Routed `POST /api/components/:componentId/ai-suggestions` through the provider runtime instead of hand-building the demo response in the HTTP route.
- Kept explicit demo mode on the same invocation path through an app-owned deterministic adapter.

Still incomplete or blocked:

- Live real-provider validation still needs a reachable provider registry profile, selected provider, and local secret reference.
- Windows smoke validation remains pending and is required before any distribution work or discussion.

## 3. Current State

Working:

- `npm run verify` passes.
- Provider settings remain configurable in the Providers panel.
- Provider readiness now distinguishes missing registry/profile/secret/capability from missing adapter registration.
- Demo AI suggestions still work, but now through `invoke-providers-for-tasks` runtime invocation.
- Real OpenAI-compatible registry providers can execute when their registry profile selects a supported adapter and required local secret is available.
- Raw provider secrets are not stored in Postgres.

Not yet verified:

- Live registry-backed provider execution against an actual provider registry service and real/local secret reference.
- Windows smoke validation.

## 4. Active Constraints

- Build Mode by default; do not release, publish, tag, package, install more dependencies, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Backend-owned workflow state remains authoritative; React renders service-derived workflow actions.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Tauri should stay limited to native capabilities such as destination selection and reveal-in-folder.
- Do not store raw provider secrets in Postgres.

## 5. Commands and Verification

Most recent verified commands:

- `npm run verify`: passed with 10 test files, 1 skipped Postgres suite, 42 tests passed, and 2 skipped; Vite production build passed.
- Focused tests: `npm test -- tests/provider-readiness.test.ts tests/http-review.test.ts` passed with 11 tests.
- Chrome smoke against `http://127.0.0.1:5182/`: passed; Providers panel rendered expected setup/provider blockers without `DATABASE_URL`, and Chrome console errors were empty.
- `npm run tauri:dev`: launched the macOS desktop shell.
- `curl -sS http://127.0.0.1:4793/health`: passed outside the sandbox while `npm run tauri:dev` was running.

Environment notes:

- `DATABASE_URL` was unset for browser and desktop validation, so the expected database/setup blockers rendered.
- The sandboxed loopback probe to `127.0.0.1:4793` failed while the desktop service was running, but the same health check passed outside the sandbox.

## 6. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `service/src/providers/runtime.ts`: provider runtime adapters and invocation path.
- `service/src/providers/readiness.ts`: readiness checks and registered adapter behavior.
- `service/src/providers/registry.ts`: shared registry client lookup.
- `service/src/http/server.ts`: AI suggestion endpoint using provider runtime invocation.
- `tests/provider-readiness.test.ts`: adapter readiness coverage.
- `tests/http-review.test.ts`: AI suggestion endpoint coverage.
- `docs/api-contract.md`: current service endpoints and provider invocation behavior.
- `docs/setup-readiness.md`: setup blockers and in-app provider settings behavior.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 7. Next Actions

Next:

- Run live registry-backed provider validation with an active registry service, profile, provider, and local secret reference.
- Run database-backed Chrome validation with active workflow, ingested document, provider settings, and AI suggestion creation.
- Run Windows smoke validation before any distribution work or discussion.

## 8. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Continue from the full provider registry/runtime support slice. Provider runtime dependencies are installed; next validation is live registry-backed provider execution with a configured profile and local secret reference, then database-backed Chrome validation and Windows smoke. Do not commit, release, package, publish, or discuss distribution unless explicitly approved.
