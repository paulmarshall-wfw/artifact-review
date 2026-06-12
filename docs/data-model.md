# Data Model

Artifact Review stores app-owned domain state in Postgres through `DATABASE_URL`. The shared provider registry remains the source of truth for provider profiles, provider configs, enabled state, capabilities, health metadata, and secret references.

## Current Migration Files

- `service/migrations/001_initial_schema.sql`
- `service/migrations/002_review_and_provider_records.sql`

`service/src/db/migrations.ts` now loads numbered SQL files in lexical order, records applied checksums in `schema_migrations`, and applies unapplied migrations inside database transactions during service startup when `DATABASE_URL` is configured.

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

Artifact Review owns document workflow state in its own database. Active document workflow definitions are currently stored under the app setting key `activeDocumentWorkflowDefinition`; document rows store their current workflow state in `documents.current_workflow_item_ref`.

The file ingest path now creates a document row, version `1`, and stable review components in one service operation for `txt` and `md` files. Plain text creates sentence components. Markdown creates heading, sentence, and bullet components while using headings as section anchors for following content. Review components preserve source offsets in `review_components.source_range` and keep the original text hash beside the current text so later review mutations can be audited against the imported source.

The `state-workflow-runtime` storage adapter has not been installed or wired yet. Until then, the service validates the same explicit workflow shape and derives allowed user actions from the active app-owned definition.

The repo-stored workflow definition is an importable fixture:

`docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`

It must not be auto-imported or auto-activated. A user action should import and activate it through the app workflow operations surface.

The `ingestion` state is internal. It is an entry state for parsing/setup work and should not appear in normal visible review buckets.

## First Repository Responsibilities

The first data implementation slice now includes:

- migration runner
- database connection lifecycle
- repository interfaces for documents, versions, components, suggestions, task runs, and app settings
- deterministic repository and migration-loader tests that run without a shared dev database

Still remaining after the initial persistence foundation and first `txt`/`md` ingest:

- workflow storage adapter for document lifecycle state
- `html`, `htm`, and URL snapshot ingest
- review mutation endpoints
