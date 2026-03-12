// ROR (Research Organization Registry) API client
// Free, no auth required, CORS-enabled.
// Provides standardized institution identifiers and metadata.
// Docs: https://ror.readme.io/docs/rest-api

const ROR_BASE = 'https://api.ror.org/v2';

// ============================================================================
// Raw response types
// ============================================================================

interface RorName {
  value: string;
  types: string[];
  lang: string | null;
}

interface RorLink {
  value: string;
  type: string;
}

interface RorLocation {
  geonames_id: number;
  geonames_details: {
    name: string;
    country_name: string;
    country_code: string;
    lat: number;
    lng: number;
  };
}

interface RorOrganizationRaw {
  id: string;
  names: RorName[];
  types: string[];
  links: RorLink[];
  locations: RorLocation[];
  established: number | null;
  status: string;
}

interface RorSearchResponse {
  items: RorOrganizationRaw[];
  number_of_results: number;
  time_taken: number;
  meta: {
    types: Array<{ id: string; count: number }>;
    statuses: Array<{ id: string; count: number }>;
    countries: Array<{ id: string; count: number }>;
  };
}

// ============================================================================
// Exported types
// ============================================================================

export interface RorOrganization {
  rorId: string;
  name: string;
  alternateNames: string[];
  types: string[];
  homepageUrl: string | null;
  countryName: string | null;
  countryCode: string | null;
  city: string | null;
  established: number | null;
  status: string;
}

// ============================================================================
// Helpers
// ============================================================================

function parseOrganization(raw: RorOrganizationRaw): RorOrganization {
  // Primary name: prefer English label, else first name
  const labelName = raw.names.find((n) => n.types.includes('label'));
  const englishName = raw.names.find((n) => n.lang === 'en');
  const primaryName = labelName ?? englishName ?? raw.names[0];

  const alternateNames = raw.names
    .filter((n) => n !== primaryName)
    .map((n) => n.value);

  const homepage = raw.links.find((l) => l.type === 'website');
  const location = raw.locations[0]?.geonames_details;

  return {
    rorId: raw.id,
    name: primaryName?.value ?? 'Unknown',
    alternateNames,
    types: raw.types,
    homepageUrl: homepage?.value ?? null,
    countryName: location?.country_name ?? null,
    countryCode: location?.country_code ?? null,
    city: location?.name ?? null,
    established: raw.established,
    status: raw.status,
  };
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Search for research organizations by name.
 * Returns up to `limit` results ranked by relevance.
 */
export async function searchInstitutions(
  query: string,
  limit = 10,
): Promise<RorOrganization[]> {
  if (!query.trim()) return [];

  const url = new URL(`${ROR_BASE}/organizations`);
  url.searchParams.set('query', query);
  url.searchParams.set('page', '1');

  const response = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!response.ok) {
    throw new Error(`ROR search failed (${response.status})`);
  }

  const data: RorSearchResponse = await response.json();
  return (data.items ?? []).slice(0, limit).map(parseOrganization);
}

/**
 * Get a single organization by ROR ID.
 * The ID can be a full URL (https://ror.org/...) or bare ID.
 */
export async function getInstitution(rorId: string): Promise<RorOrganization | null> {
  // Accept full ROR URL or bare ID
  const bareId = rorId.replace('https://ror.org/', '').replace(/^\//, '');
  const url = `${ROR_BASE}/organizations/${bareId}`;

  const response = await fetch(url, { headers: { Accept: 'application/json' } });
  if (response.status === 404) return null;
  if (!response.ok) throw new Error(`ROR fetch failed (${response.status})`);

  const data: RorOrganizationRaw = await response.json();
  return parseOrganization(data);
}
