// Manuscript formatting engine — reformats sections to match journal requirements

import type { Manuscript, DocumentSection, Journal } from '@/types';
import { nanoid } from 'nanoid';

/**
 * Format a manuscript according to a journal's submission requirements.
 * Returns a new Manuscript with reordered/renamed/augmented sections.
 */
export function formatManuscriptForJournal(
  manuscript: Manuscript,
  journal: Journal
): Manuscript {
  const requirements = journal.formattingRequirements;
  if (!requirements) {
    return { ...manuscript, sections: manuscript.sections.map((s) => ({ ...s, id: nanoid() })) };
  }

  const orderedSections: DocumentSection[] = [];
  let orderIndex = 0;

  // 1. Map required sections from existing manuscript
  for (const requiredSection of requirements.sectionOrder) {
    const existing = findMatchingSection(manuscript.sections, requiredSection);

    if (existing) {
      let content = existing.content;

      // Handle structured abstract conversion
      if (
        requiredSection.toLowerCase() === 'abstract' &&
        requirements.abstractStructure === 'structured' &&
        !isStructuredAbstract(content)
      ) {
        content = convertToStructuredAbstract(content);
      }

      // Add word limit warnings
      content = addWordLimitWarning(content, requiredSection, requirements, journal.name);

      orderedSections.push({
        ...existing,
        id: nanoid(),
        title: requiredSection,
        order: orderIndex++,
        content,
        status: existing.status,
      });
    } else {
      // Create placeholder for missing required section
      orderedSections.push({
        id: nanoid(),
        title: requiredSection,
        content: `<p><em>[${requiredSection} — Please add content for this required section]</em></p>`,
        status: 'pending',
        order: orderIndex++,
      });
    }
  }

  // 2. Add additional required sections
  if (requirements.additionalSections) {
    for (const additionalSection of requirements.additionalSections) {
      // Skip if we already have this section
      if (orderedSections.some((s) => s.title.toLowerCase() === additionalSection.toLowerCase())) {
        continue;
      }

      const existing = findMatchingSection(manuscript.sections, additionalSection);
      orderedSections.push({
        id: nanoid(),
        title: additionalSection,
        content: existing
          ? existing.content
          : `<p><em>[${additionalSection} — Required by ${journal.name}]</em></p>`,
        status: existing ? existing.status : 'pending',
        order: orderIndex++,
      });
    }
  }

  return {
    ...manuscript,
    id: nanoid(),
    sections: orderedSections,
    updatedAt: new Date(),
  };
}

// ============================================================================
// Helpers
// ============================================================================

const SECTION_ALIASES: Record<string, string[]> = {
  abstract: ['abstract', 'summary'],
  introduction: ['introduction', 'background'],
  methods: ['methods', 'materials and methods', 'methodology', 'study design'],
  'materials and methods': ['methods', 'materials and methods', 'methodology', 'study design'],
  results: ['results', 'findings'],
  discussion: ['discussion', 'discussion and conclusion'],
  conclusion: ['conclusion', 'conclusions', 'summary and conclusions'],
  references: ['references', 'bibliography'],
  'literature review': ['literature review', 'background', 'related work'],
  background: ['background', 'introduction', 'literature review'],
  declarations: ['declarations'],
  'supporting information': ['supporting information', 'supplementary materials', 'appendix'],
  'data availability statement': ['data availability statement', 'data availability'],
  'data availability': ['data availability statement', 'data availability'],
};

function findMatchingSection(
  sections: DocumentSection[],
  requiredTitle: string
): DocumentSection | undefined {
  const requiredLower = requiredTitle.toLowerCase();

  // Exact match first
  const exact = sections.find((s) => s.title.toLowerCase() === requiredLower);
  if (exact) return exact;

  // Alias match
  const aliases = SECTION_ALIASES[requiredLower] || [requiredLower];
  return sections.find((s) => aliases.includes(s.title.toLowerCase()));
}

function isStructuredAbstract(content: string): boolean {
  const structuredHeaders = ['background', 'objective', 'methods', 'results', 'conclusion'];
  const lowerContent = content.toLowerCase();
  return structuredHeaders.filter((h) => lowerContent.includes(`<strong>${h}`)).length >= 3;
}

function convertToStructuredAbstract(content: string): string {
  const plainText = content
    .replace(/<[^>]*>/g, '')
    .replace(/&nbsp;/g, ' ')
    .trim();
  if (!plainText) {
    return `<p><strong>Background:</strong> <em>[Enter background]</em></p>
<p><strong>Objective:</strong> <em>[Enter objective]</em></p>
<p><strong>Methods:</strong> <em>[Enter methods]</em></p>
<p><strong>Results:</strong> <em>[Enter results]</em></p>
<p><strong>Conclusion:</strong> <em>[Enter conclusion]</em></p>`;
  }

  // Split text into roughly equal parts for structured format
  const sentences = plainText.split(/(?<=[.!?])\s+/).filter((s) => s.length > 0);
  const total = sentences.length;
  const chunk = Math.max(1, Math.floor(total / 5));

  const bg = sentences.slice(0, chunk).join(' ');
  const obj = sentences.slice(chunk, chunk * 2).join(' ') || '<em>[State the objective]</em>';
  const meth = sentences.slice(chunk * 2, chunk * 3).join(' ') || '<em>[Describe the methods]</em>';
  const res = sentences.slice(chunk * 3, chunk * 4).join(' ') || '<em>[Summarize key results]</em>';
  const conc = sentences.slice(chunk * 4).join(' ') || '<em>[State the conclusion]</em>';

  return `<p><strong>Background:</strong> ${bg}</p>
<p><strong>Objective:</strong> ${obj}</p>
<p><strong>Methods:</strong> ${meth}</p>
<p><strong>Results:</strong> ${res}</p>
<p><strong>Conclusion:</strong> ${conc}</p>`;
}

function addWordLimitWarning(
  content: string,
  sectionTitle: string,
  requirements: NonNullable<Journal['formattingRequirements']>,
  journalName: string
): string {
  const wordCount = content
    .replace(/<[^>]*>/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 0).length;

  if (sectionTitle.toLowerCase() === 'abstract' && requirements.wordLimits?.abstract) {
    if (wordCount > requirements.wordLimits.abstract) {
      return (
        `<div style="background:#fef3c7;border:1px solid #f59e0b;border-radius:6px;padding:8px 12px;margin-bottom:12px;font-size:12px;color:#92400e;">` +
        `Warning: Abstract is ${wordCount} words. ${journalName} limit: ${requirements.wordLimits.abstract} words.</div>` +
        content
      );
    }
  }

  return content;
}
