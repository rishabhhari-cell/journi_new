import { describe, expect, it } from "vitest";
import { parseRawDocument } from "../../../shared/document-parse";
import type { RawParsedDocument } from "../../../shared/document-parse";

function makeRaw(references: string[]): RawParsedDocument {
  return {
    fileTitle: "Test",
    format: "docx",
    html: "<h2>References</h2>",
    references,
  };
}

describe("parseCitationsFromReferences — format-specific patterns", () => {
  it("parses Vancouver numbered reference without corrupting DOI", () => {
    const result = parseRawDocument(
      makeRaw(["1. Smith J, Jones A. The effects of X on Y. J Med. 2021;45(3):100-110. doi:10.1000/xyz123"])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].doi).toBe("10.1000/xyz123");
    expect(result.citations[0].title).not.toContain("10.1000"); // DOI should not be in title
  });

  it("parses APA reference correctly", () => {
    const result = parseRawDocument(
      makeRaw(["Smith, J., & Jones, A. (2021). The effects of X on Y. Journal of Medicine, 45(3), 100-110."])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].year).toBe(2021);
    expect(result.citations[0].authors.length).toBeGreaterThan(0);
    expect(result.citations[0].authors[0]).not.toBe("Unknown");
  });

  it("keeps malformed line as raw title with Unknown author — never corrupts", () => {
    const result = parseRawDocument(
      makeRaw(["Completely unparseable line with no recognisable structure at all xyz abc"])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].title).toBeTruthy();
    expect(result.citations[0].authors).toContain("Unknown");
  });

  it("extracts DOI from any format", () => {
    const result = parseRawDocument(
      makeRaw(["Some Reference. Some Title. https://doi.org/10.9999/test.2021"])
    );
    expect(result.citations[0].doi).toBe("10.9999/test.2021");
  });
});
