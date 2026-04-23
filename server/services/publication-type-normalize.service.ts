import {
  PUBLISHER_PATTERNS,
} from "./parser-benchmark.constants";
import type {
  PublisherBucket,
  PublisherMatchResult,
  StudyDesignNormalizationResult,
} from "./parser-benchmark.types";

function containsAny(text: string, patterns: RegExp[]): boolean {
  return patterns.some((pattern) => pattern.test(text));
}

function normalizeText(parts: Array<string | undefined | null>): string {
  return parts
    .filter((part): part is string => typeof part === "string" && part.trim().length > 0)
    .join(" ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function hasWord(text: string, phrase: string): boolean {
  return text.includes(phrase.toLowerCase());
}

export function normalizePublicationTypes(
  publicationTypesRaw: string[],
  title?: string,
  abstractText?: string,
): StudyDesignNormalizationResult {
  const normalizedTypes = publicationTypesRaw.map((item) => item.toLowerCase());
  const combinedText = normalizeText([title, abstractText, ...publicationTypesRaw]);
  const reasons: string[] = [];

  if (
    normalizedTypes.some((type) => type.includes("systematic review") || type.includes("meta-analysis")) ||
    (hasWord(combinedText, "systematic review") && hasWord(combinedText, "meta-analysis"))
  ) {
    reasons.push("Matched systematic review/meta-analysis publication type or title/abstract language.");
    return {
      bucket: "systematic_review_meta_analysis",
      confidence: "high",
      reasons,
    };
  }

  if (
    normalizedTypes.some((type) => type.includes("review")) ||
    hasWord(combinedText, "literature review") ||
    hasWord(combinedText, "narrative review") ||
    hasWord(combinedText, "scoping review")
  ) {
    reasons.push("Matched review publication type or review-specific language.");
    return {
      bucket: "review_non_systematic",
      confidence: normalizedTypes.some((type) => type.includes("review")) ? "high" : "medium",
      reasons,
    };
  }

  if (
    normalizedTypes.some((type) =>
      type.includes("clinical trial") ||
      type.includes("randomized controlled trial") ||
      type.includes("adaptive clinical trial"),
    ) ||
    hasWord(combinedText, "randomized trial") ||
    hasWord(combinedText, "randomised trial") ||
    hasWord(combinedText, "interventional")
  ) {
    reasons.push("Matched interventional or clinical trial signals.");
    return {
      bucket: "rct_or_interventional_trial",
      confidence: normalizedTypes.length > 0 ? "high" : "medium",
      reasons,
    };
  }

  if (
    normalizedTypes.some((type) => type.includes("case reports")) ||
    hasWord(combinedText, "case report") ||
    hasWord(combinedText, "case series")
  ) {
    reasons.push("Matched case report or case series signals.");
    return {
      bucket: "case_report_or_case_series",
      confidence: normalizedTypes.some((type) => type.includes("case reports")) ? "high" : "medium",
      reasons,
    };
  }

  if (
    hasWord(combinedText, "cohort") ||
    hasWord(combinedText, "case-control") ||
    hasWord(combinedText, "case control") ||
    hasWord(combinedText, "cross-sectional") ||
    hasWord(combinedText, "cross sectional") ||
    hasWord(combinedText, "observational")
  ) {
    reasons.push("Matched observational study language.");
    return {
      bucket: "observational_cohort_case_control_cross_sectional",
      confidence: "medium",
      reasons,
    };
  }

  reasons.push("No strong publication-type signals matched; falling back to other primary research.");
  return {
    bucket: "other_primary_research",
    confidence: publicationTypesRaw.length > 0 ? "low" : "low",
    reasons,
  };
}

export function matchPublisherBucket(publisherRaw?: string, journal?: string): PublisherMatchResult {
  const haystack = normalizeText([publisherRaw, journal]);
  if (!haystack) {
    return { bucket: null, confidence: "low" };
  }

  for (const [bucket, patterns] of Object.entries(PUBLISHER_PATTERNS) as Array<[PublisherBucket, RegExp[]]>) {
    const matched = patterns.find((pattern) => pattern.test(haystack));
    if (matched) {
      return {
        bucket,
        confidence: publisherRaw ? "high" : "medium",
        matchedPattern: matched.source,
      };
    }
  }

  if (containsAny(haystack, [/nature/i])) {
    return {
      bucket: "springer_nature",
      confidence: "low",
      matchedPattern: "nature",
    };
  }

  return { bucket: null, confidence: "low" };
}
