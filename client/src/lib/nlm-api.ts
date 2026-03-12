// NLM E-utilities API client for searching PubMed/MEDLINE journals
// Uses the public NCBI E-utilities API (supports CORS, no API key required)
// Docs: https://www.ncbi.nlm.nih.gov/books/NBK25500/

const EUTILS_BASE = 'https://eutils.ncbi.nlm.nih.gov/entrez/eutils';

interface ESearchResult {
  esearchresult: {
    count: string;
    retmax: string;
    retstart: string;
    idlist: string[];
  };
}

interface ESummaryResult {
  result: {
    uids: string[];
    [uid: string]: ESummaryRecord | string[];
  };
}

interface ESummaryRecord {
  uid: string;
  title: string;
  medlineta: string;
  isoabbreviation: string;
  issnlist: Array<{ issn: string; issntype: string }>;
  publishername: string;
  placeofpublication: string;
  broadheadinglist: string[];
  meshheadinglist?: string[];
  currentlyindexedforsubset: string[];
  activesubsetlist?: string[];
  language?: string[];
  country?: string;
}

export interface NlmJournal {
  nlmId: string;
  title: string;
  isoAbbreviation: string;
  medlineAbbreviation: string;
  issnPrint?: string;
  issnOnline?: string;
  publisher: string;
  country: string;
  subjects: string[];
  broadSubjects: string[];
  isMedlineIndexed: boolean;
  isActive: boolean;
}

export interface NlmSearchResult {
  journals: NlmJournal[];
  totalCount: number;
}

/**
 * Search the NLM Catalog for journals matching a query.
 * Uses esearch to find matching UIDs, then esummary to get details.
 */
export async function searchNlmJournals(
  query: string,
  limit = 25,
  offset = 0,
): Promise<NlmSearchResult> {
  // Build search term: restrict to serials (journals) in NLM Catalog
  const searchTerm = `${query}[All Fields] AND journal[pt]`;

  const searchUrl = new URL(`${EUTILS_BASE}/esearch.fcgi`);
  searchUrl.searchParams.set('db', 'nlmcatalog');
  searchUrl.searchParams.set('term', searchTerm);
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('retmax', String(limit));
  searchUrl.searchParams.set('retstart', String(offset));
  searchUrl.searchParams.set('sort', 'relevance');

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) {
    throw new Error(`NLM esearch failed (${searchResponse.status})`);
  }

  const searchData: ESearchResult = await searchResponse.json();
  const totalCount = parseInt(searchData.esearchresult.count, 10);
  const uids = searchData.esearchresult.idlist;

  if (uids.length === 0) {
    return { journals: [], totalCount };
  }

  // Fetch summaries for the found UIDs
  const journals = await fetchNlmSummaries(uids);
  return { journals, totalCount };
}

/**
 * Browse all journals from NLM Catalog with optional MEDLINE filter.
 */
export async function browseNlmJournals(
  limit = 25,
  offset = 0,
  medlineOnly = false,
): Promise<NlmSearchResult> {
  const searchTerm = medlineOnly
    ? 'currentlyindexed[All] AND journal[pt]'
    : 'journal[pt]';

  const searchUrl = new URL(`${EUTILS_BASE}/esearch.fcgi`);
  searchUrl.searchParams.set('db', 'nlmcatalog');
  searchUrl.searchParams.set('term', searchTerm);
  searchUrl.searchParams.set('retmode', 'json');
  searchUrl.searchParams.set('retmax', String(limit));
  searchUrl.searchParams.set('retstart', String(offset));

  const searchResponse = await fetch(searchUrl.toString());
  if (!searchResponse.ok) {
    throw new Error(`NLM esearch failed (${searchResponse.status})`);
  }

  const searchData: ESearchResult = await searchResponse.json();
  const totalCount = parseInt(searchData.esearchresult.count, 10);
  const uids = searchData.esearchresult.idlist;

  if (uids.length === 0) {
    return { journals: [], totalCount };
  }

  const journals = await fetchNlmSummaries(uids);
  return { journals, totalCount };
}

/**
 * Fetch journal summaries from NLM Catalog by UIDs.
 */
async function fetchNlmSummaries(uids: string[]): Promise<NlmJournal[]> {
  const summaryUrl = new URL(`${EUTILS_BASE}/esummary.fcgi`);
  summaryUrl.searchParams.set('db', 'nlmcatalog');
  summaryUrl.searchParams.set('id', uids.join(','));
  summaryUrl.searchParams.set('retmode', 'json');

  const summaryResponse = await fetch(summaryUrl.toString());
  if (!summaryResponse.ok) {
    throw new Error(`NLM esummary failed (${summaryResponse.status})`);
  }

  const summaryData: ESummaryResult = await summaryResponse.json();
  const journals: NlmJournal[] = [];

  for (const uid of summaryData.result.uids) {
    const record = summaryData.result[uid] as ESummaryRecord | undefined;
    if (!record || typeof record === 'object' && 'error' in record) continue;

    const issnPrint = record.issnlist?.find(i => i.issntype === 'Print')?.issn;
    const issnOnline = record.issnlist?.find(i => i.issntype === 'Electronic')?.issn;

    const isMedlineIndexed = Array.isArray(record.currentlyindexedforsubset)
      && record.currentlyindexedforsubset.some(
        s => s.toLowerCase().includes('medline') || s.toLowerCase().includes('im'),
      );

    journals.push({
      nlmId: uid,
      title: record.title?.replace(/\.$/, '') ?? 'Unknown',
      isoAbbreviation: record.isoabbreviation ?? '',
      medlineAbbreviation: record.medlineta ?? '',
      issnPrint,
      issnOnline,
      publisher: record.publishername ?? 'Unknown',
      country: record.placeofpublication ?? record.country ?? 'Unknown',
      subjects: record.meshheadinglist ?? [],
      broadSubjects: record.broadheadinglist ?? [],
      isMedlineIndexed,
      isActive: true,
    });
  }

  return journals;
}
