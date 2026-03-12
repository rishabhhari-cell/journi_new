// OpenAlex API client — primary journal/paper discovery engine
// Free, no auth required. Use polite pool by sending mailto param.
// Docs: https://docs.openalex.org

const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'journi@journi.app';

// ============================================================================
// Raw response types
// ============================================================================

interface OpenAlexConcept {
  id: string;
  display_name: string;
  score: number;
  level: number;
}

interface OpenAlexApc {
  price: number;
  currency: string;
  price_usd: number;
  provenance: string;
}

interface OpenAlexSource {
  id: string;
  display_name: string;
  issn_l: string | null;
  issn: string[] | null;
  host_organization_name: string | null;
  host_organization: string | null;
  is_oa: boolean;
  is_in_doaj: boolean;
  apc_usd: number | null;
  apc_prices: OpenAlexApc[] | null;
  cited_by_count: number;
  works_count: number;
  x_concepts: OpenAlexConcept[];
  homepage_url: string | null;
  country_code: string | null;
  type: string;
  '2yr_mean_citedness': number | null;
  alternate_titles: string[] | null;
}

interface OpenAlexSearchResponse {
  results: OpenAlexSource[];
  meta: {
    count: number;
    db_response_time_ms: number;
    page: number;
    per_page: number;
  };
}

// ============================================================================
// Exported types
// ============================================================================

export interface OpenAlexJournal {
  openAlexId: string;
  name: string;
  issnL: string | null;
  issns: string[];
  publisher: string | null;
  isOa: boolean;
  isInDoaj: boolean;
  apcUsd: number | null;
  citationsCount: number;
  worksCount: number;
  concepts: Array<{ name: string; score: number }>;
  homepageUrl: string | null;
  countryCode: string | null;
  impactFactor: number | null; // 2yr mean citedness proxy
}

export interface OpenAlexSearchResult {
  journals: OpenAlexJournal[];
  totalCount: number;
}

// ============================================================================
// Helpers
// ============================================================================

function buildUrl(path: string, params: Record<string, string>): string {
  const url = new URL(`${OPENALEX_BASE}${path}`);
  url.searchParams.set('mailto', MAILTO);
  for (const [key, value] of Object.entries(params)) {
    url.searchParams.set(key, value);
  }
  return url.toString();
}

function parseSource(source: OpenAlexSource): OpenAlexJournal {
  return {
    openAlexId: source.id,
    name: source.display_name,
    issnL: source.issn_l,
    issns: source.issn ?? [],
    publisher: source.host_organization_name,
    isOa: source.is_oa,
    isInDoaj: source.is_in_doaj,
    apcUsd: source.apc_usd,
    citationsCount: source.cited_by_count,
    worksCount: source.works_count,
    concepts: (source.x_concepts ?? [])
      .filter((c) => c.level <= 2) // top-level and level-2 concepts only
      .sort((a, b) => b.score - a.score)
      .slice(0, 10)
      .map((c) => ({ name: c.display_name, score: c.score })),
    homepageUrl: source.homepage_url,
    countryCode: source.country_code,
    impactFactor: source['2yr_mean_citedness'],
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Search OpenAlex for journals matching a query.
 * Filters to type:journal sources only.
 */
export async function searchOpenAlexJournals(
  query: string,
  limit = 25,
  offset = 0,
): Promise<OpenAlexSearchResult> {
  const url = buildUrl('/sources', {
    search: query,
    filter: 'type:journal',
    per_page: String(Math.min(limit, 200)),
    page: String(Math.floor(offset / limit) + 1),
    sort: 'cited_by_count:desc',
  });

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`OpenAlex search failed (${response.status})`);
  }

  const data: OpenAlexSearchResponse = await response.json();
  return {
    journals: data.results.map(parseSource),
    totalCount: data.meta.count,
  };
}

/**
 * Browse/list journals from OpenAlex (no query — sorted by citation count).
 * Used for the idle discovery view.
 */
export async function browseOpenAlexJournals(
  limit = 25,
  offset = 0,
): Promise<OpenAlexSearchResult> {
  const url = buildUrl('/sources', {
    filter: 'type:journal,works_count:>100',
    per_page: String(Math.min(limit, 200)),
    page: String(Math.floor(offset / limit) + 1),
    sort: 'cited_by_count:desc',
  });

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`OpenAlex browse failed (${response.status})`);
  }

  const data: OpenAlexSearchResponse = await response.json();
  return {
    journals: data.results.map(parseSource),
    totalCount: data.meta.count,
  };
}

/**
 * Get a single journal by OpenAlex ID or ISSN.
 * Useful for on-demand enrichment of a selected journal card.
 */
export async function getOpenAlexJournal(idOrIssn: string): Promise<OpenAlexJournal | null> {
  // Accept full OpenAlex URL, bare ID, or ISSN
  const isIssn = /^\d{4}-\d{3}[\dX]$/i.test(idOrIssn);
  const path = isIssn ? `/sources/issn:${idOrIssn}` : `/sources/${idOrIssn}`;

  const url = buildUrl(path, {});

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`OpenAlex fetch failed (${response.status})`);

  const data: OpenAlexSource = await response.json();
  return parseSource(data);
}
