import { describe, expect, it } from 'vitest';
import { toFormattingRequirements } from '@/lib/journal-submission-requirements';

describe('toFormattingRequirements', () => {
  it('maps typed submission requirements into client formatting requirements', () => {
    const formatted = toFormattingRequirements({
      word_limits: { abstract: 250, total: 3000 },
      sections_required: ['Abstract', 'Introduction', 'Methods'],
      citation_style: 'Vancouver',
      figures_max: 4,
      tables_max: 3,
      structured_abstract: true,
      keywords_required: true,
      max_keywords: 6,
      requires_cover_letter: true,
      required_declarations: ['Conflict of Interest', 'Funding'],
    });

    expect(formatted).toEqual({
      sectionOrder: ['Abstract', 'Introduction', 'Methods'],
      wordLimits: { total: 3000, abstract: 250, title: undefined },
      abstractStructure: 'structured',
      referenceStyle: 'vancouver',
      requiresKeywords: true,
      maxKeywords: 6,
      requiresCoverLetter: true,
      figureLimit: 4,
      tableLimit: 3,
      additionalSections: ['Conflict of Interest', 'Funding'],
    });
  });

  it('returns undefined when requirements are absent', () => {
    expect(toFormattingRequirements(null)).toBeUndefined();
  });
});
