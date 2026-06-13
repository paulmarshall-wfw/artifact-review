import type { AiSuggestion } from "../repositories/aiSuggestions.js";
import type { DocumentSummary, DocumentVersion, ReviewComponent } from "../repositories/documents.js";
import type { Annotation, EvidenceSource, Highlight, Question } from "../repositories/review.js";

type SourceRange = {
  start: number;
  end: number;
};

export type ExportReviewRecords = {
  annotations: Annotation[];
  questions: Question[];
  evidenceSources: EvidenceSource[];
  highlights: Highlight[];
  aiSuggestions: AiSuggestion[];
};

export type ExportDocumentData = {
  document: DocumentSummary;
  versions: DocumentVersion[];
  components: ReviewComponent[];
  review: ExportReviewRecords;
};

export type ReviewBundle = {
  fileName: string;
  contentType: "application/json";
  content: string;
};

export type SameFormatExport = {
  format: "txt" | "md" | "html" | "htm" | "url_snapshot";
  fileName: string;
  contentType: string;
  content: string;
  reviewBundle: ReviewBundle;
};

export class ExportAssemblyError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportAssemblyError";
  }
}

export function buildSameFormatExport(data: ExportDocumentData, exportedAt: Date = new Date()): SameFormatExport {
  const sourceVersion = data.versions[0];
  if (!sourceVersion) {
    throw new ExportAssemblyError("The document has no imported source version to export.");
  }

  const reviewedSource = applyReviewedComponentText(sourceVersion.sourceSnapshot, data.components);
  const format = normalizeExportFormat(data.document);
  const fileName = buildExportFileName(data.document);
  const bundleContent = buildReviewBundle(data, sourceVersion, exportedAt);

  return {
    format,
    fileName,
    contentType: contentTypeForFormat(format),
    content: appendReviewMetadata(reviewedSource, format, data, bundleContent),
    reviewBundle: {
      fileName: buildReviewBundleFileName(fileName),
      contentType: "application/json",
      content: JSON.stringify(bundleContent, null, 2)
    }
  };
}

export function applyReviewedComponentText(sourceSnapshot: string, components: ReviewComponent[]): string {
  const replacements = components
    .map((component) => ({
      componentId: component.id,
      currentText: component.currentText,
      range: parseSourceRange(component.sourceRange)
    }))
    .filter((replacement): replacement is { componentId: string; currentText: string; range: SourceRange } =>
      Boolean(replacement.range)
    )
    .sort((left, right) => left.range.start - right.range.start || left.range.end - right.range.end);

  let previousEnd = 0;
  for (const replacement of replacements) {
    if (replacement.range.end > sourceSnapshot.length) {
      throw new ExportAssemblyError(`Component ${replacement.componentId} source range exceeds the source snapshot.`);
    }
    if (replacement.range.start < previousEnd) {
      throw new ExportAssemblyError(`Component ${replacement.componentId} source range overlaps an earlier component.`);
    }
    previousEnd = replacement.range.end;
  }

  let reviewedSource = "";
  let cursor = 0;
  for (const replacement of replacements) {
    reviewedSource += sourceSnapshot.slice(cursor, replacement.range.start);
    reviewedSource += replacement.currentText;
    cursor = replacement.range.end;
  }
  reviewedSource += sourceSnapshot.slice(cursor);
  return reviewedSource;
}

export function buildExportFileName(document: DocumentSummary): string {
  const extension = extensionForFormat(normalizeExportFormat(document));
  const baseName = stripKnownExtension(sanitizeFileStem(document.name));
  return `${baseName || "artifact-review-export"}.${extension}`;
}

function buildReviewBundle(
  data: ExportDocumentData,
  sourceVersion: DocumentVersion,
  exportedAt: Date
) {
  const latestVersion = data.versions[data.versions.length - 1] ?? sourceVersion;

  return {
    bundleType: "artifact-review-review-bundle",
    schemaVersion: "0.1.0",
    exportedAt: exportedAt.toISOString(),
    document: data.document,
    sourceVersion: {
      id: sourceVersion.id,
      versionNumber: sourceVersion.versionNumber,
      parserMetadata: sourceVersion.parserMetadata,
      createdAt: sourceVersion.createdAt
    },
    latestVersion: {
      id: latestVersion.id,
      versionNumber: latestVersion.versionNumber,
      parserMetadata: latestVersion.parserMetadata,
      createdAt: latestVersion.createdAt
    },
    components: data.components,
    review: data.review
  };
}

function appendReviewMetadata(
  reviewedSource: string,
  format: SameFormatExport["format"],
  data: ExportDocumentData,
  bundleContent: ReturnType<typeof buildReviewBundle>
): string {
  if (!hasReviewMetadata(data)) {
    return reviewedSource;
  }

  if (format === "html" || format === "htm" || format === "url_snapshot") {
    return appendHtmlReviewMetadata(reviewedSource, data, bundleContent);
  }

  if (format === "md") {
    return `${trimTrailingBlankLines(reviewedSource)}\n\n---\n\n## Artifact Review Notes\n\n${buildMarkdownReviewNotes(data)}`;
  }

  return `${trimTrailingBlankLines(reviewedSource)}\n\n---\nArtifact Review Notes\n\n${buildTextReviewNotes(data)}`;
}

