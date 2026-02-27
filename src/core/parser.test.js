import { describe, expect, it } from "vitest";
import { detectEnding, parseMarkdownTable } from "./parser";

describe("parseMarkdownTable", () => {
  it("parst einfache markdown-tabellen", () => {
    const md = `
| Wort | Artikel |
|---|---|
| Baum | der |
| Sonne | die |
`;
    const rows = parseMarkdownTable(md);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toEqual({ Wort: "Baum", Artikel: "der" });
  });

  it("ignoriert ungültige zeilen", () => {
    const md = `
not table
| Wort | Artikel |
|---|---|
| Baum | der |
`;
    expect(parseMarkdownTable(md)).toHaveLength(1);
  });

  it("liefert leeres array bei leerem input", () => {
    expect(parseMarkdownTable("")).toEqual([]);
  });
});

describe("detectEnding", () => {
  it("erkennt bekannte endungen", () => {
    expect(detectEnding("Zeitung")).toBe("-ung");
    expect(detectEnding("Mädchen")).toBe("-chen");
  });

  it("liefert frei bei unbekannter endung", () => {
    expect(detectEnding("Baum")).toBe("(frei)");
  });
});
