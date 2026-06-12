import { describe, expect, it } from "vitest";
import { parsePlainTextToComponents } from "../service/src/domain/parser";

describe("plain text parser", () => {
  it("creates stable component ids from sentence content", () => {
    const first = parsePlainTextToComponents("One sentence. Another sentence.");
    const second = parsePlainTextToComponents("One sentence. Another sentence.");

    expect(first).toHaveLength(2);
    expect(first.map((component) => component.id)).toEqual(second.map((component) => component.id));
    expect(first[0]?.kind).toBe("paragraph_sentence");
  });
});

