# Artifact Review MVP Plan

## Summary

Build `artifact-review` as a cross-platform desktop app for macOS and Windows using **Tauri 2 + React + a local TypeScript service**. The app is an operational review/editor workspace: durable left navigation, searchable review sections, section-level decision controls, inline component controls, drawers, autosave, provider-backed suggestions, and export.

The app reviews documents using the UI model from [flow-design-prd-review.html](/Users/paulmarshall/Software%20Development/flow-design/docs/review/flow-design-prd-review.html) and the screenshot, but persistence, workflow, provider invocation, and export are owned by the local app runtime rather than browser-only state.

By **reviewable components**, the MVP means stable, addressable document units extracted from the source document so each can be reviewed, annotated, edited, audited, and targeted by provider-backed tasks:

- paragraph sentences
- Markdown/list bullets
- HTML list items
- table body rows
- headings as navigation/section anchors, not inline review targets

Chosen decisions from your answers:

- MVP formats: `txt`, `md`, `html`, `htm`, and dropped webpage links.
- Desktop stack: Tauri + React.
- AI behavior: provider-backed tasks create proposed suggestions that can be accepted/rejected; users may copy all or part into a manual edit.
- Postgres: configured external/dev Postgres connection string, not bundled Postgres.

## Key Changes

- Scaffold a single repo with a Tauri desktop shell, React review workspace, and Node/TypeScript sidecar service. Pin numbered dependency versions; do not use `latest`.
- Use Postgres as the app database via configured `DATABASE_URL`; show database readiness before ingest/review actions.
- Add a document ingestion pipeline:
  - Open file from OS picker.
  - Drop file into the shared drop zone.
  - Drop/paste URL into the same drop zone and fetch a reviewable HTML snapshot.
  - Parse source into a canonical document model plus source mappings.
- Add review workspace controls:
  - `Search`: filters sections/components by visible text.
  - `Focus`: hides inline controls while preserving review state.
  - `Expand/Collapse`: expands or collapses all review sections.
  - `Export`: asks for a destination and writes the reviewed document in the original MVP format.
  - `Save`: promotes current staging state to a durable document version.
  - Section `Decision`: `Unreviewed`, `Accepted`, `Needs changes`, `Rejected`.
  - Section `Priority`: `Low`, `Normal`, `High`, `Critical`.
  - Section `Readiness`: `Draft`, `Ready`, `Blocked`, `Needs evidence`.
  - Inline `Highlight`: toggles visual emphasis for one component.
  - Inline `Annotate`: captures reviewer notes.
  - Inline `Question`: captures unresolved questions.
  - Inline `Evidence`: captures source, link, repo path, screenshot path, or note.
  - Inline `Drawer`: shows all review data for that component.
  - Inline `AI Suggest`: invokes the `suggest-component-revision` provider-backed task for that component and stores a proposed suggestion.
  - Inline `Edit`: edits the component text while retaining original text and revision history.
  - Suggestion `Accept/Reject`: accepted suggestions create audited component revisions; rejected suggestions remain in history.
- Export behavior:
  - `txt`: current reviewed text plus an appended review-notes section.
  - `md`: current Markdown plus annotation blocks/comments and a review-notes appendix.
  - `html`/URL: current HTML with embedded review annotations and review metadata.
  - Export also writes a JSON review bundle beside the selected export when the user enables that option.

## Runtime Boundary

Artifact Review is a target app for `invoke-providers-for-tasks`, not a provider registry owner.

- Tauri owns native file dialogs, export destination selection, reveal-in-folder, local permissions, app lifecycle, and platform integration.
- The local TypeScript service owns Postgres access, provider-runtime composition, task invocation, workflow calls, export, readiness APIs, and all domain mutations.
- React renders the review workspace and calls service APIs. React must not directly own provider invocation, registry persistence, durable workflow state, or domain mutations.
- `state-workflow-runtime` owns the document lifecycle transition model through an app-owned Postgres storage adapter.
- `invoke-providers-for-tasks` owns provider-backed task invocation contracts, readiness checks, structured output validation, hook contracts, and task-run provenance.

## Data Model

The app owns domain persistence in Postgres. Core tables:

- `projects`: project name and metadata.
- `documents`: document name, source type, original format, ingest time, last modified time, current workflow item ref.
- `document_versions`: immutable source/current snapshots and parser metadata.
- `review_components`: stable component IDs, kind, section ID, source range, current text, original text hash.
- `component_revisions`: original/current text changes, edit source, AI suggestion source, timestamps.
- `annotations`, `questions`, `evidence_sources`, `highlights`: component-linked review records.
- `autosave_snapshots`: debounced staging snapshots after every edit, annotation, question, evidence, or suggestion action.
- `ai_suggestions`: proposed text, rationale, confidence, warning metadata, provider/task-run ref, source component ID, and status `proposed|accepted|rejected`.
- `task_definitions`, `prompt_versions`, `structured_output_schemas`, `processing_hooks`, `render_slot_mappings`, `task_runs`, `provider_readiness_observations`, `app_settings`: app-owned invoke-provider records and diagnostics.

