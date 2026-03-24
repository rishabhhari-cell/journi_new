// Acceptance likelihood scoring engine for journal-manuscript matching

import type { Journal, Manuscript, AcceptanceLikelihood } from '@/types';
import { ALL_SUBJECT_AREAS } from '@/data/journals-database';
import { MEDICAL_SYNONYMS } from '@/lib/medical-synonyms';

export interface ManuscriptProfile {
  subjectKeywords: string[];       // Subject areas matched
  keywordWeights: Map<string, number>; // Subject area → weight (0-1)
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
  const hasAcceptanceRate = typeof journal.acceptanceRate === 'number';
  const hasImpactFactor = typeof journal.impactFactor === 'number';
  const hasOpenAccess = typeof journal.openAccess === 'boolean';
  const acceptanceRate = hasAcceptanceRate ? journal.acceptanceRate! : 50;

  // Factor 1: Acceptance Rate (0-30 points)
  const acceptanceScore = Math.round((acceptanceRate / 100) * 30);

  // Factor 2: Topic Relevance (0-30 points) — weighted matching
  const matchedAreas: string[] = [];
  let totalWeight = 0;
  for (const area of journal.subjectAreas) {
    const areaLower = area.toLowerCase();
    // Check if any manuscript keyword matches this journal subject area
    for (const kw of profile.subjectKeywords) {
      const kwLower = kw.toLowerCase();
      if (areaLower.includes(kwLower) || kwLower.includes(areaLower) || areaLower === kwLower) {
        matchedAreas.push(area);
        // Use the weight from the profile if available
        const weight = profile.keywordWeights?.get(kwLower) ?? profile.keywordWeights?.get(kw) ?? 0.5;
        totalWeight += weight;
        break;
      }
    }
  }
  // Score based on both coverage and weight strength
  const coverageRatio = profile.subjectKeywords.length > 0
    ? matchedAreas.length / Math.max(journal.subjectAreas.length, 1)
    : 0;
  const weightBonus = Math.min(1, totalWeight / Math.max(journal.subjectAreas.length, 1));
  const topicScore = Math.min(30, Math.round((coverageRatio * 0.5 + weightBonus * 0.5) * 30 * 2));

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
  // DOAJ Seal bonus: +2 for verified high-quality OA. High APC penalty: -2 if APC > $3000.
  let openAccessScore = hasOpenAccess
    ? journal.openAccess === profile.prefersOpenAccess
      ? 10
      : 3
    : 6;
  if (journal.doajSeal) openAccessScore = Math.min(10, openAccessScore + 2);
  if (typeof journal.apcCostUsd === 'number' && journal.apcCostUsd > 3000) {
    openAccessScore = Math.max(0, openAccessScore - 2);
  }

  // Factor 5: Competitiveness / Impact Factor Tier (0-15 points)
  // Higher IF = more competitive = lower likelihood
  let competitivenessScore: number;
  let competitivenessDetail: string;
  if (!hasImpactFactor) {
    competitivenessScore = 8;
    competitivenessDetail = 'Impact factor unavailable from source';
  } else if (journal.impactFactor! < 2) {
    competitivenessScore = 15;
    competitivenessDetail = `Accessible journal (IF ${journal.impactFactor!.toFixed(1)})`;
  } else if (journal.impactFactor! < 5) {
    competitivenessScore = 12;
    competitivenessDetail = `Moderate journal (IF ${journal.impactFactor!.toFixed(1)})`;
  } else if (journal.impactFactor! < 10) {
    competitivenessScore = 8;
    competitivenessDetail = `Mid-tier journal (IF ${journal.impactFactor!.toFixed(1)}) - moderately competitive`;
  } else if (journal.impactFactor! < 20) {
    competitivenessScore = 5;
    competitivenessDetail = `High-tier journal (IF ${journal.impactFactor!.toFixed(1)}) - competitive`;
  } else if (journal.impactFactor! < 50) {
    competitivenessScore = 3;
    competitivenessDetail = `Top-tier journal (IF ${journal.impactFactor!.toFixed(1)}) - very competitive`;
  } else {
    competitivenessScore = 1;
    competitivenessDetail = `Elite journal (IF ${journal.impactFactor!.toFixed(1)}) - extremely competitive`;
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
        detail: hasAcceptanceRate
          ? `Journal accepts ${journal.acceptanceRate}% of submissions`
          : 'Acceptance rate unavailable from source',
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
        detail: hasOpenAccess
          ? journal.openAccess
            ? journal.doajSeal
              ? 'Open access journal — DOAJ Seal quality verified'
              : 'Open access journal'
            : typeof journal.apcCostUsd === 'number' && journal.apcCostUsd > 3000
              ? `Subscription-based journal (APC: $${journal.apcCostUsd.toLocaleString()})`
              : 'Subscription-based journal'
          : 'Open access status unavailable from source',
      },
      competitiveness: {
        score: competitivenessScore,
        detail: competitivenessDetail,
      },
    },
  };
}

