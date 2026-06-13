# Split Document Review From Admin And Settings

## Summary

Refactor the UI so `Document Review` is a focused review workspace. Move ingest, workflow setup, provider readiness/configuration, and app settings into a separate `Admin / Setup` top-level tab. The review page should use `docs/design/artefact_review_ui.html` as the visual target while keeping all existing live service wiring.

## Key Changes

- Create two top-level app areas in `src/App.tsx`:
  - `Document Review`: document list, workflow buckets, selected document toolbar, component search/stats, document canvas, inline review controls, save/export, workflow action buttons.
  - `Admin / Setup`: workflow validate/import/activate, setup readiness, provider readiness, provider settings, file/URL ingest.
- Keep `Document Review` free of setup/configuration panels:
  - no provider settings
  - no workflow setup card
  - no ingest forms
  - no readiness grids except compact blocking status when review cannot proceed
- Adapt the mockup layout for the review area:
  - top nav with `Document Review` and `Admin / Setup`
  - left sidebar with workflow buckets and searchable documents
  - main canvas with document toolbar, view toggle, stats strip, sectioned components, inline review expansion, and footer autosave/workflow status
- Preserve service-backed behavior:
  - ingest remains blocked until workflow is active, but that blocker is shown in `Admin / Setup`
  - document workflow actions still come from `getDocumentWorkflowActions`
  - AI suggestions remain proposals until explicit accept/reject
  - provider/task-run provenance remains visible in the inline suggestion panel
- Replace the current right-side detail drawer with inline component review:
  - `Text` tab for component editing/autosave
  - `Annotations`, `Questions`, `Evidence`, and `AI Suggestions` tabs
  - gutter buttons select a component and open the relevant inline tab
- Add `Normal` and `Focus` modes:
  - `Normal` shows review indicators, inline panels, and component actions
  - `Focus` hides review controls and shows a clean readable document

## Interface Changes

- No backend API changes.
- No dependency changes.
- Add local UI state for tab/page selection, review view mode, document filtering, bucket selection, and selected inline review tab.
- Keep the existing API client and service contracts unchanged.

## Test Plan

- Run `npm run verify`.
- In Chrome at `http://127.0.0.1:5184`, verify:
  - `Document Review` has no setup/settings/ingest panels
  - `Admin / Setup` contains workflow, provider, settings, and ingest controls
  - inactive workflow blocks ingest in `Admin / Setup`
  - selecting documents and components works
  - inline text edit, annotation, question, evidence, AI suggest, accept, and reject flows work
  - save/export remain available from the review toolbar
  - focus mode removes review chrome without breaking document reading
  - narrow viewports have no overlap or horizontal overflow

## Assumptions

- `Admin / Setup` is the chosen destination for all non-review operational controls.
- `Document Review` may show compact status only when it directly affects reviewing a selected document.
- Do not commit, tag, release, publish, install dependencies, or delete files.
- Update `handoff.md` after implementation with the new UI split and verification performed.
