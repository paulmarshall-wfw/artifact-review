import { describe, expect, it } from "vitest";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

const now = new Date("2026-06-12T00:00:00.000Z");

const componentRow = {
  id: "component-1",
  document_id: "document-1",
  kind: "paragraph_sentence",
  section_id: "root",
  source_range: { start: 0, end: 16 },
  current_text: "Original sentence.",
  original_text_hash: "hash-original",
  created_at: now,
  updated_at: now
};

const updatedComponentRevisionRow = {
  component_id: "component-1",
  component_document_id: "document-1",
  component_kind: "paragraph_sentence",
  component_section_id: "root",
  component_source_range: { start: 0, end: 16 },
  component_current_text: "Revised sentence.",
  component_original_text_hash: "hash-original",
  component_created_at: now,
  component_updated_at: now,
  revision_id: "revision-1",
  revision_component_id: "component-1",
  revision_previous_text: "Original sentence.",
  revision_revised_text: "Revised sentence.",
  revision_edit_source: "manual",
  revision_ai_suggestion_id: null,
  revision_created_at: now
};

describe("review mutation HTTP endpoints", () => {
  it("edits component text, writes an audited revision, and stores an autosave snapshot without touching versions", async () => {
    const db = createQueuedDatabase([
      [updatedComponentRevisionRow],
      [
        {
          id: "autosave-1",
          document_id: "document-1",
          snapshot: {
            action: "component_text_edited",
            componentId: "component-1",
            payload: {
              revisionId: "revision-1",
              previousText: "Original sentence.",
              revisedText: "Revised sentence.",
              editSource: "manual"
            }
          },
          created_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "PATCH", "/api/components/component-1", {
      currentText: "Revised sentence."
    });

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      component: {
        id: "component-1",
        documentId: "document-1",
        currentText: "Revised sentence.",
        sourceRange: { start: 0, end: 16 },
        originalTextHash: "hash-original"
      },
      revision: {
        id: "revision-1",
        componentId: "component-1",
        previousText: "Original sentence.",
        revisedText: "Revised sentence.",
        editSource: "manual"
      },
      autosave: {
        id: "autosave-1",
        documentId: "document-1",
        snapshot: {
          action: "component_text_edited",
          componentId: "component-1"
        }
      }
    });
    expect(db.queries[0]?.text).toContain("component_revisions");
    expect(db.queries[1]?.text).toContain("insert into autosave_snapshots");
    expect(db.queries.map((query) => query.text).join("\n")).not.toContain("update document_versions");
  });

  it("records annotations, questions, evidence, and highlights with autosave snapshots", async () => {
    const db = createQueuedDatabase([
      [componentRow],
      [{ id: "annotation-1", component_id: "component-1", body: "Tighten this claim.", created_at: now }],
      [{ id: "autosave-annotation", document_id: "document-1", snapshot: { action: "annotation_added" }, created_at: now }],
      [componentRow],
      [
        {
          id: "question-1",
          component_id: "component-1",
          body: "What is the source?",
          status: "open",
          created_at: now
        }
      ],
      [{ id: "autosave-question", document_id: "document-1", snapshot: { action: "question_added" }, created_at: now }],
      [componentRow],
      [
        {
          id: "evidence-1",
          component_id: "component-1",
          kind: "link",
          value: "https://example.test/source",
          created_at: now
        }
      ],
      [{ id: "autosave-evidence", document_id: "document-1", snapshot: { action: "evidence_added" }, created_at: now }],
      [componentRow],
      [{ component_id: "component-1", enabled: true, updated_at: now }],
      [{ id: "autosave-highlight", document_id: "document-1", snapshot: { action: "highlight_updated" }, created_at: now }]
    ]);
    const app = createTestServer(db);

    const annotation = await requestApp(app, "POST", "/api/components/component-1/annotations", {
      body: "Tighten this claim."
    });
    const question = await requestApp(app, "POST", "/api/components/component-1/questions", {
      body: "What is the source?"
    });
    const evidence = await requestApp(app, "POST", "/api/components/component-1/evidence", {
      kind: "link",
      value: "https://example.test/source"
    });
    const highlight = await requestApp(app, "PATCH", "/api/components/component-1/highlight", {
      enabled: true
    });

    expect(annotation.status).toBe(201);
    expect(annotation.body).toMatchObject({
      annotation: { id: "annotation-1", componentId: "component-1", body: "Tighten this claim." },
      autosave: { documentId: "document-1" }
    });
    expect(question.status).toBe(201);
    expect(question.body).toMatchObject({
      question: { id: "question-1", componentId: "component-1", body: "What is the source?", status: "open" }
    });
    expect(evidence.status).toBe(201);
    expect(evidence.body).toMatchObject({
      evidence: { id: "evidence-1", componentId: "component-1", kind: "link" }
    });
    expect(highlight.status).toBe(200);
    expect(highlight.body).toMatchObject({
      highlight: { componentId: "component-1", enabled: true }
    });
    expect(db.queries.filter((query) => query.text.includes("insert into autosave_snapshots"))).toHaveLength(4);
  });

  it("promotes reviewed state to a new document version while preserving the imported source snapshot", async () => {
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "needs_review",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-1",
          document_id: "document-1",
          version_number: 1,
          source_snapshot: "Original sentence.",
          current_snapshot: "Original sentence.",
          parser_metadata: { parser: "plain-text-sentences", componentCount: 1 },
          created_at: now
        }
      ],
      [
        {
          ...componentRow,
          current_text: "Revised sentence."
        }
      ],
      [{ id: "annotation-1", component_id: "component-1", body: "Tighten this claim.", created_at: now }],
      [{ id: "question-1", component_id: "component-1", body: "What is the source?", status: "open", created_at: now }],
      [
        {
          id: "evidence-1",
          component_id: "component-1",
          kind: "link",
          value: "https://example.test/source",
          created_at: now
        }
      ],
      [{ component_id: "component-1", enabled: true, updated_at: now }],
      [
        {
          id: "version-2",
          document_id: "document-1",
          version_number: 2,
          source_snapshot: "Original sentence.",
          current_snapshot: '{"snapshotType":"review-state"}',
          parser_metadata: {
            parser: "review-state-snapshot",
            savedFrom: "document-save",
            previousVersionNumber: 1,
            componentCount: 1
          },
          created_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/documents/document-1/save");

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: { id: "document-1", name: "Review.txt" },
      version: {
        id: "version-2",
        documentId: "document-1",
        versionNumber: 2,
        sourceSnapshot: "Original sentence.",
        parserMetadata: {
          parser: "review-state-snapshot",
          previousVersionNumber: 1,
          componentCount: 1
        }
      },
      snapshot: {
        type: "review-state",
        componentCount: 1,
        previousVersionNumber: 1
      }
    });

    expect(db.queries[7]?.values?.[2]).toBe(2);
    expect(db.queries[7]?.values?.[3]).toBe("Original sentence.");
    expect(JSON.parse(String(db.queries[7]?.values?.[4]))).toMatchObject({
      snapshotType: "review-state",
      document: { id: "document-1" },
      components: [{ id: "component-1", currentText: "Revised sentence." }],
      annotations: [{ id: "annotation-1" }],
      questions: [{ id: "question-1" }],
      evidenceSources: [{ id: "evidence-1" }],
      highlights: [{ componentId: "component-1", enabled: true }]
    });
  });

  it("stores AI output as a proposed suggestion without mutating component text", async () => {
    const db = createQueuedDatabase([
      [
        {
          task_key: "suggest-component-revision",
          provider_key: null,
          required_capability: "llm.generateJson",
          prompt_version: "0.1.0",
          render_slot: "component.inline.aiSuggest",
          hook_key: "store-ai-suggestion",
          prompt: { name: "suggest-component-revision" },
          schema_version: "0.1.0",
          schema: { type: "object" },
          hook_implementation_key: "store-ai-suggestion",
          hook_policy: "block_when_missing"
        }
      ],
      [componentRow],
      [
        {
          id: "task-run-1",
          task_key: "suggest-component-revision",
          provider_key: "artifact-review-demo",
          provider_profile_key: "demo",
          prompt_version: "0.1.0",
          status: "succeeded",
          validation_status: "valid",
          external_send: false,
          latency_ms: 12,
          provenance: { providerRuntime: "deterministic-demo" },
          created_at: now
        }
      ],
      [
        {
          id: "suggestion-1",
          component_id: "component-1",
          task_run_id: "task-run-1",
          proposed_text: "Original sentence.",
          rationale: "No substantive rewrite was needed; the proposal preserves the current component text.",
          confidence: "0.620",
          warnings: [],
          status: "proposed",
          created_at: now,
          decided_at: null
        }
      ]
    ]);

    const response = await requestApp(
      createTestServer(db, { ARTIFACT_REVIEW_DEMO_PROVIDER_MODE: "true" }),
      "POST",
      "/api/components/component-1/ai-suggestions"
    );

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      suggestion: {
        id: "suggestion-1",
        componentId: "component-1",
        taskRunId: "task-run-1",
        status: "proposed"
      },
      taskRun: {
        id: "task-run-1",
        taskKey: "suggest-component-revision",
        validationStatus: "valid",
        externalSend: false
      }
    });
    const queryText = db.queries.map((query) => query.text).join("\n");
    expect(queryText).toContain("insert into task_runs");
    expect(queryText).toContain("insert into ai_suggestions");
    expect(queryText).not.toContain("update review_components");
    expect(queryText).not.toContain("component_revisions");
  });

  it("accepts a proposed AI suggestion by creating an audited component revision", async () => {
    const proposedSuggestionRow = {
      id: "suggestion-1",
      component_id: "component-1",
      task_run_id: "task-run-1",
      proposed_text: "Accepted revision.",
      rationale: "Clearer phrasing.",
      confidence: "0.810",
      warnings: [],
      status: "proposed",
      created_at: now,
      decided_at: null
    };
    const db = createQueuedDatabase([
      [proposedSuggestionRow],
      [
        {
          component_id: "component-1",
          component_document_id: "document-1",
          component_kind: "paragraph_sentence",
          component_section_id: "root",
          component_source_range: { start: 0, end: 16 },
          component_current_text: "Accepted revision.",
          component_original_text_hash: "hash-original",
          component_created_at: now,
          component_updated_at: now,
          revision_id: "revision-accepted",
          revision_component_id: "component-1",
          revision_previous_text: "Original sentence.",
          revision_revised_text: "Accepted revision.",
          revision_edit_source: "accepted_ai_suggestion",
          revision_ai_suggestion_id: "suggestion-1",
          revision_created_at: now,
          suggestion_id: "suggestion-1",
          suggestion_component_id: "component-1",
          suggestion_task_run_id: "task-run-1",
          suggestion_proposed_text: "Accepted revision.",
          suggestion_rationale: "Clearer phrasing.",
          suggestion_confidence: "0.810",
          suggestion_warnings: [],
          suggestion_status: "accepted",
          suggestion_created_at: now,
          suggestion_decided_at: now
        }
      ],
      [{ id: "autosave-accept", document_id: "document-1", snapshot: { action: "ai_suggestion_accepted" }, created_at: now }]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ai-suggestions/suggestion-1/accept");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      suggestion: {
        id: "suggestion-1",
        componentId: "component-1",
        status: "accepted"
      },
      component: {
        id: "component-1",
        currentText: "Accepted revision."
      },
      revision: {
        id: "revision-accepted",
        editSource: "accepted_ai_suggestion",
        aiSuggestionId: "suggestion-1",
        previousText: "Original sentence.",
        revisedText: "Accepted revision."
      },
      autosave: {
        id: "autosave-accept",
        documentId: "document-1"
      }
    });

    const queryText = db.queries.map((query) => query.text).join("\n");
    expect(queryText).toContain("update review_components");
    expect(queryText).toContain("component_revisions");
    expect(queryText).toContain("set status = 'accepted'");
    expect(queryText).toContain("insert into autosave_snapshots");
    expect(queryText).not.toContain("update document_versions");
  });

  it("rejects a proposed AI suggestion without mutating component text", async () => {
    const proposedSuggestionRow = {
      id: "suggestion-1",
      component_id: "component-1",
      task_run_id: "task-run-1",
      proposed_text: "Rejected revision.",
      rationale: "Clearer phrasing.",
      confidence: "0.810",
      warnings: [],
      status: "proposed",
      created_at: now,
      decided_at: null
    };
    const db = createQueuedDatabase([
      [proposedSuggestionRow],
      [componentRow],
      [{ ...proposedSuggestionRow, status: "rejected", decided_at: now }],
      [{ id: "autosave-reject", document_id: "document-1", snapshot: { action: "ai_suggestion_rejected" }, created_at: now }]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ai-suggestions/suggestion-1/reject");

    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({
      suggestion: {
        id: "suggestion-1",
        componentId: "component-1",
        status: "rejected",
        proposedText: "Rejected revision."
      },
      autosave: {
        id: "autosave-reject",
        documentId: "document-1"
      }
    });

    const queryText = db.queries.map((query) => query.text).join("\n");
    expect(queryText).toContain("update ai_suggestions");
    expect(queryText).toContain("insert into autosave_snapshots");
    expect(queryText).not.toContain("update review_components");
    expect(queryText).not.toContain("component_revisions");
    expect(queryText).not.toContain("update document_versions");
  });
});
