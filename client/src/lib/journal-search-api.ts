// Journal search API — fans out to OpenAlex + NLM in parallel
// Results are merged by ISSN: OpenAlex wins on metrics, NLM wins on MEDLINE flag.
// Static database kept as emergency fallback only.

import Fuse from 'fuse.js';
import type { Journal } from '@/types';
import { MEDICAL_JOURNALS } from '@/data/journals-database';
import { ACCEPTANCE_RATES } from '@/data/acceptance-rates';
import { searchNlmJournals, browseNlmJournals, type NlmJournal } from '@/lib/nlm-api';
import {
  searchOpenAlexJournals,
  browseOpenAlexJournals,
  type OpenAlexJournal,
} from '@/lib/openalex-api';
import { batchEnrichFromDoaj } from '@/lib/doaj-api';
import { toFormattingRequirements } from '@/lib/journal-submission-requirements';

// ============================================================================
// Static database lookup index (for metric enrichment of NLM results)
// ============================================================================

const GRADIENTS = [
  'from-blue-800 to-blue-600',
  'from-emerald-800 to-emerald-600',
  'from-purple-800 to-purple-600',
  'from-rose-800 to-rose-600',
  'from-amber-800 to-amber-600',
  'from-teal-800 to-teal-600',
  'from-indigo-800 to-indigo-600',
  'from-pink-800 to-pink-600',
  'from-cyan-800 to-cyan-600',
  'from-orange-800 to-orange-600',
];

const staticByName = new Map<string, Journal>();
const staticByIssn = new Map<string, Journal>();
for (const j of MEDICAL_JOURNALS) {
  staticByName.set(j.name.toLowerCase(), j as Journal);
  if (j.issn) {
    staticByIssn.set(j.issn.replace(/-/g, ''), j as Journal);
  }
}

function getInitials(name: string): string {
  return name
    .split(/\s+/)
    .filter((w) => w.length > 2)
    .map((w) => w[0])
    .join('')
    .substring(0, 3)
    .toUpperCase();
}

function findStaticMatch(issns: string[], name: string): Journal | undefined {
  for (const issn of issns) {
    const match = staticByIssn.get(issn.replace(/-/g, ''));
    if (match) return match;
  }
  return staticByName.get(name.toLowerCase());
}

// ============================================================================
// Normalizers: raw API responses → Journal
// ============================================================================

function openAlexToJournal(oa: OpenAlexJournal, index: number): Journal {
  const issns = [oa.issnL, ...oa.issns].filter(Boolean) as string[];
  const staticMatch = findStaticMatch(issns, oa.name);

  return {
    id: staticMatch?.id ?? `oa-${oa.openAlexId.replace('https://openalex.org/', '')}`,
    name: oa.name,
    coverColor: staticMatch?.coverColor ?? GRADIENTS[index % GRADIENTS.length],
    coverInitial: staticMatch?.coverInitial ?? getInitials(oa.name),
    impactFactor: oa.impactFactor ?? staticMatch?.impactFactor ?? null,
    avgDecisionDays: staticMatch?.avgDecisionDays ?? null,
    acceptanceRate: staticMatch?.acceptanceRate ?? null,
    openAccess: oa.isOa,
    subjectAreas:
      staticMatch?.subjectAreas ??
      (oa.concepts.length > 0 ? oa.concepts.map((c) => c.name) : ['General']),
    geographicLocation: oa.countryCode ?? staticMatch?.geographicLocation ?? 'Unknown',
    publisher: oa.publisher ?? staticMatch?.publisher ?? 'Unknown',
    issn: oa.issnL ?? issns[0] ?? staticMatch?.issn,
    issnOnline: oa.issns.find((i) => i !== oa.issnL) ?? undefined,
    isMedlineIndexed: staticMatch?.isMedlineIndexed ?? false,
    website: oa.homepageUrl ?? staticMatch?.website,
    submissionRequirements: staticMatch?.submissionRequirements ?? null,
    formattingRequirements: toFormattingRequirements(staticMatch?.submissionRequirements) ?? staticMatch?.formattingRequirements,
    openAlexId: oa.openAlexId,
    apcCostUsd: oa.apcUsd,
    citationsCount: oa.citationsCount,
    worksCount: oa.worksCount,
    isDoajListed: oa.isInDoaj,
    logoUrl: oa.imageUrl ?? null,
  };
}

