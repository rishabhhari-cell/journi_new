/**
 * enrich-openalex-metadata.ts
 *
 * Pages through all OpenAlex sources (type:journal) via cursor pagination,
 * matches against Supabase journals by ISSN, and writes:
 *   impact_factor, subject_areas, apc_cost_usd
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
const DELAY_MS = 100;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface OpenAlexSource {
  id: string;
  issn_l: string | null;
  issn: string[] | null;
  impact_factor: number | null;
  x_concepts: Array<{ display_name: string; score: number; level: number }> | null;
  apc_prices: Array<{ price: number; currency: string; price_usd: number }> | null;
}

async function fetchPage(cursor: string): Promise<{ results: OpenAlexSource[]; next_cursor: string | null }> {
  const url = new URL(`${OPENALEX_BASE}/sources`);
  url.searchParams.set('filter', 'type:journal');
  url.searchParams.set('per_page', String(PER_PAGE));
  url.searchParams.set('cursor', cursor);
  url.searchParams.set('sort', 'works_count:desc');
  url.searchParams.set('select', 'id,issn_l,issn,impact_factor,x_concepts,apc_prices');
  url.searchParams.set('mailto', MAILTO);

  const res = await fetch(url.toString(), { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error(`OpenAlex error ${res.status}`);
  const data = await res.json();
  return { results: data.results, next_cursor: data.meta?.next_cursor ?? null };
}

async function updateBatch(rows: Array<{ issn: string; impact_factor: number | null; subject_areas: string[]; apc_cost_usd: number | null }>) {
  for (const row of rows) {
    const update: Record<string, unknown> = {};
    if (row.impact_factor != null) update.impact_factor = row.impact_factor;
    if (row.subject_areas.length > 0) update.subject_areas = row.subject_areas;
    if (row.apc_cost_usd != null) update.apc_cost_usd = row.apc_cost_usd;
    if (Object.keys(update).length === 0) continue;

    // Try issn_print first, then issn_online
    let { error } = await supabase
      .from('journals')
      .update(update)
      .eq('issn_print', row.issn);

    if (error) {
      ({ error } = await supabase
        .from('journals')
        .update(update)
        .eq('issn_online', row.issn));
    }

    if (error) console.warn(`Update failed for ISSN ${row.issn}:`, error.message);
  }
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

async function main() {
  console.log('Starting OpenAlex metadata enrichment...');
  let cursor = '*';
  let processed = 0;
  let matched = 0;

  while (true) {
    const { results, next_cursor } = await fetchPage(cursor);
    if (results.length === 0) break;

    const batch: Array<{ issn: string; impact_factor: number | null; subject_areas: string[]; apc_cost_usd: number | null }> = [];

    for (const source of results) {
      const issns = [source.issn_l, ...(source.issn ?? [])].filter(Boolean) as string[];
      if (issns.length === 0) continue;

      const primaryIssn = issns[0];
      batch.push({
        issn: primaryIssn,
        impact_factor: source.impact_factor,
        subject_areas: parseSubjectAreas(source),
        apc_cost_usd: parseApcUsd(source),
      });
    }

    if (batch.length > 0) {
      await updateBatch(batch);
      matched += batch.length;
    }

    processed += results.length;
    if (processed % 500 === 0) console.log(`Processed ${processed} sources, ${matched} matched`);

    if (!next_cursor) break;
    cursor = next_cursor;
    await sleep(DELAY_MS);
  }

  console.log(`Done. Processed ${processed} total, attempted updates for ${matched}.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
