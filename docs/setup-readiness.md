# Setup And Readiness

Artifact Review should be explicit about setup blockers before users try to ingest or review a document. The app currently exposes readiness endpoints, but most domain behavior remains scaffolded.

## Required Local Configuration

Copy `.env.example` to `.env` and fill values appropriate for local development.

| Variable | Required for | Notes |
| --- | --- | --- |
| `ARTIFACT_REVIEW_SERVICE_HOST` | service startup | Defaults to `127.0.0.1`. |
| `ARTIFACT_REVIEW_SERVICE_PORT` | service startup | Defaults to registered port `4793`. |
| `VITE_ARTIFACT_REVIEW_API_BASE` | UI to service calls | Defaults to `http://127.0.0.1:4793`. |
| `DATABASE_URL` | database-backed work | Configured external/dev Postgres connection string. |
| `INVOKE_PROVIDERS_REGISTRY_URL` | provider-backed work | Shared provider registry URL. |
| `INVOKE_PROVIDERS_PROFILE` | first-run provider bootstrap | Used only when no saved selected profile exists. |
| `ARTIFACT_REVIEW_DEMO_PROVIDER_MODE` | tests or explicit demos | Must be explicitly enabled; default is `false`. |
| `LOG_LEVEL` | diagnostics | `debug`, `info`, `warn`, or `error`. |

## Readiness Endpoints

| Endpoint | Meaning |
| --- | --- |
| `GET /health` | Service process is alive. Does not prove dependencies are ready. |
| `GET /ready` | Database readiness only. |
| `GET /api/setup-readiness` | Combined database, provider, and workflow readiness. |
| `GET /api/provider-readiness` | Provider registry/profile/task/schema/fallback/demo readiness. |
| `GET /api/provider-readiness/tasks/:taskKey` | Provider readiness for a task key. |

## Expected First-Run Blockers

Until implementation continues, these blockers can be expected depending on local configuration:

- no active document workflow is imported or activated
- database is not configured through `DATABASE_URL`
- provider registry URL is missing or unreachable
- saved selected provider profile is missing from the registry
- no enabled registry provider supplies the required task capability
- required provider secret reference is unavailable locally
- provider runtime adapters are not installed unless explicit deterministic demo mode is enabled

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
