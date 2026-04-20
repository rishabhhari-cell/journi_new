# Journal Metadata Enrichment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich journals table with CiteScore and SJR metrics, add a JournalMetricBadge UI component with IF -> CiteScore -> SJR -> "Unavailable" fallback, and filter all non-Latin journals from live OpenAlex results.

**Architecture:** Three standalone bulk-enrichment scripts write to two new Supabase columns (cite_score, sjr_score, sjr_quartile). A new JournalMetricBadge component encapsulates the display hierarchy. Discovery.tsx and JournalDetailDrawer consume the badge. Non-Latin filtering is applied at the OpenAlex client layer.

**Tech Stack:** TypeScript, Supabase (service role), OpenAlex REST API, Elsevier serial metadata API, Scimago CSV, React + Tailwind

---

## File Map

| Action | File |
|--------|------|
| Create | `supabase/migrations/20260420000000_add_journal_metrics_columns.sql` |
| Modify | `shared/backend.ts` — add citeScore, sjrScore, sjrQuartile to JournalDTO |
| Modify | `server/services/journals/types.ts` — add to JournalRow + mapJournalRow |
| Modify | `client/src/types/index.ts` — add to Journal interface |
| Modify | `client/src/lib/journal-search-api.ts` — map new fields in mapBackendJournal |
| Modify | `client/src/lib/openalex-api.ts` — add isLatinName filter (linter keeps reverting) |
| Create | `server/scripts/enrich-openalex-metadata.ts` |
| Create | `server/scripts/import-scimago.ts` |
| Create | `server/scripts/import-citescore.ts` |
| Create | `client/src/components/discovery/JournalMetricBadge.tsx` |
| Modify | `client/src/pages/Discovery.tsx` — use JournalMetricBadge |
| Modify | `client/src/components/discovery/JournalDetailDrawer.tsx` — use JournalMetricBadge |

---

### Task 1: Supabase Migration

**Files:**
- Create: `supabase/migrations/20260420000000_add_journal_metrics_columns.sql`

- [ ] **Step 1: Create migration file**

```sql
-- supabase/migrations/20260420000000_add_journal_metrics_columns.sql
ALTER TABLE journals ADD COLUMN IF NOT EXISTS cite_score FLOAT;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS sjr_score FLOAT;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS sjr_quartile TEXT;
```

- [ ] **Step 2: Apply migration**

Run in Supabase SQL editor or via CLI:
```bash
supabase db push
```

Or paste the SQL directly into the Supabase dashboard SQL editor and run it.

- [ ] **Step 3: Verify columns exist**

Run in Supabase SQL editor:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'journals'
  AND column_name IN ('cite_score', 'sjr_score', 'sjr_quartile');
```

Expected: 3 rows returned with correct types (double precision / text).

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260420000000_add_journal_metrics_columns.sql
git commit -m "feat: add cite_score, sjr_score, sjr_quartile columns to journals"
```

---

### Task 2: Backend Types

**Files:**
- Modify: `shared/backend.ts`
- Modify: `server/services/journals/types.ts`

- [ ] **Step 1: Add new fields to JournalDTO in shared/backend.ts**

Find the JournalDTO interface in `shared/backend.ts` and add three fields after `apcCostUsd`:

```typescript
  apcCostUsd: number | null;
  citeScore: number | null;
  sjrScore: number | null;
  sjrQuartile: string | null;
```

- [ ] **Step 2: Add new fields to JournalRow in server/services/journals/types.ts**

Find `JournalRow` interface and add after `apc_cost_usd`:

```typescript
  cite_score: number | null;
  sjr_score: number | null;
  sjr_quartile: string | null;
```

- [ ] **Step 3: Add mapping in mapJournalRow**

In the `mapJournalRow` function body, add after `apcCostUsd: row.apc_cost_usd,`:

```typescript
    citeScore: row.cite_score,
    sjrScore: row.sjr_score,
    sjrQuartile: row.sjr_quartile,
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add shared/backend.ts server/services/journals/types.ts
git commit -m "feat: add citeScore, sjrScore, sjrQuartile to JournalDTO and JournalRow"
```

---

### Task 3: Frontend Types and API Mapping

**Files:**
- Modify: `client/src/types/index.ts`
- Modify: `client/src/lib/journal-search-api.ts`
- Modify: `client/src/lib/openalex-api.ts`

- [ ] **Step 1: Add fields to Journal interface in client/src/types/index.ts**

Find the `Journal` interface and add after `apcCostUsd?: number | null;`:

```typescript
  citeScore?: number | null;
  sjrScore?: number | null;
  sjrQuartile?: string | null;
```

- [ ] **Step 2: Map new fields in journal-search-api.ts**

Open `client/src/lib/journal-search-api.ts` and find the `mapBackendJournal` function (or equivalent that converts raw API response to `Journal`). Add after the `apcCostUsd` mapping:

