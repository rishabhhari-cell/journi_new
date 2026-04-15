# Journi LLM Capabilities Design

**Date:** 2026-04-15  
**Status:** Approved  
**Scope:** Parse error detection, journal scraping, journal recommender, manuscript reformatter

---

## Context

Journi is a collaborative research paper reformatter built on Express + Supabase + Yjs. The LLM
fallback has moved from Ollama to Qwen3-8B on Modal (vLLM, A10G GPU). This spec extends the
LLM's role to four capabilities while keeping manuscript text off external APIs and costs
predictable.

**Architecture principle:** deterministic-first everywhere. LLM is called only when rule-based
logic cannot produce sufficient confidence. Two Modal endpoints total:
- `journi-llm` — existing, user-facing (parse fallback, error detection, reformat suggestions)
- `journi-scraper` — new, batch-only (monthly guidelines extraction)

---

## Capability 1: Parse Error Detection

### Deterministic checks (always run, zero cost)

Confidence threshold is **strict**: a document passes deterministic parsing only when it produces
≥3 named canonical sections with no error-level diagnostics. Fewer sections or any error forces
LLM review.

**Structural errors (level: error):**
- Fewer than 3 canonical sections detected
- Required section missing (per `CANONICAL_ALIASES`)
- Two sections with the same normalised title
- Section with <50 words that likely merged into wrong block

**Content integrity errors (level: error):**
- Text ends mid-sentence (truncation signal)
- Unicode replacement characters (U+FFFD) present — garbled encoding
- Citation entry cut off before a year is found

**Warnings (level: warning, no re-parse triggered):**
- Figures referenced in text but not captured
- Tables referenced in text but not captured
- Section order differs from canonical order (informational)

### LLM checks (only when deterministic confidence < threshold)

Sent to existing `journi-llm` Modal endpoint. Input: section content only (no full manuscript).

- Section mis-attribution: prose content clearly belongs to a different section than its heading
- Merge errors: two canonical sections collapsed into one long block

### Re-parse behaviour

Error-level diagnostics trigger an automatic re-parse attempt via Modal. The re-parse result
replaces the original **only if** it produces ≥3 more named canonical sections OR reduces
error-level diagnostics by ≥2. Otherwise the original is kept and errors are surfaced to the user.

### Output

`ParseDiagnostic[]` on `RawParsedDocument`. Surfaced in the editor as a dismissible banner:
- Errors: red banner, "We found issues with your document parse. Review before editing."
- Warnings: yellow banner, dismissible without action

### Files changed
- `shared/document-parse.ts` — raise confidence threshold to ≥3 canonical sections; add new diagnostic codes
- `server/services/manuscript-parse.service.ts` — wire deterministic error checks; gate LLM call on new threshold; re-parse comparison logic

---

## Capability 2: Journal Scraping (Monthly Batch)

### New Modal endpoint: `journi-scraper`

Separate from `journi-llm`. Same A10G, `min_containers=0`. Isolation ensures batch jobs never
compete with user-facing reformat/parse requests.

### Data sources per journal

| Field | Source |
|---|---|
| Subject areas, ISSN, OA status, APC | OpenAlex / DOAJ / Crossref (existing adapters) |
| Submission guidelines | Scraped — rule-based first, LLM fallback |
| Cover logo | Scraped — `<link rel="icon">` or OG image from journal homepage |
| Mean time to publication | Scraped from journal editorial metrics page; null if not found |
| Acceptance rate | Scraped from journal stats page; null if not found |

### Scraping flow per journal

1. Fetch "Instructions for Authors" page (URL from `website_url` or ISSN-based discovery)
2. **Rule-based DOM extraction first:** regex for word counts, section lists, citation style names,
   acceptance rate percentages, publication time in weeks/days
3. **Confidence check:** if fewer than 3 fields extracted with high-certainty patterns → send
   cleaned page text to `journi-scraper` Modal for LLM extraction into `submission_requirements_json` schema
4. **Logo:** fetch `<link rel="icon">` or `og:image` from journal homepage; store URL in `logo_url`
5. **Mean time + acceptance rate:** scraped from editorial metrics page where available; never
   fabricated — stored as null if not found

### Scheduling

Modal scheduled function runs on the 1st of each month. Queries Supabase for journals where
`last_verified_at < 30 days ago`. Processes up to 500 journals per run in batches of 20
(parallel). Updates via existing `ingestJournals` upsert path.

### Cost estimate

| Journals in DB | LLM calls (~40%) | Estimated monthly cost |
|---|---|---|
| 2,000 | 800 | ~$1.20 |
| 5,000 | 2,000 | ~$3.00 |
| 20,000 | 8,000 | ~$12.00 |