function nlmToJournal(nlm: NlmJournal, index: number): Journal {
  const issns = [nlm.issnPrint, nlm.issnOnline].filter(Boolean) as string[];
  const staticMatch = findStaticMatch(issns, nlm.title);
  const title = nlm.title.trim();
  const subjects = nlm.broadSubjects.length > 0 ? nlm.broadSubjects : nlm.subjects;

  return {
    id: staticMatch?.id ?? `nlm-${nlm.nlmId}`,
    name: title,
    abbreviation: nlm.isoAbbreviation || nlm.medlineAbbreviation || undefined,
    coverColor: staticMatch?.coverColor ?? GRADIENTS[index % GRADIENTS.length],
    coverInitial: staticMatch?.coverInitial ?? getInitials(title),
    impactFactor: staticMatch?.impactFactor ?? null,
    avgDecisionDays: staticMatch?.avgDecisionDays ?? null,
    acceptanceRate: staticMatch?.acceptanceRate ?? null,
    openAccess: staticMatch?.openAccess ?? null,
    subjectAreas: staticMatch?.subjectAreas ?? (subjects.length > 0 ? subjects : ['General']),
    geographicLocation: staticMatch?.geographicLocation ?? nlm.country,
    publisher: staticMatch?.publisher ?? nlm.publisher,
    issn: nlm.issnPrint ?? nlm.issnOnline ?? staticMatch?.issn,
    issnOnline: nlm.issnOnline ?? undefined,
    isMedlineIndexed: nlm.isMedlineIndexed,
    website: staticMatch?.website,
    submissionRequirements: staticMatch?.submissionRequirements ?? null,
    formattingRequirements: toFormattingRequirements(staticMatch?.submissionRequirements) ?? staticMatch?.formattingRequirements,
  };
}

// ============================================================================
// Merge logic: combine NLM + OpenAlex results by ISSN
// OpenAlex wins on metrics; NLM wins on MEDLINE flag and abbreviation.
// ============================================================================

function mergeJournals(nlmList: Journal[], oaList: Journal[]): Journal[] {
  const byIssn = new Map<string, Journal>();
  const byId = new Map<string, Journal>();

  // Index NLM results first
  for (const j of nlmList) {
    byId.set(j.id, j);
    if (j.issn) byIssn.set(j.issn.replace(/-/g, ''), j);
    if (j.issnOnline) byIssn.set(j.issnOnline.replace(/-/g, ''), j);
  }

  const merged: Journal[] = [...nlmList];

  for (const oa of oaList) {
    const issnKey = oa.issn?.replace(/-/g, '') ?? '';
    const issnOnlineKey = oa.issnOnline?.replace(/-/g, '') ?? '';

    const nlmMatch = byIssn.get(issnKey) || byIssn.get(issnOnlineKey);

    if (nlmMatch) {
      // Merge: enrich NLM entry with OpenAlex metrics
      const idx = merged.indexOf(nlmMatch);
      merged[idx] = {
        ...nlmMatch,
        impactFactor: oa.impactFactor ?? nlmMatch.impactFactor,
        openAccess: oa.openAccess ?? nlmMatch.openAccess,
        openAlexId: oa.openAlexId,
        apcCostUsd: oa.apcCostUsd,
        citationsCount: oa.citationsCount,
        worksCount: oa.worksCount,
        isDoajListed: oa.isDoajListed ?? nlmMatch.isDoajListed,
        website: nlmMatch.website ?? oa.website,
        publisher: nlmMatch.publisher !== 'Unknown' ? nlmMatch.publisher : oa.publisher,
      };
    } else if (!byId.has(oa.id)) {
      // OpenAlex-only result — add it
      merged.push(oa);
      byId.set(oa.id, oa);
      if (oa.issn) byIssn.set(oa.issn.replace(/-/g, ''), oa);
    }
  }

  return merged;
}

// ============================================================================
// DOAJ batch enrichment (top N results only, to limit requests)
// ============================================================================

async function enrichWithDoaj(journals: Journal[]): Promise<Journal[]> {
  const TOP_N = 15;
  const toEnrich = journals.slice(0, TOP_N);
  const issns = toEnrich
    .flatMap((j) => [j.issn, j.issnOnline])
    .filter((i): i is string => Boolean(i));

  if (issns.length === 0) return journals;

  try {
    const doajMap = await batchEnrichFromDoaj(issns);

    return journals.map((j, idx) => {
      if (idx >= TOP_N) return j;
      const key = j.issn?.replace(/-/g, '') ?? j.issnOnline?.replace(/-/g, '') ?? '';
      const doaj = doajMap.get(key);
      if (!doaj) return j;
      return {
        ...j,
        isDoajListed: true,
        doajSeal: doaj.doajSeal,
        doajId: doaj.doajId,
        apcCostUsd: j.apcCostUsd ?? (doaj.hasApc ? doaj.apcMax : null),
        apcCurrency: doaj.apcCurrency ?? undefined,
        openAccess: j.openAccess ?? true, // DOAJ listed = OA
        peerReviewType: doaj.reviewProcesses[0] ?? j.peerReviewType ?? null,
      };
    });
  } catch {
    return journals;
  }
}

// ============================================================================
// Fuse.js fallback search (client-side, static database — emergency only)
// ============================================================================

