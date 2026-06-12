# Data Model

Artifact Review stores app-owned domain state in Postgres through `DATABASE_URL`. The shared provider registry remains the source of truth for provider profiles, provider configs, enabled state, capabilities, health metadata, and secret references.

## Current Migration Files

- `service/migrations/001_initial_schema.sql`
- `service/migrations/002_review_and_provider_records.sql`

There is not yet a migration runner. Wiring one is the first implementation slice before repository work.

## Document And Review Tables

| Table | Ownership |
| --- | --- |
| `projects` | Optional grouping metadata for reviewed documents. |
| `documents` | Imported document identity, source type, original format, workflow item reference, and timestamps. |
| `document_versions` | Immutable source/current snapshots and parser metadata by document version number. |
| `review_components` | Stable addressable review units with source range, current text, and original hash. |
| `component_revisions` | Audited text changes from manual edits or accepted AI suggestions. |
| `annotations` | Reviewer notes linked to components. |
| `questions` | Open or resolved reviewer questions linked to components. |
| `evidence_sources` | Component evidence records such as source, link, repo path, screenshot path, or note. |
| `highlights` | Component-level emphasis state. |
| `autosave_snapshots` | Staged document review snapshots created during editing and review. |

## Provider And Task Tables

| Table | Ownership |
| --- | --- |
| `app_settings` | App-specific settings such as selected provider profile key. |
| `task_definitions` | App-owned provider-backed task configuration. |
| `prompt_versions` | Versioned app prompts for provider-backed tasks. |
| `structured_output_schemas` | App-owned JSON schemas for provider outputs. |
| `processing_hooks` | App-owned hook metadata and missing-hook policy. |
| `render_slot_mappings` | Mapping from UI render slot to task key. |
| `task_runs` | Invocation provenance, status, validation state, external-send flag, latency, and provider profile. |
| `provider_readiness_observations` | Cached or historical readiness diagnostics. |
| `ai_suggestions` | Proposed provider outputs with `proposed`, `accepted`, or `rejected` status. |

## Provider Boundary Rules

- Do not copy shared provider configs into Artifact Review Postgres as authoritative records.
- Store selected profile keys and task-run provenance, not raw provider secrets.
- Resolve raw secrets only through the local secret mechanism at invocation time.
- If the saved selected profile is missing from the registry, block provider-backed actions and keep the saved key visible for repair.
- `INVOKE_PROVIDERS_PROFILE` is first-run bootstrap only and must not override a saved selected profile.
- Deterministic provider behavior is allowed only through explicit test/demo mode.

## Workflow Boundary

Artifact Review owns document workflow state in its own database through a `state-workflow-runtime` storage adapter that has not been implemented yet.

The repo-stored workflow definition is an importable fixture:

`docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`

It must not be auto-imported or auto-activated. A user action should import and activate it through the app workflow operations surface.

The `ingestion` state is internal. It is an entry state for parsing/setup work and should not appear in normal visible review buckets.

## First Repository Responsibilities

The first data implementation slice should add:

- migration runner
- database connection lifecycle
- repository interfaces for documents, versions, components, suggestions, task runs, and app settings
- deterministic fixtures for parser and repository tests
- workflow storage adapter for document lifecycle state
