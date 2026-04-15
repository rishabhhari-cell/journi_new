import { describe, expect, it } from "vitest";
import {
  runDeterministicErrorChecks,
  meetsHighConfidenceThreshold,
} from "../parse-error-detection.service";
import type { ParsedManuscript } from "../../../shared/document-parse";

function makeSection(title: string, content: string) {
  return { title, content, order: 0, wordCount: content.split(" ").length, sourceTitle: title };
}

describe("meetsHighConfidenceThreshold", () => {
  it("returns true when ≥3 canonical sections present with no error diagnostics", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "Background objectives methods results."),
        makeSection("Methods", "We recruited 100 patients."),
        makeSection("Results", "Primary outcome was achieved."),
        makeSection("References", "1. Doe J. 2020."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 50,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(true);
  });

  it("returns false when fewer than 3 canonical sections", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Content", "Some text here."),
        makeSection("Content", "More text here."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 20,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(false);
  });

  it("returns false when an error-level diagnostic is present", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "x"),
        makeSection("Methods", "y"),
        makeSection("Results", "z"),
      ],
      citations: [],
      diagnostics: [{ level: "error", code: "TRUNCATED_TEXT", message: "Text ends mid-sentence" }],
      totalWordCount: 3,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(false);
  });
});

describe("runDeterministicErrorChecks", () => {
  it("flags truncated text ending mid-sentence", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Methods", "We enrolled patients who were treated with")],
      citations: [],
      diagnostics: [],
      totalWordCount: 10,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "TRUNCATED_TEXT")).toBe(true);
    expect(diags.find((d) => d.code === "TRUNCATED_TEXT")?.level).toBe("error");
  });

  it("flags duplicate section titles", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Methods", "First methods section."),
        makeSection("Methods", "Second methods section."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 10,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "DUPLICATE_SECTION")).toBe(true);
  });

  it("flags sections with fewer than 50 words as potential merge errors", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Results", "Only a few words here.")],
      citations: [],
      diagnostics: [],
      totalWordCount: 5,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "SECTION_TOO_SHORT")).toBe(true);
  });

  it("flags unicode replacement characters", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Abstract", "Patients with \uFFFD disease were enrolled.")],
      citations: [],
      diagnostics: [],
      totalWordCount: 7,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "GARBLED_ENCODING")).toBe(true);
  });

  it("returns no errors for a clean manuscript", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "We studied cardiac outcomes in a randomised controlled trial."),
        makeSection("Methods", "A randomised trial with 200 participants was conducted over 12 months."),
        makeSection("Results", "Primary endpoint was met in 78% of participants in the treatment group."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 30,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.filter((d) => d.level === "error")).toHaveLength(0);
  });
});
