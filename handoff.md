# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T00:49:14Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `a15e70f`
- Session scope: built Build Slice 6 export.

### Checkpoint Status

- Git HEAD: `a15e70f`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `.gitignore`
  - `docs/api-contract.md`
  - `docs/completed-tasks.md`
  - `docs/data-model.md`
  - `docs/implementation-sequence.md`
  - `docs/setup-readiness.md`
  - `handoff.md`
  - `service/src/http/server.ts`
  - `src-tauri/src/lib.rs`
  - `src/App.tsx`
  - `src/lib/api.ts`
  - `src/styles.css`
- New files intentionally in scope:
  - `service/src/domain/exporter.ts`
  - `src-tauri/Cargo.lock`
  - `src/lib/tauri.ts`
  - `tests/exporter.test.ts`
  - `tests/http-export.test.ts`
- Generated files intentionally ignored:
  - `src-tauri/gen/`
- Last verification:
  - `npm run verify`: passed
  - `npm run lint`: passed
  - `npm test`: passed with 9 test files, 1 skipped Postgres suite, 38 tests passed, and 2 skipped
  - `npm run build`: passed
  - `cargo check --offline`: blocked before checking app command code because `src-tauri/icons/icon.png` is missing
- Browser validation: not run for this slice.
- Tauri desktop validation: not run; native compile is blocked by the missing Tauri icon asset.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Build Slice 6 is implemented.

Completed now:

- `POST /api/documents/:documentId/export` builds same-format reviewed output for `txt`, `md`, `html`, `htm`, and URL snapshots.
- Export reconstruction applies each review component's current text to the imported source snapshot through stored source ranges.
- `txt` and `md` exports append review notes in matching text/Markdown form.
- `html`, `htm`, and URL snapshot exports embed review notes plus JSON metadata in the HTML.
- Optional JSON review bundles include document identity, source/latest version metadata, components, annotations, questions, evidence, highlights, and AI suggestions.
- When `destinationPath` is supplied, the TypeScript service writes the export and optional beside-file review bundle.
- When no destination is supplied, the endpoint returns downloadable content for browser/dev mode.
- React exposes explicit Export and JSON bundle controls in the review top bar.
- Tauri is limited to export destination selection and reveal-in-folder commands; it does not assemble export content or mutate documents.
- Added export round-trip and HTTP endpoint tests.
- Added `src-tauri/Cargo.lock` after native dependency resolution and ignored generated Tauri schema output under `src-tauri/gen/`.

Still incomplete or blocked:

- `state-workflow-runtime` is not installed or wired.
- Real registry provider adapter execution is still blocked until provider runtime dependencies are explicitly approved and installed.
- Database-backed Chrome UI validation with populated review/suggestion data is still pending.
- `npm run tauri:dev` and native desktop validation are blocked until the missing icon asset is added or the Tauri config is adjusted.

## 3. Current State

Working:

- `npm run verify` passes.
- Default tests skip the Postgres integration suite when `ARTIFACT_REVIEW_TEST_DATABASE_URL` is absent.
- File and URL ingest remain workflow-gated.
- Review mutations, autosave snapshots, save promotion, AI proposal creation, and AI accept/reject behavior remain covered.
- Export endpoint returns stable errors for missing database, missing documents, invalid payloads, and source reconstruction failures.
- Browser/dev exports download returned files; desktop exports ask Tauri for a destination and then ask the service to write files.

Not yet verified:

- Live export from a database-backed browser session.
- Tauri destination picker and reveal-in-folder in a running desktop shell.
- Full Tauri compile/run because `src-tauri/icons/icon.png` is missing.

## 4. Active Constraints

- Build Mode by default; do not release, publish, tag, package, install dependencies, or commit unless explicitly requested.
- Never use `latest`; use numbered versions.
- Use Chrome for browser automation unless explicitly asked otherwise.
- Backend-owned workflow state remains authoritative; React renders service-derived workflow actions.
- Provider output must create proposed suggestions only; accepting a suggestion is a separate audited user action.
- Tauri should stay limited to native capabilities such as destination selection and reveal-in-folder.
- Do not store raw provider secrets in Postgres.

## 5. Commands and Verification

Most recent verified commands:

- `npm run lint`: passed.
- `npm test`: passed with 9 test files, 1 skipped Postgres suite, 38 tests passed, and 2 skipped.
- `npm run build`: passed.
- `npm run verify`: passed with 9 test files, 1 skipped Postgres suite, 38 tests passed, and 2 skipped.
- `cargo check --offline`: failed before app command checking because Tauri codegen could not open `src-tauri/icons/icon.png`.

Environment notes:

- `DATABASE_URL` was unset for default verification.
- `cargo check --offline` generated `src-tauri/Cargo.lock` and generated Tauri schema output under `src-tauri/gen/`; `src-tauri/gen/` is now ignored.

## 6. Files to Open First

- `AGENTS.md`: project constraints and commands.
- `docs/implementation-sequence.md`: slice order and remaining work.
- `docs/api-contract.md`: current service endpoints and error behavior.
- `service/src/domain/exporter.ts`: same-format export reconstruction and bundle assembly.
- `service/src/http/server.ts`: export endpoint, ingest, review mutation, save, and workflow API implementation.
- `src/lib/api.ts`: typed React API client.
- `src/lib/tauri.ts`: frontend bridge for Tauri destination/reveal commands.
- `src/App.tsx`: review workspace and export UI.
- `src-tauri/src/lib.rs`: native service URL, destination picker, and reveal commands.
- `tests/exporter.test.ts`: format reconstruction tests.
- `tests/http-export.test.ts`: export endpoint tests.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 7. Next Actions

Next:

- Add or configure the missing Tauri icon asset so `cargo check --offline` and `npm run tauri:dev` can reach the app command layer.
- Run database-backed Chrome validation with an active workflow, ingested document, review records, and export.
- Run `npm run tauri:dev` and validate destination selection plus reveal-in-folder.

Blocked or deferred:

- Real provider adapter execution remains blocked until provider runtime dependencies are explicitly approved and installed.
- `state-workflow-runtime` remains deferred until dependency installation is explicitly approved.

## 8. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Continue after Build Slice 6 export. Preserve the service-owned export boundary: TypeScript service assembles and writes exports; Tauri only selects destinations and reveals exported files. Before Tauri validation, address the missing `src-tauri/icons/icon.png` asset or adjust the Tauri config. Do not install dependencies, commit, release, or wire provider/runtime packages unless explicitly approved.
