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
- Local service liveness is verified on `127.0.0.1:4793`; readiness returns expected setup blockers without local env configuration.

## Build Slice 1: Persistence Foundation

Purpose: make the service safely own app data.

Completed:

- Add migration runner.
- Add database lifecycle helpers for startup and shutdown.
- Add repositories for documents, document versions, review components, app settings, task runs, and AI suggestions.
- Add deterministic migration-loader and repository tests that run in the default verification path.

Remaining:

- Run and validate migrations/repositories against an isolated configured Postgres database.
- Wire repositories into ingest and review mutation flows in later slices.
- Keep raw provider secrets out of Postgres.

## Build Slice 2: Workflow Operations

Purpose: make document lifecycle state backend-owned before ingest.

- Implement workflow definition import validation.
- Implement explicit activation for a user-provided document workflow.
- Add service endpoints for active workflow status and allowed document actions.
- Wire `state-workflow-runtime` through an app-owned storage adapter.
- Keep the repo-stored workflow fixture importable but not auto-activated.

## Build Slice 3: Ingest And Component Model

Purpose: create reviewable documents without provider dependency.

- Implement file ingest for `txt`.
- Add stable component IDs and source mappings.
- Add `md`, then `html` and `htm` ingest.
- Add URL snapshot ingest after local file formats are stable.
- Store document versions and review components.
- Autosave staged review changes.

## Build Slice 4: Review Mutation Surface

Purpose: support human review before AI assistance.

- Implement component edit endpoint.
- Implement annotations, questions, evidence, and highlights.
- Implement save as a durable document version.
- Return compact document rows separately from full document/component data.
- Preserve audit history for all text mutations.

## Build Slice 5: Provider-Backed Suggestions

Purpose: add AI assistance as proposal-only workflow.

- Wire registry-backed provider readiness.
- Load selected provider profile from app settings first, then first-run env fallback.
- Implement task definitions, prompt versions, structured output schemas, and hooks.
- Implement `suggest-component-revision`.
- Store provider output as proposed `ai_suggestions`.
- Implement accept/reject as separate audited user actions.

## Build Slice 6: Export

Purpose: produce reviewed artifacts after the review loop is durable.

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
