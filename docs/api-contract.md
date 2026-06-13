# API Contract

Artifact Review uses a local TypeScript service as the only HTTP API boundary for durable app behavior. React calls these endpoints through the configured API base. Tauri handles native OS integration and delegates domain work to the service.

## Current Implemented Surface

| Method | Path | Current behavior |
| --- | --- | --- |
| `GET` | `/health` | Returns liveness, service name, and version. |
| `GET` | `/ready` | Checks database connectivity and returns `200` when ready or `503` when not ready. |
| `GET` | `/api/setup-readiness` | Combines database, provider, and workflow readiness checks. |
| `GET` | `/api/provider-readiness` | Reports registry/profile/task/schema/fallback/demo readiness plus the current invocation summary for the default provider-backed task. |
| `GET` | `/api/provider-readiness/tasks/:taskKey` | Reports provider readiness in the context of a task key, including selected provider/profile/adapter, prompt version, demo mode, and `externalSend`. |
| `GET` | `/api/provider-settings` | Returns effective provider runtime settings and whether each value came from saved app settings, environment bootstrap, or neither. |
| `PUT` | `/api/provider-settings` | Saves non-secret provider runtime settings: registry URL, selected profile key, and explicit deterministic demo mode. Requires `DATABASE_URL`. |
| `GET` | `/api/workflow/status` | Returns active document workflow status, active workflow summary, and workflow readiness. |
| `GET` | `/api/settings` | Returns the service-backed Settings summary: database settings, provider registry settings/catalog, processing hooks, workflow status, combined readiness, task routes, predefined render slots, and recent task runs. |
| `GET` | `/api/settings/database` | Returns effective and saved database URL state, source, database readiness, local `.env` path, and whether a restart is required. |
| `PATCH` | `/api/settings/database` | Writes `DATABASE_URL` to local `.env` and returns a refreshed Settings summary. Changed database connections require an app restart before they become active. |
| `GET` | `/api/settings/readiness` | Returns combined Settings readiness for database, workflow, and provider runtime state. |
| `PATCH` | `/api/settings/provider-registry` | Saves non-secret provider registry/profile/demo settings and returns a refreshed Settings summary. Requires `DATABASE_URL`. |
| `POST` | `/api/settings/providers/refresh` | Recomputes provider readiness and returns provider settings plus a refreshed Settings summary without mutating saved settings. |
| `POST` | `/api/settings/processing-hooks` | Creates an app-owned processing hook key with default no-op policy. Requires `DATABASE_URL`. |
| `DELETE` | `/api/settings/processing-hooks/:hookKey` | Deletes an unused processing hook. Hooks referenced by task routes are blocked with `409 processing_hook_in_use`. Requires `DATABASE_URL`. |
| `GET` | `/api/settings/render-slots` | Lists predefined Artifact Review landing areas with current task assignments and ready-action counts. |
| `GET` | `/api/settings/render-slots/:slot/actions` | Lists provider task actions for a predefined render slot, sorted by display order and readiness. |
| `GET` | `/api/settings/task-runs` | Lists recent provider task runs for Settings diagnostics. |
| `PATCH` | `/api/settings/tasks/:taskKey/route` | Edits task route metadata including provider key, render slot, hook key, display order, enabled state, model override, and display metadata. Requires `DATABASE_URL`. |
| `POST` | `/api/workflow/definitions/validate` | Validates a user-provided document workflow definition without activating it. |
| `POST` | `/api/workflow/activate` | Validates and stores a user-provided active document workflow when `DATABASE_URL` is configured. |
| `GET` | `/api/documents` | Returns repository-backed document summaries when `DATABASE_URL` is configured; otherwise returns an empty list. |
| `GET` | `/api/documents/:documentId` | Returns repository-backed document, versions, review components, annotations, questions, evidence, highlights, and AI suggestions when present; otherwise returns `404 document_not_found`. |
| `GET` | `/api/workflow/documents/:documentId/actions` | Returns backend-derived visible user actions for the document's current workflow state. |
| `POST` | `/api/workflow/documents/:documentId/actions/:actionId` | Executes an allowed visible user workflow action and updates the document state. |
| `POST` | `/api/ingest/file` | Ingests `txt`, `md`, `html`, and `htm` file payloads into a document, first version, review components, and the active workflow entry state when database and workflow are configured. |
| `POST` | `/api/ingest/url` | Ingests URL snapshots into a document, first version, review components, and the active workflow entry state when database and workflow are configured; accepts caller-supplied snapshot HTML or fetches the URL when no snapshot is supplied. |
| `PATCH` | `/api/components/:componentId` | Edits component text, creates an audited component revision, and records an autosave snapshot without mutating imported source snapshots. |
| `POST` | `/api/components/:componentId/annotations` | Adds a reviewer annotation and records an autosave snapshot. |
| `POST` | `/api/components/:componentId/questions` | Adds an open reviewer question and records an autosave snapshot. |
| `POST` | `/api/components/:componentId/evidence` | Adds source/link/repo path/screenshot/note evidence and records an autosave snapshot. |
| `PATCH` | `/api/components/:componentId/highlight` | Enables or disables component highlight state and records an autosave snapshot. |
| `POST` | `/api/documents/:documentId/save` | Promotes current reviewed state to a new durable document version while preserving the imported source snapshot. |
| `POST` | `/api/documents/:documentId/export` | Builds same-format reviewed output for `txt`, `md`, `html`, `htm`, and URL snapshots; optionally writes a JSON review bundle beside the export. If `destinationPath` is supplied, the service writes local files and returns paths. Otherwise it returns downloadable content. |
| `POST` | `/api/components/:componentId/task-actions/:taskKey` | Executes a component inline task action when it is assigned to `component.inline.aiSuggest`; currently supports `suggest-component-revision` and creates proposal-only AI suggestions. |
| `POST` | `/api/components/:componentId/ai-suggestions` | Compatibility path for `suggest-component-revision`; blocks when task-specific provider readiness fails, invokes through the service-owned provider runtime facade, validates structured output, writes a task run, and stores a proposed `ai_suggestions` record without mutating component text. Explicit deterministic demo mode uses the same invocation path with a local deterministic adapter. |
| `POST` | `/api/ai-suggestions/:suggestionId/accept` | Accepts a proposed AI suggestion, updates component text, creates an audited `component_revisions` row with `edit_source = accepted_ai_suggestion`, marks the suggestion accepted, and writes an autosave snapshot. |
| `POST` | `/api/ai-suggestions/:suggestionId/reject` | Rejects a proposed AI suggestion, preserves suggestion history, writes an autosave snapshot, and does not mutate component text or create a component revision. |
| `GET` | `/api/task-runs/:taskRunId` | Returns repository-backed task-run provenance when present; otherwise returns `404 task_run_not_found`. |

