# AGENTS.md

## Core Skill Policy

For any repo setup, maintenance, versioning, or stack-selection work, apply the engineering-project-standard skill from `~/.codex/skills/engineering-project-standard`.

For any frontend UI design, scaffolding, review, or refinement work, apply the web-app-design-standard skill from `~/.codex/skills/web-app-design-standard`.

For any Docker, container, image build, image publishing, registry push, or container release work, apply the docker-build-and-publish skill from `~/.codex/skills/docker-build-and-publish`.

For browser automation, use Chrome unless the user explicitly asks for a different browser or Chrome is unavailable.

## Broad Project Policy

Prefer explicit user intent over convenience defaults. Defaults may suggest values or preselect options, but they are not permission to mutate state, activate features, publish, overwrite files, commit, tag, release, install, delete, send, or navigate/change app or browser state unless the user explicitly chooses or requests that action.

- Default to Build Mode unless the user explicitly asks for release behaviour.
- Never use `latest`.
- Always use numbered versions.
- When the project is in Git, prefer Git-derived traceability by default.
- When distribution beyond local or dev use is explicitly requested, require publishable images to support both `linux/amd64` and `linux/arm64`.
- Do not let container distribution work overwrite or weaken existing Codex instructions in this file.

## Repo Workflow Notes

- Install command: `npm install`
- Development command: `npm run dev`
- Desktop development command: `npm run tauri:dev`
- Test command: `npm test`
- Lint or typecheck command: `npm run lint`
- Build command: `npm run build`
- Full verification command: `npm run verify`

## Runtime Notes

- Local app URL: `http://127.0.0.1:5184`
- API or service port: `127.0.0.1:4794`
- Registered local ports: Artifact Review Tauri/Vite UI `5184`; Artifact Review local TypeScript service `4794`; shared local Postgres dependency `5432`.
- Data directory: none established yet.
- Important environment variables: `DATABASE_URL`, `ARTIFACT_REVIEW_SERVICE_HOST`, `ARTIFACT_REVIEW_SERVICE_PORT`, `VITE_ARTIFACT_REVIEW_API_BASE`, `INVOKE_PROVIDERS_REGISTRY_URL`, `INVOKE_PROVIDERS_PROFILE`, `ARTIFACT_REVIEW_DEMO_PROVIDER_MODE`, `LOG_LEVEL`.
- External services: configured Postgres, shared invoke-providers registry service, local secret mechanism for raw provider secrets.
- Background jobs or workers: none established yet.

## Port Registry

Before adding or changing local ports, check and update `/Users/paulmarshall/Software Development/All Standards/local-port-registry.md`; record project ports in this file's Runtime Notes. After updating, run:

```bash
python3 "/Users/paulmarshall/Software Development/All Standards/scripts/check-local-port-registry.py"
```

## Verification Notes

- Use `npm run verify` for the full local verification path after dependencies are installed.
- Use `npm run doctor` when the local service is running to inspect service health.
- If browser validation is needed, use Chrome unless the user asks otherwise.

## Documentation And State

- If `handoff.md` or `HANDOFF.md` exists, read it before maintenance or implementation work.
- If `project-dossier.md` exists, use it for durable architecture and historical context.
- Keep `handoff.md` concise and current; put broader durable context in `project-dossier.md`.
- Update docs when changing user-facing behavior, workflows, setup, deployment, or verification.

## Project-Specific Constraints

- Product scope: cross-platform desktop review/editor workspace for imported `txt`, `md`, `html`, `htm`, and URL snapshot documents.
- Local-only or deployment expectations: Build Mode by default; no release packaging, publishing, or distribution unless explicitly requested.
- Authentication model: no user management, authentication, or permissions in MVP.
- Storage model: configured external/dev Postgres through `DATABASE_URL`; raw provider secrets must not be stored in Postgres.
- UI direction: dense, stable review/editor workspace with durable navigation, inline review controls, readiness surfaces, drawers, autosave, and export.
- State-machine or workflow ownership: backend-owned document workflow state through `state-workflow-runtime`; frontend renders allowed actions from the service.
- Provider boundary: Artifact Review is a target app for `invoke-providers-for-tasks`; the shared registry remains the provider catalog/profile/config source of truth.

## Agent Notes

- Inspect relevant files before editing.
- Preserve explicit user requirements and stronger project-local instructions.
- Keep changes scoped to the requested work.
- Do not commit, tag, release, publish, install dependencies, or delete files unless the user explicitly asks.
- Report verification performed and any verification that could not be run.
