/**
 * import-scimago.ts
 *
 * Reads server/scripts/data/scimago.csv (semicolon-delimited, UTF-8 with optional BOM)
 * and writes sjr_score + sjr_quartile to matched journals.
 *
 * Download from: https://www.scimagojr.com/journalrank.php (Export button)
 *
 * Run: npx ts-node -r dotenv/config server/scripts/import-scimago.ts
 */
import * as dotenv from 'dotenv';
dotenv.config();

import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CSV_PATH = path.join(__dirname, 'data', 'scimago.csv');

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

function stripHyphens(issn: string): string {
  return issn.replace(/-/g, '');
}

function parseSjrValue(raw: string): number | null {
  if (!raw || raw.trim() === '') return null;
  // Scimago uses comma as decimal separator in some exports
  const normalised = raw.trim().replace(',', '.');
  const val = parseFloat(normalised);
  return isNaN(val) ? null : val;
}

function parseQuartile(raw: string): string | null {
  const q = raw.trim();
  if (/^Q[1-4]$/.test(q)) return q;
  return null;
}

async function main() {
  if (!fs.existsSync(CSV_PATH)) {
    console.error(`CSV not found at ${CSV_PATH}. Download from scimagojr.com and place it there.`);
    process.exit(1);
  }

  let content = fs.readFileSync(CSV_PATH, 'utf-8');
  // Strip UTF-8 BOM if present
  if (content.charCodeAt(0) === 0xfeff) content = content.slice(1);

  const lines = content.split('\n');
  const header = lines[0].split(';').map((h) => h.trim().replace(/^"|"$/g, ''));

  const issnIdx = header.indexOf('Issn');
  const sjrIdx = header.indexOf('SJR');
  const quartileIdx = header.indexOf('SJR Best Quartile');

  if (issnIdx === -1 || sjrIdx === -1 || quartileIdx === -1) {
    console.error('CSV missing expected columns. Header:', header);
    process.exit(1);
  }

  let processed = 0;
  let updated = 0;
  const batch: Array<{ issns: string[]; sjr_score: number | null; sjr_quartile: string | null }> = [];

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split(';').map((c) => c.trim().replace(/^"|"$/g, ''));
    const rawIssns = cols[issnIdx] ?? '';
    const issns = rawIssns
      .split(',')
      .map((s) => stripHyphens(s.trim()))
      .filter((s) => s.length > 0);

    const sjrScore = parseSjrValue(cols[sjrIdx]);
    const sjrQuartile = parseQuartile(cols[quartileIdx]);

    if (issns.length === 0 || (sjrScore == null && sjrQuartile == null)) continue;

    batch.push({ issns, sjr_score: sjrScore, sjr_quartile: sjrQuartile });

    if (batch.length >= 100) {
      const count = await flushBatch(batch);
      updated += count;
      batch.length = 0;
    }

    processed++;
    if (processed % 500 === 0) console.log(`Processed ${processed} rows, updated ${updated}`);
  }

  if (batch.length > 0) {
    updated += await flushBatch(batch);
  }

  console.log(`Done. Processed ${processed} CSV rows, updated ${updated} journals.`);
}

async function flushBatch(batch: Array<{ issns: string[]; sjr_score: number | null; sjr_quartile: string | null }>): Promise<number> {
  let count = 0;
  for (const row of batch) {
    const update: Record<string, unknown> = {};
    if (row.sjr_score != null) update.sjr_score = row.sjr_score;
    if (row.sjr_quartile != null) update.sjr_quartile = row.sjr_quartile;
    if (Object.keys(update).length === 0) continue;

    for (const issn of row.issns) {
      // Try issn_print (stored with hyphen like 1234-5678) - normalise both sides
      const { data, error } = await supabase
        .from('journals')
        .update(update)
        .or(`issn_print.eq.${issn},issn_online.eq.${issn},issn_print.eq.${issn.slice(0, 4)}-${issn.slice(4)},issn_online.eq.${issn.slice(0, 4)}-${issn.slice(4)}`)
        .select('id');

      if (error) {
        console.warn(`Supabase error for ISSN ${issn}:`, error.message);
        continue;
      }

      if (data && data.length > 0) {
        count++;
        break; // matched on this ISSN, skip remaining ISSNs for this row
      }
    }
  }
  return count;
}

main().catch((err) => { console.error(err); process.exit(1); });
