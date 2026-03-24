import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { searchJournals, listJournals } from '@/lib/journal-search-api';
import { MEDICAL_JOURNALS } from '@/data/journals-database';

// ── Helpers ──────────────────────────────────────────────────────────────────

/** Make every fetch call reject — forces the static fallback path */
const failAllApis = () =>
  vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

/** Build a minimal valid backend Response */
function backendResponse(journals: object[], total?: number): Response {
  const payload = { data: journals, total: total ?? journals.length };
  return new Response(JSON.stringify(payload), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  });
}

// ── Setup ─────────────────────────────────────────────────────────────────────

beforeEach(() => {
  vi.stubGlobal('fetch', vi.fn());
});

afterEach(() => {
  vi.restoreAllMocks();
});

// ── Cycle 1: Static fallback ──────────────────────────────────────────────────

describe('static fallback', () => {
  it('returns source:static with results when all APIs fail', async () => {
    failAllApis();
    const result = await searchJournals('cardiology');
    expect(result.source).toBe('static');
    expect(result.journals.length).toBeGreaterThan(0);
    expect(result.total).toBeGreaterThan(0);
  });

  it('listJournals returns source:static when all APIs fail', async () => {
    failAllApis();
    const result = await listJournals();
    expect(result.source).toBe('static');
    expect(result.journals.length).toBeGreaterThan(0);
  });

  // ── Cycle 2: Limit ──────────────────────────────────────────────────────────

  it('respects the limit parameter in static fallback', async () => {
    failAllApis();
    const result = await listJournals(5);
    expect(result.journals.length).toBeLessThanOrEqual(5);
  });
});

// ── Cycle 3: OA filter ────────────────────────────────────────────────────────

describe('isOpenAccess filter', () => {
  it('returns only open-access journals when isOpenAccess:true', async () => {
    failAllApis();
    const result = await listJournals(100, { isOpenAccess: true });
    expect(result.journals.length).toBeGreaterThan(0);
    result.journals.forEach((j) => {
      expect(j.openAccess).toBe(true);
    });
  });

  it('returns only subscription journals when isOpenAccess:false', async () => {
    failAllApis();
    const result = await listJournals(100, { isOpenAccess: false });
    expect(result.journals.length).toBeGreaterThan(0);
    result.journals.forEach((j) => {
      expect(j.openAccess).toBe(false);
    });
  });
});

// ── Cycle 4: MEDLINE filter ───────────────────────────────────────────────────

describe('isMedline filter', () => {
  it('returns only MEDLINE-indexed journals when isMedline:true', async () => {
    failAllApis();
    const result = await listJournals(100, { isMedline: true });
    expect(result.journals.length).toBeGreaterThan(0);
    result.journals.forEach((j) => {
      expect(j.isMedlineIndexed).toBe(true);
    });
  });

  it('does not filter MEDLINE when isMedline is not set', async () => {
    failAllApis();
    const withFilter = await listJournals(100, { isMedline: true });
    const withoutFilter = await listJournals(100);
    // Without the filter we should get more (or equal) results
    expect(withoutFilter.journals.length).toBeGreaterThanOrEqual(withFilter.journals.length);
  });
});

// ── Cycle 5: peerReviewType from backend ─────────────────────────────────────

describe('peerReviewType', () => {
  it('maps peerReviewType from backend response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      backendResponse([{
        id: 'j1',
        name: 'Test Journal',
        subjectAreas: ['Medicine'],
        geographicLocation: 'United Kingdom',
        publisher: 'Test Publisher',
        peerReviewType: 'Double blind peer review',
      }]),
    );
    const result = await searchJournals('medicine');
    expect(result.source).toBe('backend');
    expect(result.journals[0].peerReviewType).toBe('Double blind peer review');
  });

  it('accepts null peerReviewType from backend', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      backendResponse([{
        id: 'j2',
        name: 'Another Journal',
        subjectAreas: ['Surgery'],
        geographicLocation: 'United States',
        publisher: 'Test',
        peerReviewType: null,
      }]),
    );
    const result = await searchJournals('surgery');
    expect(result.journals[0].peerReviewType).toBeNull();
  });
});

// ── Cycle 6: Acceptance rate enrichment ──────────────────────────────────────

