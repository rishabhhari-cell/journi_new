export type JournalSource = "manual" | "openalex" | "doaj" | "crossref";

export interface JournalEnrichment {
  source: JournalSource;
  fields: Record<string, unknown>;
}

