import type { JournalFormattingRequirements } from '@/types';
import type { JournalSubmissionRequirements } from '@shared/backend';
import { normalizeCitationStyle, normalizeJournalSubmissionRequirements } from '@shared/journal-requirements';

export function toFormattingRequirements(
  value: JournalSubmissionRequirements | Record<string, unknown> | null | undefined,
): JournalFormattingRequirements | undefined {
  const normalized = normalizeJournalSubmissionRequirements(value);
  if (!normalized) return undefined;

  const referenceStyle = normalizeCitationStyle(normalized.citation_style) ?? 'vancouver';

  return {
    sectionOrder: normalized.section_order ?? normalized.sections_required ?? [],
    wordLimits: {
      total: normalized.word_limits?.total ?? undefined,
      abstract: normalized.word_limits?.abstract ?? undefined,
      title: normalized.word_limits?.title ?? undefined,
    },
    abstractStructure: normalized.structured_abstract ? 'structured' : 'unstructured',
    referenceStyle,
    requiresKeywords: normalized.keywords_required ?? false,
    maxKeywords: normalized.max_keywords ?? undefined,
    requiresCoverLetter: normalized.requires_cover_letter ?? false,
    figureLimit: normalized.figures_max ?? undefined,
    tableLimit: normalized.tables_max ?? undefined,
    additionalSections: normalized.required_declarations ?? undefined,
  };
}
