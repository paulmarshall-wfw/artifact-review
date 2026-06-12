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
});