```typescript
  citeScore: raw.citeScore ?? null,
  sjrScore: raw.sjrScore ?? null,
  sjrQuartile: raw.sjrQuartile ?? null,
```

- [ ] **Step 3: Fix isLatinName in openalex-api.ts**

The linter keeps reverting `client/src/lib/openalex-api.ts`. Add the following function before the `// Public API` section comment (around line 140):

```typescript
// Rejects journal names that contain more than 2 characters outside the
// Latin + Latin-Extended Unicode range (U+0000 to U+024F).
// Filters out Chinese, Arabic, Cyrillic, Japanese, Korean, etc.
function isLatinName(name: string): boolean {
  let nonLatin = 0;
  for (const c of name) {
    const code = c.codePointAt(0) ?? 0;
    if (code > 0x024f && !/[\s\d!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~]/.test(c)) {
      nonLatin++;
      if (nonLatin > 2) return false;
    }
  }
  return true;
}
```

Then in `searchOpenAlexJournals`, change:
```typescript
    journals: data.results.map(parseSource),
```
to:
```typescript
    journals: data.results.map(parseSource).filter((j) => isLatinName(j.name)),
```

And in `browseOpenAlexJournals`, change:
```typescript
    journals: data.results.map(parseSource),
```
to:
```typescript
    journals: data.results.map(parseSource).filter((j) => isLatinName(j.name)),
```

Note: If the file already has isLatinName from a previous edit (check the file), only add it if missing.

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add client/src/types/index.ts client/src/lib/journal-search-api.ts client/src/lib/openalex-api.ts
git commit -m "feat: add citeScore/sjrScore/sjrQuartile to Journal type and map from backend; add isLatinName filter to OpenAlex client"
```

---

### Task 4: JournalMetricBadge Component

**Files:**
- Create: `client/src/components/discovery/JournalMetricBadge.tsx`

- [ ] **Step 1: Create the component**

```tsx
import type { Journal } from '../../types';

interface Props {
  journal: Journal;
  size?: 'card' | 'detail';
}

