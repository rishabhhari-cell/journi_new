import type { ParsedCitation } from "../../shared/document-parse";

const CROSSREF_BASE = "https://api.crossref.org/works";
const OPENALEX_BASE = "https://api.openalex.org/works";
const OPENALEX_MAILTO = "rishabh.hari@gmail.com";
const CONFIDENCE_THRESHOLD = 0.80;

// ─── Scoring helper (exported for tests) ────────────────────────────────────

export function scoreOpenAlexMatch(
  citation: ParsedCitation,
  candidateTitle: string,
  candidateYear: number | null,
): number {
  if (!citation.title || !candidateTitle) return 0;

  const normalize = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t1 = normalize(citation.title);
  const t2 = normalize(candidateTitle);

  if (t1 === t2) return 1.0;

  const tokens1 = new Set(t1.split(" ").filter((w) => w.length > 3));
  const tokens2 = new Set(t2.split(" ").filter((w) => w.length > 3));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let overlap = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) overlap += 1;
  }
  const jaccardLike = overlap / (tokens1.size + tokens2.size - overlap);
  const yearBonus =
    candidateYear !== null && Math.abs(candidateYear - citation.year) <= 1 ? 0.1 : 0;

  return Math.min(1.0, jaccardLike + yearBonus);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function mergeCitation(base: ParsedCitation, enriched: Partial<ParsedCitation>): ParsedCitation {
  return {
    ...base,
    authors: enriched.authors && enriched.authors.length > 0 ? enriched.authors : base.authors,
    title: enriched.title ?? base.title,
    journal: enriched.journal ?? base.journal,
    year: enriched.year ?? base.year,
    doi: enriched.doi ?? base.doi,
    url: enriched.url ?? base.url,
    volume: enriched.volume ?? base.volume,
    issue: enriched.issue ?? base.issue,
    pages: enriched.pages ?? base.pages,
    metadata: { ...(base.metadata ?? {}), enriched: true },
  };
}

// ─── CrossRef ────────────────────────────────────────────────────────────────

async function crossrefByDoi(doi: string): Promise<Partial<ParsedCitation> | null> {
  try {
    const res = await fetch(`${CROSSREF_BASE}/${encodeURIComponent(doi)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.message;
    if (!work) return null;
    return {
      authors: ensureArray(work["author"])
        .map((a: any) => `${a.family ?? ""} ${a.given ?? ""}`.trim())
        .filter(Boolean),
      title: ensureArray(work["title"])[0] ?? undefined,
      journal: ensureArray(work["container-title"])[0] ?? undefined,
      year: work["published"]?.["date-parts"]?.[0]?.[0] ?? undefined,
      volume: work["volume"] ?? undefined,
      issue: work["issue"] ?? undefined,
      pages: work["page"] ?? undefined,
      doi: work["DOI"] ?? doi,
      url: work["URL"] ?? undefined,
    };
  } catch {
    return null;
  }
}

async function crossrefFuzzy(citation: ParsedCitation): Promise<Partial<ParsedCitation> | null> {
  try {
    const query = encodeURIComponent(`${citation.title} ${citation.authors[0] ?? ""}`);
    const res = await fetch(`${CROSSREF_BASE}?query=${query}&rows=1`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const item = data?.message?.items?.[0];
    if (!item) return null;
    const score = scoreOpenAlexMatch(
      citation,
      ensureArray(item["title"])[0] ?? "",
      item["published"]?.["date-parts"]?.[0]?.[0] ?? null,
    );
    if (score < CONFIDENCE_THRESHOLD) return null;
    return {
      authors: ensureArray(item["author"])
        .map((a: any) => `${a.family ?? ""} ${a.given ?? ""}`.trim())
        .filter(Boolean),
      title: ensureArray(item["title"])[0] ?? undefined,
      journal: ensureArray(item["container-title"])[0] ?? undefined,
      year: item["published"]?.["date-parts"]?.[0]?.[0] ?? undefined,
      doi: item["DOI"] ?? undefined,
      url: item["URL"] ?? undefined,
    };
  } catch {
    return null;
  }
}

// ─── OpenAlex ────────────────────────────────────────────────────────────────

function mapOpenAlexWork(work: any): Partial<ParsedCitation> {
  return {
    authors: ensureArray(work["authorships"])
      .map((a: any) => a?.author?.display_name ?? "")
      .filter(Boolean),
    title: work["title"] ?? undefined,
    journal: work["primary_location"]?.source?.display_name ?? undefined,
    year: work["publication_year"] ?? undefined,
    doi: work["doi"]?.replace("https://doi.org/", "") ?? undefined,
  };
}

async function openAlexByDoi(doi: string): Promise<Partial<ParsedCitation> | null> {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}?filter=doi:${encodeURIComponent(doi)}&select=title,authorships,publication_year,primary_location,doi`,
      {
        headers: { "User-Agent": `Journi/1.0 (mailto:${OPENALEX_MAILTO})` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.results?.[0];
    if (!work) return null;
    return mapOpenAlexWork(work);
  } catch {
    return null;
  }
}

async function openAlexFuzzy(citation: ParsedCitation): Promise<Partial<ParsedCitation> | null> {
  try {
    const query = encodeURIComponent(`${citation.title} ${citation.authors[0] ?? ""}`);
    const res = await fetch(
      `${OPENALEX_BASE}?search=${query}&per-page=1&select=title,authorships,publication_year,primary_location,doi`,
      {
        headers: { "User-Agent": `Journi/1.0 (mailto:${OPENALEX_MAILTO})` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.results?.[0];
    if (!work) return null;
    const score = scoreOpenAlexMatch(citation, work.title ?? "", work.publication_year ?? null);
    if (score < CONFIDENCE_THRESHOLD) return null;
    return mapOpenAlexWork(work);
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Enrich citations using CrossRef + OpenAlex. Returns a new array.
 * Call AFTER the import HTTP response is sent (fire-and-forget).
 * Only DOIs, titles, and author names leave this server.
 */
export async function enrichCitations(citations: ParsedCitation[]): Promise<ParsedCitation[]> {
  return Promise.all(
    citations.map(async (citation): Promise<ParsedCitation> => {
      try {
        if (citation.doi) {
          const crossrefResult = await crossrefByDoi(citation.doi);
          if (crossrefResult) return mergeCitation(citation, crossrefResult);
          const openAlexResult = await openAlexByDoi(citation.doi);
          if (openAlexResult) return mergeCitation(citation, openAlexResult);
          return citation;
        }

        if (citation.title && citation.authors[0] !== "Unknown") {
          const [crossrefResult, openAlexResult] = await Promise.all([
            crossrefFuzzy(citation),
            openAlexFuzzy(citation),
          ]);
          if (crossrefResult) return mergeCitation(citation, crossrefResult);
          if (openAlexResult) return mergeCitation(citation, openAlexResult);
        }
      } catch {
        // Never let enrichment crash the import
      }
      return citation;
    }),
  );
}