describe('acceptance rate enrichment', () => {
  it('enriches journals with null acceptanceRate from curated lookup via backend', async () => {
    // Backend returns NEJM (ISSN 0028-4793) with no acceptanceRate
    vi.mocked(fetch).mockResolvedValueOnce(
      backendResponse([{
        id: 'nejm',
        name: 'The New England Journal of Medicine',
        subjectAreas: ['Medicine'],
        geographicLocation: 'United States',
        publisher: 'Massachusetts Medical Society',
        issnPrint: '0028-4793',
        acceptanceRate: null,
      }]),
    );
    const result = await searchJournals('new england journal');
    const nejm = result.journals[0];
    expect(nejm.acceptanceRate).toBeDefined();
    expect(nejm.acceptanceRate).toBeGreaterThan(0);
    expect(nejm.acceptanceRate).toBeLessThan(100);
  });

  it('does not overwrite an existing acceptanceRate', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      backendResponse([{
        id: 'j1',
        name: 'The New England Journal of Medicine',
        subjectAreas: ['Medicine'],
        geographicLocation: 'United States',
        publisher: 'Massachusetts Medical Society',
        issnPrint: '0028-4793',
        acceptanceRate: 99, // Deliberately wrong — should not be overwritten
      }]),
    );
    const result = await searchJournals('nejm');
    expect(result.journals[0].acceptanceRate).toBe(99);
  });

  it('static fallback journals already have acceptanceRate from static DB', async () => {
    failAllApis();
    const result = await searchJournals('new england journal of medicine');
    const nejm = result.journals.find((j) => j.issn === '0028-4793');
    expect(nejm).toBeDefined();
    expect(nejm!.acceptanceRate).toBeGreaterThan(0);
  });
});

// ── Cycle 7: Backend source happy path ───────────────────────────────────────

describe('searchJournals — backend source', () => {
  it('returns source:backend when backend responds successfully', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(
      backendResponse([{
        id: 'j1',
        name: 'Test Journal',
        subjectAreas: ['Medicine'],
        geographicLocation: 'United States',
        publisher: 'Test Publisher',
      }]),
    );
    const result = await searchJournals('medicine');
    expect(result.source).toBe('backend');
    expect(result.journals).toHaveLength(1);
    expect(result.journals[0].name).toBe('Test Journal');
  });

  it('falls back from backend on non-ok response', async () => {
    vi.mocked(fetch).mockResolvedValueOnce(new Response('{}', { status: 500 }));
    vi.mocked(fetch).mockRejectedValue(new Error('Network failure')); // All subsequent fail too
    const result = await searchJournals('cardiology');
    expect(result.source).toBe('static');
  });
});

// ── Cycle 8: Static DB data accuracy ─────────────────────────────────────────

describe('MEDICAL_JOURNALS data accuracy', () => {
  it('has at least 50 journals in the static database', () => {
    expect(MEDICAL_JOURNALS.length).toBeGreaterThanOrEqual(50);
  });

  it('all journals have a positive impactFactor', () => {
    const bad = MEDICAL_JOURNALS.filter(
      (j) => j.impactFactor == null || (j.impactFactor as number) <= 0,
    );
    expect(bad.map((j) => j.name)).toEqual([]);
  });

  it('all journals have openAccess explicitly set', () => {
    const bad = MEDICAL_JOURNALS.filter((j) => (j as any).openAccess === undefined);
    expect(bad.map((j) => j.name)).toEqual([]);
  });

  it('all journals have a positive avgDecisionDays', () => {
    const bad = MEDICAL_JOURNALS.filter(
      (j) => !(j as any).avgDecisionDays || (j as any).avgDecisionDays <= 0,
    );
    expect(bad.map((j) => j.name)).toEqual([]);
  });

  it('has a mix of open-access and subscription journals', () => {
    const oa = MEDICAL_JOURNALS.filter((j) => (j as any).openAccess === true);
    const sub = MEDICAL_JOURNALS.filter((j) => (j as any).openAccess === false);
    expect(oa.length).toBeGreaterThan(0);
    expect(sub.length).toBeGreaterThan(0);
  });

  it('at least 10 journals have isMedlineIndexed:true', () => {
    const medline = MEDICAL_JOURNALS.filter((j) => (j as any).isMedlineIndexed === true);
    expect(medline.length).toBeGreaterThanOrEqual(10);
  });
});
