/**
 * import-citescore.ts
 *
 * Calls Elsevier free serial metadata API for each journal that has an ISSN.
 * No API key required. Writes cite_score to matched journals.
 *
 * Rate limit: 350ms delay between requests (~3 req/s, stays under free tier).
 *
 * Run: npx ts-node -r dotenv/config server/scripts/import-citescore.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ELSEVIER_BASE = 'https://api.elsevier.com/content/serial/title/issn';
const DELAY_MS = 350;
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
    // Retry once
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

async function main() {
  console.log('Starting CiteScore enrichment...');
  let processed = 0;
  let updated = 0;
  let page = 0;

  while (true) {
    const { data: rows, error } = await supabase
      .from('journals')
      .select('id, issn_print, issn_online')
      .or('issn_print.not.is.null,issn_online.not.is.null')
      .range(page * PAGE_SIZE, (page + 1) * PAGE_SIZE - 1);

    if (error) { console.error('Supabase error:', error.message); break; }
    if (!rows || rows.length === 0) break;

    for (const row of rows) {
      const issn = row.issn_print ?? row.issn_online;
      if (!issn) continue;

      const citeScore = await fetchCiteScore(issn);
      processed++;

      if (citeScore != null) {
        const { error: updateError } = await supabase
          .from('journals')
          .update({ cite_score: citeScore })
          .eq('id', row.id);

        if (updateError) console.warn(`Update failed for ${row.id}:`, updateError.message);
        else updated++;
      }

      if (processed % 100 === 0) console.log(`Processed ${processed}, updated ${updated}`);
      await sleep(DELAY_MS);
    }

    page++;
  }

  console.log(`Done. Processed ${processed} journals, updated ${updated} with CiteScore.`);
}

main().catch((err) => { console.error(err); process.exit(1); });
