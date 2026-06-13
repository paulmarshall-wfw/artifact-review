# Data Model

Artifact Review stores app-owned domain state in Postgres through `DATABASE_URL`. The shared provider registry remains the source of truth for provider profiles, provider configs, enabled state, capabilities, health metadata, and secret references.

## Current Migration Files

- `service/migrations/001_initial_schema.sql`
- `service/migrations/002_review_and_provider_records.sql`
- `service/migrations/003_provider_task_assets.sql`

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

`003_provider_task_assets.sql` seeds the app-owned MVP task assets:

- `suggest-component-revision` for component inline AI suggestions.
- `summarize-section-findings` for section-level summaries.
- `draft-review-note` for component drawer note drafts.

Each seeded task has a prompt version, structured output schema, render slot, and processing hook record. The `suggest-component-revision` hook stores proposed `ai_suggestions` only; accepting or rejecting suggestions is a separate user action.

## Workflow Boundary

Artifact Review owns document workflow state in its own database. Active document workflow definitions are currently stored under the app setting key `activeDocumentWorkflowDefinition`; document rows store their current workflow state in `documents.current_workflow_item_ref`.

The ingest path now creates a document row, version `1`, and stable review components in one service operation for local `txt`, `md`, `html`, and `htm` files plus URL snapshots. Plain text creates sentence components. Markdown creates heading, sentence, and bullet components while using headings as section anchors for following content. HTML, HTM, and URL snapshots create paragraph sentence, list item, and table body row components while using headings as section anchors rather than inline review targets. URL snapshots store `documents.source_type = "url"`, `documents.original_format = "url_snapshot"`, and parser metadata containing the source URL, snapshot source (`provided` or `fetched`), and fetch metadata when applicable. Review components preserve source offsets in `review_components.source_range` and keep the original text hash beside the current text so later review mutations can be audited against the imported source.

Review mutation endpoints now write app-owned review records through the service boundary:

- `PATCH /api/components/:componentId` updates `review_components.current_text` and creates a `component_revisions` audit row.
- Annotation, question, evidence, and highlight endpoints write to their matching review tables after confirming the component exists.
- `POST /api/ai-suggestions/:suggestionId/accept` applies a proposed suggestion through an audited `component_revisions` row and records the AI suggestion ID on that revision.
- `POST /api/ai-suggestions/:suggestionId/reject` updates suggestion decision state while preserving history and leaving component text untouched.
- Each review mutation writes an `autosave_snapshots` row with the changed component ID, source mapping, current text, and mutation payload.
- Autosave snapshots do not mutate `document_versions`; imported source snapshots remain immutable.
- `POST /api/documents/:documentId/save` creates a new `document_versions` row, preserves the first imported `source_snapshot`, and stores the reviewed component/review-record state as a JSON `current_snapshot`.
- `POST /api/documents/:documentId/export` reconstructs same-format reviewed output from the imported `source_snapshot` plus current review components. `txt` and `md` exports append review notes in matching text formats; `html`, `htm`, and URL snapshot exports embed review notes and JSON metadata in the HTML. When enabled, the optional JSON review bundle carries document, source/latest version, component, and review-record data beside the reviewed artifact.

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

Still remaining after the initial persistence foundation and ingest slices:

- workflow storage adapter for document lifecycle state
- real provider adapter execution beyond deterministic demo suggestions
- same-format export
