/**
 * Seed the journals table from OpenAlex's sources (journals) API.
 *
 * OpenAlex has ~250k journals/sources. This script pages through them and
 * upserts into Supabase via ingestJournals — same path as the normal import.
 *
 * Run:
 *   npx tsx server/scripts/seed-from-openalex.ts
 *
 * Options (env vars):
 *   SEED_LIMIT    — max journals to import (default: 50000)
 *   SEED_FILTER   — OpenAlex filter string e.g. "type:journal" (default: "type:journal")
 *
 * Requires SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in environment (or .env).
 */
import { config as loadEnv } from "dotenv";
loadEnv();

import { createClient } from "@supabase/supabase-js";
import type { JournalImportInput } from "../services/journals/types";

const supabase = createClient(
  process.env.SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!,
);

const SEED_LIMIT = parseInt(process.env.SEED_LIMIT ?? "50000", 10);
// language: is not a valid filter on /sources. Instead we sort by works_count
// (most-cited/active journals first) and skip rows whose names contain
// non-Latin script characters at map time.
const SEED_FILTER = process.env.SEED_FILTER ?? "type:journal";
const BATCH_SIZE = 200; // OpenAlex max per_page
const UPSERT_BATCH = 500; // rows per Supabase upsert

const OA_BASE = "https://api.openalex.org/sources";

interface OASource {
  id: string;
  display_name: string;
  abbreviated_title?: string;
  issn_l?: string;
  issn?: string[];
  host_organization_name?: string;
  homepage_url?: string;
  apc_prices?: Array<{ price: number; currency: string }>;
  is_oa?: boolean;
  is_in_doaj?: boolean;
  x_concepts?: Array<{ display_name: string; score: number }>;
  type?: string;
}

interface OAPage {
  results: OASource[];
  meta: { count: number; per_page: number; next_cursor?: string };
}

// Regex that matches any character outside Basic Latin + Latin Extended blocks.
// Used to skip journals whose names are primarily in Chinese, Arabic, Cyrillic, etc.
const NON_LATIN_RE = /[^\u0000-\u024F\s\d\p{P}]/u;

function isLatinName(name: string): boolean {
  // Allow names that are mostly Latin (up to 2 non-Latin chars tolerated for symbols)
  const nonLatin = [...name].filter((c) => NON_LATIN_RE.test(c));
  return nonLatin.length <= 2;
}

function mapSource(src: OASource): JournalImportInput | null {
  // Skip non-Latin-script journals (Chinese, Arabic, Cyrillic, etc.)
  if (!isLatinName(src.display_name)) return null;

  const issnList = src.issn ?? [];
  const issnPrint = issnList[0] ?? src.issn_l;
  const issnOnline = issnList[1];

  // Use top x_concepts as subject areas (score > 0.3)
  const subjectAreas = (src.x_concepts ?? [])
    .filter((c) => c.score >= 0.3)
    .slice(0, 6)
    .map((c) => c.display_name);

  // External ID: openalex short ID e.g. "S1983995261"
  const externalId = src.id.replace("https://openalex.org/", "openalex:");

  return {
    externalId,
    name: src.display_name,
    abbreviation: src.abbreviated_title ?? undefined,
    publisher: src.host_organization_name ?? undefined,
    issnPrint: issnPrint ?? undefined,
    issnOnline: issnOnline ?? undefined,
    websiteUrl: src.homepage_url ?? undefined,
    openAccess: src.is_oa ?? src.is_in_doaj ?? null,
    apcCostUsd: src.apc_prices?.find((p) => p.currency === "USD")?.price ?? null,
    subjectAreas: subjectAreas.length > 0 ? subjectAreas : undefined,
    provenance: { name: "openalex", publisher: "openalex" },
  };
}

