# Review Workspace UI/UX Notes

## Purpose

Artifact Review should use the familiar workflow-driven queue pattern from Memo Capture, but the primary workspace is a document review/editor surface. The document being reviewed must get the largest stable area in the app.

This note records the current UI and workflow layout decisions so implementation does not drift into a queue-first three-pane layout.

## Workflow Definition Handling

- The document workflow item resource type is `artifact-review_workflow`.
- Workflow definitions are repo or user artifacts that must be explicitly imported into the app and explicitly activated.
- The app must not auto-import or auto-activate the repo-stored workflow definition.
- The active workflow owns bucket labels, bucket state membership, visible actions, action labels, and transition availability.
- The frontend renders workflow actions from backend/runtime responses rather than hardcoding action availability.

The current repo-stored definition is:

`docs/workflow/artifact-review-0.1.0-state-workflow-definition.json`

It is expected to change over time. New versions should be imported and activated through the app workflow operations UI.

## Ingestion State

`ingestion` is an internal entry state for newly imported documents while parsing and setup work completes.

UI rules:

- Do not show `ingestion` documents in the normal review list.
- Do not include `ingestion` in the visible `Needs Review` bucket unless the product decision changes.
- Show ingestion progress or failure in a separate setup/import surface, operations surface, or transient import status area.
- Once parsing completes and the workflow advances to `needs_review`, the document appears in the normal review workspace.

## Primary Layout Direction

Use an editor-first layout:

1. Compact workflow navigator on the left.
2. Full document review canvas in the center.
3. Collapsible or resizable inspector/detail panel on the right.

The Memo Capture pattern remains useful for workflow concepts, but Artifact Review should compress queue navigation so the reviewed document has room for reading, annotation, editing, AI suggestions, and export readiness.

## Left Workflow Navigator

The left side should combine workflow bucket navigation and document selection in a compact form.

Expected elements:

- Bucket list from active workflow metadata.
- Counts per bucket.
- Search/filter controls for documents.
- Dense document rows showing title, format, state/readiness, and a short excerpt.
- Runtime-provided workflow action buttons or a compact action menu per selected document.

Document rows should help identify the item quickly, not serve as the main review surface.

## Document Review Canvas

The center panel is the primary work area.

Expected elements:

- Document title, source format, save/export status, and active workflow state.
- Search, focus mode, expand/collapse, save, and export controls.
- Section navigation and section-level status.
- Reviewable components with inline controls for highlight, annotate, question, evidence, edit, and AI suggest.
- Stable scrolling, durable selection, and enough width for comfortable document reading.

The full review document should not live mainly in a floating panel. Floating panels can be used for temporary previews or secondary views, but the normal selected-document experience should keep the review canvas visible and stable.

## Right Inspector

Use the right panel for selected component or document detail.

Expected elements:

- Selected component text and metadata.
- Notes, questions, evidence, highlights, and revision history.
- AI suggestion status, accept/reject controls, task-run provenance, prompt version, provider/model, validation status, latency, and `externalSend`.
- Workflow/action audit details when relevant.

The inspector should be collapsible or resizable so the document canvas can expand during intensive reading or editing.

## Floating Panels

Floating, scrollable panels are acceptable for secondary tasks:

- quick full-document preview from a compact row
- task-run detail
- evidence detail
- suggestion comparison
- import/activation validation details

They should not become the primary place where review work happens. The main canvas should remain the default place for reading, editing, and reviewing the document.

## Responsive Behavior

Desktop and large tablet:

- Use compact navigator, central canvas, and optional inspector.
- Allow the navigator and inspector to collapse.

Narrow viewport:

- Switch to a single primary column.
- Put buckets/list, document canvas, and inspector behind tabs or segmented navigation.
- Keep the document canvas as the default selected-document view.

## Implementation Implications

- Backend workflow APIs should expose buckets and allowed actions from the active workflow.
- Document list rows should carry enough fields for identification: title, source type/format, current workflow state, excerpt, updated time, and readiness.
- Review document APIs should return full component data separately from compact list rows.
- UI state should preserve selected document, scroll position, expanded sections, selected component, and inspector collapsed state.
- Workflow import and activation UI can follow Memo Capture's Operations pattern: validate JSON, stage import, show identity/version/content hash, then require explicit activation confirmation.
