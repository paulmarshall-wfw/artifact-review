import { describe, expect, it } from "vitest";
import { applyReviewedComponentText, buildSameFormatExport } from "../service/src/domain/exporter";
import type { DocumentSummary, ReviewComponent } from "../service/src/repositories/documents";

const now = new Date("2026-06-13T00:00:00.000Z");

function document(overrides: Partial<DocumentSummary> = {}): DocumentSummary {
  return {
    id: "document-1",
    projectId: null,
    name: "Draft.txt",
    sourceType: "file",
    originalFormat: "txt",
    currentWorkflowItemRef: "review",
    ingestedAt: now,
    updatedAt: now,
    ...overrides
  };
}

function component(id: string, start: number, end: number, currentText: string): ReviewComponent {
  return {
    id,
    documentId: "document-1",
    kind: "paragraph_sentence",
    sectionId: "root",
    sourceRange: { start, end },
    currentText,
    originalTextHash: `hash-${id}`,
    createdAt: now,
    updatedAt: now
  };
}

describe("same-format export assembly", () => {
  it("replaces original txt ranges with reviewed component text", () => {
    const source = "First sentence. Second sentence.";

    expect(
      applyReviewedComponentText(source, [
        component("component-1", 0, 15, "Opening sentence."),
        component("component-2", 16, 32, "Revised second sentence.")
      ])
    ).toBe("Opening sentence. Revised second sentence.");
  });

  it("preserves markdown syntax around reviewed ranges and appends markdown review notes", () => {
    const source = "# Title\n\n- First point\n";
    const exportResult = buildSameFormatExport(
      {
        document: document({ name: "Draft.md", originalFormat: "md" }),
        versions: [
          {
            id: "version-1",
            documentId: "document-1",
            versionNumber: 1,
            sourceSnapshot: source,
            currentSnapshot: source,
            parserMetadata: { parser: "markdown-components" },
            createdAt: now
          }
        ],
        components: [
          component("heading", 2, 7, "Reviewed Title"),
          { ...component("bullet", 11, 22, "Reviewed point"), kind: "markdown_bullet" }
        ],
        review: {
          annotations: [{ id: "annotation-1", componentId: "bullet", body: "Check evidence.", createdAt: now }],
          questions: [],
          evidenceSources: [],
          highlights: [],
          aiSuggestions: []
        }
      },
      now
    );

    expect(exportResult.fileName).toBe("Draft.md");
    expect(exportResult.content).toContain("# Reviewed Title");
    expect(exportResult.content).toContain("- Reviewed point");
    expect(exportResult.content).toContain("## Artifact Review Notes");
    expect(exportResult.content).toContain("Annotation: Check evidence.");
  });

  it("injects review metadata into html and URL snapshot exports", () => {
    const source = "<html><body><p>Original text.</p></body></html>";
    const exportResult = buildSameFormatExport(
      {
        document: document({ name: "https-example", sourceType: "url", originalFormat: "url_snapshot" }),
        versions: [
          {
            id: "version-1",
            documentId: "document-1",
            versionNumber: 1,
            sourceSnapshot: source,
            currentSnapshot: source,
            parserMetadata: { parser: "url-html-snapshot", sourceUrl: "https://example.test" },
            createdAt: now
          }
        ],
        components: [component("html-component", 15, 29, "Reviewed text.")],
        review: {
          annotations: [],
          questions: [{ id: "question-1", componentId: "html-component", body: "Clarify source?", status: "open", createdAt: now }],
          evidenceSources: [],
          highlights: [{ componentId: "html-component", enabled: true, updatedAt: now }],
          aiSuggestions: []
        }
      },
      now
    );

    expect(exportResult.fileName).toBe("https-example.html");
    expect(exportResult.contentType).toContain("text/html");
    expect(exportResult.content).toContain("<p>Reviewed text.</p>");
    expect(exportResult.content).toContain('data-artifact-review-notes="true"');
    expect(exportResult.content).toContain("artifact-review-metadata");
    expect(exportResult.reviewBundle.fileName).toBe("https-example.review-bundle.json");
  });
});
