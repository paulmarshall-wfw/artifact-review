# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T04:33:54Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `9edb45a`
- Session scope: provider registry integration compliance, local port reassignment, and continuity documents.

### Checkpoint Status

- Git HEAD: `9edb45a`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `.env.example`
  - `AGENTS.md`
  - `README.md`
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/implementation-sequence.md`
  - `docs/setup-readiness.md`
  - `docs/verification-plan.md`
  - `handoff.md`
  - `package.json`
  - `service/src/config/env.ts`
  - `service/src/http/server.ts`
  - `service/src/providers/runtime.ts`
  - `service/src/repositories/providerTasks.ts`
  - `src-tauri/src/lib.rs`
  - `src-tauri/tauri.conf.json`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
  - `tests/postgres.integration.test.ts`
  - `tests/provider-readiness.test.ts`
  - `vite.config.ts`
- Dirty files intentionally out of scope:
  - None
- Untracked files intentionally in scope:
  - `docs/artifact-review-provider-registry-integration-review-v2.md`
  - `service/migrations/004_block_future_provider_task_hooks.sql`
- Untracked files intentionally out of scope:
  - `docs/design/artefact_review_ui.html`
  - `docs/design/mockup-a-clean-panel.html`
  - `docs/design/mockup-b-inline-annotations.html`
  - `docs/design/mockup-c-split-editor.html`
- Canonical files described:
  - `AGENTS.md`
  - `README.md`
  - `docs/completed-tasks.md`
  - `docs/setup-readiness.md`
  - `docs/verification-plan.md`
  - `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`
- Last verification:
  - command: `npm run verify`
  - result: passed with 10 test files, 1 skipped Postgres suite, 43 tests passed, and 2 skipped; Vite production build passed
  - timestamp UTC: 2026-06-13T04:31:01Z
  - command: `python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"`
  - result: passed; existing unrelated conflicts in other projects remain reported
  - timestamp UTC: 2026-06-13T04:31:00Z
  - command: live port checks for `5184` and `4794`
  - result: passed; no listeners found on either new Artifact Review port
  - timestamp UTC: 2026-06-13T04:31:00Z
- Handoff freshness: `fresh-to-dirty-tree`
- Safe-to-continue basis: current HEAD, dirty files, untracked files, port reservations, and verification results are listed here; the remaining dirty tree is intentional.
- Handoff helper status: `scripts/handoff_status.py` and `scripts/verify_handoff_freshness.py` are not present in this repo, so freshness was checked manually.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Artifact Review now has the provider-registry integration hardening from `docs/artifact-review-provider-registry-integration-review-v2.md` and new reserved local ports.

Completed work history is tracked in `docs/completed-tasks.md`; do not duplicate it here.

Complete now:

- Provider-backed action flow goes through a service-owned provider runtime facade instead of endpoint-specific provider plumbing.
- Provider readiness is task-specific and includes invocation summaries such as selected provider/profile/adapter, prompt version, demo mode, and `externalSend`.
- AI suggestions remain proposal-only until explicit accept/reject user action.
- Future provider-backed task hooks are guarded by migration `004_block_future_provider_task_hooks.sql` and tests.
- Local Artifact Review ports are reassigned and reserved: UI `127.0.0.1:5184`, service `127.0.0.1:4794`, Postgres shared dependency `localhost:5432`.
- Root verification and the shared local port registry checker pass.

Incomplete or not yet verified:

- Live real-provider validation still needs a reachable provider registry profile, selected provider, adapter, and local secret reference.
- Chrome smoke was not rerun after the port reassignment.
- macOS Tauri smoke was not rerun after the port reassignment.
- Windows smoke validation remains pending and is required before any distribution work or discussion.

## 3. Current Objective

Immediate goal:

- Carry forward the current dirty tree safely for the next implementation or validation pass.

Intended finished state for the current workstream:

- Provider runtime integration stays behind the shared Artifact Review boundary, provider output stays proposal-only, and local dev ports remain conflict-free and documented.

Definition of done for the next pass:

