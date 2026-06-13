# Implementation Sequence

This document stops at the point where app feature-building begins. It orders the remaining setup and first implementation slices so work can proceed without reopening stack, ownership, or readiness decisions.

## Pre-Build Baseline

Completed:

- Tauri 2, React, Vite, local TypeScript service, and Postgres stack selected.
- Root commands documented in `README.md` and `AGENTS.md`.
- Local UI and service ports registered and documented.
- Provider registry boundary documented.
- Workflow fixture documented as explicit import/activation artifact.
- Editor-first review workspace direction documented.
- Dependencies installed and lockfile generated.
- Vite and Vitest patched to numbered non-vulnerable versions.
- `npm run verify` passes.
- Local service liveness is verified on `127.0.0.1:4794`; readiness returns expected setup blockers without local env configuration.

## Build Slice 1: Persistence Foundation

Purpose: make the service safely own app data.

Completed:

- Add migration runner.
- Add database lifecycle helpers for startup and shutdown.
- Add repositories for documents, document versions, review components, app settings, task runs, and AI suggestions.
- Add deterministic migration-loader and repository tests that run in the default verification path.
- Add opt-in Postgres integration tests for migration idempotency and repository round trips.

Remaining:

- Wire repositories into ingest and review mutation flows in later slices.
- Keep raw provider secrets out of Postgres.

## Build Slice 2: Workflow Operations

Purpose: make document lifecycle state backend-owned before ingest.

Completed:

- Implement workflow definition validation.
- Implement explicit activation storage for a user-provided document workflow.
- Add React workflow setup UI for validating and importing/activating the repo-stored fixture.
- Add service endpoints for active workflow status and allowed document actions.
- Add service-side transition rejection for actions not allowed from the document's current state.
- Add HTTP-level tests for workflow validation, activation, allowed actions, and invalid transition rejection.

Remaining:

- Wire `state-workflow-runtime` through an app-owned storage adapter after the dependency is added.
- Keep the repo-stored workflow fixture importable but not auto-activated.

## Build Slice 3: Ingest And Component Model

Purpose: create reviewable documents without provider dependency.

Completed:

- Implement file ingest for `txt`.
- Add stable sentence component IDs and source mappings.
- Store document version `1`, review components, parser metadata, and initial workflow state from the active workflow entry state.
- Implement file ingest for `md`.
- Add stable Markdown heading, prose sentence, and bullet components with source mappings.
- Implement file ingest for `html` and `htm`.
- Add stable HTML paragraph sentence, list item, and table body row components with source mappings and heading section anchors.
- Implement URL snapshot ingest.
- Add repository-backed URL snapshot document/version/component creation using the HTML parser, including caller-supplied snapshot HTML and service-side URL fetch paths.
- Autosave staged review changes.
- Add review-mutation autosave snapshots that preserve component IDs, source mappings, original text hashes, and imported source snapshots.
- Wire React file and URL ingest forms to the service and block them until an active workflow exists.
- Add browser file selection for `txt`, `md`, `html`, and `htm` so selected files populate the service-backed ingest flow before document creation.

Remaining:

- Desktop validation.

## Build Slice 4: Review Mutation Surface

Purpose: support human review before AI assistance.

Completed:

- Implement component edit endpoint with `component_revisions` audit records.
- Implement annotations, questions, evidence, and highlights.
- Implement autosave snapshots for review mutations.
- Implement save as a durable document version that preserves the imported source snapshot and stores JSON review-state `current_snapshot` data.
- Return compact document rows separately from full document/component/review data.
- Preserve audit history for text mutations.
- Wire the React review workspace to document list/detail, component text edits, annotations, questions, evidence, highlights, autosave status, workflow actions, and save.
- Add review workspace search, component section grouping, expand/collapse controls, selected-component focus, inline detail/highlight controls, and open/closed detail drawer state.

Remaining:

- Keep same-format output reconstruction in Build Slice 6 export.

## Build Slice 5: Provider-Backed Suggestions

Purpose: add AI assistance as proposal-only workflow.

Completed:

- Wire registry-backed provider readiness around `GET /profiles/:profileKey` and `GET /profiles/:profileKey/providers`.
- Load selected provider profile from app settings first, then first-run env fallback.
- Seed app-owned task definitions, prompt versions, structured output schemas, render slots, and hooks through numbered migration `003_provider_task_assets.sql`.
- Implement `suggest-component-revision` in explicit deterministic demo mode.
- Store provider output as proposed `ai_suggestions` and task-run provenance without mutating component text.
- Implement accept/reject as separate audited user actions.
- Wire React suggestion cards to accept/reject proposed suggestions while preserving accepted/rejected history.
- Install the full local numbered `@invoke-providers/*@0.1.0` package family.
- Route registry lookup through `@invoke-providers/client`.
- Route `suggest-component-revision` through `invoke-providers-for-tasks` core invocation, registered adapters, structured output validation, and app-owned hook/task-run persistence.
- Keep deterministic demo mode on the same invocation path with a local deterministic adapter.
- Add a service-owned provider runtime facade so readiness, invocation summaries, render-slot action derivation, invocation, task-run persistence, and task-run detail flow through one Artifact Review boundary.

Remaining:

- Validate a live registry/provider profile with a local secret reference against real provider adapter execution.
- Keep future provider-backed tasks behind `TargetAppRuntimeService` or `RegistryBackedInvokeProvidersClient` from `@invoke-providers/client` before exposing additional render slots. Low-level `@invoke-providers/core.invokeTask` is acceptable only inside the shared client/runtime helper path, not as endpoint-specific plumbing. React must render task-specific readiness and `externalSend` at the invocation point, and provider output must remain proposed until an explicit accept/reject user action.

## Build Slice 6: Export

Purpose: produce reviewed artifacts after the review loop is durable.

Completed:

- Implement same-format export for `txt`, `md`, `html`, and URL snapshots.
- Add optional JSON review bundle beside exports.
- Use Tauri only for destination selection and reveal-in-folder.
- Add export round-trip tests.

## Build Slice 7: Desktop And Cross-Platform Validation

Purpose: verify the complete MVP in the intended shell.

- Run local browser smoke checks in Chrome.
- Run `npm run tauri:dev` on macOS.
- Add Windows smoke validation before any distribution work.
- Keep packaging, release tags, published images, and distribution out of scope until explicitly requested.
