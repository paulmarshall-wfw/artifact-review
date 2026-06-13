# Setup And Readiness

Artifact Review should be explicit about setup blockers before users try to ingest or review a document. The app exposes readiness endpoints for the database, document workflow, provider registry, provider runtime adapters, local secret references, and task assets.

## Required Local Configuration

Copy `.env.example` to `.env` and fill values appropriate for local development.

| Variable | Required for | Notes |
| --- | --- | --- |
| `ARTIFACT_REVIEW_SERVICE_HOST` | service startup | Defaults to `127.0.0.1`. |
| `ARTIFACT_REVIEW_SERVICE_PORT` | service startup | Defaults to registered port `4794`. |
| `VITE_ARTIFACT_REVIEW_API_BASE` | UI to service calls | Defaults to `http://127.0.0.1:4794`. |
| `DATABASE_URL` | database-backed work | Configured external/dev Postgres connection string. |
| `INVOKE_PROVIDERS_REGISTRY_URL` | first-run provider bootstrap | Shared provider registry URL. A saved provider registry URL in app settings takes priority. |
| `INVOKE_PROVIDERS_PROFILE` | first-run provider bootstrap | Used only when no saved selected profile exists. |
| `ARTIFACT_REVIEW_DEMO_PROVIDER_MODE` | tests or explicit demos | Must be explicitly enabled; default is `false`. A saved demo-mode setting takes priority. |
| `LOG_LEVEL` | diagnostics | `debug`, `info`, `warn`, or `error`. |

## Readiness Endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Service process is alive. Does not prove dependencies are ready. |
| `GET /ready` | Database readiness only. |
| `GET /api/setup-readiness` | Combined database, provider, and workflow readiness. |
| `GET /api/provider-readiness` | Provider registry/profile/task/schema/fallback/demo readiness plus the default task invocation summary. |
| `GET /api/provider-readiness/tasks/:taskKey` | Provider readiness and invocation summary for a task key. |
| `GET /api/provider-settings` | Effective provider registry URL, selected profile, demo mode, and value sources. |
| `PUT /api/provider-settings` | Saves non-secret provider runtime settings in app settings. |
| `GET /api/settings` | Full Settings summary for workflow, provider registry, task routes, predefined landing areas, readiness, and recent task runs. |
| `PATCH /api/settings/provider-registry` | Saves non-secret provider registry settings and returns refreshed Settings summary data. |
| `POST /api/settings/providers/refresh` | Recomputes provider readiness without changing saved settings. |
| `GET /api/settings/render-slots` | Lists predefined render slots and current task assignments. |
| `GET /api/settings/render-slots/:slot/actions` | Lists slot-driven task actions and readiness reasons. |
| `GET /api/settings/task-runs` | Lists recent task runs for diagnostics. |
| `PATCH /api/settings/tasks/:taskKey/route` | Saves editable task-route metadata after render-slot and hook validation. |

## In-App Settings

Settings is organized as a left section navigator with focused detail panels:

- Workflow: import/activation/status and workflow readiness.
- Provider Registry: registry URL, selected profile, demo mode, refresh, catalog status, and provider readiness.
- AI Tasks: editable task route fields for provider key, hook, render slot, order, enabled state, model override, and display metadata.
- Landing Areas: predefined render slots and current task assignments.
- Diagnostics: setup/provider readiness plus recent task runs.
- Ingest: file and URL ingest, still blocked until an active workflow exists.

The Settings section can save:

- provider registry URL
- selected provider profile key
- explicit deterministic demo mode

These settings are stored in `app_settings` and take precedence over first-run environment values. Clearing a text field removes the saved value and allows the corresponding environment bootstrap value to apply again. Raw provider secrets remain outside Postgres and are only checked through local secret references.

Provider-backed actions should use task-specific readiness. The component detail panel shows the selected provider, profile, adapter, prompt version, demo-mode state, and `externalSend` before `AI Suggest` can be invoked. Suggestions keep task-run provenance visible with provider/profile, validation status, latency, and external-send state.

The component inline AI Suggest button is driven by the `component.inline.aiSuggest` render slot. It still creates proposed suggestions only; accepting or rejecting a suggestion remains a separate explicit user action.

## Expected First-Run Blockers

These blockers can be expected depending on local configuration:

- no active document workflow is imported or activated
- database is not configured through `DATABASE_URL`
- provider registry URL is missing or unreachable
- saved selected provider profile is missing from the registry
- no enabled registry provider supplies the required task capability
- required provider secret reference is unavailable locally
- selected registry provider uses an adapter that is not registered in Artifact Review

These blockers should be shown as setup state, not as broken import or review behavior.

## Local Diagnostic Path

Use these commands after dependencies are installed:

```bash
npm run verify
npm run doctor
```

`npm run doctor` expects the local service to be running. The service health and readiness endpoints are the first place to inspect runtime setup.

## Logging And Redaction

- Use `LOG_LEVEL` to control service verbosity.
- Logs may include operation names, readiness check keys, task keys, request paths, and safe IDs.
- Logs must not include raw provider secrets, tokens, passwords, full secret-bearing environment values, or unnecessary sensitive document content.
- Provider task-run records may store provenance and diagnostics, but raw provider secrets remain outside Postgres.
