import type { ParsedManuscript } from "../../shared/document-parse";
import { normalizeSectionMatchKey } from "../../shared/document-parse";

const CANONICAL_BODY_SECTIONS = new Set([
  "abstract", "introduction", "methods", "results", "discussion",
]);

const NAMED_NON_CONTENT_KEYS = new Set(["title", "references", "content"]);

export interface ConfidenceSignals {
  sectionCount: number;
  bodyCoverage: number;
  citationYield: number;
  figureYield: number;
}

export interface ConfidenceResult {
  score: number;
  signals: ConfidenceSignals;
  penalty: number;
}

export interface ConfidenceContext {
  referenceLinesFound: number;
  figureCaptionsFound: number;
}

export function computeParseConfidence(
  ms: ParsedManuscript,
  ctx: ConfidenceContext,
): ConfidenceResult {
  // 1. Section count signal (30%): ≥5 canonical body sections = 1.0
  const canonicalSectionKeys = new Set(
    ms.sections
      .map((s) => normalizeSectionMatchKey(s.title))
      .filter(
        (key) =>
          !NAMED_NON_CONTENT_KEYS.has(key) &&
          key !== "figures_and_tables" &&
          key !== "appendix" &&
          key !== "acknowledgements",
      ),
  );
  const sectionCountSignal = Math.min(1.0, canonicalSectionKeys.size / 5);

  // 2. Body coverage signal (30%): words in named non-title/refs sections ÷ total
  const bodyWords = ms.sections
    .filter((s) => {
      const key = normalizeSectionMatchKey(s.title);
      return (
        !NAMED_NON_CONTENT_KEYS.has(key) &&
        key !== "figures_and_tables" &&
        key !== "appendix"
      );
    })
    .reduce((sum, s) => sum + s.wordCount, 0);
  const bodyCoverageSignal =
    ms.totalWordCount > 0 ? Math.min(1.0, bodyWords / ms.totalWordCount) : 0;

  // 3. Citation yield signal (20%): citations ÷ reference lines (neutral 0.5 if no refs)
  const citationYieldSignal =
    ctx.referenceLinesFound === 0
      ? 0.5
      : Math.min(1.0, ms.citations.length / ctx.referenceLinesFound);

  // 4. Figure yield signal (20%): figures ÷ captions (neutral 0.5 if no captions)
  const figureYieldSignal =
    ctx.figureCaptionsFound === 0
      ? 0.5
      : Math.min(1.0, (ms.figures?.length ?? 0) / ctx.figureCaptionsFound);

  const rawScore =
    sectionCountSignal * 0.3 +
    bodyCoverageSignal * 0.3 +
    citationYieldSignal * 0.2 +
    figureYieldSignal * 0.2;

  // Empty section penalty: -0.10 per canonical body section with <30 words, capped at -0.40
  let penaltyCount = 0;
  for (const section of ms.sections) {
    const key = normalizeSectionMatchKey(section.title);
    if (CANONICAL_BODY_SECTIONS.has(key) && section.wordCount < 30) {
      penaltyCount += 1;
    }
  }
  const penalty = Math.min(0.4, penaltyCount * 0.1);
  const score = Math.max(0, Math.min(1.0, rawScore - penalty));

  return {
    score,
    penalty,
    signals: {
      sectionCount: sectionCountSignal,
      bodyCoverage: bodyCoverageSignal,
      citationYield: citationYieldSignal,
      figureYield: figureYieldSignal,
    },
  };
}
