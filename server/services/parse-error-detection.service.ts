import { CANONICAL_SECTION_NAMES } from "../../shared/document-parse";
import type { ParseDiagnostic, ParsedManuscript } from "../../shared/document-parse";

function isCanonical(title: string): boolean {
  return CANONICAL_SECTION_NAMES.has(title.trim().toLowerCase());
}

/**
 * Returns true when the manuscript passes the high-confidence threshold:
 * - ≥3 sections with canonical titles
 * - no error-level diagnostics already present
 */
export function meetsHighConfidenceThreshold(manuscript: ParsedManuscript): boolean {
  const hasError = manuscript.diagnostics.some((d) => d.level === "error");
  if (hasError) return false;
  const canonicalCount = manuscript.sections.filter((s) => isCanonical(s.title)).length;
  return canonicalCount >= 3;
}

/**
 * Run deterministic checks against a parsed manuscript.
 * Returns new diagnostics — does NOT mutate the manuscript.
 */
export function runDeterministicErrorChecks(manuscript: ParsedManuscript): ParseDiagnostic[] {
  const diagnostics: ParseDiagnostic[] = [];
  const seenTitles = new Map<string, number>();

  for (const section of manuscript.sections) {
    const normalised = section.title.trim().toLowerCase();

    // Duplicate section titles
    const count = (seenTitles.get(normalised) ?? 0) + 1;
    seenTitles.set(normalised, count);
    if (count === 2) {
      diagnostics.push({
        level: "error",
        code: "DUPLICATE_SECTION",
        message: `Section "${section.title}" appears more than once — sections may have been merged incorrectly.`,
      });
    }

    const plainText = section.content.replace(/<[^>]+>/g, " ").trim();

    // Truncated text: content ends mid-word (no word boundary) suggesting hard cut-off.
    // Use a narrow signal: ends with a letter that's not a known sentence terminal,
    // AND the last "word" is short (not a URL, number, abbreviation, or parenthetical).
    if (plainText.length > 20) {
      const lastWord = plainText.split(/\s+/).pop() ?? "";
      const endsAbruptly =
        /[a-z]$/i.test(plainText) &&          // ends in a letter
        lastWord.length >= 3 &&               // not a short abbreviation
        lastWord.length <= 20 &&              // not a URL fragment
        !/[.!?,;:\-]/.test(lastWord) &&       // no punctuation within the last word
        !/^\d/.test(lastWord) &&              // not a number
        !/^(et|al|vs|cf|eg|ie|fig|pp|vol|no|ed|eds|rev|suppl)\.?$/i.test(lastWord); // not common abbrev
      if (endsAbruptly) {
        diagnostics.push({
          level: "warning",
          code: "TRUNCATED_TEXT",
          message: `Section "${section.title}" appears to end mid-sentence — text may have been cut off during import.`,
        });
      }
    }

    // Garbled encoding: Unicode replacement character
    if (plainText.includes("\uFFFD")) {
      diagnostics.push({
        level: "error",
        code: "GARBLED_ENCODING",
        message: `Section "${section.title}" contains garbled characters — the source file may have encoding issues.`,
      });
    }

    // Section too short: potential merge error (skip non-canonical short sections like "Title")
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    if (
      isCanonical(section.title) &&
      normalised !== "title" &&
      wordCount < 50 &&
      wordCount > 0
    ) {
      diagnostics.push({
        level: "warning",
        code: "SECTION_TOO_SHORT",
        message: `Section "${section.title}" has only ${wordCount} words — it may have been merged into a neighbouring section.`,
      });
    }
  }

  // Check for truncated citations
  for (const citation of manuscript.citations) {
    if (!citation.year || citation.year < 1900 || citation.year > new Date().getFullYear() + 2) {
      diagnostics.push({
        level: "warning",
        code: "CITATION_MISSING_YEAR",
        message: `A citation${citation.title ? ` ("${citation.title.slice(0, 40)}...")` : ""} has a missing or invalid year — it may have been cut off during import.`,
      });
    }
  }

  return diagnostics;
}
