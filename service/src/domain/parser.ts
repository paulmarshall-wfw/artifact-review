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

type MappedCharacter = {
  char: string;
  start: number;
  end: number;
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

function appendMappedSentenceComponents(
  components: ReviewComponent[],
  mappedCharacters: MappedCharacter[],
  sectionId: string
): void {
  const normalizedSource = mappedCharacters.map((character) => character.char).join("");
  const sentenceMatches = normalizedSource.matchAll(/[^.!?]+[.!?]?/g);

  for (const match of sentenceMatches) {
    const rawText = match[0];
    const matchStart = match.index ?? 0;
    const leadingWhitespace = rawText.match(/^\s*/)?.[0].length ?? 0;
    const trailingWhitespace = rawText.match(/\s*$/)?.[0].length ?? 0;
    const text = rawText.trim();

    if (!text) {
      continue;
    }

    const firstCharacter = mappedCharacters[matchStart + leadingWhitespace];
    const lastCharacter = mappedCharacters[matchStart + rawText.length - trailingWhitespace - 1];
    if (!firstCharacter || !lastCharacter) {
      continue;
    }

    const index = components.length;
    components.push({
      id: stableId("sentence", text, index),
      kind: "paragraph_sentence",
      sectionId,
      sourceRange: { start: firstCharacter.start, end: lastCharacter.end },
      text,
      originalTextHash: hashText(text)
    });
  }
}

function appendMappedTextComponent(
  components: ReviewComponent[],
  mappedCharacters: MappedCharacter[],
  kind: ReviewComponentKind,
  idPrefix: string,
  sectionId: string
): void {
  const text = mappedCharacters.map((character) => character.char).join("").trim();
  if (!text) {
    return;
  }

  const firstCharacter = mappedCharacters.find((character) => character.char.trim());
  const lastCharacter = [...mappedCharacters].reverse().find((character) => character.char.trim());
  if (!firstCharacter || !lastCharacter) {
    return;
  }

  const index = components.length;
  components.push({
    id: stableId(idPrefix, text, index),
    kind,
    sectionId,
    sourceRange: { start: firstCharacter.start, end: lastCharacter.end },
    text,
    originalTextHash: hashText(text)
  });
}

export function parsePlainTextToComponents(source: string): ReviewComponent[] {
  const components: ReviewComponent[] = [];
  appendSentenceComponents(components, source, 0, "root");

  return components;
}

function decodeHtmlEntity(entity: string): string {
  const namedEntities: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: "\""
  };
  const entityName = entity.slice(1, -1);
  const normalizedEntityName = entityName.toLowerCase();

  if (namedEntities[normalizedEntityName]) {
    return namedEntities[normalizedEntityName];
  }

  if (normalizedEntityName.startsWith("#x")) {
    const value = Number.parseInt(normalizedEntityName.slice(2), 16);
    return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  }

  if (normalizedEntityName.startsWith("#")) {
    const value = Number.parseInt(normalizedEntityName.slice(1), 10);
    return Number.isFinite(value) && value >= 0 && value <= 0x10ffff ? String.fromCodePoint(value) : entity;
  }

  return entity;
}

function appendNormalizedCharacter(characters: MappedCharacter[], character: MappedCharacter): void {
  const normalizedCharacter = /\s/.test(character.char) || character.char === "\u00a0" ? " " : character.char;
  const previousCharacter = characters.at(-1);

  if (normalizedCharacter === " " && previousCharacter?.char === " ") {
    previousCharacter.end = character.end;
    return;
  }

  characters.push({
    ...character,
    char: normalizedCharacter
  });
}

function extractHtmlMappedText(source: string, sourceOffset: number): MappedCharacter[] {
  const mappedCharacters: MappedCharacter[] = [];
  let index = 0;

  while (index < source.length) {
    const character = source[index];
    if (character === "<") {
      const tagEndIndex = source.indexOf(">", index);
      if (tagEndIndex === -1) {
        appendNormalizedCharacter(mappedCharacters, {
          char: character,
          start: sourceOffset + index,
          end: sourceOffset + index + 1
        });
        index += 1;
        continue;
      }

      const tagSource = source.slice(index, tagEndIndex + 1);
      if (/^<\/?(br|dd|div|dt|li|p|td|th|tr)\b/i.test(tagSource)) {
        appendNormalizedCharacter(mappedCharacters, {
          char: " ",
          start: sourceOffset + index,
          end: sourceOffset + tagEndIndex + 1
        });
      }
      index = tagEndIndex + 1;
      continue;
    }

    if (character === "&") {
      const entityMatch = source.slice(index).match(/^&(?:[a-z]+|#\d+|#x[0-9a-f]+);/i);
      if (entityMatch) {
        for (const decodedCharacter of decodeHtmlEntity(entityMatch[0]).split("")) {
          appendNormalizedCharacter(mappedCharacters, {
            char: decodedCharacter,
            start: sourceOffset + index,
            end: sourceOffset + index + entityMatch[0].length
          });
        }
        index += entityMatch[0].length;
        continue;
      }
    }

    appendNormalizedCharacter(mappedCharacters, {
      char: character,
      start: sourceOffset + index,
      end: sourceOffset + index + 1
    });
    index += 1;
  }

  return mappedCharacters;
}

function isInsideIgnoredHtmlRange(source: string, index: number): boolean {
  const before = source.slice(0, index);
  const openIgnoredElement = before.match(/<(script|style|template|head)\b[^>]*>/gi)?.at(-1);
  if (!openIgnoredElement) {
    return false;
  }

  const ignoredElement = openIgnoredElement.match(/^<([a-z]+)/i)?.[1];
  if (!ignoredElement) {
    return false;
  }

  const lastCloseIndex = before.toLowerCase().lastIndexOf(`</${ignoredElement.toLowerCase()}>`);
  const lastOpenIndex = before.toLowerCase().lastIndexOf(openIgnoredElement.toLowerCase());
  return lastOpenIndex > lastCloseIndex;
}

export function parseHtmlToComponents(source: string): ReviewComponent[] {
  const components: ReviewComponent[] = [];
  const elementMatches = source.matchAll(/<(h[1-6]|p|li|tr)\b[^>]*>([\s\S]*?)<\/\1>/gi);
  let currentSectionId = "root";
  let headingIndex = 0;

  for (const match of elementMatches) {
    const rawElement = match[0];
    const rawTagName = match[1];
    const innerHtml = match[2] ?? "";
    const elementStart = match.index ?? 0;

    if (!rawTagName || isInsideIgnoredHtmlRange(source, elementStart)) {
      continue;
    }

    const tagName = rawTagName.toLowerCase();
    const openingTag = rawElement.match(/^<[^>]*>/)?.[0] ?? "";
    const innerOffset = elementStart + openingTag.length;
    const mappedText = extractHtmlMappedText(innerHtml, innerOffset);
    const text = mappedText.map((character) => character.char).join("").trim();
    if (!text) {
      continue;
    }

    if (tagName.startsWith("h")) {
      currentSectionId = stableId("html_section", text, headingIndex);
      headingIndex += 1;
      continue;
    }

    if (tagName === "p") {
      appendMappedSentenceComponents(components, mappedText, currentSectionId);
      continue;
    }

    if (tagName === "li") {
      appendMappedTextComponent(components, mappedText, "html_list_item", "html_list_item", currentSectionId);
      continue;
    }

    if (tagName === "tr" && /<td\b/i.test(innerHtml)) {
      appendMappedTextComponent(components, mappedText, "table_row", "table_row", currentSectionId);
    }
  }

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
