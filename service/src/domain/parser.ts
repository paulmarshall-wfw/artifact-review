import { createHash } from "node:crypto";

export type ReviewComponentKind = "paragraph_sentence" | "markdown_bullet" | "html_list_item" | "table_row";

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

export function parsePlainTextToComponents(source: string): ReviewComponent[] {
  const components: ReviewComponent[] = [];
  const sentenceMatches = source.matchAll(/[^.!?]+[.!?]?/g);

  for (const match of sentenceMatches) {
    const rawText = match[0];
    const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    const start = (match.index ?? 0) + leadingWhitespace;
    const end = (match.index ?? 0) + rawText.length - trailingWhitespace;
    const index = components.length;

    components.push({
      id: stableId("sentence", text, index),
      kind: "paragraph_sentence",
      sectionId: "root",
      sourceRange: { start, end },
      text,
      originalTextHash: hashText(text)
    });
  }

  return components;
}
