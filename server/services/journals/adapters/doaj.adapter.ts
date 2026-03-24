import type { JournalEnrichment } from "./types";

interface DoajRecord {
  bibjson?: {
    title?: string;
    eissn?: string;
    pissn?: string;
    apc?: {
      has_apc: boolean;
      max?: Array<{ price: number; currency: string }>;
    };
  };
  id: string;
}

export async function fetchDoajEnrichment(input: {
  name: string;
  issnPrint?: string | null;
  issnOnline?: string | null;
}): Promise<JournalEnrichment | null> {
  const issn = input.issnPrint ?? input.issnOnline;
  let url: string;

  if (issn) {
    const normalized = issn.replace(/-/g, "").replace(/^(\d{4})(\d{4})$/, "$1-$2");
    url = `https://doaj.org/api/search/journals/issn:${encodeURIComponent(normalized)}?pageSize=1`;
  } else {
    url = `https://doaj.org/api/search/journals/${encodeURIComponent(input.name)}?pageSize=1`;
  }

  const response = await fetch(url, { headers: { Accept: "application/json" } });
  if (!response.ok) return null;

  const payload = (await response.json()) as { results?: DoajRecord[] };
  const record = payload.results?.[0];
  if (!record) return null;

  const apcOptions = record.bibjson?.apc?.max ?? [];
  const preferredApc = apcOptions.find((entry) => entry.currency === "USD") ?? apcOptions[0];

  return {
    source: "doaj",
    fields: {
      open_access: true,
      apc_cost_usd: preferredApc?.currency === "USD" ? preferredApc.price : null,
      issn_print: record.bibjson?.pissn ?? null,
      issn_online: record.bibjson?.eissn ?? null,
      provenance_doaj_id: record.id,
    },
  };
}

