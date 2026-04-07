import type { JournalCitationStyle, JournalSubmissionRequirements } from "./backend";

export const SUPPORTED_CITATION_STYLES = new Set<JournalCitationStyle>([
  "vancouver",
  "apa",
  "mla",
]);

export function normalizeCitationStyle(value: string | null | undefined): JournalCitationStyle | null {
  if (!value) return null;
  const normalized = value.trim().toLowerCase();
  if (
    normalized === "vancouver" ||
    normalized === "apa" ||
    normalized === "mla" ||
    normalized === "harvard" ||
    normalized === "ama" ||
    normalized === "nlm" ||
    normalized === "ieee"
  ) {
    return normalized;
  }
  return null;
}

export function normalizeJournalSubmissionRequirements(
  value: JournalSubmissionRequirements | Record<string, unknown> | null | undefined,
): JournalSubmissionRequirements | null {
  if (!value) return null;

  const raw = value as Record<string, unknown>;
  const normalizeStringArray = (input: unknown): string[] | null => {
    if (!Array.isArray(input)) return null;
    const next = input.map((entry) => String(entry).trim()).filter(Boolean);
    return next.length > 0 ? next : null;
  };

  return {
    word_limits:
      raw.word_limits && typeof raw.word_limits === "object"
        ? {
            abstract: typeof (raw.word_limits as Record<string, unknown>).abstract === "number"
              ? ((raw.word_limits as Record<string, unknown>).abstract as number)
              : null,
            main_text: typeof (raw.word_limits as Record<string, unknown>).main_text === "number"
              ? ((raw.word_limits as Record<string, unknown>).main_text as number)
              : null,
            total: typeof (raw.word_limits as Record<string, unknown>).total === "number"
              ? ((raw.word_limits as Record<string, unknown>).total as number)
              : null,
            title: typeof (raw.word_limits as Record<string, unknown>).title === "number"
              ? ((raw.word_limits as Record<string, unknown>).title as number)
              : null,
          }
        : null,
    section_order: normalizeStringArray(raw.section_order),
    sections_required: normalizeStringArray(raw.sections_required),
    citation_style: normalizeCitationStyle(typeof raw.citation_style === "string" ? raw.citation_style : null),
    figures_max: typeof raw.figures_max === "number" ? raw.figures_max : null,
    tables_max: typeof raw.tables_max === "number" ? raw.tables_max : null,
    structured_abstract: typeof raw.structured_abstract === "boolean" ? raw.structured_abstract : null,
    notes: typeof raw.notes === "string" ? raw.notes : null,
    required_declarations: normalizeStringArray(raw.required_declarations),
    keywords_required: typeof raw.keywords_required === "boolean" ? raw.keywords_required : null,
    max_keywords: typeof raw.max_keywords === "number" ? raw.max_keywords : null,
    requires_cover_letter: typeof raw.requires_cover_letter === "boolean" ? raw.requires_cover_letter : null,
  };
}