let fuseInstance: Fuse<Journal> | null = null;

function getFuse(): Fuse<Journal> {
  if (!fuseInstance) {
    fuseInstance = new Fuse(MEDICAL_JOURNALS as Journal[], {
      keys: [
        { name: 'name', weight: 0.4 },
        { name: 'publisher', weight: 0.15 },
        { name: 'subjectAreas', weight: 0.25 },
        { name: 'issn', weight: 0.1 },
        { name: 'abbreviation', weight: 0.1 },
      ],
      threshold: 0.4,
      includeScore: true,
      ignoreLocation: true,
    });
  }
  return fuseInstance;
}

// ============================================================================
// Public API
// ============================================================================

export interface SearchOptions {
  offset?: number;
  isOpenAccess?: boolean;
  isMedline?: boolean;
  subjectAreas?: string[];
}

export interface JournalSearchResult {
  journals: Journal[];
  total: number;
  source: 'backend' | 'openalex' | 'nlm' | 'static';
}

function mapBackendJournal(raw: any, index: number): Journal {
  return {
    id: raw.id,
    name: raw.name,
    externalId: raw.externalId ?? undefined,
    abbreviation: raw.abbreviation ?? undefined,
    coverColor: raw.coverColor ?? GRADIENTS[index % GRADIENTS.length],
    coverInitial: raw.coverInitial ?? getInitials(raw.name),
    logoUrl: raw.logoUrl ?? null,
    impactFactor: raw.impactFactor ?? null,
    impactFactorYear: raw.impactFactorYear ?? null,
    avgDecisionDays: raw.avgDecisionDays ?? null,
    acceptanceRate: raw.acceptanceRate ?? null,
    openAccess: raw.openAccess ?? null,
    subjectAreas: raw.subjectAreas ?? ['General'],
    geographicLocation: raw.geographicLocation ?? 'Unknown',
    publisher: raw.publisher ?? 'Unknown',
    issn: raw.issnPrint ?? undefined,
    issnOnline: raw.issnOnline ?? undefined,
    website: raw.websiteUrl ?? raw.website ?? undefined,
    websiteUrl: raw.websiteUrl ?? null,
    submissionPortalUrl: raw.submissionPortalUrl ?? null,
    submissionRequirements: raw.submissionRequirements ?? null,
    apcCostUsd: raw.apcCostUsd ?? null,
    citeScore: raw.citeScore ?? null,
    sjrScore: raw.sjrScore ?? null,
    sjrQuartile: raw.sjrQuartile ?? null,
    peerReviewType: raw.peerReviewType ?? null,
    provenance: raw.provenance ?? undefined,
    lastVerifiedAt: raw.lastVerifiedAt ?? undefined,
    formattingRequirements: toFormattingRequirements(raw.submissionRequirements) ?? raw.formattingRequirements ?? undefined,
  };
}

async function searchBackend(
  query: string | null,
  limit: number,
  options: SearchOptions = {},
): Promise<JournalSearchResult | null> {
  try {
    const base = import.meta.env.VITE_API_BASE_URL ?? '/api';
    const endpoint = `${base}/journals`;
    const params = new URLSearchParams();
    params.set('page', String(Math.floor((options.offset ?? 0) / limit) + 1));
    params.set('perPage', String(limit));
    if (query && query.trim().length > 0) {
      params.set('q', query.trim());
    }
    if (typeof options.isOpenAccess === 'boolean') {
      params.set('openAccess', String(options.isOpenAccess));
    }
    if (options.subjectAreas && options.subjectAreas.length > 0) {
      params.set('subjectAreas', options.subjectAreas.join(','));
    }

    const response = await fetch(`${endpoint}?${params.toString()}`, {
      headers: { Accept: 'application/json' },
    });
    if (!response.ok) {
      return null;
    }

    const payload = await response.json();
    if (!payload || !Array.isArray(payload.data)) {
      return null;
    }

    const journals = payload.data.map((journal: any, index: number) => mapBackendJournal(journal, index));
    const total = typeof payload.total === 'number' ? payload.total : payload.data.length;

    // Backend has no data — fall through to external APIs / static fallback
    if (journals.length === 0 && total === 0) return null;

    return { journals, total, source: 'backend' };
  } catch {
    return null;
  }
}

/**
 * Search journals by fanning out to OpenAlex + NLM in parallel.
 * Results are merged by ISSN and enriched with DOAJ data for the top results.
 * Falls back to Fuse.js on the static database if both APIs fail.
 */
