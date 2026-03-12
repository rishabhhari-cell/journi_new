// DOAJ (Directory of Open Access Journals) API client
// Free, no auth required, CORS-enabled.
// Docs: https://doaj.org/api/v3/docs

const DOAJ_BASE = 'https://doaj.org/api';

// ============================================================================
// Raw response types
// ============================================================================

interface DoajApcMax {
  price: number;
  currency: string;
}

interface DoajBibjson {
  eissn?: string;
  pissn?: string;
  title?: string;
  publisher?: { name?: string; country?: string };
  apc?: {
    has_apc: boolean;
    max?: DoajApcMax[];
  };
  other_charges?: { has_other_charges: boolean };
  license?: Array<{ type: string; url?: string }>;
  editorial?: {
    review_process?: string[];
    review_url?: string;
  };
  subject?: Array<{ scheme: string; term: string; code?: string }>;
  language?: string[];
  article?: {
    license_display?: string[];
  };
}

interface DoajAdminBlock {
  seal: boolean;
  in_doaj: boolean;
  ticked: boolean;
}

interface DoajJournalRecord {
  id: string;
  bibjson: DoajBibjson;
  admin: DoajAdminBlock;
  created_date: string;
  last_updated: string;
}

interface DoajSearchResponse {
  results: DoajJournalRecord[];
  total: number;
  page: number;
  pageSize: number;
}

// ============================================================================
// Exported types
// ============================================================================

export interface DoajJournal {
  doajId: string;
  title: string | null;
  issnPrint: string | null;
  issnOnline: string | null;
  publisher: string | null;
  country: string | null;
  hasApc: boolean;
  apcMax: number | null;
  apcCurrency: string | null;
  doajSeal: boolean;
  licenseTypes: string[];
  reviewProcesses: string[];
  subjects: string[];
  languages: string[];
}

// ============================================================================
// Helpers
// ============================================================================

function parseRecord(record: DoajJournalRecord): DoajJournal {
  const b = record.bibjson;
  const apcList = b.apc?.max ?? [];
  const usdEntry = apcList.find((a) => a.currency === 'USD');
  const firstEntry = apcList[0];

  return {
    doajId: record.id,
    title: b.title ?? null,
    issnPrint: b.pissn ?? null,
    issnOnline: b.eissn ?? null,
    publisher: b.publisher?.name ?? null,
    country: b.publisher?.country ?? null,
    hasApc: b.apc?.has_apc ?? false,
    apcMax: usdEntry?.price ?? firstEntry?.price ?? null,
    apcCurrency: usdEntry ? 'USD' : (firstEntry?.currency ?? null),
    doajSeal: record.admin.seal,
    licenseTypes: (b.license ?? []).map((l) => l.type),
    reviewProcesses: b.editorial?.review_process ?? [],
    subjects: (b.subject ?? []).map((s) => s.term),
    languages: b.language ?? [],
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Look up a journal in DOAJ by ISSN (print or online).
 * Returns null if the journal is not listed in DOAJ.
 */
export async function getDoajJournalByIssn(issn: string): Promise<DoajJournal | null> {
  // Normalize ISSN format: add hyphen if missing
  const normalized = issn.replace(/-/g, '').replace(/^(\d{4})(\d{3}[\dX])$/i, '$1-$2');

  const url = new URL(`${DOAJ_BASE}/search/journals/issn:${encodeURIComponent(normalized)}`);
  url.searchParams.set('pageSize', '1');

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`DOAJ ISSN lookup failed (${response.status})`);
  }

  const data: DoajSearchResponse = await response.json();
  if (!data.results || data.results.length === 0) return null;

  return parseRecord(data.results[0]);
}

/**
 * Search DOAJ journals by title query.
 */
export async function searchDoajJournals(
  query: string,
  pageSize = 10,
): Promise<{ journals: DoajJournal[]; total: number }> {
  const url = new URL(`${DOAJ_BASE}/search/journals/${encodeURIComponent(query)}`);
  url.searchParams.set('pageSize', String(pageSize));

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`DOAJ search failed (${response.status})`);
  }

  const data: DoajSearchResponse = await response.json();
  return {
    journals: (data.results ?? []).map(parseRecord),
    total: data.total ?? 0,
  };
}

/**
 * Enrich a batch of journals with DOAJ data by ISSN.
 * Returns a Map of ISSN → DoajJournal for matched entries.
 * Uses Promise.allSettled so individual failures don't break the batch.
 */
export async function batchEnrichFromDoaj(
  issns: string[],
): Promise<Map<string, DoajJournal>> {
  const results = await Promise.allSettled(
    issns.map(async (issn) => {
      const journal = await getDoajJournalByIssn(issn);
      return { issn, journal };
    }),
  );

  const map = new Map<string, DoajJournal>();
  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.journal) {
      map.set(result.value.issn.replace(/-/g, ''), result.value.journal);
    }
  }
  return map;
}
