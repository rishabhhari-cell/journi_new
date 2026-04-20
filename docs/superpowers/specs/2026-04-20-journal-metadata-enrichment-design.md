# Journal Metadata Enrichment Design

## Goal

Enrich all 50,000 journals in Supabase with impact metric, subject areas, open access cost, and time/acceptance data from three free bulk sources, then surface the best available metric in the Journal Finder UI with plain "Unavailable" fallback text for missing fields.

## Background

The current journals table has `open_access` populated for all 50,000 rows but zero coverage for `impact_factor`, `acceptance_rate`, `avg_decision_days`, and `subject_areas`. These fields are non-negotiable requirements for the Journal Finder. Clarivate JCR is not freely available, so we use three free alternatives in a display hierarchy: IF proxy (OpenAlex) -> CiteScore (Elsevier) -> SJR score (Scimago).

---

## Section 1: Data Sources and Field Mapping

### Source priority (highest wins per field)

| Field | Source | Coverage estimate |
| --- | --- | --- |
| `impact_factor` | OpenAlex `impact_factor` field | ~60% of indexed journals |
| `subject_areas` | OpenAlex `x_concepts` (score >= 0.3, top 6) | ~90% |
| `apc_cost_usd` | OpenAlex `apc_prices` (USD) | ~50% |
| `cite_score` | Elsevier CiteScore API (free, no key) | ~26k journals |
| `sjr_score` | Scimago annual CSV | ~22k journals |
| `sjr_quartile` | Scimago annual CSV | ~22k journals |

### Display hierarchy in UI

```text
impact_factor -> cite_score -> sjr_score -> "Unavailable"
```

All three values that are present are shown in the detail drawer. Only the best available is shown on the card. Missing values display the plain text "Unavailable" (no special characters, no dashes, no em dashes).

### New Supabase columns

```sql
ALTER TABLE journals ADD COLUMN cite_score FLOAT;
ALTER TABLE journals ADD COLUMN sjr_score FLOAT;
ALTER TABLE journals ADD COLUMN sjr_quartile TEXT;
```

---

## Section 2: Enrichment Scripts

Three standalone scripts in `server/scripts/`, each following the pattern of `seed-from-openalex.ts`. All scripts:

- Load `.env` via `dotenv`
- Connect via `SUPABASE_SERVICE_ROLE_KEY`
- Only UPDATE existing rows (never insert)
- Match by `issn_print` first, then `issn_online` as fallback
- Skip rows where source returns no usable data
- Log progress every 500 rows
- Are idempotent and safe to re-run

### Script 1: `enrich-openalex-metadata.ts`

- Pages through all OpenAlex sources using cursor pagination (`sort=works_count:desc`)
- For each source, fetches: `impact_factor`, `x_concepts`, `apc_prices`, `cited_by_count`
- Maps `x_concepts` (score >= 0.3, top 6) to `subject_areas` string array
- Updates matched rows with `impact_factor`, `subject_areas`, `apc_cost_usd`
- Uses `select` param to fetch only needed fields (same pattern as existing seed script)
- Batch size: 200 (OpenAlex max per_page), upsert chunk: 50 rows per Supabase UPDATE call
- Delay: 100ms between OpenAlex pages (polite crawling)

### Script 2: `import-scimago.ts`

