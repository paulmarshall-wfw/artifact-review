# Handoff

## 1. Metadata

- Project name: Artifact Review
- Handoff type: implementation handoff
- Updated timestamp UTC: 2026-06-13T01:56:00Z
- Prepared by: Codex
- Repository, workspace, or folder: `/Users/paulmarshall/Software Development/artifact-review`
- Branch or working context: Git branch `main`; current HEAD `63446d3`
- Session scope: separate Settings tab for durable provider configuration.

### Checkpoint Status

- Git HEAD: `63446d3`
- Working tree: dirty
- Dirty files intentionally in scope:
  - `README.md`
  - `docs/completed-tasks.md`
  - `docs/setup-readiness.md`
  - `handoff.md`
  - `src/App.tsx`
  - `src/styles.css`
- Last verification:
  - `npm run verify`: passed
  - `npm run lint`: passed as part of verify
  - `npm test`: passed with 10 test files, 1 skipped Postgres suite, 42 tests passed, and 2 skipped
  - `npm run build`: passed as part of verify
  - Chrome smoke: passed against `http://127.0.0.1:5182/`; nav included Settings, Providers no longer contained the settings form, Settings contained the form, and Chrome reported no console errors
- Windows smoke validation: pending; not runnable from this macOS workspace.
- Next checkpoint action: leave dirty intentionally unless the user asks to commit.

## 2. Executive Summary

Artifact Review now has a separate Settings navigation item for durable app configuration.

Completed now:

- Added `Settings` to the primary sidebar navigation.
- Moved provider registry URL, selected profile, and demo-mode controls out of Providers.
- Kept Providers focused on readiness diagnostics.
- Added a compact Settings summary for registry source, profile source, and demo-mode state.
- Updated setup docs and README wording to point users to Settings for provider runtime configuration.

Still incomplete or blocked:

- Live real-provider validation still needs a reachable provider registry profile, selected provider, and local secret reference.
- Windows smoke validation remains pending and is required before any distribution work or discussion.

## 3. Current State

Working:

- `npm run verify` passes.
- Settings is present as a separate nav target.
- Provider settings remain backed by existing `GET /api/provider-settings` and `PUT /api/provider-settings`.
- Provider readiness remains visible in Providers.
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
- Chrome smoke against `http://127.0.0.1:5182/`: passed; Settings nav and settings form placement were verified, and Chrome console errors were empty.

Environment notes:

- `DATABASE_URL` was unset for browser validation, so expected database/setup blockers rendered.

## 6. Files to Open First

- `src/App.tsx`: Settings nav item and Settings section.
- `src/styles.css`: Settings summary and responsive nav layout.
- `docs/setup-readiness.md`: in-app Settings documentation.
- `docs/completed-tasks.md`: append-only completed work ledger.

## 7. Next Actions

Next:

- Run live registry-backed provider validation with an active registry service, profile, provider, and local secret reference.
- Run database-backed Chrome validation with active workflow, ingested document, provider settings, and AI suggestion creation.
- Run Windows smoke validation before any distribution work or discussion.

## 8. Ready-Made Prompt for Starting a New Thread

Read `handoff.md` as the hot-context source for `/Users/paulmarshall/Software Development/artifact-review`. Treat the current dirty tree as intentional and do not reset or discard changes. Continue from the Settings-tab split for durable provider configuration. Settings now owns provider registry/profile/demo-mode controls; Providers is readiness-only. Do not commit, release, package, publish, or discuss distribution unless explicitly approved.
