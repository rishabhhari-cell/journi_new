import { describe, expect, it } from "vitest";
import { computeParseConfidence } from "../parse-confidence.service";
import type { ParsedManuscript } from "../../../shared/document-parse";

function makeSection(title: string, words: number) {
  const content = `<p>${Array(words).fill("word").join(" ")}</p>`;
  return { title, content, order: 0, wordCount: words, sourceTitle: title };
}

describe("computeParseConfidence", () => {
  it("returns ≥0.85 for a well-structured document", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [
        makeSection("Abstract", 150),
        makeSection("Introduction", 400),
        makeSection("Methods", 500),
        makeSection("Results", 600),
        makeSection("Discussion", 300),
        makeSection("References", 50),
      ],
      citations: [{ authors: ["A"], title: "T", year: 2020, type: "article" }],
      diagnostics: [],
      totalWordCount: 2000,
    };
    const { score } = computeParseConfidence(ms, { referenceLinesFound: 1, figureCaptionsFound: 0 });
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  it("penalises empty canonical sections below 0.85", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [
        makeSection("Abstract", 5),
        makeSection("Introduction", 5),
        makeSection("Methods", 5),
        makeSection("Results", 5),
        makeSection("Discussion", 5),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 25,
    };
    const { score } = computeParseConfidence(ms, { referenceLinesFound: 0, figureCaptionsFound: 0 });
    expect(score).toBeLessThan(0.85);
  });

  it("returns signals breakdown with all four keys", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [makeSection("Abstract", 200), makeSection("Methods", 300)],
      citations: [],
      diagnostics: [],
      totalWordCount: 500,
    };
    const { score, signals } = computeParseConfidence(ms, { referenceLinesFound: 0, figureCaptionsFound: 0 });
    expect(typeof score).toBe("number");
    expect(signals).toHaveProperty("sectionCount");
    expect(signals).toHaveProperty("bodyCoverage");
    expect(signals).toHaveProperty("citationYield");
    expect(signals).toHaveProperty("figureYield");
  });
});
