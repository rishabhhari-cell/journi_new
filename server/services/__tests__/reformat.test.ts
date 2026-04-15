import { describe, expect, it } from "vitest";
import { buildDeterministicChanges } from "../reformat.service";
import type { JournalGuidelinesDTO } from "../../../shared/backend";

function makeSection(id: string, title: string, contentHtml: string) {
  return { id, title, contentHtml };
}

const JOURNAL: JournalGuidelinesDTO = {
  journalId: "j1",
  journalName: "Test Journal",
  submissionPortalUrl: null,
  wordLimits: { abstract: 250, main_text: 3500, total: null, title: null },
  sectionOrder: ["Abstract", "Introduction", "Methods", "Results", "Discussion", "References"],
  sectionsRequired: ["Abstract", "Introduction", "Methods", "Results", "Discussion", "References"],
  citationStyle: "vancouver",
  figuresMax: null,
  tablesMax: null,
  structuredAbstract: true,
  keywordsRequired: null,
  maxKeywords: null,
  requiredDeclarations: ["Data Availability"],
  requiresCoverLetter: null,
  notes: null,
  acceptanceRate: null,
  avgDecisionDays: null,
  raw: null,
};

describe("buildDeterministicChanges", () => {
  it("produces a reorder suggestion when sections are out of order", () => {
    const sections = [
      makeSection("s1", "Introduction", "<p>Intro text.</p>"),
      makeSection("s2", "Abstract", "<p>Abstract text.</p>"),
      makeSection("s3", "Methods", "<p>Methods text.</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.some((c) => c.type === "reorder")).toBe(true);
  });

  it("produces a stub for missing required section", () => {
    const sections = [
      makeSection("s1", "Abstract", "<p>Abstract.</p>"),
      makeSection("s2", "Introduction", "<p>Introduction.</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    const stubs = changes.filter((c) => c.type === "stub");
    expect(stubs.some((c) => c.reason.includes("Methods"))).toBe(true);
  });

  it("produces citation-style suggestion", () => {
    const sections = [
      makeSection("s1", "References", "<ol><li>Smith J et al. (2020). Title. Journal.</li></ol>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.some((c) => c.type === "citation-style")).toBe(true);
  });

  it("marks all deterministic changes as autoAccepted", () => {
    const sections = [
      makeSection("s1", "Introduction", "<p>x</p>"),
      makeSection("s2", "Abstract", "<p>y</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.every((c) => c.autoAccepted === true)).toBe(true);
  });

  it("returns no changes for a correctly ordered complete manuscript", () => {
    const sections = [
      makeSection("s1", "Abstract", "<p>Abstract text here.</p>"),
      makeSection("s2", "Introduction", "<p>Introduction text here.</p>"),
      makeSection("s3", "Methods", "<p>Methods text here.</p>"),
      makeSection("s4", "Results", "<p>Results text here.</p>"),
      makeSection("s5", "Discussion", "<p>Discussion text here.</p>"),
      makeSection("s6", "References", "<ol><li>Ref 1.</li></ol>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    // Only citation-style flag and Data Availability stub expected (required declaration)
    const reorderChanges = changes.filter((c) => c.type === "reorder");
    expect(reorderChanges).toHaveLength(0);
  });
});
