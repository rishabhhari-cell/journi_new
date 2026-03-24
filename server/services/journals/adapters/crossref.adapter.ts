import type { JournalEnrichment } from "./types";

interface CrossrefPayload {
  message?: {
    title?: string;
    publisher?: string;
    issn?: string[];
    counts?: {
      "total-dois"?: number;
    };
  };
}

export async function fetchCrossrefEnrichment(input: {
  name: string;
  issnPrint?: string | null;
  issnOnline?: string | null;
}): Promise<JournalEnrichment | null> {
  const issn = input.issnPrint ?? input.issnOnline;
  if (!issn) return null;

  const response = await fetch(
    `https://api.crossref.org/journals/${encodeURIComponent(issn)}?mailto=journi@journi.app`,
    { headers: { Accept: "application/json" } },
  );
  if (!response.ok) return null;

  const payload = (await response.json()) as CrossrefPayload;
  const message = payload.message;
  if (!message) return null;

  return {
    source: "crossref",
    fields: {
      name: message.title ?? input.name,
      publisher: message.publisher ?? null,
      issn_print: message.issn?.[0] ?? input.issnPrint ?? null,
      provenance_crossref_total_dois: message.counts?.["total-dois"] ?? null,
    },
  };
}

