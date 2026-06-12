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
| `GET` | `/api/documents` | Returns repository-backed document summaries when `DATABASE_URL` is configured; otherwise returns an empty list. |
| `GET` | `/api/documents/:documentId` | Returns repository-backed document, versions, and review components when present; otherwise returns `404 document_not_found`. |
| `POST` | `/api/ingest/file` | Returns `409 workflow_not_configured` until workflow import/activation exists. |
| `POST` | `/api/ingest/url` | Returns `409 workflow_not_configured` until workflow import/activation exists. |
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
| `GET` | `/api/workflow/documents/:documentId/actions` | Return backend-owned allowed workflow actions. |
| `POST` | `/api/workflow/documents/:documentId/actions/:actionId` | Execute a named backend workflow transition. |

## Response Rules

- Readiness responses use `{ ready: boolean, checks: ReadinessCheck[] }`.
- Blocking setup failures should use `409` with a stable `error` code and a user-actionable message.
- Unimplemented reserved behavior should use `501` with a stable `error` code.
- Missing records should use `404` with the missing resource ID when safe.
- Provider output must never directly mutate document text. Provider invocation creates proposed suggestions only.
- Workflow state must be returned by the service and must not be inferred as durable truth in React.

## Tauri Command Boundary

Tauri commands should stay limited to native capabilities:

- open document picker
- open export destination picker
- reveal exported file
- report local app/service/database readiness
- report local secret availability without exposing raw secret values

Tauri commands must not own provider invocation, workflow transitions, Postgres writes, or document mutation logic.