Based on Qwen3-8B on A10G at ~5s/call ($0.000306/s). One cold start per batch run amortised
across hundreds of calls.

### Privacy

No manuscript text involved. Only public journal web pages are sent to Modal.

### Files created/changed
- `modal-llm/scraper.py` — new Modal app (`journi-scraper`) with scheduled function and LLM extraction endpoint
- `server/services/journals/scrape.service.ts` — rule-based DOM extraction, confidence scoring, calls `journi-scraper` on low confidence
- `server/services/journals/sync.service.ts` — add logo, mean_time_to_publication, acceptance_rate to `writableColumns`; wire scraper into `enrichRow`
- `server/services/journals/adapters/types.ts` — add new fields to `JournalEnrichment`

---

## Capability 3: Journal Recommender

### Embedding strategy

- **At manuscript upload:** extract abstract section (canonical, deterministic); embed using
  `all-MiniLM-L6-v2` on a new CPU-only `journi-embed` Modal endpoint (384-dim, ~$0.001/call);
  store in `manuscripts.abstract_embedding` (pgvector column)
- **At journal ingest:** embed journal scope/aims text using same endpoint; store in
  `journals.scope_embedding` (pgvector column)
- **At query time:** pure pgvector cosine similarity — no LLM call, no GPU cost

### Recommendation query (runs on Express, no GPU)

1. Cosine similarity: top-50 journals by `abstract_embedding <=> scope_embedding`
2. Filter by manuscript constraints: word count within journal range, required sections present,
   open access filter if specified
3. Rank filtered set by mode-dependent score (see below)
4. Return top-10 with fit metadata

### Ranking modes (user-selectable)

Similarity anchors at 0.6 in all modes — subject fit is never sacrificed.

| Mode | Formula |
|---|---|
| `auto` (default) | `0.6 * similarity + 0.2 * (1 / avg_decision_days_norm) + 0.2 * acceptance_rate` |
| `impact` | `0.6 * similarity + 0.35 * impact_factor_norm + 0.05 * acceptance_rate` |
| `odds` | `0.6 * similarity + 0.1 * impact_factor_norm + 0.3 * acceptance_rate` |

All non-similarity components normalised to [0, 1] across the candidate set before scoring.

### Open access filter

- `openAccess=true` — exclude non-OA journals before ranking
- `openAccess=false` — exclude OA journals before ranking
- Omitted — no filter (default)

### Route

```
GET /api/manuscripts/:id/recommend-journals?mode=auto|impact|odds&openAccess=true|false
```

Response shape:
```json
{
  "journals": [
    {
      "id": "...",
      "name": "...",
      "impactFactor": 4.2,
      "acceptanceRate": 0.18,
      "avgDecisionDays": 45,
      "openAccess": true,
      "fitScore": 0.81,
      "fitReasons": ["Subject match: Cardiology", "Word count within range", "Open access"]
    }
  ]
}
```

`fitReasons` are built deterministically from constraint matches — not LLM-generated.

### Re-embedding trigger

Automatically re-embeds when the abstract section is edited and saved (debounced, fires on
autosave).

### Database migrations required
- `manuscripts` table: add `abstract_embedding vector(384)` column
- `journals` table: add `scope_embedding vector(384)` column
- pgvector index: `CREATE INDEX ON journals USING ivfflat (scope_embedding vector_cosine_ops)`

### Files created/changed
- `server/services/journal-recommend.service.ts` — new: cosine query, constraint filter, score calculation, reason generation
- `server/routes/manuscripts.ts` — add `GET /:id/recommend-journals` endpoint
- `server/services/manuscript-parse.service.ts` — trigger abstract embedding after parse completes
- `server/sql/003_embeddings.sql` — migration for new vector columns and index
- `modal-llm/embed.py` — lightweight sentence-transformer endpoint on Modal for abstract/scope embedding (e.g. `sentence-transformers/all-MiniLM-L6-v2`, 384-dim, CPU-only, negligible cost)

---

## Capability 4: Manuscript Reformatter

### Flow

1. User selects target journal, clicks "Reformat"
2. `buildManuscriptFormatCheck()` runs — produces required changes list (existing service,
   unchanged)
3. **Deterministic auto-fixes** applied immediately (no LLM):
   - Section reordering to match journal's required section order
   - Structured abstract template inserted if journal requires structured abstract and current
     abstract is unstructured
   - Citation style flag added to each reference (text rewriting is a manual action)
