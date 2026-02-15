/**
 * Smart Citation Lookup Service
 * Resolves citations from DOIs, URLs, paper titles using the CrossRef API (free, no auth required)
 */

export interface LookupResult {
  authors: string[];
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: 'article' | 'book' | 'website' | 'conference';
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
}

export interface SearchResult {
  results: LookupResult[];
  total: number;
}

// Detect what kind of input the user provided
export function detectInputType(input: string): 'doi' | 'url' | 'title' {
  const trimmed = input.trim();

  // DOI patterns: 10.xxxx/... or full doi.org URL
  if (/^10\.\d{4,}\//.test(trimmed)) return 'doi';
  if (/doi\.org\/10\.\d{4,}\//.test(trimmed)) return 'doi';

  // URL pattern
  if (/^https?:\/\//i.test(trimmed)) return 'url';

  // Default to title search
  return 'title';
}

// Extract DOI from various formats
function extractDoi(input: string): string {
  const trimmed = input.trim();

  // Extract from doi.org URL
  const doiUrlMatch = trimmed.match(/doi\.org\/(10\.\d{4,}\/.+)/i);
  if (doiUrlMatch) return doiUrlMatch[1];

  // Already a raw DOI
  if (/^10\.\d{4,}\//.test(trimmed)) return trimmed;

  return trimmed;
}

// Parse CrossRef work item into our LookupResult format
function parseCrossRefWork(work: any): LookupResult {
  const authors = (work.author || []).map((a: any) => {
    if (a.given && a.family) return `${a.family}, ${a.given.charAt(0)}.`;
    if (a.family) return a.family;
    if (a.name) return a.name;
    return 'Unknown';
  });

  const title = Array.isArray(work.title) ? work.title[0] : work.title || 'Untitled';

  // Extract year from various date fields
  let year = new Date().getFullYear();
  if (work['published-print']?.['date-parts']?.[0]?.[0]) {
    year = work['published-print']['date-parts'][0][0];
  } else if (work['published-online']?.['date-parts']?.[0]?.[0]) {
    year = work['published-online']['date-parts'][0][0];
  } else if (work['issued']?.['date-parts']?.[0]?.[0]) {
    year = work['issued']['date-parts'][0][0];
  } else if (work['created']?.['date-parts']?.[0]?.[0]) {
    year = work['created']['date-parts'][0][0];
  }

  // Determine type
  let type: LookupResult['type'] = 'article';
  const crossRefType = work.type || '';
  if (crossRefType.includes('book')) type = 'book';
  else if (crossRefType.includes('proceedings') || crossRefType.includes('conference')) type = 'conference';

  const journal = Array.isArray(work['container-title'])
    ? work['container-title'][0]
    : work['container-title'] || '';

  return {
    authors,
    title,
    year,
    journal,
    doi: work.DOI || '',
    url: work.URL || (work.DOI ? `https://doi.org/${work.DOI}` : ''),
    type,
    volume: work.volume || '',
    issue: work.issue || '',
    pages: work.page || '',
    publisher: work.publisher || '',
  };
}

// Look up a citation by DOI
export async function lookupByDoi(input: string): Promise<LookupResult> {
  const doi = extractDoi(input);
  const response = await fetch(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error(`Could not find a paper with DOI: ${doi}`);
  }

  const data = await response.json();
  return parseCrossRefWork(data.message);
}

// Search for citations by title
export async function searchByTitle(title: string, maxResults = 5): Promise<SearchResult> {
  const params = new URLSearchParams({
    query: title,
    rows: String(maxResults),
    sort: 'relevance',
    order: 'desc',
  });

  const response = await fetch(`https://api.crossref.org/works?${params}`, {
    headers: { 'Accept': 'application/json' },
  });

  if (!response.ok) {
    throw new Error('Search failed. Please try again.');
  }

  const data = await response.json();
  const items = data.message?.items || [];

  return {
    results: items.map(parseCrossRefWork),
    total: data.message?.['total-results'] || 0,
  };
}

// Try to extract metadata from a URL by searching CrossRef for the page title
export async function lookupByUrl(url: string): Promise<SearchResult> {
  // Extract potential identifiers from the URL
  // Many academic URLs contain DOIs in the path
  const doiInUrl = url.match(/10\.\d{4,}\/[^\s?#]+/);
  if (doiInUrl) {
    try {
      const result = await lookupByDoi(doiInUrl[0]);
      return { results: [result], total: 1 };
    } catch {
      // Fall through to URL-based search
    }
  }

  // Try to extract a meaningful search term from the URL path
  const urlObj = new URL(url);
  const pathSegments = urlObj.pathname
    .split('/')
    .filter((s) => s.length > 3)
    .map((s) => s.replace(/[-_]/g, ' '));
  const searchTerm = pathSegments.slice(-2).join(' ');

  if (searchTerm.length > 3) {
    return searchByTitle(searchTerm);
  }

  throw new Error('Could not extract citation info from this URL. Try pasting the DOI or paper title instead.');
}

// Main smart lookup function
export async function smartLookup(
  input: string
): Promise<{ type: 'single'; result: LookupResult } | { type: 'multiple'; results: SearchResult }> {
  const inputType = detectInputType(input);

  switch (inputType) {
    case 'doi': {
      const result = await lookupByDoi(input);
      return { type: 'single', result };
    }
    case 'url': {
      const results = await lookupByUrl(input);
      if (results.results.length === 1) {
        return { type: 'single', result: results.results[0] };
      }
      return { type: 'multiple', results };
    }
    case 'title': {
      const results = await searchByTitle(input);
      if (results.results.length === 1) {
        return { type: 'single', result: results.results[0] };
      }
      return { type: 'multiple', results };
    }
  }
}
