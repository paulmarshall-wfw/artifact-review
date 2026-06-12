import { afterEach, describe, expect, it, vi } from "vitest";
import workflowFixture from "../docs/workflow/artifact-review-0.1.0-state-workflow-definition.json";
import { createQueuedDatabase, createTestServer, requestApp } from "./helpers/http";

describe("file ingest HTTP endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

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

  it("creates markdown heading, sentence, and bullet components for md files", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const source = "# Title\n\nIntro sentence. More detail.\n- First point\n- Second point\n";
    const db = createQueuedDatabase([
      [{ value: workflowFixture }],
      [
        {
          id: "document-md-1",
          project_id: null,
          name: "Draft.md",
          source_type: "file",
          original_format: "md",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-md-1",
          document_id: "document-md-1",
          version_number: 1,
          source_snapshot: source,
          current_snapshot: source,
          parser_metadata: { parser: "markdown-components", componentCount: 5 },
          created_at: now
        }
      ],
      [
        {
          id: "markdown_heading_0_2c70e12b7a06",
          document_id: "document-md-1",
          kind: "markdown_heading",
          section_id: "section-0",
          source_range: { start: 2, end: 7 },
          current_text: "Title",
          original_text_hash: "hash-title",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "sentence_1_b01f6c6c89b4",
          document_id: "document-md-1",
          kind: "paragraph_sentence",
          section_id: "section-0",
          source_range: { start: 9, end: 24 },
          current_text: "Intro sentence.",
          original_text_hash: "hash-intro",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "sentence_2_876d0fbbf525",
          document_id: "document-md-1",
          kind: "paragraph_sentence",
          section_id: "section-0",
          source_range: { start: 25, end: 37 },
          current_text: "More detail.",
          original_text_hash: "hash-detail",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "markdown_bullet_3_039c6e4ee2fd",
          document_id: "document-md-1",
          kind: "markdown_bullet",
          section_id: "section-0",
          source_range: { start: 40, end: 51 },
          current_text: "First point",
          original_text_hash: "hash-first",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "markdown_bullet_4_901b8a2724f1",
          document_id: "document-md-1",
          kind: "markdown_bullet",
          section_id: "section-0",
          source_range: { start: 54, end: 66 },
          current_text: "Second point",
          original_text_hash: "hash-second",
          created_at: now,
          updated_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/file", {
      name: "Draft.md",
      format: "md",
      content: source
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: {
        id: "document-md-1",
        name: "Draft.md",
        sourceType: "file",
        originalFormat: "md",
        currentWorkflowItemRef: "ingestion"
      },
      version: {
        id: "version-md-1",
        documentId: "document-md-1",
        versionNumber: 1
      },
      components: [
        { kind: "markdown_heading", sourceRange: { start: 2, end: 7 }, currentText: "Title" },
        { kind: "paragraph_sentence", sourceRange: { start: 9, end: 24 }, currentText: "Intro sentence." },
        { kind: "paragraph_sentence", sourceRange: { start: 25, end: 37 }, currentText: "More detail." },
        { kind: "markdown_bullet", sourceRange: { start: 40, end: 51 }, currentText: "First point" },
        { kind: "markdown_bullet", sourceRange: { start: 54, end: 66 }, currentText: "Second point" }
      ],
      workflow: {
        currentState: "ingestion",
        actions: []
      }
    });
    expect(db.queries[1]?.values).toEqual([
      expect.any(String),
      null,
      "Draft.md",
      "file",
      "md",
      "ingestion"
    ]);
    expect(db.queries[2]?.values).toEqual([
      expect.any(String),
      "document-md-1",
      1,
      source,
      source,
      { parser: "markdown-components", componentCount: 5 }
    ]);
    const sectionId = db.queries[3]?.values?.[3];
    expect(db.queries[3]?.values?.slice(2, 7)).toEqual([
      "markdown_heading",
      sectionId,
      { start: 2, end: 7 },
      "Title",
      expect.any(String)
    ]);
    expect(db.queries[4]?.values?.slice(2, 7)).toEqual([
      "paragraph_sentence",
      sectionId,
      { start: 9, end: 24 },
      "Intro sentence.",
      expect.any(String)
    ]);
    expect(db.queries[6]?.values?.slice(2, 7)).toEqual([
      "markdown_bullet",
      sectionId,
      { start: 40, end: 51 },
      "First point",
      expect.any(String)
    ]);
  });

  it("creates sentence, list item, and table row components for htm files", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const source =
      "<h1>Review Plan</h1><p>First sentence. Second sentence.</p><ul><li>Check facts</li></ul><table><tbody><tr><td>Clause A</td><td>Ready.</td></tr></tbody></table>";
    const db = createQueuedDatabase([
      [{ value: workflowFixture }],
      [
        {
          id: "document-html-1",
          project_id: null,
          name: "Review.htm",
          source_type: "file",
          original_format: "htm",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-html-1",
          document_id: "document-html-1",
          version_number: 1,
          source_snapshot: source,
          current_snapshot: source,
          parser_metadata: { parser: "html-components", componentCount: 4 },
          created_at: now
        }
      ],
      [
        {
          id: "sentence_0_a5c231e1d83d",
          document_id: "document-html-1",
          kind: "paragraph_sentence",
          section_id: "html-section-1",
          source_range: { start: source.indexOf("First"), end: source.indexOf("sentence.") + "sentence.".length },
          current_text: "First sentence.",
          original_text_hash: "hash-first",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "sentence_1_5fd0e758a591",
          document_id: "document-html-1",
          kind: "paragraph_sentence",
          section_id: "html-section-1",
          source_range: { start: source.indexOf("Second"), end: source.indexOf("sentence.</p>") + "sentence.".length },
          current_text: "Second sentence.",
          original_text_hash: "hash-second",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "html_list_item_2_010c54952081",
          document_id: "document-html-1",
          kind: "html_list_item",
          section_id: "html-section-1",
          source_range: { start: source.indexOf("Check"), end: source.indexOf("facts") + "facts".length },
          current_text: "Check facts",
          original_text_hash: "hash-list",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "table_row_3_13d4d858c123",
          document_id: "document-html-1",
          kind: "table_row",
          section_id: "html-section-1",
          source_range: { start: source.indexOf("Clause A"), end: source.indexOf("Ready.") + "Ready.".length },
          current_text: "Clause A Ready.",
          original_text_hash: "hash-row",
          created_at: now,
          updated_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/file", {
      name: "Review.htm",
      format: "htm",
      content: source
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: {
        id: "document-html-1",
        name: "Review.htm",
        sourceType: "file",
        originalFormat: "htm",
        currentWorkflowItemRef: "ingestion"
      },
      version: {
        id: "version-html-1",
        documentId: "document-html-1",
        versionNumber: 1
      },
      components: [
        { kind: "paragraph_sentence", sourceRange: { start: source.indexOf("First"), end: source.indexOf("sentence.") + "sentence.".length }, currentText: "First sentence." },
        { kind: "paragraph_sentence", sourceRange: { start: source.indexOf("Second"), end: source.indexOf("sentence.</p>") + "sentence.".length }, currentText: "Second sentence." },
        { kind: "html_list_item", sourceRange: { start: source.indexOf("Check"), end: source.indexOf("facts") + "facts".length }, currentText: "Check facts" },
        { kind: "table_row", sourceRange: { start: source.indexOf("Clause A"), end: source.indexOf("Ready.") + "Ready.".length }, currentText: "Clause A Ready." }
      ],
      workflow: {
        currentState: "ingestion",
        actions: []
      }
    });
    expect(db.queries[1]?.values).toEqual([
      expect.any(String),
      null,
      "Review.htm",
      "file",
      "htm",
      "ingestion"
    ]);
    expect(db.queries[2]?.values).toEqual([
      expect.any(String),
      "document-html-1",
      1,
      source,
      source,
      { parser: "html-components", componentCount: 4 }
    ]);
    const sectionId = db.queries[3]?.values?.[3];
    expect(sectionId).not.toBe("root");
    expect(db.queries[3]?.values?.slice(2, 7)).toEqual([
      "paragraph_sentence",
      sectionId,
      { start: source.indexOf("First"), end: source.indexOf("sentence.") + "sentence.".length },
      "First sentence.",
      expect.any(String)
    ]);
    expect(db.queries[5]?.values?.slice(2, 7)).toEqual([
      "html_list_item",
      sectionId,
      { start: source.indexOf("Check"), end: source.indexOf("facts") + "facts".length },
      "Check facts",
      expect.any(String)
    ]);
    expect(db.queries[6]?.values?.slice(2, 7)).toEqual([
      "table_row",
      sectionId,
      { start: source.indexOf("Clause A"), end: source.indexOf("Ready.") + "Ready.".length },
      "Clause A Ready.",
      expect.any(String)
    ]);
  });
});

describe("URL ingest HTTP endpoint", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("blocks URL ingest until a document workflow is active", async () => {
    const db = createQueuedDatabase([[]]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/url", {
      url: "https://example.test/review",
      snapshotHtml: "<p>Review this sentence.</p>"
    });

    expect(response.status).toBe(409);
    expect(response.body).toEqual({
      error: "workflow_not_configured",
      message: "Import or activate a user-provided document workflow before ingest."
    });
  });

  it("creates a URL snapshot document, first version, components, and initial workflow state from supplied HTML", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const source = "<h1>Snapshot</h1><p>First URL sentence.</p><ul><li>Check link</li></ul>";
    const db = createQueuedDatabase([
      [{ value: workflowFixture }],
      [
        {
          id: "document-url-1",
          project_id: null,
          name: "Example Review",
          source_type: "url",
          original_format: "url_snapshot",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-url-1",
          document_id: "document-url-1",
          version_number: 1,
          source_snapshot: source,
          current_snapshot: source,
          parser_metadata: {
            parser: "url-html-snapshot",
            componentCount: 2,
            sourceUrl: "https://example.test/review",
            snapshotSource: "provided"
          },
          created_at: now
        }
      ],
      [
        {
          id: "sentence_0_3ea074f91cf4",
          document_id: "document-url-1",
          kind: "paragraph_sentence",
          section_id: "html-section-url-1",
          source_range: { start: source.indexOf("First"), end: source.indexOf("sentence.") + "sentence.".length },
          current_text: "First URL sentence.",
          original_text_hash: "hash-url-sentence",
          created_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "html_list_item_1_7c5dfaa17362",
          document_id: "document-url-1",
          kind: "html_list_item",
          section_id: "html-section-url-1",
          source_range: { start: source.indexOf("Check"), end: source.indexOf("link") + "link".length },
          current_text: "Check link",
          original_text_hash: "hash-url-list",
          created_at: now,
          updated_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/url", {
      url: "https://example.test/review",
      name: "Example Review",
      snapshotHtml: source
    });

    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      document: {
        id: "document-url-1",
        name: "Example Review",
        sourceType: "url",
        originalFormat: "url_snapshot",
        currentWorkflowItemRef: "ingestion"
      },
      version: {
        id: "version-url-1",
        documentId: "document-url-1",
        versionNumber: 1
      },
      components: [
        {
          documentId: "document-url-1",
          kind: "paragraph_sentence",
          sourceRange: { start: source.indexOf("First"), end: source.indexOf("sentence.") + "sentence.".length },
          currentText: "First URL sentence."
        },
        {
          documentId: "document-url-1",
          kind: "html_list_item",
          sourceRange: { start: source.indexOf("Check"), end: source.indexOf("link") + "link".length },
          currentText: "Check link"
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
      "Example Review",
      "url",
      "url_snapshot",
      "ingestion"
    ]);
    expect(db.queries[2]?.values).toEqual([
      expect.any(String),
      "document-url-1",
      1,
      source,
      source,
      {
        parser: "url-html-snapshot",
        componentCount: 2,
        sourceUrl: "https://example.test/review",
        snapshotSource: "provided"
      }
    ]);
  });

  it("fetches URL snapshot HTML when no captured snapshot is supplied", async () => {
    const now = new Date("2026-06-12T00:00:00.000Z");
    const source = "<main><p>Fetched sentence.</p></main>";
    const fetchMock = vi.fn(async () => new Response(source, {
      status: 200,
      headers: { "content-type": "text/html; charset=utf-8" }
    }));
    vi.stubGlobal("fetch", fetchMock);
    const db = createQueuedDatabase([
      [{ value: workflowFixture }],
      [
        {
          id: "document-fetched-url-1",
          project_id: null,
          name: "https://example.test/fetched",
          source_type: "url",
          original_format: "url_snapshot",
          current_workflow_item_ref: "ingestion",
          ingested_at: now,
          updated_at: now
        }
      ],
      [
        {
          id: "version-fetched-url-1",
          document_id: "document-fetched-url-1",
          version_number: 1,
          source_snapshot: source,
          current_snapshot: source,
          parser_metadata: {
            parser: "url-html-snapshot",
            componentCount: 1,
            sourceUrl: "https://example.test/fetched",
            snapshotSource: "fetched",
            status: 200,
            contentType: "text/html; charset=utf-8",
            finalUrl: "https://example.test/fetched"
          },
          created_at: now
        }
      ],
      [
        {
          id: "sentence_0_a86b455067b9",
          document_id: "document-fetched-url-1",
          kind: "paragraph_sentence",
          section_id: "root",
          source_range: { start: source.indexOf("Fetched"), end: source.indexOf("sentence.") + "sentence.".length },
          current_text: "Fetched sentence.",
          original_text_hash: "hash-fetched",
          created_at: now,
          updated_at: now
        }
      ]
    ]);

    const response = await requestApp(createTestServer(db), "POST", "/api/ingest/url", {
      url: "https://example.test/fetched"
    });

    expect(response.status).toBe(201);
    expect(fetchMock).toHaveBeenCalledWith("https://example.test/fetched", expect.objectContaining({ redirect: "follow" }));
    expect(db.queries[2]?.values).toEqual([
      expect.any(String),
      "document-fetched-url-1",
      1,
      source,
      source,
      {
        parser: "url-html-snapshot",
        componentCount: 1,
        sourceUrl: "https://example.test/fetched",
        snapshotSource: "fetched",
        status: 200,
        contentType: "text/html; charset=utf-8",
        finalUrl: "https://example.test/fetched"
      }
    ]);
  });
});