4. **LLM suggestions** sent to `journi-llm` Modal. Input: one section at a time + journal
   guidelines. Never full manuscript. Output: `ReformatSuggestion[]` per section.
   - Word count reduction: identify specific overlong paragraphs to trim
   - Missing section stubs: draft placeholder content for required sections that are absent
     (e.g. "Data Availability", "Ethics Statement")
   - Structured abstract rewrite: restructure existing abstract prose into required subheadings

### ReformatSuggestion shape

```typescript
interface ReformatSuggestion {
  id: string;
  type: "trim" | "stub" | "restructure" | "reorder" | "citation-style";
  sectionId: string;
  original: string;       // empty string for stubs
  suggested: string;
  reason: string;         // human-readable, e.g. "Abstract exceeds 250-word limit by 47 words"
  source: "deterministic" | "llm";
  autoAccepted: boolean;  // true for deterministic reorder/template inserts only
}
```

### Track-changes UI behaviour

- `autoAccepted: true` (deterministic): applied immediately, shown as accepted diff, undoable
- `autoAccepted: false` (LLM): shown as pending diff (strikethrough original, green suggested),
  user must explicitly accept or reject each
- All suggestions persisted to DB so the session survives page refresh

### Route

```
POST /api/manuscripts/:id/reformat
Body: { journalId: string }

Response: {
  deterministicChanges: ReformatSuggestion[],
  llmSuggestions: ReformatSuggestion[]
}
```

Two distinct arrays so the frontend can auto-apply deterministic changes and queue LLM
suggestions for user review independently.

### Parallelism

LLM suggestion calls are issued in parallel (`Promise.all`) — one call per section — matching the
existing pattern in `llm.service.ts`. Modal's `max_inputs=8` handles concurrent requests on the
same container.

### Privacy

Only the specific section content being suggested on + journal guidelines text are sent to Modal.
Full manuscript is never sent to any external API.

### Files created/changed
- `server/services/reformat.service.ts` — new: orchestrates format check → deterministic fixes → LLM suggestions
- `server/routes/manuscripts.ts` — add `POST /:id/reformat` endpoint
- `shared/reformat.ts` — new: `ReformatSuggestion` type (shared between server and client)
- `modal-llm/app.py` — add `reformat_section` method to `JourniLLM` class

---

## Privacy Boundaries Summary

| Task | Data sent to Modal | Manuscript text leaves server? |
|---|---|---|
| Parse fallback | Text chunks (on-server only) | No — Modal is on-infrastructure |
| Error detection (LLM check) | Section content only | No |
| Journal scraping | Public journal web pages | Never — no manuscript involved |
| Abstract embedding | Abstract section only | No |
| Journal recommendation query | No LLM call at query time | No |
| Reformat suggestions | One section + guidelines | No |

---

## Cost Summary

| Capability | When LLM called | Estimated cost |
|---|---|---|
| Parse error detection | ~20% of uploads (low-confidence docs) | ~$0.001/upload |
| Journal scraping | ~40% of journals/month | $1–12/month total |
| Abstract embedding | Once per manuscript upload | ~$0.001/upload |
| Reformat suggestions | On user request, per section | ~$0.005/reformat |

---

## Verification Checklist

### Parse error detection
- [ ] Well-structured DOCX (≥3 heading styles) → passes deterministic, no LLM call
- [ ] DOCX with 2 or fewer detected sections → LLM called automatically
- [ ] Truncated PDF → error diagnostic surfaced, re-parse attempted
- [ ] Re-parse result only replaces original when it produces ≥3 more sections or ≥2 fewer errors

### Journal scraping
- [ ] Rule-based extraction succeeds on standard layout → no Modal call made
- [ ] Rule-based extracts <3 fields → Modal `journi-scraper` called
- [ ] `last_verified_at` updated after each successful scrape
- [ ] Acceptance rate / mean time fields stored as null when not found, never fabricated
- [ ] Monthly scheduled function runs and processes stale journals

### Journal recommender
- [ ] `abstract_embedding` populated after manuscript upload
- [ ] `scope_embedding` populated after journal ingest
- [ ] Query time: no LLM call, only pgvector cosine
- [ ] `mode=impact` surfaces higher impact-factor journals over faster ones
- [ ] `openAccess=true` excludes non-OA journals from results
- [ ] Abstract edit triggers re-embedding

### Manuscript reformatter
- [ ] Section reordering applied without LLM call
- [ ] LLM suggestions sent one section at a time, never full manuscript
- [ ] `autoAccepted: true` suggestions applied immediately in editor
- [ ] `autoAccepted: false` suggestions require explicit user accept/reject
- [ ] Reformat session persists across page refresh