async function fetchPage(filter: string, cursor: string): Promise<OAPage> {
  const url = new URL(OA_BASE);
  url.searchParams.set("filter", filter);
  url.searchParams.set("per_page", String(BATCH_SIZE));
  url.searchParams.set("cursor", cursor);
  url.searchParams.set("select", "id,display_name,abbreviated_title,issn_l,issn,host_organization_name,homepage_url,apc_prices,is_oa,is_in_doaj,x_concepts,type");
  url.searchParams.set("sort", "works_count:desc"); // most-active journals first
  url.searchParams.set("mailto", "support@journi.ai");

  const urlStr = url.toString();
  for (let attempt = 1; attempt <= 4; attempt++) {
    try {
      const res = await fetch(urlStr, {
        headers: { "User-Agent": "Journi/1.0 (journal seeder; contact support@journi.ai)" },
        signal: AbortSignal.timeout(60_000),
      });
      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(`OpenAlex returned ${res.status}: ${text.slice(0, 200)}`);
      }
      return res.json() as Promise<OAPage>;
    } catch (err) {
      if (attempt === 4) throw err;
      const wait = attempt * 2000;
      console.warn(`Fetch attempt ${attempt} failed (${(err as Error).message}), retrying in ${wait / 1000}s...`);
      await new Promise((r) => setTimeout(r, wait));
    }
  }
  throw new Error("unreachable");
}

const seenIssnPrint = new Set<string>();
const seenIssnOnline = new Set<string>();

async function upsertBatch(journals: JournalImportInput[]): Promise<number> {
  if (journals.length === 0) return 0;

  const rows = journals.map((j) => {
    const issnPrint = j.issnPrint && !seenIssnPrint.has(j.issnPrint) ? j.issnPrint : null;
    const issnOnline = j.issnOnline && !seenIssnOnline.has(j.issnOnline) ? j.issnOnline : null;
    if (issnPrint) seenIssnPrint.add(issnPrint);
    if (issnOnline) seenIssnOnline.add(issnOnline);
    return {
      external_id: j.externalId!,
      name: j.name,
      abbreviation: j.abbreviation ?? null,
      logo_url: null,
      impact_factor: null,
      impact_factor_year: null,
      open_access: j.openAccess ?? null,
      website_url: j.websiteUrl ?? null,
      submission_portal_url: null,
      submission_requirements_json: null,
      publisher: j.publisher ?? null,
      subject_areas: j.subjectAreas ?? [],
      geographic_location: null,
      issn_print: issnPrint,
      issn_online: issnOnline,
      acceptance_rate: null,
      avg_decision_days: null,
      apc_cost_usd: j.apcCostUsd ?? null,
      mean_time_to_publication_days: null,
      provenance: j.provenance ?? {},
      last_verified_at: new Date().toISOString(),
    };
  });

  const { error } = await supabase
    .from("journals")
    .upsert(rows, { onConflict: "external_id", ignoreDuplicates: true });

  if (error) throw new Error(`Supabase upsert failed: ${error.message}`);
  return rows.length;
}

async function main() {
  console.log(`Seeding journals from OpenAlex (filter="${SEED_FILTER}", limit=${SEED_LIMIT})...`);

  let cursor = "*";
  let totalFetched = 0;
  let totalUpserted = 0;
  let buffer: JournalImportInput[] = [];
  let firstPage = true;
  let totalAvailable = 0;

  while (totalFetched < SEED_LIMIT) {
    const page = await fetchPage(SEED_FILTER, cursor);

    if (firstPage) {
      totalAvailable = page.meta.count;
      console.log(`OpenAlex reports ${totalAvailable.toLocaleString()} sources matching filter.`);
      firstPage = false;
    }

    if (page.results.length === 0) break;

    for (const src of page.results) {
      if (totalFetched >= SEED_LIMIT) break;
      const mapped = mapSource(src);
      if (!mapped) continue; // skip non-Latin journals
      buffer.push(mapped);
      totalFetched++;
    }

    // Flush buffer in UPSERT_BATCH chunks
    while (buffer.length >= UPSERT_BATCH) {
      const chunk = buffer.splice(0, UPSERT_BATCH);
      totalUpserted += await upsertBatch(chunk);
      console.log(`Upserted ${totalUpserted.toLocaleString()} / ${Math.min(SEED_LIMIT, totalAvailable).toLocaleString()}`);
    }

    if (!page.meta.next_cursor || page.results.length < BATCH_SIZE) break;
    cursor = page.meta.next_cursor;

    // Small delay to be polite to OpenAlex API
    await new Promise((r) => setTimeout(r, 100));
  }

  // Flush remainder
  if (buffer.length > 0) {
    totalUpserted += await upsertBatch(buffer);
  }

  console.log(`\nDone. Fetched ${totalFetched.toLocaleString()}, upserted ${totalUpserted.toLocaleString()} journals.`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
