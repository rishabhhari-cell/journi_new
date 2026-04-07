import { describe, expect, it } from 'vitest';
import { buildManuscriptFormatCheck } from '../../../../server/services/format-check.service';

describe('buildManuscriptFormatCheck', () => {
  it('returns deterministic safe and manual actions from journal requirements', () => {
    const result = buildManuscriptFormatCheck({
      manuscriptId: 'ms-1',
      journalId: 'journal-1',
      journalName: 'Deterministic Journal',
      manuscriptSections: [
        { id: 'sec-title', title: 'Title', contentHtml: '<p>Clinical outcomes study</p>' },
        { id: 'sec-abs', title: 'Abstract', contentHtml: '<p>Plain abstract text only.</p>' },
        { id: 'sec-methods', title: 'Materials and Methods', contentHtml: '<p>Methods content.</p>' },
        { id: 'sec-results', title: 'Results', contentHtml: '<p>Result body.</p><img src="x" /><img src="y" />' },
      ],
      manuscriptCitations: [{ id: 'cit-1' }],
      journalGuidelines: {
        journalId: 'journal-1',
        journalName: 'Deterministic Journal',
        submissionPortalUrl: null,
        wordLimits: { abstract: 3, main_text: 2, total: 20, title: 2 },
        sectionOrder: ['Title', 'Abstract', 'Introduction', 'Methods', 'Results', 'Discussion'],
        sectionsRequired: ['Abstract', 'Introduction', 'Methods', 'Results'],
        citationStyle: 'AMA',
        figuresMax: 1,
        tablesMax: 0,
        structuredAbstract: true,
        keywordsRequired: true,
        maxKeywords: 5,
        requiredDeclarations: ['Conflict of Interest'],
        requiresCoverLetter: true,
        notes: 'Add declarations.',
        acceptanceRate: null,
        avgDecisionDays: null,
        raw: {
          citation_style: 'ama',
        },
      },
    });

    expect(result.safeAutoActions.some((action) => action.type === 'rename_heading')).toBe(true);
    expect(result.safeAutoActions.some((action) => action.type === 'insert_missing_section')).toBe(true);
    expect(result.safeAutoActions.some((action) => action.type === 'apply_structured_abstract_template')).toBe(true);
    expect(result.manualActions.some((action) => action.type === 'word_limit_overrun')).toBe(true);
    expect(result.manualActions.some((action) => action.type === 'figure_limit_exceeded')).toBe(true);
    expect(result.manualActions.some((action) => action.type === 'citation_style_review')).toBe(true);
    expect(result.unsupportedChecks.some((check) => check.code === 'CITATION_STYLE_UNSUPPORTED')).toBe(true);
    expect(result.summary.citationStyleSupported).toBe(false);
  });
});
