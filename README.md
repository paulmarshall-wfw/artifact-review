# Artifact Review

Artifact Review is a cross-platform desktop review/editor workspace for imported documents. It uses Tauri 2, React, a local TypeScript service, and configured Postgres.

The MVP is grounded by:

- [Artifact Review MVP Plan](docs/Artifact%20Review%20MVP%20Plan.md)
- [Provider Registry Integration Review](docs/artifact-review-provider-registry-integration-review.md)

## Stack

- Tauri 2 desktop shell
- React 19 and Vite 6 web workspace
- Node/TypeScript local service
- Postgres via `DATABASE_URL`
- `invoke-providers-for-tasks` target-app integration boundary
- `state-workflow-runtime` backend-owned document workflow boundary

## Local Configuration

Copy `.env.example` to `.env` and fill in local values.

Required for database-backed work:

```text
DATABASE_URL=postgres://artifact_review:artifact_review@localhost:5432/artifact_review_dev
```

Provider-backed actions also require:

```text
INVOKE_PROVIDERS_REGISTRY_URL=http://127.0.0.1:5181
INVOKE_PROVIDERS_PROFILE=<profile-key>
```

`INVOKE_PROVIDERS_PROFILE` is first-run bootstrap only. A saved selected provider profile in app settings takes priority.

## Commands

```bash
npm install
npm run dev
npm run tauri:dev
npm test
npm run lint
npm run build
npm run verify
npm run doctor
```

`npm run dev` starts the local service and browser UI. `npm run tauri:dev` starts the Tauri shell.

## Local Ports

- UI: `http://127.0.0.1:5182`
- Local service: `http://127.0.0.1:4793`
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

The initial test suite covers parser stability and provider readiness policy. The service also exposes:

- `GET /health`
- `GET /ready`
- `GET /api/setup-readiness`
- `GET /api/provider-readiness`