- Confirm live registry-backed provider execution with a real local profile/secret path, then run browser and desktop smoke on `5184`/`4794` if user-facing validation is requested.

## 4. Current State

Working:

- `npm run verify` passes.
- Shared local port registry checker passes after reserving Artifact Review `5184` and `4794`.
- `.env.example`, Vite, service config, Tauri config, README, AGENTS runtime notes, setup docs, and verification docs all point to the new ports.
- Provider readiness endpoints expose task-specific invocation context.
- React displays provider readiness and `externalSend` at the AI Suggest invocation point.
- Task-run detail preserves provider/profile/validation/external-send provenance.
- Raw provider secrets remain outside Postgres.

Partially Working:

- Deterministic demo mode remains available on the same invocation path.
- Real provider execution can run only when registry/profile, adapter availability, and local secret readiness are satisfied.

Not Working Yet:

- No confirmed live provider registry/adapter/secret execution in this dirty-tree checkpoint.
- Windows smoke validation has not been run from this macOS workspace.

Not Yet Verified:

- Chrome smoke on `http://127.0.0.1:5184/`.
- `npm run tauri:dev` with desktop service health at `http://127.0.0.1:4794/health`.

## 5. Active Constraints

- Build Mode by default; do not release, publish, tag, package, install dependencies, delete files, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Backend-owned workflow state remains authoritative; React renders service-derived workflow actions.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Future provider-backed tasks should use `TargetAppRuntimeService` or `RegistryBackedInvokeProvidersClient` from `@invoke-providers/client` before exposing additional render slots.
- Do not store raw provider secrets in Postgres.
- Before any future local port change, update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`, keep `AGENTS.md` aligned, and rerun the registry checker.

## 6. Commands and Verification

Most recent verified commands:

- `npm run verify`: passed with lint, tests, and Vite production build.
- `python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"`: passed; reports existing unrelated conflicts in other projects.
- `git diff --check`: passed.
- Live port checks for `5184` and `4794`: no listeners found after the reassignment.

Useful next commands:

- `npm run verify`
- `npm run dev`
- `npm run doctor`
- `npm run tauri:dev`
- `python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"`

Unverified areas:

- Browser smoke on the new UI port.
- Desktop smoke on the new UI/service ports.
- Live real-provider invocation with local secret readiness.

## 7. Files to Open First

- `docs/artifact-review-provider-registry-integration-review-v2.md`: source review requirements for the provider integration work.
- `service/src/providers/runtime.ts`: service-owned provider runtime facade.
- `service/src/http/server.ts`: readiness, provider settings, and AI suggestion endpoint wiring.
- `service/migrations/004_block_future_provider_task_hooks.sql`: guardrails for future provider-backed task hooks.
- `src/App.tsx`: Settings, provider readiness display, AI Suggest, and task-run provenance UI.
- `src/lib/api.ts`: typed client surface for provider readiness and task-run details.
- `AGENTS.md`: current local ports and project constraints.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 8. Next Actions

Next:

- Validate live registry-backed provider execution with an active registry service, selected profile/provider, adapter, and local secret reference.
- Run Chrome smoke on `http://127.0.0.1:5184/` when browser validation is requested.
- Run macOS Tauri smoke and check `http://127.0.0.1:4794/health` when desktop validation is requested.

Blocked:

- Windows smoke validation cannot be completed from this macOS workspace.

Later:

- Commit the dirty tree only when the user explicitly asks for a checkpoint.

## 9. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Review `docs/artifact-review-provider-registry-integration-review-v2.md`, `service/src/providers/runtime.ts`, `service/src/http/server.ts`, `src/App.tsx`, `src/lib/api.ts`, and `AGENTS.md` first. Continue from the provider-registry integration compliance and local port reassignment state: UI is `127.0.0.1:5184`, service is `127.0.0.1:4794`, and completed work history lives in `docs/completed-tasks.md`. Distinguish confirmed state from new recommendations, and do not commit, release, package, publish, install dependencies, or change ports unless explicitly approved.
