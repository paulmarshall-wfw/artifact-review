import { describe, expect, it } from "vitest";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("file ingest HTTP endpoint", () => {
  it("blocks file ingest until a document workflow is active", async () => {
    const db = createQueuedDatabase([[]]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/file", {
      name: "Draft.txt",
      format: "txt",
      content: "Review this sentence."
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "workflow_not_configured",
      message: "Import or activate a user-provided document workflow before ingest."
    });
  });

  it("creates a document, first version, components, and initial workflow state for txt files", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const db = createQueuedDatabase([
      [{ value: workflowFixture }],
      [
        {
          id: "document-1",
          project_id: null,
          name: "Draft.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-1",
          document_id: "document-1",
          version_number: 1,
          source_snapshot: "First sentence. Second one.",
          current_snapshot: "First sentence. Second one.",
          parser_metadata: { parser: "plain-text-sentences", componentCount: 2 },
          created_at: now
        }
      ],
      [
        {
          id: "sentence_0_7d4a34b3b6c4",
          document_id: "document-1",
          kind: "paragraph_sentence",
          section_id: "root",
          source_range: { start: 0, end: 15 },
          current_text: "First sentence.",
          original_text_hash: "hash-1",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "sentence_1_8ab271ae2122",
          document_id: "document-1",
          kind: "paragraph_sentence",
          section_id: "root",
          source_range: { start: 16, end: 27 },
          current_text: "Second one.",
          original_text_hash: "hash-2",
          created_at: now,
          updated_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/file", {
      name: "Draft.txt",
      format: "txt",
      content: "First sentence. Second one."
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: {
        id: "document-1",
        name: "Draft.txt",
        sourceType: "file",
        originalFormat: "txt",
        currentWorkflowItemRef: "ingestion"
      },
      version: {
        id: "version-1",
        documentId: "document-1",
        versionNumber: 1
      },
      components: [
        {
          documentId: "document-1",
          kind: "paragraph_sentence",
          sourceRange: { start: 0, end: 15 },
          currentText: "First sentence."
        },
        {
          documentId: "document-1",
          kind: "paragraph_sentence",
          sourceRange: { start: 16, end: 27 },
          currentText: "Second one."
        }
      ],
      workflow: {
        currentState: "ingestion",
        actions: []
      }
    });
    expect(db.queries[1]?.values).toEqual([
      expect.any(String),
      null,
      "Draft.txt",
      "file",
      "txt",
      "ingestion"
    ]);
    expect(db.queries[2]?.values).toEqual([
      expect.any(String),
      "document-1",
      1,
      "First sentence. Second one.",
      "First sentence. Second one.",
      { parser: "plain-text-sentences", componentCount: 2 }
    ]);
    expect(db.queries[3]?.values?.slice(3, 7)).toEqual([
      "root",
      { start: 0, end: 15 },
      "First sentence.",
      expect.any(String)
    ]);
    expect(db.queries[4]?.values?.slice(3, 7)).toEqual([
      "root",
      { start: 16, end: 27 },
      "Second one.",
      expect.any(String)
    ]);
  });
});
