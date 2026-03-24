import { describe, expect, it } from 'vitest';
import { countWordsFromHtml, countWordsFromText } from '@shared/word-count';
import { parseRawDocument } from '@shared/document-parse';
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