export async function searchJournals(
  query: string,
  limit = 25,
  options: SearchOptions = {},
): Promise<JournalSearchResult> {
  const backendResult = await searchBackend(query, limit, options);
  if (backendResult) {
    return { ...backendResult, journals: enrichWithAcceptanceRate(backendResult.journals) };
  }

  const [oaResult, nlmResult] = await Promise.allSettled([
    searchOpenAlexJournals(query, limit, options.offset ?? 0),
    searchNlmJournals(query, limit, options.offset ?? 0),
  ]);

  const oaJournals =
    oaResult.status === 'fulfilled'
      ? oaResult.value.journals.map((j, i) => openAlexToJournal(j, i))
      : [];

  const nlmJournals =
    nlmResult.status === 'fulfilled'
      ? nlmResult.value.journals.map((j, i) => nlmToJournal(j, i))
      : [];

  const totalCount =
    oaResult.status === 'fulfilled'
      ? oaResult.value.totalCount
      : nlmResult.status === 'fulfilled'
        ? nlmResult.value.totalCount
        : 0;

  if (oaJournals.length === 0 && nlmJournals.length === 0) {
    return searchStatic(query, limit, options);
  }

  let journals = mergeJournals(nlmJournals, oaJournals);
  journals = applyClientFilters(journals, options);
  journals = await enrichWithDoaj(journals);
  journals = enrichWithAcceptanceRate(journals);

  const source = oaJournals.length > 0 ? 'openalex' : 'nlm';

  return { journals, total: totalCount, source };
}

/**
 * List/browse journals (no query) fanning out to OpenAlex + NLM.
 * Falls back to static database if both APIs fail.
 */
export async function listJournals(
  limit = 25,
  options: SearchOptions = {},
): Promise<JournalSearchResult> {
  const backendResult = await searchBackend(null, limit, options);
  if (backendResult) {
    return { ...backendResult, journals: enrichWithAcceptanceRate(backendResult.journals) };
  }

  const [oaResult, nlmResult] = await Promise.allSettled([
    browseOpenAlexJournals(limit, options.offset ?? 0),
    browseNlmJournals(limit, options.offset ?? 0, true),
  ]);

  const oaJournals =
    oaResult.status === 'fulfilled'
      ? oaResult.value.journals.map((j, i) => openAlexToJournal(j, i))
      : [];

  const nlmJournals =
    nlmResult.status === 'fulfilled'
      ? nlmResult.value.journals.map((j, i) => nlmToJournal(j, i))
      : [];

  const totalCount =
    oaResult.status === 'fulfilled'
      ? oaResult.value.totalCount
      : nlmResult.status === 'fulfilled'
        ? nlmResult.value.totalCount
        : 0;

  if (oaJournals.length === 0 && nlmJournals.length === 0) {
    return listStatic(limit, options);
  }

  let journals = mergeJournals(nlmJournals, oaJournals);
  journals = applyClientFilters(journals, options);
  journals = await enrichWithDoaj(journals);
  journals = enrichWithAcceptanceRate(journals);

  const source = oaJournals.length > 0 ? 'openalex' : 'nlm';

  return { journals, total: totalCount, source };
}

// ============================================================================
// Static fallback implementations (emergency only)
// ============================================================================

function searchStatic(
  query: string,
  limit: number,
  options: SearchOptions,
): JournalSearchResult {
  const fuse = getFuse();
  const results = fuse.search(query);
  let journals = results.map((r) => r.item);
  journals = applyClientFilters(journals, options);
  const offset = options.offset ?? 0;
  return {
    journals: journals.slice(offset, offset + limit),
    total: journals.length,
    source: 'static',
  };
}

function listStatic(limit: number, options: SearchOptions): JournalSearchResult {
  let journals = [...(MEDICAL_JOURNALS as Journal[])];
  journals = applyClientFilters(journals, options);
  const offset = options.offset ?? 0;
  return {
    journals: journals.slice(offset, offset + limit),
    total: journals.length,
    source: 'static',
  };
}

function enrichWithAcceptanceRate(journals: Journal[]): Journal[] {
  return journals.map((j) => {
    if (j.acceptanceRate != null) return j;
    const key = (j.issn ?? j.issnOnline ?? '').replace(/-/g, '');
    const rate = key ? ACCEPTANCE_RATES[key] : undefined;
    return rate != null ? { ...j, acceptanceRate: rate } : j;
  });
}

function applyClientFilters(journals: Journal[], options: SearchOptions): Journal[] {
  let results = journals;

  if (typeof options.isOpenAccess === 'boolean') {
    results = results.filter((j) => j.openAccess === options.isOpenAccess);
  }

  if (options.isMedline === true) {
    results = results.filter((j) => j.isMedlineIndexed === true);
  }

  if (options.subjectAreas && options.subjectAreas.length > 0) {
    const areas = new Set(options.subjectAreas.map((a) => a.toLowerCase()));
    results = results.filter((j) =>
      j.subjectAreas.some((sa) => areas.has(sa.toLowerCase())),
    );
  }

  return results;
}
