# Bootstrap Architecture

Artifact Review is bootstrapped as a single repo with three runtime surfaces:

- Tauri desktop shell for native OS integration.
- React workspace for review/editor UI.
- Local TypeScript service for persistence, workflow, provider runtime, readiness, and export APIs.

## Authority Boundaries

The TypeScript service is the authority for durable state and domain mutations. React never directly invokes providers, mutates workflow state, or writes app-owned records. Tauri handles native desktop integration only.

## Provider Boundary

Artifact Review is a target app for `invoke-providers-for-tasks`. The shared provider registry owns provider profiles, provider configs, capabilities, enabled state, health metadata, and secret references.

Artifact Review owns:

- selected provider profile setting
- task definitions
- prompt versions
- structured output schemas
- render slot mappings
- hook implementations
- task runs
- AI suggestion records
- document records and revisions
- workflow transitions

Provider output remains proposed until a user accepts or rejects it.

## Workflow Boundary

Document lifecycle state is backend-owned. The frontend requests allowed actions from the service and renders those actions. Provider hooks may store proposals, but lifecycle transitions go through named workflow APIs.

## First Implementation Slices

1. Wire migrations and repository access around the existing schema.
2. Add workflow import/activation and setup readiness.
3. Implement ingest for `txt`, then `md`, then `html`/URL snapshots.
4. Wire registry-backed provider readiness against the real registry client.
5. Implement `suggest-component-revision` with structured output validation and proposal-only mutation.
6. Implement accept/reject audit flow and export.

