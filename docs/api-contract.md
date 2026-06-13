# API Contract

Artifact Review uses a local TypeScript service as the only HTTP API boundary for durable app behavior. React calls these endpoints through the configured API base. Tauri handles native OS integration and delegates domain work to the service.

## Current Implemented Surface

| Method | Path | Current behavior |
| --- | --- | --- |
| `GET` | `/health` | Returns liveness, service name, and version. |
| `GET` | `/ready` | Checks database connectivity and returns `200` when ready or `503` when not ready. |
| `GET` | `/api/setup-readiness` | Combines database, provider, and workflow readiness checks. |
| `GET` | `/api/provider-readiness` | Reports registry/profile/task/schema/fallback/demo readiness. |
| `GET` | `/api/provider-readiness/tasks/:taskKey` | Reports provider readiness in the context of a task key. |
| `GET` | `/api/workflow/status` | Returns active document workflow status, active workflow summary, and workflow readiness. |
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
| `POST` | `/api/components/:componentId/ai-suggestions` | Blocks when provider readiness fails; in explicit deterministic demo mode validates `suggest-component-revision` output, writes a task run, and stores a proposed `ai_suggestions` record without mutating component text. |
| `POST` | `/api/ai-suggestions/:suggestionId/accept` | Returns `501 suggestion_accept_not_wired`. |
| `POST` | `/api/ai-suggestions/:suggestionId/reject` | Returns `501 suggestion_reject_not_wired`. |
| `GET` | `/api/task-runs/:taskRunId` | Returns repository-backed task-run provenance when present; otherwise returns `404 task_run_not_found`. |

Any other `/api` route currently returns `501 not_implemented`.

## Reserved MVP Surface

These routes are reserved by the MVP plan and should be implemented incrementally without changing the React or Tauri authority boundary:

| Method | Path | Purpose |
| --- | --- | --- |
| `POST` | `/api/documents/:documentId/export` | Write reviewed output and optional JSON review bundle. |
| `PATCH` | `/api/workflow/active` | Replace or deactivate the active document workflow after import/activation UX exists. |

## Response Rules

- Readiness responses use `{ ready: boolean, checks: ReadinessCheck[] }`.
- Blocking setup failures should use `409` with a stable `error` code and a user-actionable message.
- Unimplemented reserved behavior should use `501` with a stable `error` code.
- Missing records should use `404` with the missing resource ID when safe.
- Provider output must never directly mutate document text. Provider invocation creates proposed suggestions only.
- Provider readiness checks the selected profile, registry profile/provider lookup, task definition, prompt version, structured output schema, processing hook, required provider capability, local secret availability, adapter availability, no-fallback policy, and deterministic demo mode.
- Selected provider profile precedence is saved `selectedProviderProfileKey` first, then first-run `INVOKE_PROVIDERS_PROFILE`; a saved missing profile must block provider-backed actions instead of falling back.
- Deterministic provider behavior is available only when `ARTIFACT_REVIEW_DEMO_PROVIDER_MODE=true`; real registry provider adapter execution remains blocked until provider runtime adapters are installed.
- Workflow state must be returned by the service and must not be inferred as durable truth in React.
- Workflow validation failures return `422` with `valid: false` and stable error strings.
- Workflow action execution rejects invalid transitions with `409 workflow_action_not_allowed`.
- File ingest accepts `{ name: string, format: "txt" | "md" | "html" | "htm", content: string }`; malformed payloads return `422 invalid_ingest_file_request`, and content with no reviewable components returns `422 no_reviewable_components`.
- URL ingest accepts `{ url: string, name?: string, snapshotHtml?: string }`; only `http` and `https` URLs are accepted. If `snapshotHtml` is supplied, the service parses that captured HTML. If it is omitted, the service fetches the URL and parses the returned HTML/text snapshot.
- URL ingest malformed payloads return `422 invalid_ingest_url_request`; fetch failures return `502 url_snapshot_fetch_failed`; snapshots with no reviewable components return `422 no_reviewable_components`.
- Ingest without a configured database returns `409 database_not_configured`; ingest without an active workflow returns `409 workflow_not_configured`.
- Component edits accept `{ currentText: string, editSource?: "manual" | "accepted_ai_suggestion" }`; malformed payloads return `422 invalid_component_edit_request`, and missing components return `404 component_not_found`.
- Annotation and question payloads accept `{ body: string }`; evidence accepts `{ kind: "source" | "link" | "repo_path" | "screenshot_path" | "note", value: string }`; highlight accepts `{ enabled: boolean }`.
- Review mutation endpoints write autosave snapshots to `autosave_snapshots`; they do not update `document_versions.source_snapshot` or `document_versions.current_snapshot`.
- Document save creates a new `document_versions` row with the original imported source snapshot preserved and a JSON review-state `current_snapshot`. Same-format export remains reserved for `/api/documents/:documentId/export`.

## Tauri Command Boundary

Tauri commands should stay limited to native capabilities:

- open document picker
- open export destination picker
- reveal exported file
- report local app/service/database readiness
- report local secret availability without exposing raw secret values

Tauri commands must not own provider invocation, workflow transitions, Postgres writes, or document mutation logic.
