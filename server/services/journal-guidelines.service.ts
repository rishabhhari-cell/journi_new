import type { JournalDTO, JournalGuidelinesDTO } from "../../shared/backend";
import { normalizeJournalSubmissionRequirements } from "../../shared/journal-requirements";

export function toJournalGuidelinesDto(journal: JournalDTO): JournalGuidelinesDTO {
  const raw = normalizeJournalSubmissionRequirements(journal.submissionRequirements);

  return {
    journalId: journal.id,
    journalName: journal.name,
    submissionPortalUrl: journal.submissionPortalUrl ?? null,
    wordLimits: raw?.word_limits ?? null,
    sectionOrder: raw?.section_order ?? null,
    sectionsRequired: raw?.sections_required ?? null,
    citationStyle: raw?.citation_style ?? null,
    figuresMax: raw?.figures_max ?? null,
    tablesMax: raw?.tables_max ?? null,
    structuredAbstract: raw?.structured_abstract ?? null,
    keywordsRequired: raw?.keywords_required ?? null,
    maxKeywords: raw?.max_keywords ?? null,
    requiredDeclarations: raw?.required_declarations ?? null,
    requiresCoverLetter: raw?.requires_cover_letter ?? null,
    notes: raw?.notes ?? null,
    acceptanceRate: journal.acceptanceRate ?? null,
    avgDecisionDays: journal.avgDecisionDays ?? null,
    raw,
  };
}
