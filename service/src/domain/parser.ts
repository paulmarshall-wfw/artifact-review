import { createHash } from "node:crypto";

export type ReviewComponentKind =
  | "paragraph_sentence"
  | "markdown_heading"
  | "markdown_bullet"
  | "html_list_item"
  | "table_row";

export type ReviewComponent = {
  id: string;
  kind: ReviewComponentKind;
  sectionId: string;
  sourceRange: {
    start: number;
    end: number;
  };
  text: string;
  originalTextHash: string;
};

function hashText(text: string): string {
  return createHash("sha256").update(text).digest("hex");
}

function stableId(prefix: string, text: string, index: number): string {
  return `${prefix}_${index}_${hashText(text).slice(0, 12)}`;
}

function appendSentenceComponents(
  components: ReviewComponent[],
  source: string,
  sourceOffset: number,
  sectionId: string
): void {
  const sentenceMatches = source.matchAll(/[^.!?]+[.!?]?/g);

  for (const match of sentenceMatches) {
    const rawText = match[0];
    const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    const start = sourceOffset + (match.index ?? 0) + leadingWhitespace;
    const end = sourceOffset + (match.index ?? 0) + rawText.length - trailingWhitespace;
    const index = components.length;

    components.push({
      id: stableId("sentence", text, index),
      kind: "paragraph_sentence",
      sectionId,
      sourceRange: { start, end },
      text,
      originalTextHash: hashText(text)
    });
  }
}

export function parsePlainTextToComponents(source: string): ReviewComponent[] {
  const components: ReviewComponent[] = [];
  appendSentenceComponents(components, source, 0, "root");

  return components;
}

export function parseMarkdownToComponents(source: string): ReviewComponent[] {
  const components: ReviewComponent[] = [];
  const lines = source.matchAll(/.*(?:\r?\n|$)/g);
  let currentSectionId = "root";
  let headingIndex = 0;
  let paragraphStart: number | null = null;
  let paragraphEnd: number | null = null;

  function flushParagraph(): void {
    if (paragraphStart === null || paragraphEnd === null || paragraphEnd <= paragraphStart) {
      paragraphStart = null;
      paragraphEnd = null;
      return;
    }

    appendSentenceComponents(
      components,
      source.slice(paragraphStart, paragraphEnd),
      paragraphStart,
      currentSectionId
    );
    paragraphStart = null;
    paragraphEnd = null;
  }

  for (const match of lines) {
    const rawLine = match[0];
    const lineStart = match.index ?? 0;

    if (rawLine === "") {
      continue;
    }

    const lineWithoutBreak = rawLine.replace(/\r?\n$/, "");
    const trimmedLine = lineWithoutBreak.trim();

    if (!trimmedLine) {
      flushParagraph();
      continue;
    }

    const headingMatch = lineWithoutBreak.match(/^(\s{0,3}#{1,6}\s+)(.*?)(?:\s+#+\s*)?$/);
    if (headingMatch) {
      flushParagraph();

      const marker = headingMatch[1] ?? "";
      const text = headingMatch[2]?.trim() ?? "";
      if (!text) {
        continue;
      }

      const leadingTextWhitespace = headingMatch[2]?.match(/^\s*/)?.[0].length ?? 0;
      const trailingTextWhitespace = headingMatch[2]?.match(/\s*$/)?.[0].length ?? 0;
      const start = lineStart + marker.length + leadingTextWhitespace;
      const end = lineStart + marker.length + (headingMatch[2]?.length ?? 0) - trailingTextWhitespace;
      const index = components.length;
      const sectionId = stableId("section", text, headingIndex);

      currentSectionId = sectionId;
      headingIndex += 1;
      components.push({
        id: stableId("markdown_heading", text, index),
        kind: "markdown_heading",
        sectionId,
        sourceRange: { start, end },
        text,
        originalTextHash: hashText(text)
      });
      continue;
    }

    const bulletMatch = lineWithoutBreak.match(/^(\s*(?:[-*+]|\d+\.)\s+)(.*?)(\s*)$/);
    if (bulletMatch) {
      flushParagraph();

      const marker = bulletMatch[1] ?? "";
      const rawText = bulletMatch[2] ?? "";
      const text = rawText.trim();
      if (!text) {
        continue;
      }

      const leadingTextWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
      const trailingTextWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
      const start = lineStart + marker.length + leadingTextWhitespace;
      const end = lineStart + marker.length + rawText.length - trailingTextWhitespace;
      const index = components.length;

      components.push({
        id: stableId("markdown_bullet", text, index),
        kind: "markdown_bullet",
        sectionId: currentSectionId,
        sourceRange: { start, end },
        text,
        originalTextHash: hashText(text)
      });
      continue;
    }

    paragraphStart ??= lineStart;
    paragraphEnd = lineStart + lineWithoutBreak.length;
  }

  flushParagraph();

  return components;
}
