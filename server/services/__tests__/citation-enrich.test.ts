import { describe, expect, it } from "vitest";
import type { ParsedCitation } from "../../../shared/document-parse";
import { scoreOpenAlexMatch } from "../citation-enrich.service";

describe("scoreOpenAlexMatch", () => {
  it("returns high score when title matches closely", () => {
    const citation: ParsedCitation = {
      authors: ["Smith J"],
      title: "Effect of aspirin on cardiovascular events",
      year: 2019,
      type: "article",
    };
    const score = scoreOpenAlexMatch(citation, "Effect of aspirin on cardiovascular events", 2019);
    expect(score).toBeGreaterThanOrEqual(0.80);
  });

  it("returns low score when title does not match", () => {
    const citation: ParsedCitation = {
      authors: ["Smith J"],
      title: "Effect of aspirin on cardiovascular events",
      year: 2019,
      type: "article",
    };
    const score = scoreOpenAlexMatch(citation, "Completely different paper about biology", 2019);
    expect(score).toBeLessThan(0.80);
  });
});
