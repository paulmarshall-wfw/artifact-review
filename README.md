# Artifact Review

Artifact Review is a cross-platform desktop review/editor workspace for imported documents. It uses Tauri 2, React, a local TypeScript service, and configured Postgres.

The MVP is grounded by:

- [Artifact Review MVP Plan](docs/Artifact%20Review%20MVP%20Plan.md)
- [Provider Registry Integration Review](docs/artifact-review-provider-registry-integration-review.md)
- [API Contract](docs/api-contract.md)
- [Data Model](docs/data-model.md)
- [Setup And Readiness](docs/setup-readiness.md)
- [Verification Plan](docs/verification-plan.md)
- [Implementation Sequence](docs/implementation-sequence.md)

## Stack

- Tauri 2 desktop shell
- React 19 and Vite 6 web workspace
- Node/TypeScript local service
- Postgres via `DATABASE_URL`
- `invoke-providers-for-tasks@0.1.0` target-app runtime packages through local `@invoke-providers/*` dependencies
- `state-workflow-runtime` backend-owned document workflow boundary

## Local Configuration

Copy `.env.example` to `.env` and fill in local values. The local service loads `.env` at startup; process environment values override `.env` values.

Required for database-backed work:

```text
DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev
```

Optional isolated Postgres integration tests use a disposable schema inside the configured database and drop only that schema after the run:

```text
ARTIFACT_REVIEW_TEST_DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_test
```

Provider-backed actions also require:

```text
INVOKE_PROVIDERS_REGISTRY_URL=http://127.0.0.1:5181
INVOKE_PROVIDERS_PROFILE=<profile-key>
```

The database URL can also be edited in the app's Settings section. Database URL changes are written to `.env` and take effect after restarting Artifact Review.

The provider registry URL, selected profile, and deterministic demo mode can be configured in Settings. Environment values are first-run bootstrap defaults; saved provider settings take priority. Raw provider secrets remain outside Postgres.

## Commands

```bash
npm install
npm run dev
npm run tauri:dev
npm test
npm run test:postgres
npm run lint
npm run build
npm run verify
npm run doctor
```

`npm run dev` starts the local service and browser UI. `npm run tauri:dev` starts the Tauri shell.

## Local Ports

- UI: `http://127.0.0.1:5184`
- Local service: `http://127.0.0.1:4794`
- Shared local Postgres dependency: `localhost:5432`

Before changing ports, update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`.

## Runtime Boundaries

- Tauri owns native file dialogs, export destination selection, reveal-in-folder, local permissions, and app lifecycle.
- The TypeScript service owns Postgres access, provider-runtime composition, task invocation, workflow calls, export, readiness APIs, and domain mutations.
- React renders the review workspace and calls service APIs.
- Provider output is stored as proposed suggestions. Accepting a suggestion is a separate user action that creates an audited component revision.
- Document lifecycle transitions go through app-owned workflow APIs.

## Verification

After dependencies are installed, run:

```bash
npm run verify
```

The default test suite covers parser stability, provider readiness policy, migration loading, and repository mapping. Use `npm run test:postgres` with `ARTIFACT_REVIEW_TEST_DATABASE_URL` when validating migrations and repositories against a real Postgres database. The service also exposes:

- `GET /health`
- `GET /ready`
- `GET /api/setup-readiness`
- `GET /api/provider-readiness`
- `GET /api/provider-settings`
- `GET /api/workflow/status`
- `POST /api/workflow/definitions/validate`
- `POST /api/workflow/activate`
- `GET /api/workflow/documents/:documentId/actions`
