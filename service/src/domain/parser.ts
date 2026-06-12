import { createHash } from "node:crypto";

export type ReviewComponentKind = "paragraph_sentence" | "markdown_bullet" | "html_list_item" | "table_row";

export type ReviewComponent = {
  id: string;
  kind: ReviewComponentKind;
  sectionId: string;
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
  const sentences = source
    .split(/(?<=[.!?])\s+/)
    .map((text) => text.trim())
    .filter(Boolean);

  return sentences.map((text, index) => ({
    id: stableId("sentence", text, index),
    kind: "paragraph_sentence",
    sectionId: "root",
    text,
    originalTextHash: hashText(text)
  }));
}

