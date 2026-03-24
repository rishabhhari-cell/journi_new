import type { JournalEnrichment } from "./types";

interface OpenAlexSource {
  display_name: string;
  host_organization_name: string | null;
  is_oa: boolean;
  apc_usd: number | null;
  homepage_url: string | null;
  x_concepts: Array<{ display_name: string; level: number }>;
  "2yr_mean_citedness": number | null;
  issn: string[] | null;
  issn_l: string | null;
}

export async function fetchOpenAlexEnrichment(input: {
  name: string;
  issnPrint?: string | null;
  issnOnline?: string | null;
}): Promise<JournalEnrichment | null> {
  const possibleIssn = input.issnPrint ?? input.issnOnline;
  const issn = possibleIssn?.replace(/\s/g, "");
  const byIssn = issn ? `https://api.openalex.org/sources/issn:${encodeURIComponent(issn)}` : null;

  let source: OpenAlexSource | null = null;

  if (byIssn) {
    const response = await fetch(byIssn, { headers: { Accept: "application/json" } });
    if (response.ok) {
      source = (await response.json()) as OpenAlexSource;
    }
  }

  if (!source) {
    const queryUrl = new URL("https://api.openalex.org/sources");
    queryUrl.searchParams.set("search", input.name);
    queryUrl.searchParams.set("filter", "type:journal");
    queryUrl.searchParams.set("per_page", "1");
    const response = await fetch(queryUrl.toString(), { headers: { Accept: "application/json" } });
    if (!response.ok) return null;
    const payload = (await response.json()) as { results: OpenAlexSource[] };
    source = payload.results?.[0] ?? null;
  }

  if (!source) return null;

  const subjects = (source.x_concepts ?? [])
    .filter((concept) => concept.level <= 1)
    .slice(0, 10)
    .map((concept) => concept.display_name);

  return {
    source: "openalex",
    fields: {
      name: source.display_name,
      publisher: source.host_organization_name,
      open_access: source.is_oa,
      apc_cost_usd: source.apc_usd,
      website_url: source.homepage_url,
      subject_areas: subjects,
      impact_factor: source["2yr_mean_citedness"],
      issn_print: source.issn_l ?? source.issn?.[0] ?? null,
    },
  };
}