Any other `/api` route currently returns `501 not_implemented`.

## Reserved MVP Surface

These routes are reserved by the MVP plan and should be implemented incrementally without changing the React or Tauri authority boundary:

| Method | Path | Purpose |
| --- | --- | --- |
| `PATCH` | `/api/workflow/active` | Replace or deactivate the active document workflow after import/activation UX exists. |

## Response Rules

- Readiness responses use `{ ready: boolean, checks: ReadinessCheck[] }`. Provider readiness responses also include `taskKey` and an `invocation` summary so React can show the selected provider/profile/adapter, prompt version, demo mode, and `externalSend` before invocation.
- Blocking setup failures should use `409` with a stable `error` code and a user-actionable message.
- Unimplemented reserved behavior should use `501` with a stable `error` code.
- Missing records should use `404` with the missing resource ID when safe.
- Provider output must never directly mutate document text. Provider invocation creates proposed suggestions only.
- Provider readiness checks the selected profile, registry profile/provider lookup, task definition, prompt version, structured output schema, processing hook, required provider capability, local secret availability, adapter availability, no-fallback policy, and deterministic demo mode.
- Provider settings can be configured in the app and are persisted in `app_settings`. Saved provider registry URL, selected provider profile, and demo mode take precedence over first-run environment values.
- Settings is the primary setup surface. It exposes Database, Workflow, Provider Registry, Processing Hooks, AI Tasks, Landing Areas, and Diagnostics sections from service-backed summary data. Ingest is a top-level workspace tab that still uses the service-backed database and workflow readiness gates.
- Provider Registry is a profile-and-catalog screen: users can choose the active registry profile and inspect read-only providers from the shared registry, but Artifact Review does not own provider records.
- Processing Hooks is the app-owned hook configuration surface. New hooks are created as `default_noop`; task routes can select registered hooks, but enabling a route through a no-op hook is rejected until backend logic exists.
- Selected provider profile precedence is saved `selectedProviderProfileKey` first, then first-run `INVOKE_PROVIDERS_PROFILE`; a saved missing profile must block provider-backed actions instead of falling back.
- Predefined render slots are `component.inline.aiSuggest`, `component.inline.textTools`, `component.drawer.noteDraft`, `section.toolbar`, `document.toolbar`, `document.footer`, and `admin.diagnostics`. Custom user-created slots are deferred.
- Task route saves validate render slots against the predefined registry and validate hook keys against registered processing hooks. A task route cannot be enabled when its selected hook is registered but unimplemented. Provider/runtime readiness is returned after save so the UI can show blockers without treating frontend state as authoritative.
- Component inline AI Suggest is selected from `GET /api/settings/render-slots/component.inline.aiSuggest/actions`; AI output remains proposal-only until the user explicitly accepts a suggestion.
- Deterministic provider behavior is available only when explicit demo mode is enabled through saved app settings or `ARTIFACT_REVIEW_DEMO_PROVIDER_MODE=true`; real registry provider adapter execution requires a reachable registry profile, a selected provider with a registered adapter, and any required local secret reference.
- Provider settings saves accept `{ registryUrl: string | null, selectedProviderProfileKey: string | null, demoProviderMode: boolean }`; raw provider secrets must never be saved through this endpoint.
- Workflow state must be returned by the service and must not be inferred as durable truth in React.
- Workflow validation failures return `422` with `valid: false` and stable error strings.
- Workflow action execution rejects invalid transitions with `409 workflow_action_not_allowed`.
- File ingest accepts `{ name: string, format: "txt" | "md" | "html" | "htm", content: string }`; malformed payloads return `422 invalid_ingest_file_request`, and content with no reviewable components returns `422 no_reviewable_components`.
- URL ingest accepts `{ url: string, name?: string, snapshotHtml?: string }`; only `http` and `https` URLs are accepted. If `snapshotHtml` is supplied, the service parses that captured HTML. If it is omitted, the service fetches the URL and parses the returned HTML/text snapshot.
- URL ingest malformed payloads return `422 invalid_ingest_url_request`; fetch failures return `502 url_snapshot_fetch_failed`; snapshots with no reviewable components return `422 no_reviewable_components`.
- Ingest without a configured database returns `409 database_not_configured`; ingest without an active workflow returns `409 workflow_not_configured`.
- Component edits accept `{ currentText: string, editSource?: "manual" | "accepted_ai_suggestion" }`; malformed payloads return `422 invalid_component_edit_request`, and missing components return `404 component_not_found`.
- Annotation and question payloads accept `{ body: string }`; evidence accepts `{ kind: "source" | "link" | "repo_path" | "screenshot_path" | "note", value: string }`; highlight accepts `{ enabled: boolean }`.
- AI suggestion accept/reject only works for `proposed` suggestions. Missing suggestions return `404 suggestion_not_found`; already accepted or rejected suggestions return `409 suggestion_already_decided`.
- Accepting an AI suggestion applies `ai_suggestions.proposed_text` as component text and records the suggestion ID on the created component revision.
- Rejecting an AI suggestion updates only suggestion decision state and autosave history; it does not update `review_components` or write `component_revisions`.
- Review mutation endpoints write autosave snapshots to `autosave_snapshots`; they do not update `document_versions.source_snapshot` or `document_versions.current_snapshot`.
- Document save creates a new `document_versions` row with the original imported source snapshot preserved and a JSON review-state `current_snapshot`.
- Document export accepts `{ destinationPath?: string, includeReviewBundle?: boolean }`. Missing database returns `409 database_not_configured`; missing documents return `404 document_not_found`; malformed payloads return `422 invalid_export_request`; source reconstruction failures return `409 export_assembly_failed`.
- Same-format export reconstructs reviewed output by applying component `currentText` to the imported source snapshot through stored source ranges. `txt` and `md` exports append review notes in matching text/Markdown form; `html`, `htm`, and URL snapshot exports embed review notes plus JSON metadata into the HTML. The optional JSON review bundle includes document identity, source/latest version metadata, components, and review records.

## Tauri Command Boundary

Tauri commands should stay limited to native capabilities:

- open document picker
- open export destination picker
- reveal exported file
- report local app/service/database readiness
- report local secret availability without exposing raw secret values

Tauri commands must not own provider invocation, workflow transitions, Postgres writes, or document mutation logic.