The app must not copy shared provider configs into Artifact Review Postgres as authoritative provider records. The shared registry remains the provider catalog source of truth.

## Provider Runtime

Integrate `invoke-providers-for-tasks` version `0.1.0` using these package boundaries:

- `@invoke-providers/registry`: shared provider catalog/profile/config service only.
- `@invoke-providers/client`: registry lookup, registry-backed invocation, and `TargetAppRuntimeService` over Artifact Review's own Postgres repositories.
- `@invoke-providers/core`: task definitions, readiness, structured output validation, hook contracts, task-run provenance, and in-process invocation behavior.
- `@invoke-providers/adapters`: deterministic test adapters, OpenAI-compatible providers, Codex CLI, Whisper.cpp, Apple Vision OCR, and other reusable provider protocol adapters where relevant.
- `@invoke-providers/react`: style-light provider/task/readiness controls that Artifact Review wraps inside its own React layout.

Artifact Review uses the shared provider registry only for provider profiles, provider configs, capabilities, enabled state, health metadata, and secret references. Artifact Review owns selected profile settings, task definitions, prompt versions, structured output schemas, render slots, hook implementations, task runs, document records, workflow transitions, and all domain mutations in its own Postgres database.

Provider-backed actions must resolve readiness before rendering and invocation, must surface `externalSend`, must validate structured output, and must store AI output as proposed suggestions until the user accepts or rejects them.

## Registry Boundary

- Read provider profile and provider config records through `RemoteRegistryClient` or `RegistryBackedInvokeProvidersClient`.
- Store only secret references in app-owned records or registry records; resolve raw values from the local secret mechanism at invocation time.
- Do not store raw provider secrets in Postgres or registry records.
- Do not silently fall back to another registry profile, provider, or local provider when the registry or saved profile is missing.
- Allow deterministic test/demo adapters only when an explicit test/demo mode is enabled by the user or test harness.

Profile selection order:

1. Saved `selectedProviderProfileKey` from Artifact Review settings.
2. `INVOKE_PROVIDERS_PROFILE` as first-run bootstrap only.
3. Not configured.

If a saved profile is missing from the registry, keep the saved key, block provider-backed actions, and show a setup error.

## Task And Prompt Design

Prompts are app-owned task configuration, not inline strings in UI handlers or Tauri commands.

MVP task records:

- `suggest-component-revision`: proposes edited text for one review component.
- `summarize-section-findings`: summarizes open issues for a section.
- `draft-review-note`: proposes an annotation or question, but does not apply it automatically.

Each task includes:

- stable `taskKey`
- selected registry `providerKey`
- required capability such as `llm.generateJson`
- prompt version such as `0.1.0`
- render slot such as `component.inline.aiSuggest` or `section.toolbar`
- hook key
- structured output schema
- saved task-run provenance

For MVP, AI suggestions use JSON output. The `suggest-component-revision` schema includes proposed text, rationale, confidence, source component ID, and warnings. Invalid JSON or schema failures create a failed task run and no suggestion or domain mutation.

## AI Suggest Flow

1. User invokes `AI Suggest` for a review component.
2. Service loads the component, document context, selected task definition, selected provider profile, provider config, hook metadata, runtime context, and secret availability.
3. Service evaluates readiness before rendering or invoking the action.
4. UI shows disabled actions with concrete readiness reasons.
5. If the selected provider has `externalSend: true`, the UI shows that component text and context will leave the local runtime before invocation.
6. Service invokes through `RegistryBackedInvokeProvidersClient` or `TargetAppRuntimeService.invokeTask`.
7. Provider output validates against the task's explicit structured output schema.
8. The app-owned hook stores a proposed `ai_suggestions` record.
9. Accept/reject endpoints apply or reject the proposal.
10. Accept creates an audited `component_revisions` record.

Provider output must never directly overwrite component text. Suggested text remains proposed until the user explicitly accepts it.

## Readiness And Setup

Expose a setup/readiness model that combines:

- database readiness
- provider registry reachability
- selected profile existence
- selected provider enabled state
- required secret availability
- adapter availability
- required capability compatibility
- task definition availability
- prompt version availability
- structured output schema availability
- hook implementation status
- workflow readiness for document lifecycle actions

Provider-backed buttons are rendered from readiness, not optimistic UI assumptions. If the registry is unavailable, provider-backed review actions block instead of falling back to local providers unless explicit test/demo mode is active.

First-run setup must include:

- database connection status from `DATABASE_URL`
- registry URL and reachability
- selected profile setup/status
- secret-reference status without exposing raw secret values
- provider adapter diagnostics
- workflow setup status
- a clear setup screen for missing active document workflow requirements before file ingest

