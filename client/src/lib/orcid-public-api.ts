// ORCID Public API client (v3.0)
// Reads publicly visible ORCID profiles — no auth required for public data.
// Docs: https://info.orcid.org/documentation/api-tutorials/api-tutorial-read-data-on-a-record/

const ORCID_BASE = 'https://pub.orcid.org/v3.0';

// ============================================================================
// Raw response types (simplified — ORCID responses are deeply nested)
// ============================================================================

interface OrcidPersonName {
  'given-names'?: { value: string };
  'family-name'?: { value: string };
  'credit-name'?: { value: string };
}

interface OrcidPerson {
  name?: OrcidPersonName;
  biography?: { content: string | null };
  keywords?: {
    keyword: Array<{ content: string }>;
  };
  emails?: {
    email: Array<{ email: string; primary: boolean }>;
  };
  'researcher-urls'?: {
    'researcher-url': Array<{ 'url-name': string; url: { value: string } }>;
  };
}

interface OrcidAffiliation {
  'organization': {
    name: string;
    address?: { city?: string; country?: string };
  };
  'start-date'?: { year?: { value: string } };
  'end-date'?: { year?: { value: string } } | null;
}

interface OrcidEmploymentSummary {
  'employment-summary': OrcidAffiliation;
}

interface OrcidEmployments {
  'affiliation-group': Array<{
    summaries: OrcidEmploymentSummary[];
  }>;
}

interface OrcidWorkTitle {
  title?: { value: string };
}

interface OrcidExternalId {
  'external-id-type': string;
  'external-id-value': string;
  'external-id-url'?: { value: string };
}

interface OrcidWorkSummary {
  'work-summary': Array<{
    title?: OrcidWorkTitle;
    type?: string;
    'publication-date'?: {
      year?: { value: string };
    };
    'external-ids'?: {
      'external-id': OrcidExternalId[];
    };
    'journal-title'?: { value: string };
    url?: { value: string };
  }>;
}

interface OrcidWorks {
  group: OrcidWorkSummary[];
}

// ============================================================================
// Exported types
// ============================================================================

export interface OrcidProfile {
  orcidId: string;
  givenName: string | null;
  familyName: string | null;
  creditName: string | null;
  displayName: string;
  biography: string | null;
  keywords: string[];
  primaryEmail: string | null;
  currentInstitution: string | null;
  institutionCountry: string | null;
  researcherUrls: Array<{ label: string; url: string }>;
}

export interface OrcidWork {
  title: string;
  type: string;
  year: number | null;
  doi: string | null;
  url: string | null;
  journal: string | null;
}

// ============================================================================
// Helpers
// ============================================================================

const JSON_ACCEPT = 'application/vnd.orcid+json';

async function fetchOrcid<T>(orcidId: string, endpoint: string): Promise<T> {
  const cleanId = orcidId.trim().replace(/^https?:\/\/orcid\.org\//, '');
  const url = `${ORCID_BASE}/${cleanId}/${endpoint}`;

  const response = await fetch(url, { headers: { Accept: JSON_ACCEPT } });
  if (!response.ok) {
    throw new Error(`ORCID API error (${response.status}) for ${endpoint}`);
  }
  return response.json();
}

function buildDisplayName(person: OrcidPerson): string {
  const credit = person.name?.['credit-name']?.value;
  if (credit) return credit;

  const given = person.name?.['given-names']?.value ?? '';
  const family = person.name?.['family-name']?.value ?? '';
  return [given, family].filter(Boolean).join(' ') || 'Unknown';
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Validate ORCID iD format (0000-0000-0000-0000 with optional checksum X).
 */
export function isValidOrcidId(id: string): boolean {
  return /^\d{4}-\d{4}-\d{4}-\d{3}[\dX]$/i.test(id.trim());
}

/**
 * Fetch the public profile (name, bio, keywords, institution) for an ORCID iD.
 */
export async function getOrcidProfile(orcidId: string): Promise<OrcidProfile> {
  const [person, employments] = await Promise.all([
    fetchOrcid<OrcidPerson>(orcidId, 'person'),
    fetchOrcid<OrcidEmployments>(orcidId, 'employments').catch(() => null),
  ]);

  // Current employment: affiliation group with no end-date
  let currentInstitution: string | null = null;
  let institutionCountry: string | null = null;

  if (employments) {
    for (const group of employments['affiliation-group'] ?? []) {
      const summary = group.summaries[0]?.['employment-summary'];
      if (!summary) continue;
      // No end date = current position
      if (!summary['end-date']) {
        currentInstitution = summary.organization.name;
        institutionCountry = summary.organization.address?.country ?? null;
        break;
      }
    }
  }

  const primaryEmail =
    person.emails?.email.find((e) => e.primary)?.email ??
    person.emails?.email[0]?.email ??
    null;

  const researcherUrls = (person['researcher-urls']?.['researcher-url'] ?? []).map((u) => ({
    label: u['url-name'],
    url: u.url.value,
  }));

  const cleanId = orcidId.trim().replace(/^https?:\/\/orcid\.org\//, '');

  return {
    orcidId: cleanId,
    givenName: person.name?.['given-names']?.value ?? null,
    familyName: person.name?.['family-name']?.value ?? null,
    creditName: person.name?.['credit-name']?.value ?? null,
    displayName: buildDisplayName(person),
    biography: person.biography?.content ?? null,
    keywords: (person.keywords?.keyword ?? []).map((k) => k.content),
    primaryEmail,
    currentInstitution,
    institutionCountry,
    researcherUrls,
  };
}

/**
 * Fetch the public works list for an ORCID iD.
 * Returns up to 50 most recent works.
 */
export async function getOrcidWorks(orcidId: string): Promise<OrcidWork[]> {
  const data = await fetchOrcid<OrcidWorks>(orcidId, 'works');
  const works: OrcidWork[] = [];

  for (const group of data.group ?? []) {
    // Each group may have multiple versions — use the first summary
    const summaries = group['work-summary'];
    if (!summaries || summaries.length === 0) continue;

    const work = summaries[0];
    const title = work.title?.title?.value ?? 'Untitled';
    const yearStr = work['publication-date']?.year?.value;
    const year = yearStr ? parseInt(yearStr, 10) : null;

    const externalIds = work['external-ids']?.['external-id'] ?? [];
    const doiEntry = externalIds.find((e) => e['external-id-type'] === 'doi');
    const doi = doiEntry?.['external-id-value'] ?? null;

    works.push({
      title,
      type: work.type ?? 'journal-article',
      year,
      doi,
      url: work.url?.value ?? (doi ? `https://doi.org/${doi}` : null),
      journal: work['journal-title']?.value ?? null,
    });
  }

  // Sort by year descending, unknowns last
  return works
    .sort((a, b) => (b.year ?? 0) - (a.year ?? 0))
    .slice(0, 50);
}
