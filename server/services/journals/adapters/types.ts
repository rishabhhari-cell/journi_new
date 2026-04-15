export type JournalSource = "manual" | "openalex" | "doaj" | "crossref" | "scraper";

export interface JournalEnrichment {
  source: JournalSource;
  fields: Record<string, unknown>;
}