## Workflow Boundary

Integrate `state-workflow-runtime` version `2.0.0` through a Postgres implementation of its `StateWorkflowStorageAdapter`.

- Artifact Review owns document workflow state in its own Postgres database.
- Backend-owned workflow state is authoritative. The frontend requests allowed actions from the service and renders only those actions.
- Do not define the starting workflow in this app.
- Require a user-provided active workflow with workflow ID/resource type `document`.
- On ingest, create the document record, then initialize workflow state using the first entry state declared by the active user-provided workflow definition.
- If no active document workflow or entry state exists, block ingest with a setup screen that clearly explains the missing workflow requirement before file ingest.
- Provider hooks are separate from workflow authority. A provider task may propose review content or store an AI suggestion, but document lifecycle transitions go through the app-owned workflow service and named transition APIs.

## UI Placement

The UI should remain a dense, stable, work-focused review/editor workspace.

- Global settings: registry URL, selected profile, provider readiness, secret-reference status, adapter diagnostics, database readiness, and workflow setup status.
- Component inline controls: `AI Suggest`, suggestion status, `Accept`, `Reject`, and readiness/error state for that component's task.
- Drawer/detail panel: task-run provenance, prompt version, provider/model, `externalSend`, latency, validation status, suggestion history, and audit trail.
- Section toolbar: section-level tasks only, including `summarize-section-findings`.
- App shell: product identity, version, theme control, current page name, stable navigation, search, status, and primary document actions.

Use `@invoke-providers/react` helper components as wrapped controls, not as the app's visual system. Artifact Review preserves its own shell, navigation, review sections, drawers, autosave, and export behavior.

## Interfaces

Sidecar HTTP/API boundary:

- `POST /api/ingest/file`
- `POST /api/ingest/url`
- `GET /api/documents`
- `GET /api/documents/:documentId`
- `PATCH /api/components/:componentId`
- `POST /api/components/:componentId/annotations`
- `POST /api/components/:componentId/questions`
- `POST /api/components/:componentId/evidence`
- `POST /api/components/:componentId/ai-suggestions`
- `POST /api/ai-suggestions/:suggestionId/accept`
- `POST /api/ai-suggestions/:suggestionId/reject`
- `POST /api/documents/:documentId/save`
- `POST /api/documents/:documentId/export`
- `GET /api/workflow/documents/:documentId/actions`
- `POST /api/workflow/documents/:documentId/actions/:actionId`
- `GET /api/setup-readiness`
- `GET /api/provider-readiness`
- `GET /api/provider-readiness/tasks/:taskKey`
- `GET /api/task-runs/:taskRunId`

Tauri commands:

- open document picker
- open export destination picker
- reveal exported file
- report app/service/database readiness
- report local secret availability without exposing raw secret values

## Test Plan

- Parser tests for `txt`, `md`, `html`, and URL snapshot inputs.
- Component stability tests confirming IDs remain stable across autosave and save.
- Export round-trip tests for all MVP formats.
- Postgres migration tests and repository tests.
- Workflow tests: no active workflow blocks ingest with setup guidance; valid workflow initializes to first entry state; invalid transitions are rejected.
- Registry unavailable blocks provider-backed actions with a clear readiness reason.
- Saved missing `selectedProviderProfileKey` does not fall back to `INVOKE_PROVIDERS_PROFILE`.
- Missing secret reference blocks invocation before adapter execution.
- `externalSend: true` is visible before AI Suggest invocation.
- Invalid structured provider output stores a failed task run and no suggestion.
- Successful AI Suggest stores a proposed suggestion and does not mutate component text.
- Accepting a suggestion creates an audited component revision.
- Rejecting a suggestion preserves history without mutating component text.
- Hook implementation missing produces a readiness blocker or deterministic no-op, depending on task policy.
- Adapter diagnostics do not dispatch domain hooks.
- Deterministic adapter tests run only through explicit test/demo configuration.
- UI tests for file picker path, drop zone file path, drop zone URL path, setup readiness, provider readiness, search, focus, collapse, annotation modal, drawer, task-run provenance, edit audit trail, autosave status, save, and export.
- Cross-platform smoke checks on macOS and Windows before any release packaging.

## Assumptions

- No user management, authentication, or permissions are required in MVP.
- PDF, DOCX, RTF, ODT, and image OCR are deferred because same-format export with annotations is materially larger than the strict MVP.
- The app will not generate or ship a default workflow definition; it only imports/activates the workflow you provide.
- First-run workflow setup must be shown before file ingest so a missing active document workflow does not look like a broken import feature.
- Browser `localStorage` behavior from the reference artifact becomes app/database-backed autosave and persistence, not browser-only state.
- Before assigning a fixed local service port, implementation must check the shared local port registry and document the chosen numbered port.
