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

  // APA with no journal: should fall through to fallback, not match APA with empty journal
  it("does not match APA pattern when journal is absent — uses fallback", () => {
    const result = parseRawDocument(
      makeRaw(["Smith, J. (2021). The Title."])
    );
    expect(result.citations).toHaveLength(1);
    // Fallback preserves full raw line as title
    expect(result.citations[0].title).toContain("Smith");
    // APA match would produce an empty journal; we want either undefined or a real journal name
    expect(result.citations[0].journal ?? "").toBe("");
    // Format should be fallback, not APA, since there's no journal
    expect(result.citations[0].metadata?.format).toBe("fallback");
  });

  // APA with proper journal: should still match correctly
  it("matches APA with journal and produces correct journal field", () => {
    const result = parseRawDocument(
      makeRaw(["Smith, J., & Jones, A. (2021). The effects of X. Journal of Medicine, 45(3), 100-110."])
    );
    expect(result.citations[0].journal).toBeTruthy();
    expect(result.citations[0].journal).not.toBe("");
    expect(result.citations[0].metadata?.format).toBe("apa");
  });

  // Bracketed Vancouver: [5] Author. Title. Journal. Year;pages.
  it("parses bracketed-number Vancouver reference (e.g. [5] Author...)", () => {
    const result = parseRawDocument(
      makeRaw(["[5] Jones A, Smith B. The Title. Nature. 2020;580:123-125."])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].authors[0]).not.toBe("Unknown");
    expect(result.citations[0].title).toBe("The Title");
    expect(result.citations[0].journal).toBe("Nature");
    expect(result.citations[0].year).toBe(2020);
    expect(result.citations[0].metadata?.format).toBe("vancouver");
  });

  // Vancouver authors with "et al." should parse correctly
  it("parses Vancouver citation with et al. in authors", () => {
    const result = parseRawDocument(
      makeRaw(["1. Smith J et al. The Title Here. J Med. 2021;5:10."])
    );
    expect(result.citations).toHaveLength(1);
    // Should not be empty authors
    expect(result.citations[0].authors[0]).not.toBe("Unknown");
    // Title should not contain the author text
    expect(result.citations[0].title).not.toContain("Smith J et al");
  });
});
