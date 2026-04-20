/**
 * import-citescore.ts
 *
 * Calls Elsevier free serial metadata API for each journal that has an ISSN.
 * No API key required. Writes cite_score to matched journals.
 *
 * Optimisations vs original:
 *   - Skips journals that already have cite_score (safe to re-run)
 *   - 3 concurrent requests (latency-bound, not rate-bound at 350ms window)
 *
 * Rate limit: ~3 req/s free tier. With 3 concurrent at 350ms each that's
 * effectively 3 requests per 350ms slot = same rate, ~3x throughput.
 *
 * Run: npx ts-node -r dotenv/config server/scripts/import-citescore.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELSEVIER_BASE = 'https://api.elsevier.com/content/serial/title/issn';
const SLOT_MS = 350;        // one 350ms slot per 3 concurrent requests
const CONCURRENCY = 3;      // parallel requests per slot
const REQUEST_TIMEOUT_MS = 10000;
const PAGE_SIZE = 1000;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function fetchCiteScore(issn: string): Promise<number | null> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const res = await fetch(`${ELSEVIER_BASE}/${issn}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (res.status === 404) return null;
    if (!res.ok) {
      console.warn(`Elsevier ${res.status} for ISSN ${issn}`);
      return null;
    }

    const data = await res.json();
    const entry = data?.['serial-metadata-response']?.entry?.[0];
    const raw = entry?.citeScoreCurrentMetric;
    if (raw == null) return null;
    const val = parseFloat(String(raw));
    return isNaN(val) ? null : val;
  } catch (err: unknown) {
    clearTimeout(timer);
    if (err instanceof Error && err.name === 'AbortError') {
      console.warn(`Timeout for ISSN ${issn}, skipping`);
      return null;
    }
    // Retry once without timeout
    try {
      const res2 = await fetch(`${ELSEVIER_BASE}/${issn}`, {
        headers: { Accept: 'application/json' },
      });
      if (!res2.ok) return null;
      const data2 = await res2.json();
      const entry2 = data2?.['serial-metadata-response']?.entry?.[0];
      const raw2 = entry2?.citeScoreCurrentMetric;
      if (raw2 == null) return null;
      const val2 = parseFloat(String(raw2));
      return isNaN(val2) ? null : val2;
    } catch {
      return null;
    }
  }
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function processSlot(
  rows: Array<{ id: string; issn_print: string | null; issn_online: string | null }>,
): Promise<number> {
  const results = await Promise.all(
    rows.map(async (row) => {
      const issn = row.issn_print ?? row.issn_online;
      if (!issn) return 0;
      const citeScore = await fetchCiteScore(issn);
      if (citeScore == null) return 0;
      const { error } = await supabase
        .from('journals')
        .update({ cite_score: citeScore })
        .eq('id', row.id);
      if (error) { console.warn(`Update failed for ${row.id}:`, error.message); return 0; }
      return 1 as const;
    }),
  );
  return results.reduce<number>((a, b) => a + b, 0);
}

async function main() {
  console.log('Starting CiteScore enrichment (skipping already-enriched journals)...');
  let processed = 0;
  let updated = 0;
  let page = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('journals')
      .select('id, issn_print, issn_online')
      .or('issn_print.not.is.null,issn_online.not.is.null')
      .is('cite_score', null)  // skip already enriched
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) { console.error('Supabase error:', error.message); break; }
    if (!rows || rows.length === 0) break;

    // Process in slots of CONCURRENCY with a 350ms gap between slots
    for (let i = 0; i < rows.length; i += CONCURRENCY) {
      const slot = rows.slice(i, i + CONCURRENCY);
      const [count] = await Promise.all([
        processSlot(slot),
        sleep(SLOT_MS),
      ]);
      updated += count;
      processed += slot.length;
      if (processed % 100 === 0) console.log(`Processed ${processed}, updated ${updated}`);
    }

    page++;
  }

  console.log(`Done. Processed ${processed} journals, updated ${updated} with CiteScore.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
