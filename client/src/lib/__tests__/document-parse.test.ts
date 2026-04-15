import { describe, expect, it, vi } from 'vitest';
import { countWordsFromHtml, countWordsFromText } from '@shared/word-count';
import { normalizeSectionMatchKey, parseRawDocument } from '@shared/document-parse';
import { OUP_AI_REVIEW_SEED } from '@/data/seeded-ou-paper';

describe('word count tokenizer', () => {
  it('counts punctuation-heavy text', () => {
    expect(countWordsFromText(`AI-driven, clinician-in-the-loop: what's next?`)).toBe(8);
  });

  it('counts html content consistently', () => {
    const html = '<h2>Intro</h2><p>This is an <strong>HTML</strong> block.</p>';
    expect(countWordsFromHtml(html)).toBe(6);
  });

  it('returns zero for empty values', () => {
    expect(countWordsFromText('')).toBe(0);
    expect(countWordsFromHtml('<p></p>')).toBe(0);
  });
});

describe('section mapping', () => {
  it('maps common heading variants into canonical sections', () => {
    const parsed = parseRawDocument({
      fileTitle: 'Import Test',
      format: 'pdf',
      text: [
        'ABSTRACT',
        'This is the abstract.',
        '',
        'METHODS',
        'Database search strategy details.',
        '',
        'RESULTS',
        'Main outcomes from included studies.',
        '',
        'REFERENCES',
        '1. Doe J. Example. 2020. 10.1000/xyz123',
      ].join('\n'),
    });

    const titles = parsed.sections.map((section) => section.title);
    expect(titles).toContain('Title');
    expect(titles).toContain('Abstract');
    expect(titles).toContain('Search Strategy');
    expect(titles).toContain('Results & Synthesis');
    expect(titles).toContain('References');
    expect(parsed.citations).toHaveLength(1);
    expect(parsed.citations[0].doi).toBe('10.1000/xyz123');
  });

  it('parses docx-style html even when DOMParser is unavailable', () => {
    vi.stubGlobal('DOMParser', undefined);

    try {
      const parsed = parseRawDocument({
        fileTitle: 'Digital Health Survey',
        format: 'docx',
        html: [
          '<p><strong>Digital health in the undergraduate medical curriculum</strong></p>',
          '<p><strong>Abstract</strong></p>',
          '<p>Short abstract text.</p>',
          '<p><strong>Introduction</strong></p>',
          '<p>Intro body text.</p>',
          '<p><strong>Methods</strong></p>',
          '<p>Methods body text.</p>',
          '<p><strong>Results</strong></p>',
          '<p>Results body text.</p>',
          '<p><strong>Discussion</strong></p>',
          '<p>Discussion body text.</p>',
        ].join(''),
        diagnostics: [
          {
            level: 'warning',
            code: 'DOCX_PARSE_WARNING',
            message: 'Unrecognised paragraph style: Normal (Web)',
          },
        ],
      });

      const titles = parsed.sections.map((section) => section.title);
      expect(titles).toContain('Title');
      expect(titles).toContain('Abstract');
      expect(parsed.sections.find((section) => section.title === 'Abstract')?.content).toContain('Intro body text.');
      expect(parsed.sections.find((section) => section.title === 'Abstract')?.content).toContain('<h3>Results</h3>');
      expect(parsed.reviewRequired).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('folds docx front matter and structured abstract into the right sections', () => {
    const parsed = parseRawDocument({
      fileTitle: 'Import Test',
      format: 'docx',
      html: [
        '<p><strong>Digital health in the undergraduate medical curriculum</strong></p>',
        '<p><strong>Authors:</strong></p>',
        '<p>Yuri Aung, Example Author</p>',
        '<p><strong>Abstract</strong></p>',
        '<p><strong>Introduction</strong></p>',
        '<p>Abstract introduction text.</p>',
        '<p><strong>Methods</strong></p>',
        '<p>Abstract methods text.</p>',
        '<p><strong>Results</strong></p>',
        '<p>Abstract results text.</p>',
        '<p><strong>Discussion</strong></p>',
        '<p>Abstract discussion text.</p>',
        '<p><strong>Introduction</strong></p>',
        '<p>Main introduction text.</p>',
        '<p><strong>Results</strong></p>',
        '<p>Main results text.</p>',
        '<p>Figure 1: Example figure caption.</p>',
      ].join(''),
    });

    const title = parsed.sections.find((section) => section.title === 'Title');
    const abstract = parsed.sections.find((section) => section.title === 'Abstract');
    const introduction = parsed.sections.find((section) => section.title === 'Introduction');
    const results = parsed.sections.find((section) => section.title === 'Results & Synthesis');
    const figures = parsed.sections.find((section) => section.title === 'Figures and Tables');

    expect(title?.content).toContain('Authors:');
    expect(abstract?.content).toContain('<h3>Introduction</h3>');
    expect(abstract?.content).toContain('Abstract methods text.');
    expect(introduction?.content).toContain('Main introduction text.');
    expect(results?.content).toContain('Main results text.');
    expect(figures?.content).toContain('Figure 1: Example figure caption.');
  });
});

describe('section match keys', () => {
  it('maps imported full-paper aliases onto existing manuscript sections', () => {
    expect(normalizeSectionMatchKey('Results & Synthesis')).toBe('results');
    expect(normalizeSectionMatchKey('Results')).toBe('results');
    expect(normalizeSectionMatchKey('Search Strategy')).toBe('methods');
    expect(normalizeSectionMatchKey('Materials and Methods')).toBe('methods');
    expect(normalizeSectionMatchKey('Figures and Tables')).toBe('figures_and_tables');
  });
});

describe('OUP seed golden checks', () => {
  it('contains seeded literature-review sections', () => {
    expect(OUP_AI_REVIEW_SEED.sections.map((section) => section.title)).toEqual([
      'Title',
      'Abstract',
      'Introduction',
      'Search Strategy',
      'Results & Synthesis',
      'Discussion',
      'Limitations',
      'Conclusions',
      'References',
    ]);
  });

  it('contains exactly 46 citations', () => {
    expect(OUP_AI_REVIEW_SEED.citations).toHaveLength(46);
  });
});
