import { env } from "../../config/env";
import { supabaseAdmin } from "../../lib/supabase";
import { invalidateJournalCache } from "./search.service";
import type { JournalRow } from "./types";
import { fetchCrossrefEnrichment } from "./adapters/crossref.adapter";
import { fetchDoajEnrichment } from "./adapters/doaj.adapter";
import { fetchOpenAlexEnrichment } from "./adapters/openalex.adapter";
import type { JournalEnrichment, JournalSource } from "./adapters/types";

const sourcePriority: Record<JournalSource, number> = {
  manual: 100,
  crossref: 70,
  openalex: 60,
  doaj: 50,
};

const writableColumns = new Set([
  "name",
  "publisher",
  "open_access",
  "apc_cost_usd",
  "website_url",
  "subject_areas",
  "impact_factor",
  "issn_print",
  "issn_online",
  "submission_portal_url",
  "submission_requirements_json",
  "logo_url",
]);

function shouldOverwrite(
  currentValue: unknown,
  currentSource: JournalSource | "manual",
  incomingSource: JournalSource,
): boolean {
  if (currentValue === null || currentValue === undefined) return true;
  return sourcePriority[incomingSource] >= sourcePriority[currentSource];
}

function normalizeSource(source: string | undefined): JournalSource | "manual" {
  if (source === "crossref" || source === "openalex" || source === "doaj" || source === "manual") {
    return source;
  }
  return "manual";
}

async function enrichRow(row: JournalRow) {
  const enrichments: Array<JournalEnrichment | null> = await Promise.all([
    fetchOpenAlexEnrichment({
      name: row.name,
      issnPrint: row.issn_print,
      issnOnline: row.issn_online,
    }),
    fetchDoajEnrichment({
      name: row.name,
      issnPrint: row.issn_print,
      issnOnline: row.issn_online,
    }),
    fetchCrossrefEnrichment({
      name: row.name,
      issnPrint: row.issn_print,
      issnOnline: row.issn_online,
    }),
  ]);

  const currentProvenance = { ...(row.provenance ?? {}) };
  const updates: Record<string, unknown> = {};
  const metadataProvenance: Record<string, unknown> = {};

  for (const enrichment of enrichments) {
    if (!enrichment) continue;
    const source = enrichment.source;

    for (const [field, value] of Object.entries(enrichment.fields)) {
      if (value === null || value === undefined) continue;

      if (!writableColumns.has(field)) {
        metadataProvenance[field] = value;
        continue;
      }

      const currentValue = (row as unknown as Record<string, unknown>)[field];
      const currentSource = normalizeSource(currentProvenance[field]);
      if (shouldOverwrite(currentValue, currentSource, source)) {
        updates[field] = value;
        currentProvenance[field] = source;
      }
    }
  }

  const hasUpdates = Object.keys(updates).length > 0 || Object.keys(metadataProvenance).length > 0;
  if (!hasUpdates) {
    return null;
  }

  return {
    ...updates,
    provenance: {
      ...currentProvenance,
      ...Object.fromEntries(
        Object.entries(metadataProvenance).map(([key, value]) => [`meta:${key}`, String(value)]),
      ),
    },
    last_verified_at: new Date().toISOString(),
  };
}

export interface JournalSyncResult {
  scanned: number;
  updated: number;
}

export async function syncJournals(params: {
  journalIds?: string[];
  staleHours?: number;
}): Promise<JournalSyncResult> {
  const staleHours = params.staleHours ?? env.JOURNAL_SYNC_STALE_HOURS;
  const staleCutoff = new Date(Date.now() - staleHours * 60 * 60 * 1000).toISOString();

  let query = supabaseAdmin.from("journals").select("*");
  if (params.journalIds && params.journalIds.length > 0) {
    query = query.in("id", params.journalIds);
  } else {
    query = query.or(`last_verified_at.is.null,last_verified_at.lt.${staleCutoff}`);
  }

  const { data, error } = await query.limit(200);
  if (error) {
    throw new Error(`Failed to fetch journals for sync: ${error.message}`);
  }

  const journals = (data ?? []) as JournalRow[];
  let updated = 0;

  for (const journal of journals) {
    const update = await enrichRow(journal);
    if (!update) continue;
    const { error: updateError } = await supabaseAdmin
      .from("journals")
      .update(update)
      .eq("id", journal.id);
    if (!updateError) {
      updated += 1;
    }
  }

  invalidateJournalCache();
  return { scanned: journals.length, updated };
}
