// Acceptance likelihood scoring engine for journal-manuscript matching

import type { Journal, Manuscript, AcceptanceLikelihood } from '@/types';
import { ALL_SUBJECT_AREAS } from '@/data/journals-database';

export interface ManuscriptProfile {
  subjectKeywords: string[];
  totalWordCount: number;
  prefersOpenAccess: boolean;
}

/**
 * Calculate multi-factor acceptance likelihood for a journal given a manuscript profile.
 * Total: 100 points across 5 factors.
 */
export function calculateAcceptanceLikelihood(
  journal: Journal,
  profile: ManuscriptProfile
): AcceptanceLikelihood {
  // Factor 1: Acceptance Rate (0-30 points)
  const acceptanceScore = Math.round((journal.acceptanceRate / 100) * 30);

  // Factor 2: Topic Relevance (0-30 points)
  const matchedAreas = journal.subjectAreas.filter((area) =>
    profile.subjectKeywords.some(
      (kw) =>
        area.toLowerCase().includes(kw.toLowerCase()) ||
        kw.toLowerCase().includes(area.toLowerCase())
    )
  );
  const relevanceRatio =
    profile.subjectKeywords.length > 0
      ? matchedAreas.length / Math.max(journal.subjectAreas.length, 1)
      : 0;
  const topicScore = Math.min(30, Math.round(relevanceRatio * 30));

  // Factor 3: Word Count Alignment (0-15 points)
  const typicalMin = 3000;
  const typicalMax = 8000;
  let wordCountScore = 15;
  if (profile.totalWordCount < typicalMin) {
    wordCountScore = Math.round((profile.totalWordCount / typicalMin) * 15);
  } else if (profile.totalWordCount > typicalMax) {
    wordCountScore = Math.max(
      0,
      15 - Math.round(((profile.totalWordCount - typicalMax) / typicalMax) * 15)
    );
  }

  // Factor 4: Open Access Fit (0-10 points)
  const openAccessScore = journal.openAccess === profile.prefersOpenAccess ? 10 : 3;

  // Factor 5: Competitiveness / Impact Factor Tier (0-15 points)
  // Higher IF = more competitive = lower likelihood
  let competitivenessScore: number;
  let competitivenessDetail: string;
  if (journal.impactFactor < 2) {
    competitivenessScore = 15;
    competitivenessDetail = `Accessible journal (IF ${journal.impactFactor.toFixed(1)})`;
  } else if (journal.impactFactor < 5) {
    competitivenessScore = 12;
    competitivenessDetail = `Moderate journal (IF ${journal.impactFactor.toFixed(1)})`;
  } else if (journal.impactFactor < 10) {
    competitivenessScore = 8;
    competitivenessDetail = `Mid-tier journal (IF ${journal.impactFactor.toFixed(1)}) - moderately competitive`;
  } else if (journal.impactFactor < 20) {
    competitivenessScore = 5;
    competitivenessDetail = `High-tier journal (IF ${journal.impactFactor.toFixed(1)}) - competitive`;
  } else if (journal.impactFactor < 50) {
    competitivenessScore = 3;
    competitivenessDetail = `Top-tier journal (IF ${journal.impactFactor.toFixed(1)}) - very competitive`;
  } else {
    competitivenessScore = 1;
    competitivenessDetail = `Elite journal (IF ${journal.impactFactor.toFixed(1)}) - extremely competitive`;
  }

  const overall = Math.min(
    100,
    acceptanceScore + topicScore + wordCountScore + openAccessScore + competitivenessScore
  );

  const label: AcceptanceLikelihood['label'] =
    overall >= 75
      ? 'Very High'
      : overall >= 55
        ? 'High'
        : overall >= 40
          ? 'Moderate'
          : overall >= 25
            ? 'Low'
            : 'Very Low';

  return {
    overall,
    label,
    breakdown: {
      acceptanceRate: {
        score: acceptanceScore,
        detail: `Journal accepts ${journal.acceptanceRate}% of submissions`,
      },
      topicRelevance: {
        score: topicScore,
        detail:
          matchedAreas.length > 0
            ? `${matchedAreas.length} subject area${matchedAreas.length > 1 ? 's' : ''} match your manuscript`
            : 'No direct subject area matches found',
        matchedAreas,
      },
      wordCountAlignment: {
        score: wordCountScore,
        detail: `Manuscript is ${profile.totalWordCount.toLocaleString()} words`,
      },
      openAccessFit: {
        score: openAccessScore,
        detail: journal.openAccess ? 'Open access journal' : 'Subscription-based journal',
      },
      competitiveness: {
        score: competitivenessScore,
        detail: competitivenessDetail,
      },
    },
  };
}

/**
 * Extract subject keywords from a manuscript by scanning title and section content
 * against known medical subject areas.
 */
export function extractManuscriptKeywords(manuscript: Manuscript): string[] {
  const titleLower = manuscript.title.toLowerCase();

  // Strip HTML from all sections and combine
  const contentText = manuscript.sections
    .map((s) => s.content.replace(/<[^>]*>/g, ' '))
    .join(' ')
    .toLowerCase();

  const allText = titleLower + ' ' + contentText;

  // Match against known subject areas from the journal database
  return ALL_SUBJECT_AREAS.filter((area) => {
    const areaLower = area.toLowerCase();
    // Check title first (strong signal)
    if (titleLower.includes(areaLower)) return true;
    // Check content (need multiple mentions for weaker signal)
    const regex = new RegExp(areaLower.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi');
    const matches = allText.match(regex);
    return matches && matches.length >= 2;
  });
}

/**
 * Count words from HTML content by stripping tags.
 */
export function countWordsFromHtml(html: string): number {
  if (!html || html === '<p></p>') return 0;
  const text = html.replace(/<[^>]*>/g, ' ').replace(/&nbsp;/g, ' ');
  const words = text
    .trim()
    .split(/\s+/)
    .filter((w) => w.length > 0);
  return words.length;
}
