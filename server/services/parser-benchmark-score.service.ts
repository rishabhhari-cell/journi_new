import type { ParsedManuscript } from "@shared/document-parse";
import { normalizeSectionMatchKey } from "@shared/document-parse";
import { REQUIRED_SECTION_KEYS_BY_STUDY_BUCKET } from "./parser-benchmark.constants";
import type {
  BenchmarkDocumentMetrics,
  JatsGroundTruth,
  ParserBenchmarkResultRecord,
  ScoreBreakdown,
  SectionComparison,
  StudyDesignBucket,
} from "./parser-benchmark.types";

interface ScoreParams {
  parsed: ParsedManuscript;
  truth: JatsGroundTruth;
  studyDesignBucket: StudyDesignBucket;
  mode: ParserBenchmarkResultRecord["mode"];
  format: ParserBenchmarkResultRecord["format"];
  llmFallbackTriggered: boolean;
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function normalizeText(value: string): string {
  return value
    .replace(/<[^>]+>/g, " ")
    .toLowerCase()
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/\s+/g, " ")
    .trim();
}

function tokenize(value: string): string[] {
  return normalizeText(value)
    .split(/[^a-z0-9]+/)
    .map((token) => token.trim())
    .filter(Boolean);
}

function tokenOverlapScore(predicted: string, truth: string): { precision: number; recall: number; f1: number } {
  const predictedTokens = tokenize(predicted);
  const truthTokens = tokenize(truth);
  if (predictedTokens.length === 0 && truthTokens.length === 0) {
    return { precision: 1, recall: 1, f1: 1 };
  }

  const truthCounts = new Map<string, number>();
  truthTokens.forEach((token) => truthCounts.set(token, (truthCounts.get(token) ?? 0) + 1));
  let overlap = 0;
  for (const token of predictedTokens) {
    const remaining = truthCounts.get(token) ?? 0;
    if (remaining > 0) {
      overlap += 1;
      truthCounts.set(token, remaining - 1);
    }
  }

  const precision = predictedTokens.length > 0 ? overlap / predictedTokens.length : 0;
  const recall = truthTokens.length > 0 ? overlap / truthTokens.length : 0;
  const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
  return { precision, recall, f1 };
}

function longestCommonSubsequenceRatio(predicted: string, truth: string): number {
  const a = tokenize(predicted).slice(0, 250);
  const b = tokenize(truth).slice(0, 250);
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;

  const dp = Array.from({ length: a.length + 1 }, () => new Array<number>(b.length + 1).fill(0));
  for (let i = 1; i <= a.length; i += 1) {
    for (let j = 1; j <= b.length; j += 1) {
      if (a[i - 1] === b[j - 1]) {
        dp[i][j] = dp[i - 1][j - 1] + 1;
      } else {
        dp[i][j] = Math.max(dp[i - 1][j], dp[i][j - 1]);
      }
    }
  }

  return dp[a.length][b.length] / Math.max(a.length, b.length);
}

function buildCanonicalSectionMap(sections: Array<{ title: string; text: string }>): Map<string, string> {
  const map = new Map<string, string>();
  for (const section of sections) {
    const key = normalizeSectionMatchKey(section.title);
    const existing = map.get(key);
    map.set(key, [existing, section.text].filter(Boolean).join("\n\n").trim());
  }
  return map;
}

function extractParsedSectionText(parsed: ParsedManuscript): Array<{ title: string; text: string }> {
  return parsed.sections.map((section) => ({
    title: section.title,
    text: normalizeText(section.content),
  }));
}