- Reads a locally placed CSV file at `server/scripts/data/scimago.csv`
- Parses with explicit UTF-8 encoding and semicolon delimiter, strips BOM if present
- Extracts: `Sourceid`, `Title`, `SJR`, `H index`, `SJR Best Quartile`, `Issn`
- Normalises ISSNs by stripping hyphens before matching (e.g. "1234-5678" -> "12345678")
- Matches journals by ISSN (Scimago ISSN field contains comma-separated values, e.g. "12345678, 87654321")
- Writes `sjr_score` (float), `sjr_quartile` (Q1/Q2/Q3/Q4 or null), into journals rows
- Processes in batches of 100, UPDATE per matched row
- Scimago CSV download: [scimagojr.com/journalrank.php](https://www.scimagojr.com/journalrank.php) (Export button, no login needed)

### Script 3: `import-citescore.ts`

- Calls Elsevier free serial metadata API: `https://api.elsevier.com/content/serial/title/issn/{issn}`
- No API key required for this endpoint
- Processes only journals that have `issn_print` or `issn_online` populated
- Rate limit: 350ms delay between requests (stays under ~3 req/s)
- Extracts `citeScoreCurrentMetric` from response JSON
- Writes to `cite_score` column
- 404 responses: skip silently
- Non-200 responses: log warning, skip

---

## Section 3: UI Changes

### Files to change

- `client/src/pages/Discovery.tsx` - replace raw IF display with `JournalMetricBadge` component
- `client/src/components/discovery/JournalDetailDrawer.tsx` - show all available metrics
- `client/src/components/discovery/JournalMetricBadge.tsx` - new component (metric display logic)
- `client/src/types/index.ts` (or equivalent) - add `citeScore`, `sjrScore`, `sjrQuartile` fields to `Journal` type
- `server/services/journals/types.ts` - add new fields to `JournalRow` and `mapJournalRow`

### JournalMetricBadge component

Single-responsibility component that accepts a `Journal` and returns the best available metric display.

```tsx
// Props: { journal: Journal; size?: "card" | "detail" }
```

Logic:

1. If `journal.impactFactor` is a number -> show value + label "IF"
2. Else if `journal.citeScore` is a number -> show value + label "CiteScore"
3. Else if `journal.sjrScore` is a number -> show value + label "SJR"
4. Else -> show "Unavailable" in muted text

For `size="detail"`, renders all three non-null metrics stacked, not just the top one.

### Journal card (Discovery.tsx)

Replace current IF block:

```tsx
// Before
{ifStr != null && (
  <div className="flex items-baseline gap-1 shrink-0">
    <span className="text-lg font-extrabold">{ifStr}</span>
    <span className="text-[9px] uppercase">IF</span>
  </div>
)}

// After
<JournalMetricBadge journal={journal} size="card" />
```

"Unavailable" renders as muted text at the same position so layout does not shift.

### Filter panel

Existing `impactFactorMin`/`impactFactorMax` filter applies to `impact_factor` only on the backend.
No change to filter logic at this stage - this is a data enrichment task, not a filter redesign.

### No mojibake guarantee

- All script files saved as UTF-8
- No string literals containing non-ASCII characters in source files
- Scimago CSV parsed with explicit `utf-8` encoding and BOM stripping
- "Unavailable" is plain ASCII
- Metric labels ("IF", "CiteScore", "SJR") are plain ASCII
- No em dashes, smart quotes, or curly apostrophes anywhere in new or modified code

---

## Section 4: Supabase Migration

Single migration file: `supabase/migrations/YYYYMMDDHHMMSS_add_journal_metrics_columns.sql`

```sql
ALTER TABLE journals ADD COLUMN IF NOT EXISTS cite_score FLOAT;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS sjr_score FLOAT;
ALTER TABLE journals ADD COLUMN IF NOT EXISTS sjr_quartile TEXT;
```

No index needed on these columns at this stage (not used in WHERE clauses).

---

## Section 5: Error Handling and Edge Cases

- **ISSN format variance**: Scimago ISSNs may lack hyphen (12345678 vs 1234-5678). Scripts normalise by stripping hyphens before matching.
- **Multiple ISSNs per journal**: Scripts try `issn_print` first, then `issn_online`. First match wins, no double-update.
- **OpenAlex missing `impact_factor`**: Field is null for most journals. Script skips `impact_factor` update if value is null.
- **Elsevier API timeout**: 10s timeout per request, retry once on failure, then skip.
- **Scimago CSV encoding**: Strip UTF-8 BOM (`\uFEFF`) from first field name before parsing.
- **Concurrent Supabase writes**: Max 10 simultaneous UPDATE calls per batch to avoid 502s (same pattern as backfill script).
- **Re-runs**: All scripts are safe to re-run. They overwrite existing values with the same data.

---

## Out of Scope

- On-demand scraping for submission requirements (separate spec)
- Filtering out journals with no metadata (show with "Unavailable" gaps instead)
- Acceptance rate and avg_decision_days backfill via scraper (contingent on budget approval, ~$30-60)
- Clarivate JCR integration (paid, not free)
- Automated re-enrichment schedule (monthly sync already exists in sync.service.ts for scraper)