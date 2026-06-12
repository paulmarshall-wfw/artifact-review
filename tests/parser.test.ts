import { describe, expect, it } from "vitest";
import { parseMarkdownToComponents, parsePlainTextToComponents } from "../service/src/domain/parser";

describe("plain text parser", () => {
  it("creates stable component ids from sentence content", () => {
    const first = parsePlainTextToComponents("One sentence. Another sentence.");
    const second = parsePlainTextToComponents("One sentence. Another sentence.");

    expect(first).toHaveLength(2);
    expect(first.map((component) => component.id)).toEqual(second.map((component) => component.id));
    expect(first[0]?.kind).toBe("paragraph_sentence");
    expect(first.map((component) => component.sourceRange)).toEqual([
      { start: 0, end: 13 },
      { start: 14, end: 31 }
    ]);
  });
});

describe("markdown parser", () => {
  it("creates stable heading, sentence, and bullet components with source ranges", () => {
    const source = "# Title\n\nIntro sentence. More detail.\n- First point\n- Second point\n";
    const first = parseMarkdownToComponents(source);
    const second = parseMarkdownToComponents(source);

    expect(first).toHaveLength(5);
    expect(first.map((component) => component.id)).toEqual(second.map((component) => component.id));
    expect(first.map((component) => component.kind)).toEqual([
      "markdown_heading",
      "paragraph_sentence",
      "paragraph_sentence",
      "markdown_bullet",
      "markdown_bullet"
    ]);
    expect(first.map((component) => component.text)).toEqual([
      "Title",
      "Intro sentence.",
      "More detail.",
      "First point",
      "Second point"
    ]);
    expect(first.map((component) => component.sourceRange)).toEqual([
      { start: 2, end: 7 },
      { start: 9, end: 24 },
      { start: 25, end: 37 },
      { start: 40, end: 51 },
      { start: 54, end: 66 }
    ]);
    expect(new Set(first.map((component) => component.sectionId)).size).toBe(1);
  });

  it("excludes closing heading markers and supports ordered list items", () => {
    const components = parseMarkdownToComponents("## Setup ###\n1. First step\n");

    expect(components.map((component) => component.text)).toEqual(["Setup", "First step"]);
    expect(components.map((component) => component.kind)).toEqual(["markdown_heading", "markdown_bullet"]);
    expect(components.map((component) => component.sourceRange)).toEqual([
      { start: 3, end: 8 },
      { start: 16, end: 26 }
    ]);
  });
});