export function JournalMetricBadge({ journal, size = 'card' }: Props) {
  const { impactFactor, citeScore, sjrScore, sjrQuartile } = journal;

  if (size === 'detail') {
    const metrics: { label: string; value: number }[] = [];
    if (impactFactor != null) metrics.push({ label: 'IF', value: impactFactor });
    if (citeScore != null) metrics.push({ label: 'CiteScore', value: citeScore });
    if (sjrScore != null) metrics.push({ label: 'SJR', value: sjrScore });

    if (metrics.length === 0) {
      return (
        <span className="text-xs text-muted-foreground">Unavailable</span>
      );
    }

    return (
      <div className="flex flex-col gap-1">
        {metrics.map(({ label, value }) => (
          <div key={label} className="flex items-baseline gap-1">
            <span className="text-lg font-extrabold">{value.toFixed(2)}</span>
            <span className="text-[9px] uppercase text-muted-foreground">{label}</span>
            {label === 'SJR' && sjrQuartile != null && (
              <span className="text-[9px] text-muted-foreground">({sjrQuartile})</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // card: show best available metric only
  if (impactFactor != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{impactFactor.toFixed(2)}</span>
        <span className="text-[9px] uppercase">IF</span>
      </div>
    );
  }

  if (citeScore != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{citeScore.toFixed(2)}</span>
        <span className="text-[9px] uppercase">CiteScore</span>
      </div>
    );
  }

  if (sjrScore != null) {
    return (
      <div className="flex items-baseline gap-1 shrink-0">
        <span className="text-lg font-extrabold">{sjrScore.toFixed(2)}</span>
        <span className="text-[9px] uppercase">SJR</span>
      </div>
    );
  }

  return (
    <span className="text-sm text-muted-foreground shrink-0">Unavailable</span>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add client/src/components/discovery/JournalMetricBadge.tsx
git commit -m "feat: add JournalMetricBadge component (IF -> CiteScore -> SJR -> Unavailable)"
```

---

### Task 5: Wire JournalMetricBadge into Discovery.tsx

**Files:**
- Modify: `client/src/pages/Discovery.tsx`

- [ ] **Step 1: Read current IF display block in Discovery.tsx**

Search for `ifStr` or `impact` in `client/src/pages/Discovery.tsx` to find the current IF display block.

- [ ] **Step 2: Add import for JournalMetricBadge**

At the top of `Discovery.tsx`, add:

```typescript
import { JournalMetricBadge } from '../components/discovery/JournalMetricBadge';
```

- [ ] **Step 3: Remove formatImpactFactor function and ifStr variable**

Remove any local helper that formats IF (e.g. `formatImpactFactor`, `ifStr`, `const ifDisplay`). These are replaced by the badge.

- [ ] **Step 4: Replace the IF display block with JournalMetricBadge**

Replace the block that looks like:
```tsx
{ifStr != null && (
  <div className="flex items-baseline gap-1 shrink-0">
    <span className="text-lg font-extrabold">{ifStr}</span>
    <span className="text-[9px] uppercase">IF</span>
  </div>
)}
```

With:
```tsx
<JournalMetricBadge journal={journal} size="card" />
```

The badge handles "Unavailable" internally so no conditional wrapper needed.

- [ ] **Step 5: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 6: Commit**

```bash
git add client/src/pages/Discovery.tsx
git commit -m "feat: replace raw IF display with JournalMetricBadge in Discovery card"
```

---

### Task 6: Wire JournalMetricBadge into JournalDetailDrawer

**Files:**
- Modify: `client/src/components/discovery/JournalDetailDrawer.tsx`

- [ ] **Step 1: Read current metrics section in JournalDetailDrawer.tsx**

Search for `Impact Factor` in `client/src/components/discovery/JournalDetailDrawer.tsx` to locate the Key Metrics section.

- [ ] **Step 2: Add import for JournalMetricBadge**

```typescript
import { JournalMetricBadge } from './JournalMetricBadge';
```

- [ ] **Step 3: Replace the Impact Factor stat with JournalMetricBadge**

Replace the existing `Stat label="Impact Factor (2yr)"` (or similar) block with:

```tsx
<div className="flex flex-col gap-0.5">
  <span className="text-xs text-muted-foreground uppercase tracking-wide">Impact Metrics</span>
  <JournalMetricBadge journal={journal} size="detail" />
</div>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd client && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 5: Commit**

```bash
git add client/src/components/discovery/JournalDetailDrawer.tsx
git commit -m "feat: show all available metrics in JournalDetailDrawer via JournalMetricBadge"
```

---

### Task 7: Enrichment Script — OpenAlex Metadata

**Files:**
- Create: `server/scripts/enrich-openalex-metadata.ts`

- [ ] **Step 1: Create the script**

```typescript
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
const BATCH_SIZE = 50;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/scripts/enrich-openalex-metadata.ts
git commit -m "feat: add enrich-openalex-metadata script (impact_factor, subject_areas, apc_cost_usd)"
```

---

### Task 8: Enrichment Script — Scimago CSV

**Files:**
- Create: `server/scripts/import-scimago.ts`

Note: Before running this script, download the Scimago CSV from scimagojr.com/journalrank.php (Export button, no login) and place it at `server/scripts/data/scimago.csv`.

- [ ] **Step 1: Create the script**

```typescript
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
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/scripts/import-scimago.ts
git commit -m "feat: add import-scimago script (sjr_score, sjr_quartile)"
```

---

### Task 9: Enrichment Script — CiteScore

**Files:**
- Create: `server/scripts/import-citescore.ts`

- [ ] **Step 1: Create the script**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd server && npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 3: Commit**

```bash
git add server/scripts/import-citescore.ts
git commit -m "feat: add import-citescore script (cite_score via Elsevier free API)"
```

---

### Task 10: QA Pass

- [ ] **Step 1: Start the dev server**

```bash
cd client && npm run dev
```

- [ ] **Step 2: Check Journal Finder cards**

Navigate to the Journal Finder (Discovery page). Verify:
- Cards show IF value when available
- Cards show CiteScore value when IF is missing
- Cards show SJR value when both IF and CiteScore are missing
- Cards show plain "Unavailable" text when no metric is available
- No Chinese, Japanese, Arabic, Korean, Cyrillic journal names appear in any search results or browse results

- [ ] **Step 3: Check Journal Detail Drawer**

Click any journal card to open the detail drawer. Verify:
- "Impact Metrics" section shows all available metrics stacked (not just the top one)
- SJR entry shows quartile in parentheses when available (e.g. "0.85 SJR (Q1)")
- Missing metrics are not shown (not "Unavailable" in the stacked detail view)

- [ ] **Step 4: Check TypeScript and lint**

```bash
cd client && npx tsc --noEmit
cd server && npx tsc --noEmit
```

Expected: no errors in either

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: journal metadata enrichment — metric badge, scripts, type updates complete"
```

---

## Running the Enrichment Scripts (after schema migration)

Run these once after the Supabase migration is applied. They are safe to re-run.

```bash
# 1. OpenAlex — impact_factor, subject_areas, apc_cost_usd (~2-4 hours for all sources)
cd server && npx ts-node -r dotenv/config scripts/enrich-openalex-metadata.ts

# 2. Scimago — sjr_score, sjr_quartile (~5 minutes, local CSV)
#    Download CSV first: https://www.scimagojr.com/journalrank.php -> Export
cd server && npx ts-node -r dotenv/config scripts/import-scimago.ts

# 3. CiteScore — cite_score (~6-8 hours at 350ms/request for 50k journals)
cd server && npx ts-node -r dotenv/config scripts/import-citescore.ts
```