function appendHtmlReviewMetadata(
  reviewedSource: string,
  data: ExportDocumentData,
  bundleContent: ReturnType<typeof buildReviewBundle>
): string {
  const metadata = [
    '<section data-artifact-review-notes="true">',
    "<h2>Artifact Review Notes</h2>",
    buildHtmlReviewNotes(data),
    "</section>",
    `<script type="application/json" id="artifact-review-metadata">${escapeHtml(JSON.stringify(bundleContent))}</script>`
  ].join("\n");

  if (/<\/body\s*>/i.test(reviewedSource)) {
    return reviewedSource.replace(/<\/body\s*>/i, `${metadata}\n</body>`);
  }

  return `${trimTrailingBlankLines(reviewedSource)}\n${metadata}`;
}

function buildTextReviewNotes(data: ExportDocumentData): string {
  return componentsWithReviewRecords(data)
    .map(({ component, notes }) => {
      const lines = [
        `Component ${component.id} (${component.kind}, ${component.sectionId})`,
        `Text: ${component.currentText}`,
        ...notes.map((note) => `- ${note}`)
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildMarkdownReviewNotes(data: ExportDocumentData): string {
  return componentsWithReviewRecords(data)
    .map(({ component, notes }) => {
      const lines = [
        `### ${escapeMarkdown(component.id)}`,
        "",
        `- Kind: ${escapeMarkdown(component.kind)}`,
        `- Section: ${escapeMarkdown(component.sectionId)}`,
        `- Current text: ${escapeMarkdown(component.currentText)}`,
        ...notes.map((note) => `- ${escapeMarkdown(note)}`)
      ];
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildHtmlReviewNotes(data: ExportDocumentData): string {
  return componentsWithReviewRecords(data)
    .map(({ component, notes }) =>
      [
        `<article data-component-id="${escapeHtml(component.id)}">`,
        `<h3>${escapeHtml(component.id)}</h3>`,
        `<p><strong>${escapeHtml(component.kind)}</strong> in ${escapeHtml(component.sectionId)}</p>`,
        `<p>${escapeHtml(component.currentText)}</p>`,
        "<ul>",
        ...notes.map((note) => `<li>${escapeHtml(note)}</li>`),
        "</ul>",
        "</article>"
      ].join("\n")
    )
    .join("\n");
}

function componentsWithReviewRecords(data: ExportDocumentData) {
  return data.components
    .map((component) => ({
      component,
      notes: [
        ...data.review.annotations
          .filter((annotation) => annotation.componentId === component.id)
          .map((annotation) => `Annotation: ${annotation.body}`),
        ...data.review.questions
          .filter((question) => question.componentId === component.id)
          .map((question) => `Question (${question.status}): ${question.body}`),
        ...data.review.evidenceSources
          .filter((evidence) => evidence.componentId === component.id)
          .map((evidence) => `Evidence (${evidence.kind}): ${evidence.value}`),
        ...data.review.highlights
          .filter((highlight) => highlight.componentId === component.id && highlight.enabled)
          .map(() => "Highlighted for review."),
        ...data.review.aiSuggestions
          .filter((suggestion) => suggestion.componentId === component.id)
          .map((suggestion) => `AI suggestion (${suggestion.status}): ${suggestion.proposedText}`)
      ]
    }))
    .filter((entry) => entry.notes.length > 0);
}

function hasReviewMetadata(data: ExportDocumentData): boolean {
  return (
    data.review.annotations.length > 0 ||
    data.review.questions.length > 0 ||
    data.review.evidenceSources.length > 0 ||
    data.review.highlights.some((highlight) => highlight.enabled) ||
    data.review.aiSuggestions.length > 0
  );
}

function parseSourceRange(value: unknown): SourceRange | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate = value as { start?: unknown; end?: unknown };
  const start = candidate.start;
  const end = candidate.end;

  if (typeof start !== "number" || typeof end !== "number" || !Number.isInteger(start) || !Number.isInteger(end)) {
    return null;
  }

  if (start < 0 || end < start) {
    return null;
  }

  return {
    start,
    end
  };
}

function normalizeExportFormat(document: DocumentSummary): SameFormatExport["format"] {
  if (document.sourceType === "url" || document.originalFormat === "url_snapshot") {
    return "url_snapshot";
  }

  if (document.originalFormat === "md" || document.originalFormat === "html" || document.originalFormat === "htm") {
    return document.originalFormat;
  }

  return "txt";
}

function extensionForFormat(format: SameFormatExport["format"]): string {
  return format === "url_snapshot" ? "html" : format;
}

function contentTypeForFormat(format: SameFormatExport["format"]): string {
  if (format === "md") {
    return "text/markdown; charset=utf-8";
  }

  if (format === "html" || format === "htm" || format === "url_snapshot") {
    return "text/html; charset=utf-8";
  }

  return "text/plain; charset=utf-8";
}

function buildReviewBundleFileName(fileName: string): string {
  const dotIndex = fileName.lastIndexOf(".");
  if (dotIndex <= 0) {
    return `${fileName}.review-bundle.json`;
  }
  return `${fileName.slice(0, dotIndex)}.review-bundle.json`;
}

function sanitizeFileStem(value: string): string {
  return value
    .trim()
    .replace(/[\\/:"*?<>|]+/g, "-")
    .replace(/\s+/g, " ")
    .slice(0, 120);
}

function stripKnownExtension(value: string): string {
  return value.replace(/\.(txt|md|html|htm)$/i, "");
}

function trimTrailingBlankLines(value: string): string {
  return value.replace(/\s+$/g, "");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function escapeMarkdown(value: string): string {
  return value.replace(/\|/g, "\\|").replace(/\n/g, " ");
}
