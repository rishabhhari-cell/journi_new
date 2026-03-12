// Unpaywall API client
// Resolves DOIs to legal, free full-text PDF locations.
// Free, no auth required. Email param is mandatory per their TOS.
// Docs: https://unpaywall.org/products/api

const UNPAYWALL_BASE = 'https://api.unpaywall.org/v2';
const MAILTO = 'journi@journi.app';

// ============================================================================
// Raw response types
// ============================================================================

type OaStatus = 'gold' | 'hybrid' | 'bronze' | 'green' | 'closed';

interface UnpaywallOaLocation {
  is_best: boolean;
  landing_page_url: string | null;
  license: string | null;
  pmh_id: string | null;
  updated: string;
  url: string | null;
  url_for_pdf: string | null;
  url_for_landing_page: string | null;
  host_type: 'publisher' | 'repository' | null;
  version: string | null;
}

interface UnpaywallResponse {
  doi: string;
  doi_url: string;
  title: string | null;
  is_oa: boolean;
  oa_status: OaStatus;
  best_oa_location: UnpaywallOaLocation | null;
  oa_locations: UnpaywallOaLocation[];
  journal_name: string | null;
  journal_issns: string | null;
  publisher: string | null;
  year: number | null;
  updated: string;
}

// ============================================================================
// Exported types
// ============================================================================

export interface UnpaywallResult {
  doi: string;
  isOa: boolean;
  oaStatus: OaStatus;
  pdfUrl: string | null;
  landingPageUrl: string | null;
  hostType: 'publisher' | 'repository' | null;
  license: string | null;
}

// ============================================================================
// In-memory cache to avoid re-fetching on every render
// ============================================================================

const cache = new Map<string, UnpaywallResult>();

// ============================================================================
// Public API
// ============================================================================

/**
 * Look up the open access status and free PDF URL for a DOI.
 * Results are cached in-memory for the session.
 * Returns null if the DOI is not found in Unpaywall.
 */
export async function getFreePdf(doi: string): Promise<UnpaywallResult | null> {
  const normalizedDoi = doi.trim().replace(/^https?:\/\/doi\.org\//i, '');

  if (cache.has(normalizedDoi)) {
    return cache.get(normalizedDoi)!;
  }

  const url = `${UNPAYWALL_BASE}/${encodeURIComponent(normalizedDoi)}?email=${MAILTO}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });

  if (response.status === 404) return null;
  if (!response.ok) {
    throw new Error(`Unpaywall lookup failed (${response.status})`);
  }

  const data: UnpaywallResponse = await response.json();

  const best = data.best_oa_location;
  const result: UnpaywallResult = {
    doi: normalizedDoi,
    isOa: data.is_oa,
    oaStatus: data.oa_status,
    pdfUrl: best?.url_for_pdf ?? null,
    landingPageUrl: best?.url_for_landing_page ?? best?.landing_page_url ?? null,
    hostType: best?.host_type ?? null,
    license: best?.license ?? null,
  };

  cache.set(normalizedDoi, result);
  return result;
}

/**
 * Enrich a batch of DOIs with Unpaywall data.
 * Individual failures are silently swallowed so the batch always completes.
 * Returns a Map of DOI → UnpaywallResult for found entries.
 */
export async function batchGetFreePdfs(
  dois: string[],
): Promise<Map<string, UnpaywallResult>> {
  const results = await Promise.allSettled(
    dois.map(async (doi) => {
      const result = await getFreePdf(doi);
      return { doi, result };
    }),
  );

  const map = new Map<string, UnpaywallResult>();
  for (const r of results) {
    if (r.status === 'fulfilled' && r.value.result) {
      map.set(r.value.doi, r.value.result);
    }
  }
  return map;
}