function scoreSections(
  parsed: ParsedManuscript,
  truth: JatsGroundTruth,
): {
  headingPrecision: number;
  headingRecall: number;
  sectionOrderAgreement: number;
  bodyCoverageRecall: number;
  bodyCoveragePrecision: number;
  sectionComparisons: SectionComparison[];
} {
  const parsedSections = extractParsedSectionText(parsed);
  const truthSections = truth.sections.map((section) => ({
    title: section.canonicalTitle,
    text: section.text,
  }));
  const parsedMap = buildCanonicalSectionMap(parsedSections);
  const truthMap = buildCanonicalSectionMap(truthSections);

  const parsedKeys = Array.from(parsedMap.keys()).filter((key) => key !== "content");
  const truthKeys = Array.from(truthMap.keys()).filter((key) => key !== "content");
  const overlapKeys = truthKeys.filter((key) => parsedMap.has(key));

  const headingPrecision = parsedKeys.length > 0 ? overlapKeys.length / parsedKeys.length : 0;
  const headingRecall = truthKeys.length > 0 ? overlapKeys.length / truthKeys.length : 0;

  const truthOrder = truth.sections.map((section) => normalizeSectionMatchKey(section.canonicalTitle));
  const parsedOrder = parsed.sections.map((section) => normalizeSectionMatchKey(section.title));
  const sharedOrder = truthOrder.filter((key) => parsedOrder.includes(key));
  const inOrder = sharedOrder.filter((key, index) => parsedOrder.indexOf(key) === index);
  const sectionOrderAgreement = sharedOrder.length > 0 ? inOrder.length / sharedOrder.length : 0;

  const sectionComparisons: SectionComparison[] = truth.sections.map((section) => {
    const key = normalizeSectionMatchKey(section.canonicalTitle);
    const parsedText = parsedMap.get(key) ?? "";
    const overlap = tokenOverlapScore(parsedText, section.text);
    return {
      canonicalTitle: section.canonicalTitle,
      truthWordCount: section.wordCount,
      parsedWordCount: tokenize(parsedText).length,
      tokenPrecision: overlap.precision,
      tokenRecall: overlap.recall,
      lcsRatio: longestCommonSubsequenceRatio(parsedText, section.text),
      matched: parsedMap.has(key),
    };
  });

  const bodyComparisons = sectionComparisons.filter((comparison) => {
    const key = normalizeSectionMatchKey(comparison.canonicalTitle);
    return key !== "title" && key !== "references";
  });

  const bodyCoverageRecall = average(bodyComparisons.map((comparison) => comparison.tokenRecall));
  const bodyCoveragePrecision = average(bodyComparisons.map((comparison) => comparison.tokenPrecision));

  return {
    headingPrecision,
    headingRecall,
    sectionOrderAgreement,
    bodyCoverageRecall,
    bodyCoveragePrecision,
    sectionComparisons,
  };
}

function scoreMetadata(parsed: ParsedManuscript, truth: JatsGroundTruth): {
  titleExactMatch: boolean;
  titleTokenF1: number;
  authorRecall: number;
  institutionRecall: number;
} {
  const parsedTitle = parsed.sections.find((section) => normalizeSectionMatchKey(section.title) === "title")?.content ?? parsed.fileTitle;
  const titleOverlap = tokenOverlapScore(parsedTitle, truth.title);
  const titleExactMatch = normalizeText(parsedTitle) === normalizeText(truth.title);

  const truthAuthors = new Set(truth.authors.map((author) => normalizeText(author)));
  const parsedAuthors = new Set((parsed.authors ?? []).map((author) => normalizeText(author)));
  const truthInstitutions = new Set(truth.institutions.map((institution) => normalizeText(institution)));
  const parsedInstitutions = new Set((parsed.institutions ?? []).map((institution) => normalizeText(institution)));

  const authorRecall =
    truthAuthors.size > 0
      ? Array.from(truthAuthors).filter((author) => parsedAuthors.has(author)).length / truthAuthors.size
      : 1;
  const institutionRecall =
    truthInstitutions.size > 0
      ? Array.from(truthInstitutions).filter((institution) => parsedInstitutions.has(institution)).length / truthInstitutions.size
      : 1;

  return {
    titleExactMatch,
    titleTokenF1: titleOverlap.f1,
    authorRecall,
    institutionRecall,
  };
}

function scoreReferences(parsed: ParsedManuscript, truth: JatsGroundTruth): {
  referenceCountDelta: number;
  referenceDoiRecall: number;
  score: number;
} {
  const truthDois = new Set(truth.references.map((reference) => reference.doi?.toLowerCase()).filter(Boolean) as string[]);
  const parsedDois = new Set(parsed.citations.map((citation) => citation.doi?.toLowerCase()).filter(Boolean) as string[]);
  const doiRecall =
    truthDois.size > 0
      ? Array.from(truthDois).filter((doi) => parsedDois.has(doi)).length / truthDois.size
      : 1;
  const countDelta = Math.abs(parsed.citations.length - truth.references.length);
  const countPenaltyBase = truth.references.length > 0 ? countDelta / truth.references.length : 0;
  const score = clamp((1 - countPenaltyBase) * 0.4 + doiRecall * 0.6);

  return {
    referenceCountDelta: countDelta,
    referenceDoiRecall: doiRecall,
    score,
  };
}

function scoreFiguresTables(parsed: ParsedManuscript, truth: JatsGroundTruth): {
  figureCountDelta: number;
  tableCountDelta: number;
  score: number;
} {
  const figureCountDelta = Math.abs((parsed.figures?.length ?? 0) - truth.figures.length);
  const tableCountDelta = Math.abs((parsed.tables?.length ?? 0) - truth.tables.length);
  const figurePenalty = truth.figures.length > 0 ? figureCountDelta / truth.figures.length : 0;
  const tablePenalty = truth.tables.length > 0 ? tableCountDelta / truth.tables.length : 0;
  const score = clamp(1 - (figurePenalty + tablePenalty) / 2);

  return {
    figureCountDelta,
    tableCountDelta,
    score,
  };
}

