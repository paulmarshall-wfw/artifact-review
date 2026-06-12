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
| `GET` | `/api/documents/:documentId` | Returns repository-backed document, versions, and review components when present; otherwise returns `404 document_not_found`. |
| `GET` | `/api/workflow/documents/:documentId/actions` | Returns backend-derived visible user actions for the document's current workflow state. |
| `POST` | `/api/workflow/documents/:documentId/actions/:actionId` | Executes an allowed visible user workflow action and updates the document state. |
| `POST` | `/api/ingest/file` | Ingests `txt`, `md`, `html`, and `htm` file payloads into a document, first version, review components, and the active workflow entry state when database and workflow are configured. |
| `POST` | `/api/ingest/url` | Ingests URL snapshots into a document, first version, review components, and the active workflow entry state when database and workflow are configured; accepts caller-supplied snapshot HTML or fetches the URL when no snapshot is supplied. |
| `POST` | `/api/components/:componentId/ai-suggestions` | Blocks when provider readiness fails; otherwise returns `501 provider_runtime_not_wired`. |
| `POST` | `/api/ai-suggestions/:suggestionId/accept` | Returns `501 suggestion_accept_not_wired`. |
| `POST` | `/api/ai-suggestions/:suggestionId/reject` | Returns `501 suggestion_reject_not_wired`. |
| `GET` | `/api/task-runs/:taskRunId` | Returns repository-backed task-run provenance when present; otherwise returns `404 task_run_not_found`. |

Any other `/api` route currently returns `501 not_implemented`.

## Reserved MVP Surface

These routes are reserved by the MVP plan and should be implemented incrementally without changing the React or Tauri authority boundary:

| Method | Path | Purpose |
| --- | --- | --- |
| `PATCH` | `/api/components/:componentId` | Edit component text and create an audited revision. |
| `POST` | `/api/components/:componentId/annotations` | Add reviewer annotation. |
| `POST` | `/api/components/:componentId/questions` | Add unresolved question. |
| `POST` | `/api/components/:componentId/evidence` | Add source, link, path, screenshot path, or note evidence. |
| `POST` | `/api/documents/:documentId/save` | Promote current staged review state to a durable document version. |
| `POST` | `/api/documents/:documentId/export` | Write reviewed output and optional JSON review bundle. |
| `PATCH` | `/api/workflow/active` | Replace or deactivate the active document workflow after import/activation UX exists. |

## Response Rules

- Readiness responses use `{ ready: boolean, checks: ReadinessCheck[] }`.
- Blocking setup failures should use `409` with a stable `error` code and a user-actionable message.
- Unimplemented reserved behavior should use `501` with a stable `error` code.
- Missing records should use `404` with the missing resource ID when safe.
- Provider output must never directly mutate document text. Provider invocation creates proposed suggestions only.
- Workflow state must be returned by the service and must not be inferred as durable truth in React.
- Workflow validation failures return `422` with `valid: false` and stable error strings.
- Workflow action execution rejects invalid transitions with `409 workflow_action_not_allowed`.
- File ingest accepts `{ name: string, format: "txt" | "md" | "html" | "htm", content: string }`; malformed payloads return `422 invalid_ingest_file_request`, and content with no reviewable components returns `422 no_reviewable_components`.
- URL ingest accepts `{ url: string, name?: string, snapshotHtml?: string }`; only `http` and `https` URLs are accepted. If `snapshotHtml` is supplied, the service parses that captured HTML. If it is omitted, the service fetches the URL and parses the returned HTML/text snapshot.
- URL ingest malformed payloads return `422 invalid_ingest_url_request`; fetch failures return `502 url_snapshot_fetch_failed`; snapshots with no reviewable components return `422 no_reviewable_components`.
- Ingest without a configured database returns `409 database_not_configured`; ingest without an active workflow returns `409 workflow_not_configured`.

## Tauri Command Boundary

Tauri commands should stay limited to native capabilities:

- open document picker
- open export destination picker
- reveal exported file
- report local app/service/database readiness
- report local secret availability without exposing raw secret values

Tauri commands must not own provider invocation, workflow transitions, Postgres writes, or document mutation logic.