/**
 * Extract subject keywords from a manuscript using deep semantic analysis.
 * Scans the manuscript title, abstract, and body against the medical synonym
 * dictionary to identify core themes, then maps them to journal subject areas.
 * Returns subject areas sorted by relevance weight (strongest first).
 */
export function extractManuscriptKeywords(manuscript: Manuscript): string[] {
  const result = extractManuscriptKeywordsWeighted(manuscript);
  // Return subject areas sorted by weight descending
  return Array.from(result.entries())
    .sort((a, b) => b[1] - a[1])
    .map(([area]) => area);
}

/**
 * Returns a Map of subject area → weight (0-1) based on how strongly
 * the manuscript content relates to each area.
 */
export function extractManuscriptKeywordsWeighted(manuscript: Manuscript): Map<string, number> {
  const titleLower = manuscript.title.toLowerCase();

  // Separate abstract from body for weighted analysis
  const abstractSection = manuscript.sections.find(
    (s) => s.title.toLowerCase().includes('abstract')
  );
  const abstractText = abstractSection
    ? abstractSection.content.replace(/<[^>]*>/g, ' ').toLowerCase()
    : '';

  const bodyText = manuscript.sections
    .filter((s) => !s.title.toLowerCase().includes('abstract'))
    .map((s) => s.content.replace(/<[^>]*>/g, ' '))
    .join(' ')
    .toLowerCase();

  // Count occurrences of each synonym term in title, abstract, and body
  // Weight: title = 5x, abstract = 3x, body = 1x
  const areaScores = new Map<string, number>();

  const countOccurrences = (text: string, term: string): number => {
    if (!text || !term) return 0;
    const escaped = term.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Use word boundary matching for short terms, substring for longer ones
    const pattern = term.length <= 3
      ? new RegExp(`\\b${escaped}\\b`, 'gi')
      : new RegExp(escaped, 'gi');
    const matches = text.match(pattern);
    return matches ? matches.length : 0;
  };

  // Scan all synonym terms against the manuscript
  for (const [term, areas] of Object.entries(MEDICAL_SYNONYMS)) {
    const titleCount = countOccurrences(titleLower, term);
    const abstractCount = countOccurrences(abstractText, term);
    const bodyCount = countOccurrences(bodyText, term);

    const weightedCount = titleCount * 5 + abstractCount * 3 + bodyCount;

    if (weightedCount > 0) {
      for (const area of areas) {
        const current = areaScores.get(area) ?? 0;
        areaScores.set(area, current + weightedCount);
      }
    }
  }

  // Also check direct subject area name matches (e.g., "Cardiology" in text)
  for (const area of ALL_SUBJECT_AREAS) {
    const areaLower = area.toLowerCase();
    const titleCount = countOccurrences(titleLower, areaLower);
    const abstractCount = countOccurrences(abstractText, areaLower);
    const bodyCount = countOccurrences(bodyText, areaLower);
    const weightedCount = titleCount * 5 + abstractCount * 3 + bodyCount;
    if (weightedCount > 0) {
      const current = areaScores.get(area) ?? 0;
      areaScores.set(area, current + weightedCount);
    }
  }

  if (areaScores.size === 0) return new Map();

  // Normalize scores to 0-1 range
  const maxScore = Math.max(...Array.from(areaScores.values()));
  const normalized = new Map<string, number>();
  for (const [area, score] of Array.from(areaScores.entries())) {
    normalized.set(area, score / maxScore);
  }

  // Filter out very low-signal areas (< 5% of max) to reduce noise
  const filtered = new Map<string, number>();
  for (const [area, weight] of Array.from(normalized.entries())) {
    if (weight >= 0.05) {
      filtered.set(area, weight);
    }
  }

  return filtered;
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