function computeHardFailureReasons(
  parsed: ParsedManuscript,
  sectionMetrics: ReturnType<typeof scoreSections>,
  studyDesignBucket: StudyDesignBucket,
): string[] {
  const reasons: string[] = [];
  const parsedKeys = new Set(parsed.sections.map((section) => normalizeSectionMatchKey(section.title)));
  const requiredKeys = REQUIRED_SECTION_KEYS_BY_STUDY_BUCKET[studyDesignBucket];

  for (const key of requiredKeys) {
    if (!parsedKeys.has(key)) {
      reasons.push(`missing_required_section:${key}`);
    }
  }

  if (!parsedKeys.has("title")) {
    reasons.push("title_section_absent");
  }
  if (requiredKeys.includes("abstract") && !parsedKeys.has("abstract")) {
    reasons.push("abstract_section_absent");
  }
  if (sectionMetrics.bodyCoverageRecall < 0.7) {
    reasons.push("body_coverage_below_threshold");
  }
  if (parsed.diagnostics.some((diagnostic) => diagnostic.level === "error")) {
    reasons.push("parser_error_diagnostic_present");
  }

  return Array.from(new Set(reasons));
}

function buildScores(params: {
  metadataScore: number;
  structureScore: number;
  contentScore: number;
  referenceScore: number;
  figuresTablesScore: number;
}): ScoreBreakdown {
  const overall =
    params.metadataScore * 0.15 +
    params.structureScore * 0.3 +
    params.contentScore * 0.35 +
    params.referenceScore * 0.15 +
    params.figuresTablesScore * 0.05;

  return {
    metadata: clamp(params.metadataScore),
    structure: clamp(params.structureScore),
    content: clamp(params.contentScore),
    references: clamp(params.referenceScore),
    figuresTables: clamp(params.figuresTablesScore),
    overall: clamp(overall),
  };
}

export function scoreParsedDocumentAgainstTruth(params: ScoreParams): Omit<ParserBenchmarkResultRecord, "createdAt" | "rawResultPath"> {
  const metadataMetrics = scoreMetadata(params.parsed, params.truth);
  const sectionMetrics = scoreSections(params.parsed, params.truth);
  const referenceMetrics = scoreReferences(params.parsed, params.truth);
  const figureTableMetrics = scoreFiguresTables(params.parsed, params.truth);

  const metadataScore = average([
    metadataMetrics.titleExactMatch ? 1 : 0,
    metadataMetrics.titleTokenF1,
    metadataMetrics.authorRecall,
    metadataMetrics.institutionRecall,
  ]);
  const structureScore = average([
    sectionMetrics.headingPrecision,
    sectionMetrics.headingRecall,
    sectionMetrics.sectionOrderAgreement,
  ]);
  const contentScore = average(
    sectionMetrics.sectionComparisons
      .filter((comparison) => comparison.canonicalTitle !== "References")
      .map((comparison) => average([comparison.tokenPrecision, comparison.tokenRecall, comparison.lcsRatio])),
  );

  const scores = buildScores({
    metadataScore,
    structureScore,
    contentScore,
    referenceScore: referenceMetrics.score,
    figuresTablesScore: figureTableMetrics.score,
  });

  const metrics: BenchmarkDocumentMetrics = {
    titleExactMatch: metadataMetrics.titleExactMatch,
    titleTokenF1: metadataMetrics.titleTokenF1,
    authorRecall: metadataMetrics.authorRecall,
    institutionRecall: metadataMetrics.institutionRecall,
    headingPrecision: sectionMetrics.headingPrecision,
    headingRecall: sectionMetrics.headingRecall,
    sectionOrderAgreement: sectionMetrics.sectionOrderAgreement,
    bodyCoverageRecall: sectionMetrics.bodyCoverageRecall,
    bodyCoveragePrecision: sectionMetrics.bodyCoveragePrecision,
    referenceCountDelta: referenceMetrics.referenceCountDelta,
    referenceDoiRecall: referenceMetrics.referenceDoiRecall,
    figureCountDelta: figureTableMetrics.figureCountDelta,
    tableCountDelta: figureTableMetrics.tableCountDelta,
    sectionComparisons: sectionMetrics.sectionComparisons,
  };

  return {
    mode: params.mode,
    format: params.format,
    parseConfidence: params.parsed.parseConfidence,
    reviewRequired: params.parsed.reviewRequired,
    llmFallbackTriggered: params.llmFallbackTriggered,
    diagnosticCodes: params.parsed.diagnostics.map((diagnostic) => diagnostic.code),
    hardFailureReasons: computeHardFailureReasons(params.parsed, sectionMetrics, params.studyDesignBucket),
    metrics,
    scores,
  };
}
