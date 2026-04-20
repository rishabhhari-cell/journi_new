/**
 * enrich-openalex-metadata.ts
 *
 * Pages through all OpenAlex sources (type:journal) via cursor pagination,
 * matches against Supabase journals by ISSN, and writes:
 *   impact_factor, subject_areas, apc_cost_usd
 *
 * Optimisation: pre-fetches all journal ISSNs into memory so each OpenAlex
 * page becomes a single bulk UPDATE instead of N individual UPDATEs.
 *
 * Run: npx ts-node -r dotenv/config server/scripts/enrich-openalex-metadata.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const OPENALEX_BASE = 'https://api.openalex.org';
const MAILTO = 'journi@journi.app';
const PER_PAGE = 200;
const DELAY_MS = 50; // reduced from 100ms — OpenAlex polite pool is generous

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface OpenAlexSource {
  id: string;
  issn_l: string | null;
  issn: string[] | null;
  summary_stats: { '2yr_mean_citedness': number | null } | null;
  x_concepts: Array<{ display_name: string; score: number; level: number }> | null;
  apc_prices: Array<{ price: number; currency: string; price_usd: number }> | null;
}

interface IssnMap {
  // normalised ISSN (no hyphens) -> journal id
  print: Map<string, string>;
  online: Map<string, string>;
}

async function buildIssnMap(): Promise<IssnMap> {
  console.log('Pre-fetching journal ISSNs from Supabase...');
  const print = new Map<string, string>();
  const online = new Map<string, string>();
  const PAGE = 1000;
  let page = 0;

  while (true) {
    const { data, error } = await supabase
      .from('journals')
      .select('id, issn_print, issn_online')
      .range(page * PAGE, (page + 1) * PAGE - 1);

    if (error) throw new Error(`Supabase error building ISSN map: ${error.message}`);
    if (!data || data.length === 0) break;

    for (const row of data) {
      if (row.issn_print) print.set(row.issn_print.replace(/-/g, ''), row.id);
      if (row.issn_online) online.set(row.issn_online.replace(/-/g, ''), row.id);
    }
    page++;
  }

  console.log(`ISSN map built: ${print.size} print, ${online.size} online`);
  return { print, online };
}

async function fetchPage(cursor: string): Promise<{ results: OpenAlexSource[]; next_cursor: string | null }> {
  const url = new URL(`${OPENALEX_BASE}/sources`);
  url.searchParams.set('filter', 'type:journal');
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('cursor', cursor);
  url.searchParams.set('select', 'id,issn_l,issn,summary_stats,x_concepts,apc_prices');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`OpenAlex error ${res.status}: ${body}\nURL: ${url.toString()}`);
  }
  const data = await res.json();
  return { results: data.results, next_cursor: data.meta?.next_cursor ?? null };
}

function parseApcUsd(source: OpenAlexSource): number | null {
  if (!source.apc_prices) return null;
  const usd = source.apc_prices.find((p) => p.currency === 'USD');
  return usd?.price_usd ?? null;
}

function parseSubjectAreas(source: OpenAlexSource): string[] {
  if (!source.x_concepts) return [];
  return source.x_concepts
    .filter((c) => c.score >= 0.3 && c.level <= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 6)
    .map((c) => c.display_name);
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function flushUpdates(
  updates: Map<string, { impact_factor?: number; subject_areas?: string[]; apc_cost_usd?: number }>,
): Promise<number> {
  if (updates.size === 0) return 0;
  let count = 0;

  // Group by which fields are set to minimise update calls
  for (const [id, fields] of updates) {
    const update: Record<string, unknown> = {};
    if (fields.impact_factor != null) update.impact_factor = fields.impact_factor;
    if (fields.subject_areas && fields.subject_areas.length > 0) update.subject_areas = fields.subject_areas;
    if (fields.apc_cost_usd != null) update.apc_cost_usd = fields.apc_cost_usd;
    if (Object.keys(update).length === 0) continue;

    const { error } = await supabase.from('journals').update(update).eq('id', id);
    if (error) console.warn(`Update failed for journal ${id}:`, error.message);
    else count++;
  }

  return count;
}

async function main() {
  const issnMap = await buildIssnMap();

  console.log('Starting OpenAlex metadata enrichment...');
  let cursor = '*';
  let processed = 0;
  let matched = 0;

  while (true) {
    const { results, next_cursor } = await fetchPage(cursor);
    if (results.length === 0) break;

    // Build id -> update map for this page
    const updates = new Map<string, { impact_factor?: number; subject_areas?: string[]; apc_cost_usd?: number }>();

    for (const source of results) {
      const issns = [source.issn_l, ...(source.issn ?? [])].filter(Boolean) as string[];
      if (issns.length === 0) continue;

      // Find matching journal id via any of the ISSNs
      let journalId: string | undefined;
      for (const rawIssn of issns) {
        const norm = rawIssn.replace(/-/g, '');
        journalId = issnMap.print.get(norm) ?? issnMap.online.get(norm);
        if (journalId) break;
      }
      if (!journalId) continue;

      const impact_factor = source.summary_stats?.['2yr_mean_citedness'] ?? undefined;
      const subject_areas = parseSubjectAreas(source);
      const apc_cost_usd = parseApcUsd(source) ?? undefined;

      if (impact_factor == null && subject_areas.length === 0 && apc_cost_usd == null) continue;

      updates.set(journalId, { impact_factor, subject_areas, apc_cost_usd });
    }

    const count = await flushUpdates(updates);
    matched += count;
    processed += results.length;

    if (processed % 1000 === 0) console.log(`Processed ${processed} OpenAlex sources, updated ${matched} journals`);

    if (!next_cursor) break;
    cursor = next_cursor;
    await sleep(DELAY_MS);
  }

  console.log(`Done. Processed ${processed} total, updated ${matched} journals.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
