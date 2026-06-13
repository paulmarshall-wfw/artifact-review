import { describe, expect, it } from "vitest";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

const now = new Date("2026-06-13T00:00:00.000Z");

describe("document export HTTP endpoint", () => {
  it("returns same-format reviewed output and an optional JSON review bundle", async () => {
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "review",
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
          id: "component-1",
          document_id: "document-1",
          kind: "paragraph_sentence",
          section_id: "root",
          source_range: { start: 0, end: 18 },
          current_text: "Reviewed sentence.",
          original_text_hash: "hash-original",
          created_at: now,
          updated_at: now
        }
      ],
      [{ id: "annotation-1", component_id: "component-1", body: "Looks ready.", created_at: now }],
      [],
      [],
      [],
      []
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/documents/document-1/export", {
      includeReviewBundle: true
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: { id: "document-1", name: "Review.txt" },
      written: false,
      export: {
        format: "txt",
        fileName: "Review.txt",
        contentType: "text/plain; charset=utf-8",
        path: null
      },
      reviewBundle: {
        fileName: "Review.review-bundle.json",
        contentType: "application/json",
        path: null
      }
    });

    const body = response.body as {
      export: { content: string };
      reviewBundle: { content: string };
    };
    expect(body.export.content).toContain("Reviewed sentence.");
    expect(body.export.content).toContain("Annotation: Looks ready.");
    expect(JSON.parse(body.reviewBundle.content)).toMatchObject({
      bundleType: "artifact-review-review-bundle",
      document: { id: "document-1" },
      components: [{ id: "component-1", currentText: "Reviewed sentence." }],
      review: { annotations: [{ id: "annotation-1" }] }
    });
  });

  it("blocks export when the document has no imported source version", async () => {
    const db = createQueuedDatabase([
      [
        {
          id: "document-1",
          project_id: null,
          name: "Review.txt",
          source_type: "file",
          original_format: "txt",
          current_workflow_item_ref: "review",
          ingested_at: now,
          updated_at: now
        }
      ],
      [],
      [],
      [],
      [],
      [],
      [],
      []
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/documents/document-1/export", {
      includeReviewBundle: false
    });

    expect(response.status).toBe(409);
    expect(response.body).toMatchObject({
      error: "export_assembly_failed",
      documentId: "document-1"
    });
  });
});
