import { describe, expect, it } from "vitest";
import { parseHtmlToComponents, parseMarkdownToComponents, parsePlainTextToComponents } from "../service/src/domain/parser";

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

describe("html parser", () => {
  it("uses headings as section anchors and creates stable review components with source ranges", () => {
    const source = [
      "<article>",
      "<h1>Review Plan</h1>",
      "<p>First <strong>HTML</strong> sentence. Second&nbsp;item?</p>",
      "<ul><li>Keep source ranges</li><li>Decode &amp; preserve text</li></ul>",
      "<table>",
      "<thead><tr><th>Name</th><th>Status</th></tr></thead>",
      "<tbody><tr><td>Clause A</td><td>Ready.</td></tr></tbody>",
      "</table>",
      "</article>"
    ].join("");
    const first = parseHtmlToComponents(source);
    const second = parseHtmlToComponents(source);

    expect(first.map((component) => component.id)).toEqual(second.map((component) => component.id));
    expect(first.map((component) => component.kind)).toEqual([
      "paragraph_sentence",
      "paragraph_sentence",
      "html_list_item",
      "html_list_item",
      "table_row"
    ]);
    expect(first.map((component) => component.text)).toEqual([
      "First HTML sentence.",
      "Second item?",
      "Keep source ranges",
      "Decode & preserve text",
      "Clause A Ready."
    ]);
    expect(first.map((component) => component.sourceRange)).toEqual([
      { start: source.indexOf("First"), end: source.indexOf(" sentence.") + " sentence.".length },
      { start: source.indexOf("Second"), end: source.indexOf("item?") + "item?".length },
      { start: source.indexOf("Keep"), end: source.indexOf("ranges") + "ranges".length },
      { start: source.indexOf("Decode"), end: source.indexOf("text") + "text".length },
      { start: source.indexOf("Clause A"), end: source.indexOf("Ready.") + "Ready.".length }
    ]);
    expect(first.every((component) => component.sectionId !== "root")).toBe(true);
    expect(new Set(first.map((component) => component.sectionId)).size).toBe(1);
  });

  it("ignores script and style content", () => {
    const components = parseHtmlToComponents(
      "<style><p>Hidden style sentence.</p></style><script><p>Hidden script sentence.</p></script><p>Visible sentence.</p>"
    );

    expect(components).toHaveLength(1);
    expect(components[0]?.text).toBe("Visible sentence.");
  });
});
