# LLM Capabilities Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add parse error detection, monthly journal scraping, journal recommendation, and manuscript reformatting — all deterministic-first with Qwen3-8B on Modal as a targeted fallback.

**Architecture:** Two Modal endpoints (`journi-llm` existing, `journi-scraper` new) plus a CPU-only `journi-embed` endpoint for sentence embeddings. Every capability runs rule-based logic first; LLM is called only when confidence is insufficient. Manuscript text never leaves the server infrastructure.

**Tech Stack:** TypeScript/Express (server), Python/Modal/vLLM (inference), Supabase/pgvector (embeddings + DB), sentence-transformers `all-MiniLM-L6-v2` (384-dim embeddings), Vitest (tests), cheerio (HTML scraping)

---

## File Map

### Created
- `modal-llm/embed.py` — CPU-only Modal endpoint for abstract/scope embeddings (`all-MiniLM-L6-v2`)
- `modal-llm/scraper.py` — GPU Modal endpoint for guidelines extraction from journal pages; monthly scheduled job
- `server/services/parse-error-detection.service.ts` — deterministic + LLM parse error checks, re-parse comparison
- `server/services/journals/scrape.service.ts` — rule-based DOM extraction of guidelines, logo, acceptance rate, time-to-publication
- `server/services/journal-recommend.service.ts` — pgvector cosine query, constraint filtering, score calculation
- `server/services/reformat.service.ts` — deterministic fixes + LLM suggestion orchestration
- `shared/reformat.ts` — `ReformatSuggestion` type shared between server and client
- `server/sql/003_embeddings.sql` — pgvector columns + index migration
- `server/services/__tests__/parse-error-detection.test.ts`
- `server/services/__tests__/journal-scrape.test.ts`
- `server/services/__tests__/journal-recommend.test.ts`
- `server/services/__tests__/reformat.test.ts`

### Modified
- `shared/document-parse.ts` — raise deterministic confidence threshold to ≥3 canonical sections
- `server/services/manuscript-parse.service.ts` — wire parse error detection; raise LLM gate thresholds; trigger abstract embedding after parse
- `server/services/journals/sync.service.ts` — wire scraper into `enrichRow`; add new fields to `writableColumns`
- `server/services/journals/adapters/types.ts` — add `mean_time_to_publication`, `logo_url`, `acceptance_rate` to `JournalEnrichment`
- `server/services/journals/types.ts` — add `mean_time_to_publication` to `JournalRow` and `JournalImportInput`
- `server/routes/manuscripts.ts` — add `GET /:manuscriptId/recommend-journals` and `POST /:manuscriptId/reformat`
- `server/config/env.ts` — add `MODAL_EMBED_URL`, `MODAL_SCRAPER_URL`

---

## Group A — Shared Infrastructure

### Task 1: Shared `ReformatSuggestion` type

**Files:**
- Create: `shared/reformat.ts`

- [ ] **Step 1: Create the shared type file**

```typescript
// shared/reformat.ts
export interface ReformatSuggestion {
  id: string;
  type: "trim" | "stub" | "restructure" | "reorder" | "citation-style";
  sectionId: string;
  /** Empty string for stubs (new content being added) */
  original: string;
  suggested: string;
  /** Human-readable explanation shown to the user */
  reason: string;
  source: "deterministic" | "llm";
  /** Deterministic suggestions are pre-accepted; LLM suggestions require explicit user action */
  autoAccepted: boolean;
}
```

- [ ] **Step 2: Commit**

```bash
git add shared/reformat.ts
git commit -m "feat: add ReformatSuggestion shared type"
```

---

### Task 2: DB migration — pgvector columns

**Files:**
- Create: `server/sql/003_embeddings.sql`

- [ ] **Step 1: Write the migration**

```sql
-- server/sql/003_embeddings.sql
-- Run in Supabase dashboard SQL editor.
-- Requires pgvector extension (already enabled if journals table has vector support).

alter table manuscripts
  add column if not exists abstract_embedding vector(384);

alter table journals
  add column if not exists scope_embedding vector(384);

-- IVFFlat index for fast cosine similarity on journals (primary query target)
create index if not exists journals_scope_embedding_idx
  on journals
  using ivfflat (scope_embedding vector_cosine_ops)
  with (lists = 100);
```

- [ ] **Step 2: Apply migration**

Run the SQL above in the Supabase dashboard SQL editor for your project. Verify with:
```sql
select column_name, data_type
from information_schema.columns
where table_name in ('manuscripts', 'journals')
  and column_name like '%embedding%';
```
Expected: 2 rows — `abstract_embedding` on `manuscripts`, `scope_embedding` on `journals`.

- [ ] **Step 3: Commit**

```bash
git add server/sql/003_embeddings.sql
git commit -m "feat: add pgvector embedding columns to manuscripts and journals"
```

---

### Task 3: Modal embed endpoint

**Files:**
- Create: `modal-llm/embed.py`

- [ ] **Step 1: Write the embed endpoint**

```python
# modal-llm/embed.py
"""
Journi Embed — CPU-only Modal endpoint for 384-dim sentence embeddings.
Uses sentence-transformers/all-MiniLM-L6-v2.

Deploy:
  modal deploy modal-llm/embed.py

Required Modal secret: "journi-llm-token"
  MODAL_TOKEN_SECRET=<same value as journi-llm>
"""
import modal

app = modal.App("journi-embed")

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install("sentence-transformers==3.0.1")
)

@app.cls(
    image=image,
    cpu=2,
    memory=1024,
    min_containers=0,
    timeout=60,
    secrets=[modal.Secret.from_name("journi-llm-token")],
)
class JourniEmbed:
    @modal.enter()
    def load_model(self):
        from sentence_transformers import SentenceTransformer
        self.model = SentenceTransformer("sentence-transformers/all-MiniLM-L6-v2")

    @modal.fastapi_endpoint(method="POST")
    def embed(self, body: dict) -> dict:
        import os
        if body.get("_auth") != os.environ.get("MODAL_TOKEN_SECRET"):
            return {"error": "unauthorized"}

        texts = body.get("texts")
        if not texts or not isinstance(texts, list):
            return {"error": "texts must be a non-empty list of strings"}

        embeddings = self.model.encode(texts, normalize_embeddings=True).tolist()
        return {"embeddings": embeddings}
```

- [ ] **Step 2: Deploy**

```bash
cd modal-llm
modal deploy embed.py
```

Copy the printed endpoint URL. Set it as `MODAL_EMBED_URL` in your Railway environment variables (and local `.env`).

- [ ] **Step 3: Smoke-test**

```bash
curl -s -X POST "$MODAL_EMBED_URL" \
  -H "Content-Type: application/json" \
  -d '{"texts": ["cardiac outcomes in heart failure"], "_auth": "'"$MODAL_TOKEN_SECRET"'"}'
```

Expected: `{"embeddings": [[0.023, -0.11, ...]]}` — array of 384 floats.

- [ ] **Step 4: Add env vars to `server/config/env.ts`**

Add to the `envSchema` object:
```typescript
MODAL_EMBED_URL: z.string().url().optional(),
MODAL_SCRAPER_URL: z.string().url().optional(),
MODAL_LLM_REFORMAT_URL: z.string().url().optional(),
```

- [ ] **Step 5: Commit**

```bash
git add modal-llm/embed.py server/config/env.ts
git commit -m "feat: add Modal CPU embed endpoint and env vars"
```

---

## Group B — Parse Error Detection

### Task 4: Parse error detection service

**Files:**
- Create: `server/services/parse-error-detection.service.ts`
- Create: `server/services/__tests__/parse-error-detection.test.ts`

- [ ] **Step 1: Write the failing tests**

```typescript
// server/services/__tests__/parse-error-detection.test.ts
import { describe, expect, it } from "vitest";
import {
  runDeterministicErrorChecks,
  meetsHighConfidenceThreshold,
} from "../parse-error-detection.service";
import type { ParsedManuscript } from "../../../shared/document-parse";

function makeSection(title: string, content: string) {
  return { title, content, order: 0, wordCount: content.split(" ").length, sourceTitle: title };
}

describe("meetsHighConfidenceThreshold", () => {
  it("returns true when ≥3 canonical sections present with no error diagnostics", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "Background objectives methods results."),
        makeSection("Methods", "We recruited 100 patients."),
        makeSection("Results", "Primary outcome was achieved."),
        makeSection("References", "1. Doe J. 2020."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 50,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(true);
  });

  it("returns false when fewer than 3 canonical sections", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Content", "Some text here."),
        makeSection("Content", "More text here."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 20,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(false);
  });

  it("returns false when an error-level diagnostic is present", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "x"),
        makeSection("Methods", "y"),
        makeSection("Results", "z"),
      ],
      citations: [],
      diagnostics: [{ level: "error", code: "TRUNCATED_TEXT", message: "Text ends mid-sentence" }],
      totalWordCount: 3,
    };
    expect(meetsHighConfidenceThreshold(manuscript)).toBe(false);
  });
});

describe("runDeterministicErrorChecks", () => {
  it("flags truncated text ending mid-sentence", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Methods", "We enrolled patients who were treated with")],
      citations: [],
      diagnostics: [],
      totalWordCount: 10,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "TRUNCATED_TEXT")).toBe(true);
    expect(diags.find((d) => d.code === "TRUNCATED_TEXT")?.level).toBe("error");
  });

  it("flags duplicate section titles", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Methods", "First methods section."),
        makeSection("Methods", "Second methods section."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 10,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "DUPLICATE_SECTION")).toBe(true);
  });

  it("flags sections with fewer than 50 words as potential merge errors", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Results", "Only a few words here.")],
      citations: [],
      diagnostics: [],
      totalWordCount: 5,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "SECTION_TOO_SHORT")).toBe(true);
  });

  it("flags unicode replacement characters", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [makeSection("Abstract", "Patients with \uFFFD disease were enrolled.")],
      citations: [],
      diagnostics: [],
      totalWordCount: 7,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.some((d) => d.code === "GARBLED_ENCODING")).toBe(true);
  });

  it("returns no errors for a clean manuscript", () => {
    const manuscript: ParsedManuscript = {
      fileTitle: "Test",
      sections: [
        makeSection("Abstract", "We studied cardiac outcomes."),
        makeSection("Methods", "A randomised trial with 200 participants was conducted over 12 months."),
        makeSection("Results", "Primary endpoint was met in 78% of participants."),
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 30,
    };
    const diags = runDeterministicErrorChecks(manuscript);
    expect(diags.filter((d) => d.level === "error")).toHaveLength(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/services/__tests__/parse-error-detection.test.ts
```

Expected: FAIL — `parse-error-detection.service` does not exist.

- [ ] **Step 3: Implement the service**

```typescript
// server/services/parse-error-detection.service.ts
import type { ParseDiagnostic, ParsedManuscript } from "../../shared/document-parse";

const CANONICAL_SECTION_NAMES = new Set([
  "title", "abstract", "introduction", "background",
  "methods", "materials and methods", "search strategy",
  "results", "results & synthesis", "discussion",
  "conclusion", "conclusions", "references",
  "data availability", "ethics statement", "acknowledgements",
  "funding", "conflicts of interest",
]);

function isCanonical(title: string): boolean {
  return CANONICAL_SECTION_NAMES.has(title.trim().toLowerCase());
}

/**
 * Returns true when the manuscript passes the high-confidence threshold:
 * - ≥3 sections with canonical titles
 * - no error-level diagnostics already present
 */
export function meetsHighConfidenceThreshold(manuscript: ParsedManuscript): boolean {
  const hasError = manuscript.diagnostics.some((d) => d.level === "error");
  if (hasError) return false;
  const canonicalCount = manuscript.sections.filter((s) => isCanonical(s.title)).length;
  return canonicalCount >= 3;
}

/**
 * Run deterministic checks against a parsed manuscript.
 * Returns new diagnostics — does NOT mutate the manuscript.
 */
export function runDeterministicErrorChecks(manuscript: ParsedManuscript): ParseDiagnostic[] {
  const diagnostics: ParseDiagnostic[] = [];
  const seenTitles = new Map<string, number>();

  for (const section of manuscript.sections) {
    const normalised = section.title.trim().toLowerCase();

    // Duplicate section titles
    const count = (seenTitles.get(normalised) ?? 0) + 1;
    seenTitles.set(normalised, count);
    if (count === 2) {
      diagnostics.push({
        level: "error",
        code: "DUPLICATE_SECTION",
        message: `Section "${section.title}" appears more than once — sections may have been merged incorrectly.`,
      });
    }

    const plainText = section.content.replace(/<[^>]+>/g, " ").trim();

    // Truncated text: content ends without sentence-ending punctuation
    if (
      plainText.length > 20 &&
      !/[.!?)\]'"]$/.test(plainText)
    ) {
      diagnostics.push({
        level: "error",
        code: "TRUNCATED_TEXT",
        message: `Section "${section.title}" appears to end mid-sentence — text may have been cut off during import.`,
      });
    }

    // Garbled encoding: Unicode replacement character
    if (plainText.includes("\uFFFD")) {
      diagnostics.push({
        level: "error",
        code: "GARBLED_ENCODING",
        message: `Section "${section.title}" contains garbled characters — the source file may have encoding issues.`,
      });
    }

    // Section too short: potential merge error (skip non-canonical short sections like "Title")
    const wordCount = plainText.split(/\s+/).filter(Boolean).length;
    if (
      isCanonical(section.title) &&
      normalised !== "title" &&
      wordCount < 50 &&
      wordCount > 0
    ) {
      diagnostics.push({
        level: "warning",
        code: "SECTION_TOO_SHORT",
        message: `Section "${section.title}" has only ${wordCount} words — it may have been merged into a neighbouring section.`,
      });
    }
  }

  // Check for truncated citations
  for (const citation of manuscript.citations) {
    if (!citation.year || citation.year < 1900 || citation.year > new Date().getFullYear() + 2) {
      diagnostics.push({
        level: "warning",
        code: "CITATION_MISSING_YEAR",
        message: `A citation${citation.title ? ` ("${citation.title.slice(0, 40)}...")` : ""} has a missing or invalid year — it may have been cut off during import.`,
      });
    }
  }

  return diagnostics;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/services/__tests__/parse-error-detection.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/parse-error-detection.service.ts server/services/__tests__/parse-error-detection.test.ts
git commit -m "feat: add deterministic parse error detection service"
```

---

### Task 5: Wire error detection into manuscript parse service

**Files:**
- Modify: `server/services/manuscript-parse.service.ts`
- Modify: `shared/document-parse.ts`

- [ ] **Step 1: Raise threshold in `shared/document-parse.ts`**

Find this block (around line 888):
```typescript
  // Use LLM result only when deterministic parsing produced nothing useful.
  // "Useful" = at least 2 sections where not all are titled "Content".
  const deterministicProducedSections =
    baseSections.length >= 2 && !baseSections.every((s) => s.title === "Content");
```

Replace with:
```typescript
  // High-confidence threshold: ≥3 sections with canonical titles, none titled "Content" exclusively.
  // Below this threshold the LLM result is preferred when available.
  const canonicalNames = new Set([
    "title", "abstract", "introduction", "background", "methods",
    "materials and methods", "search strategy", "results",
    "results & synthesis", "discussion", "conclusion", "conclusions",
    "references", "data availability", "ethics statement",
  ]);
  const canonicalCount = baseSections.filter(
    (s) => canonicalNames.has(s.title.trim().toLowerCase())
  ).length;
  const deterministicProducedSections = canonicalCount >= 3;
```

- [ ] **Step 2: Raise DOCX LLM gate threshold in `manuscript-parse.service.ts`**

Find this block (around line 386):
```typescript
    const deterministicLooksGood = (headingCount + boldHeadingCount) >= 3;
```

Replace with:
```typescript
    const deterministicLooksGood = (headingCount + boldHeadingCount) >= 4;
```

- [ ] **Step 3: Raise PDF LLM gate threshold in `manuscript-parse.service.ts`**

Find this block (around line 447):
```typescript
      const pdfDeterministicLooksGood = structureRatio >= 0.15;
```

Replace with:
```typescript
      const pdfDeterministicLooksGood = structureRatio >= 0.25;
```

- [ ] **Step 4: Wire error detection into DOCX parse path**

In `manuscript-parse.service.ts`, add this import at the top:
```typescript
import { runDeterministicErrorChecks, meetsHighConfidenceThreshold } from "./parse-error-detection.service";
import { parseRawDocument } from "../../shared/document-parse";
```

After the `return { fileTitle, format: "docx", ... }` block is assembled but before it is returned, add:
```typescript
    // Run deterministic error checks on the parsed result
    const rawDoc = { fileTitle, format: "docx" as const, html: result.value, text: normalizeText(textResult.value), diagnostics: [...diagnostics, ...fidelityNote, ...warnings], references: extractReferencesFromOupHtml(result.value), llmParsed };
    const parsed = parseRawDocument(rawDoc);
    const errorDiags = runDeterministicErrorChecks(parsed);
    return { ...rawDoc, diagnostics: [...rawDoc.diagnostics, ...errorDiags] };
```

Replace the existing `return { fileTitle, format: "docx", ... }` with the `rawDoc` construction above (the existing fields remain the same, just assembled into `rawDoc` first).

- [ ] **Step 5: Wire error detection into PDF parse path similarly**

After `return { fileTitle, format: "pdf", ... }` in the PDF branch, apply the same pattern:
```typescript
      const rawDoc = {
        fileTitle,
        format: "pdf" as const,
        text: payload.text,
        blocks: payload.blocks,
        figures: payload.figures,
        tables: payload.tables,
        links: [],
        diagnostics: [...diagnostics, ...payload.diagnostics],
        llmParsed,
      };
      const parsed = parseRawDocument(rawDoc);
      const errorDiags = runDeterministicErrorChecks(parsed);
      return { ...rawDoc, diagnostics: [...rawDoc.diagnostics, ...errorDiags] };
```

- [ ] **Step 6: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 7: Commit**

```bash
git add shared/document-parse.ts server/services/manuscript-parse.service.ts
git commit -m "feat: wire parse error detection and raise deterministic confidence thresholds"
```

---

## Group C — Journal Scraping

### Task 6: Rule-based journal scraping service

**Files:**
- Create: `server/services/journals/scrape.service.ts`
- Create: `server/services/__tests__/journal-scrape.test.ts`
- Modify: `server/services/journals/adapters/types.ts`

- [ ] **Step 1: Extend adapter types**

In `server/services/journals/adapters/types.ts`, replace the existing content with:
```typescript
export type JournalSource = "manual" | "openalex" | "doaj" | "crossref" | "scraper";

export interface JournalEnrichment {
  source: JournalSource;
  fields: Record<string, unknown>;
}
```

- [ ] **Step 2: Add `mean_time_to_publication` to journal types**

In `server/services/journals/types.ts`, add to `JournalRow`:
```typescript
  mean_time_to_publication_days: number | null;
```

Add to `JournalImportInput`:
```typescript
  meanTimeToPublicationDays?: number | null;
```

Add to `mapJournalRow`:
```typescript
    meanTimeToPublicationDays: row.mean_time_to_publication_days,
```

Add to `JournalDTO` in `shared/backend.ts`:
```typescript
  meanTimeToPublicationDays?: number | null;
```

- [ ] **Step 3: Write failing tests for rule-based extraction**

```typescript
// server/services/__tests__/journal-scrape.test.ts
import { describe, expect, it } from "vitest";
import { extractGuidelinesFromHtml, extractLogoFromHtml, extractAcceptanceRate, extractMeanTimeToPublication } from "../journals/scrape.service";

const SAMPLE_GUIDELINES_HTML = `
<html><body>
<h2>Word Limits</h2>
<p>Original articles should not exceed <strong>3500 words</strong> (excluding abstract and references).
Abstracts must not exceed <strong>250 words</strong>.</p>
<h2>Reference Style</h2>
<p>References should follow <strong>Vancouver</strong> style, numbered consecutively.</p>
<h2>Required Sections</h2>
<p>All original articles must include: Introduction, Methods, Results, Discussion, References.</p>
<p>The acceptance rate for submitted manuscripts is approximately <strong>18%</strong>.</p>
<p>Average time from submission to first decision: <strong>6 weeks</strong>.</p>
</body></html>
`;

const SAMPLE_LOGO_HTML = `
<html>
<head>
  <link rel="icon" href="/favicon.ico" />
  <meta property="og:image" content="https://example-journal.com/logo.png" />
</head>
<body></body>
</html>
`;

describe("extractGuidelinesFromHtml", () => {
  it("extracts main text word limit", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.fields.word_limits).toMatchObject({ main_text: 3500 });
  });

  it("extracts abstract word limit", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect((result.fields.word_limits as any).abstract).toBe(250);
  });

  it("extracts citation style", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.fields.citation_style).toBe("vancouver");
  });

  it("extracts required sections", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.fields.sections_required).toContain("Methods");
  });

  it("returns low confidence when no fields found", () => {
    const result = extractGuidelinesFromHtml("<html><body><p>No useful info here.</p></body></html>");
    expect(result.confidence).toBeLessThan(3);
  });

  it("returns confidence ≥3 for well-structured page", () => {
    const result = extractGuidelinesFromHtml(SAMPLE_GUIDELINES_HTML);
    expect(result.confidence).toBeGreaterThanOrEqual(3);
  });
});

describe("extractLogoFromHtml", () => {
  it("prefers og:image over favicon", () => {
    const logo = extractLogoFromHtml(SAMPLE_LOGO_HTML, "https://example-journal.com");
    expect(logo).toBe("https://example-journal.com/logo.png");
  });

  it("falls back to favicon when no og:image", () => {
    const html = `<html><head><link rel="icon" href="/favicon.ico" /></head></html>`;
    const logo = extractLogoFromHtml(html, "https://example-journal.com");
    expect(logo).toBe("https://example-journal.com/favicon.ico");
  });

  it("returns null when no logo found", () => {
    const logo = extractLogoFromHtml("<html><body></body></html>", "https://example-journal.com");
    expect(logo).toBeNull();
  });
});

describe("extractAcceptanceRate", () => {
  it("parses percentage from text", () => {
    expect(extractAcceptanceRate("acceptance rate is approximately 18%")).toBe(0.18);
  });

  it("returns null when no percentage found", () => {
    expect(extractAcceptanceRate("no rate info here")).toBeNull();
  });
});

describe("extractMeanTimeToPublication", () => {
  it("parses weeks to days", () => {
    expect(extractMeanTimeToPublication("average time to first decision: 6 weeks")).toBe(42);
  });

  it("parses days directly", () => {
    expect(extractMeanTimeToPublication("decision within 30 days")).toBe(30);
  });

  it("returns null when not found", () => {
    expect(extractMeanTimeToPublication("no timing info")).toBeNull();
  });
});
```

- [ ] **Step 4: Run tests to verify they fail**

```bash
npx vitest run server/services/__tests__/journal-scrape.test.ts
```

Expected: FAIL — `scrape.service` does not exist.

- [ ] **Step 5: Implement the scrape service**

```typescript
// server/services/journals/scrape.service.ts
import type { JournalEnrichment } from "./adapters/types";

export interface GuidelinesExtractionResult extends JournalEnrichment {
  /** Number of fields successfully extracted with high confidence. Used to decide whether to call LLM. */
  confidence: number;
}

// ── Word limit extraction ──────────────────────────────────────────────────

function extractWordLimits(text: string): Record<string, number> | null {
  const limits: Record<string, number> = {};

  const patterns: Array<[string, RegExp]> = [
    ["abstract", /abstract[^.]{0,60}?(\d{1,5})\s*words/i],
    ["main_text", /(?:article|manuscript|paper|text)[^.]{0,80}?(\d{1,5})\s*words/i],
    ["total", /(?:total|overall)[^.]{0,60}?(\d{1,5})\s*words/i],
  ];

  for (const [key, pattern] of patterns) {
    const match = text.match(pattern);
    if (match) limits[key] = Number.parseInt(match[1], 10);
  }

  // Fallback: any "X words" near a limit keyword
  if (!limits.main_text) {
    const general = text.match(/(?:not exceed|limit[^.]{0,30}?)\s*(\d{1,5})\s*words/i);
    if (general) limits.main_text = Number.parseInt(general[1], 10);
  }

  return Object.keys(limits).length > 0 ? limits : null;
}

// ── Citation style extraction ──────────────────────────────────────────────

const CITATION_PATTERNS: Array<[string, RegExp]> = [
  ["vancouver", /vancouver/i],
  ["apa", /\bapa\b/i],
  ["mla", /\bmla\b/i],
  ["harvard", /harvard/i],
  ["ama", /\bama\b/i],
  ["ieee", /\bieee\b/i],
  ["nlm", /\bnlm\b/i],
];

function extractCitationStyle(text: string): string | null {
  for (const [style, pattern] of CITATION_PATTERNS) {
    if (pattern.test(text)) return style;
  }
  return null;
}

// ── Required sections extraction ───────────────────────────────────────────

const KNOWN_SECTIONS = [
  "Introduction", "Background", "Methods", "Materials and Methods",
  "Results", "Discussion", "Conclusion", "Conclusions",
  "Abstract", "References", "Acknowledgements", "Funding",
  "Data Availability", "Ethics Statement", "Conflicts of Interest",
];

function extractRequiredSections(text: string): string[] | null {
  const found: string[] = [];
  for (const section of KNOWN_SECTIONS) {
    const escaped = section.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    if (new RegExp(`\\b${escaped}\\b`, "i").test(text)) {
      found.push(section);
    }
  }
  return found.length >= 3 ? found : null;
}

// ── Acceptance rate ─────────────────────────────────────────────────────────

export function extractAcceptanceRate(text: string): number | null {
  const match = text.match(/acceptance\s+rate[^.]{0,60}?(\d{1,3}(?:\.\d+)?)\s*%/i);
  if (!match) return null;
  const value = Number.parseFloat(match[1]);
  return value > 0 && value <= 100 ? value / 100 : null;
}

// ── Mean time to publication ────────────────────────────────────────────────

export function extractMeanTimeToPublication(text: string): number | null {
  const weekMatch = text.match(
    /(?:time|decision|review|publication)[^.]{0,60}?(\d{1,3}(?:\.\d+)?)\s*weeks?/i,
  );
  if (weekMatch) return Math.round(Number.parseFloat(weekMatch[1]) * 7);

  const dayMatch = text.match(
    /(?:time|decision|review|publication)[^.]{0,60}?(\d{1,3})\s*days?/i,
  );
  if (dayMatch) return Number.parseInt(dayMatch[1], 10);

  return null;
}

// ── Logo extraction ─────────────────────────────────────────────────────────

export function extractLogoFromHtml(html: string, baseUrl: string): string | null {
  const ogMatch = html.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["']/i)
    ?? html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:image["']/i);
  if (ogMatch?.[1]) return ogMatch[1];

  const iconMatch = html.match(/<link[^>]+rel=["'][^"']*icon[^"']*["'][^>]+href=["']([^"']+)["']/i)
    ?? html.match(/<link[^>]+href=["']([^"']+)["'][^>]+rel=["'][^"']*icon[^"']*["']/i);
  if (iconMatch?.[1]) {
    const href = iconMatch[1];
    if (href.startsWith("http")) return href;
    const base = new URL(baseUrl);
    return new URL(href, base.origin).toString();
  }

  return null;
}

// ── Main extraction entry point ─────────────────────────────────────────────

export function extractGuidelinesFromHtml(html: string): GuidelinesExtractionResult {
  // Strip tags to get plain text for regex matching
  const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");

  const wordLimits = extractWordLimits(text);
  const citationStyle = extractCitationStyle(text);
  const sectionsRequired = extractRequiredSections(text);
  const acceptanceRate = extractAcceptanceRate(text);
  const meanTime = extractMeanTimeToPublication(text);

  const fields: Record<string, unknown> = {};
  let confidence = 0;

  if (wordLimits) { fields.word_limits = wordLimits; confidence += 1; }
  if (citationStyle) { fields.citation_style = citationStyle; confidence += 1; }
  if (sectionsRequired) { fields.sections_required = sectionsRequired; confidence += 1; }
  if (acceptanceRate !== null) { fields.acceptance_rate = acceptanceRate; confidence += 1; }
  if (meanTime !== null) { fields.mean_time_to_publication_days = meanTime; confidence += 1; }

  return { source: "scraper", fields, confidence };
}
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run server/services/__tests__/journal-scrape.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Commit**

```bash
git add server/services/journals/scrape.service.ts server/services/__tests__/journal-scrape.test.ts server/services/journals/adapters/types.ts server/services/journals/types.ts shared/backend.ts
git commit -m "feat: add rule-based journal scraping service"
```

---

### Task 7: Modal scraper endpoint + monthly scheduled job

**Files:**
- Create: `modal-llm/scraper.py`

- [ ] **Step 1: Write the scraper endpoint**

```python
# modal-llm/scraper.py
"""
Journi Scraper — GPU Modal endpoint for extracting structured journal guidelines
from raw HTML when rule-based extraction confidence is low.

Also runs a monthly scheduled job to scrape all stale journals.

Deploy:
  modal deploy modal-llm/scraper.py

Required Modal secret: "journi-llm-token"
  MODAL_TOKEN_SECRET=<same value as journi-llm>
  JOURNI_API_URL=<Railway Express API base URL>
  JOURNI_SCRAPER_SECRET=<a separate secret for server→Modal trust>
"""
import modal

app = modal.App("journi-scraper")

volume = modal.Volume.from_name("journi-model-weights", create_if_missing=False)

image = (
    modal.Image.debian_slim(python_version="3.11")
    .pip_install(
        "vllm==0.19.0",
        "huggingface_hub[hf_transfer]",
        "httpx",
    )
    .env({"HF_HUB_ENABLE_HF_TRANSFER": "1"})
)

MODEL_ID = "Qwen/Qwen3-8B"
MODEL_DIR = "/models/qwen3-8b"

EXTRACTION_PROMPT = """You are extracting structured submission guidelines from a journal's Instructions for Authors page.

Return ONLY a valid JSON object with these fields (omit fields you cannot find):
{
  "word_limits": { "abstract": <number|null>, "main_text": <number|null>, "total": <number|null> },
  "citation_style": "<vancouver|apa|mla|harvard|ama|ieee|nlm|null>",
  "sections_required": ["Introduction", "Methods", ...],
  "structured_abstract": <true|false|null>,
  "figures_max": <number|null>,
  "tables_max": <number|null>,
  "keywords_required": <true|false|null>,
  "max_keywords": <number|null>,
  "requires_cover_letter": <true|false|null>,
  "acceptance_rate": <decimal 0-1|null>,
  "mean_time_to_publication_days": <number|null>,
  "notes": "<any other important requirements as a short string|null>"
}

Page text:
---
{page_text}
---"""


@app.cls(
    gpu="A10G",
    image=image,
    volumes={"/models": volume},
    min_containers=0,
    timeout=120,
    secrets=[modal.Secret.from_name("journi-llm-token")],
)
@modal.concurrent(max_inputs=8)
class JourniScraper:
    @modal.enter()
    def load_model(self):
        from vllm import LLM
        volume.reload()
        self.llm = LLM(model=MODEL_DIR, dtype="float16")

    @modal.fastapi_endpoint(method="POST")
    def extract_guidelines(self, body: dict) -> dict:
        import json, os
        from vllm import SamplingParams

        if body.get("_auth") != os.environ.get("MODAL_TOKEN_SECRET"):
            return {"error": "unauthorized"}

        page_text = body.get("page_text", "")
        if not page_text:
            return {"error": "page_text is required"}

        # Truncate to ~3000 words to keep tokens manageable
        words = page_text.split()
        truncated = " ".join(words[:3000])

        prompt = EXTRACTION_PROMPT.format(page_text=truncated)
        params = SamplingParams(
            temperature=0.0,
            max_tokens=1024,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

        outputs = self.llm.generate([prompt], params)
        raw = outputs[0].outputs[0].text.strip()

        # Strip markdown fences if present
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            return {"guidelines": json.loads(raw)}
        except json.JSONDecodeError:
            return {"error": "failed to parse LLM output", "raw": raw}


@app.function(
    image=modal.Image.debian_slim(python_version="3.11").pip_install("httpx"),
    schedule=modal.Cron("0 2 1 * *"),  # 02:00 UTC on the 1st of each month
    secrets=[modal.Secret.from_name("journi-llm-token")],
    timeout=3600,
)
async def monthly_journal_sync():
    """Calls the Express API to trigger journal scraping for stale journals."""
    import os
    import httpx

    api_url = os.environ.get("JOURNI_API_URL")
    secret = os.environ.get("JOURNI_SCRAPER_SECRET")
    if not api_url or not secret:
        raise RuntimeError("JOURNI_API_URL and JOURNI_SCRAPER_SECRET must be set")

    async with httpx.AsyncClient(timeout=3500) as client:
        response = await client.post(
            f"{api_url}/api/journals/sync-scrape",
            headers={"x-scraper-secret": secret},
        )
        response.raise_for_status()
        print(f"Sync complete: {response.json()}")
```

- [ ] **Step 2: Add `JOURNI_SCRAPER_SECRET` to Modal secret**

In the Modal dashboard, add `JOURNI_SCRAPER_SECRET` to the `journi-llm-token` secret (same secret used by both endpoints). Set it to a random string (e.g. `openssl rand -hex 32`). Set the same value as `JOURNI_SCRAPER_SECRET` in Railway env vars.

- [ ] **Step 3: Add `JOURNI_API_URL` and `MODAL_SCRAPER_URL` to env**

In Railway, set:
- `JOURNI_API_URL` = your Railway Express service base URL (e.g. `https://journi-api.up.railway.app`)
- `MODAL_SCRAPER_URL` = the URL printed after `modal deploy modal-llm/scraper.py`

In `server/config/env.ts`, add to `envSchema`:
```typescript
JOURNI_SCRAPER_SECRET: z.string().min(1).optional(),
```

- [ ] **Step 4: Deploy**

```bash
cd modal-llm
modal deploy scraper.py
```

- [ ] **Step 5: Commit**

```bash
git add modal-llm/scraper.py server/config/env.ts
git commit -m "feat: add Modal scraper endpoint and monthly scheduled sync"
```

---

### Task 8: Wire scraper into journal sync + Express trigger route

**Files:**
- Modify: `server/services/journals/sync.service.ts`
- Modify: `server/routes/journals.ts`

- [ ] **Step 1: Add scraper call to `sync.service.ts`**

At the top of `server/services/journals/sync.service.ts`, add:
```typescript
import { extractGuidelinesFromHtml } from "./scrape.service";

async function fetchPageText(url: string): Promise<{ html: string; text: string } | null> {
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": "Journi/1.0 (journal metadata bot; contact support@journi.com)" },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;
    const html = await res.text();
    const text = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ");
    return { html, text };
  } catch {
    return null;
  }
}

async function callModalScraper(pageText: string): Promise<Record<string, unknown> | null> {
  const url = process.env.MODAL_SCRAPER_URL;
  if (!url) return null;
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ page_text: pageText, _auth: process.env.MODAL_TOKEN_SECRET }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { guidelines?: Record<string, unknown> };
    return data.guidelines ?? null;
  } catch {
    return null;
  }
}
```

Add `"scraper"` to `writableColumns`:
```typescript
const writableColumns = new Set([
  "name", "publisher", "open_access", "apc_cost_usd", "website_url",
  "subject_areas", "impact_factor", "issn_print", "issn_online",
  "submission_portal_url", "submission_requirements_json", "logo_url",
  "acceptance_rate", "avg_decision_days", "mean_time_to_publication_days",
]);
```

Add a `scrapeJournal` step to `enrichRow` — after the existing `enrichments` are processed, append:
```typescript
  // Scrape submission guidelines and logo from journal website
  const websiteUrl = (updates.website_url as string | undefined) ?? row.website_url;
  if (websiteUrl) {
    const page = await fetchPageText(websiteUrl);
    if (page) {
      const { extractLogoFromHtml } = await import("./scrape.service");
      const logo = extractLogoFromHtml(page.html, websiteUrl);
      if (logo && !row.logo_url) updates.logo_url = logo;

      const ruleResult = extractGuidelinesFromHtml(page.html);
      let guidelinesFields = ruleResult.fields;

      if (ruleResult.confidence < 3) {
        const llmResult = await callModalScraper(page.text);
        if (llmResult) guidelinesFields = { ...llmResult, ...guidelinesFields };
      }

      if (Object.keys(guidelinesFields).length > 0) {
        const { acceptance_rate, mean_time_to_publication_days, ...submissionFields } = guidelinesFields as any;
        if (Object.keys(submissionFields).length > 0) {
          updates.submission_requirements_json = {
            ...(row.submission_requirements_json ?? {}),
            ...submissionFields,
          };
        }
        if (acceptance_rate != null && row.acceptance_rate == null) {
          updates.acceptance_rate = acceptance_rate;
        }
        if (mean_time_to_publication_days != null && (row as any).mean_time_to_publication_days == null) {
          updates.mean_time_to_publication_days = mean_time_to_publication_days;
        }
      }
    }
  }
```

- [ ] **Step 2: Add `POST /journals/sync-scrape` route**

In `server/routes/journals.ts`, add after the existing routes:
```typescript
journalsRouter.post("/sync-scrape", async (req, res, next) => {
  try {
    const secret = req.headers["x-scraper-secret"];
    if (!secret || secret !== process.env.JOURNI_SCRAPER_SECRET) {
      return res.status(401).json({ error: "unauthorized" });
    }
    const { syncJournals } = await import("../services/journals/sync.service");
    const result = await syncJournals({ staleHours: 720 }); // 30 days
    res.json(result);
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/journals/sync.service.ts server/routes/journals.ts
git commit -m "feat: wire scraper into journal sync enrichment pipeline"
```

---

## Group D — Journal Recommender

### Task 9: Abstract embedding on manuscript upload

**Files:**
- Modify: `server/services/manuscript-parse.service.ts`
- Create: `server/services/embed.service.ts`

- [ ] **Step 1: Create embed service**

```typescript
// server/services/embed.service.ts
export async function embedTexts(texts: string[]): Promise<number[][] | null> {
  const url = process.env.MODAL_EMBED_URL;
  if (!url) return null;

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ texts, _auth: process.env.MODAL_TOKEN_SECRET }),
      signal: AbortSignal.timeout(30_000),
    });
    if (!res.ok) return null;
    const data = await res.json() as { embeddings?: number[][] };
    return data.embeddings ?? null;
  } catch {
    return null;
  }
}

export async function embedSingle(text: string): Promise<number[] | null> {
  const result = await embedTexts([text]);
  return result?.[0] ?? null;
}
```

- [ ] **Step 2: Trigger abstract embedding after manuscript is committed**

In `server/routes/manuscripts.ts`, find the `POST /import-sessions/:sessionId/commit` handler. After the manuscript sections are saved to DB, add:

```typescript
    // Embed abstract for journal recommendation (fire-and-forget, non-blocking)
    const abstractSection = sections.find(
      (s: { title: string }) => s.title.toLowerCase() === "abstract"
    );
    if (abstractSection) {
      const { embedSingle } = await import("../services/embed.service");
      embedSingle(abstractSection.content.replace(/<[^>]+>/g, " ").trim())
        .then(async (embedding) => {
          if (!embedding) return;
          const { supabaseAdmin } = await import("../lib/supabase");
          await supabaseAdmin
            .from("manuscripts")
            .update({ abstract_embedding: embedding })
            .eq("id", manuscriptId);
        })
        .catch(() => {/* non-critical, silent fail */});
    }
```

Also add re-embedding on abstract section edit. In the `PATCH /:manuscriptId/sections/:sectionId` handler, after a successful update, add:
```typescript
    if (updatedSection.title.toLowerCase() === "abstract" && updatedSection.contentHtml) {
      const { embedSingle } = await import("../services/embed.service");
      embedSingle(updatedSection.contentHtml.replace(/<[^>]+>/g, " ").trim())
        .then(async (embedding) => {
          if (!embedding) return;
          const { supabaseAdmin } = await import("../lib/supabase");
          await supabaseAdmin
            .from("manuscripts")
            .update({ abstract_embedding: embedding })
            .eq("id", req.params.manuscriptId);
        })
        .catch(() => {});
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add server/services/embed.service.ts server/routes/manuscripts.ts
git commit -m "feat: embed abstract on manuscript upload and section edit"
```

---

### Task 10: Journal recommendation service + route

**Files:**
- Create: `server/services/journal-recommend.service.ts`
- Create: `server/services/__tests__/journal-recommend.test.ts`
- Modify: `server/routes/manuscripts.ts`

- [ ] **Step 1: Write failing tests**

```typescript
// server/services/__tests__/journal-recommend.test.ts
import { describe, expect, it } from "vitest";
import { buildFitScore, buildFitReasons, normalizeScoreComponents } from "../journal-recommend.service";

interface ScoringInput {
  similarity: number;
  impactFactorNorm: number;
  acceptanceRate: number;
  avgDecisionDaysNorm: number;
}

describe("buildFitScore", () => {
  const input: ScoringInput = {
    similarity: 0.85,
    impactFactorNorm: 0.6,
    acceptanceRate: 0.2,
    avgDecisionDaysNorm: 0.7,
  };

  it("auto mode weights similarity 0.6, speed 0.2, acceptance 0.2", () => {
    const score = buildFitScore(input, "auto");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.7 * 0.2 + 0.2 * 0.2, 4);
  });

  it("impact mode weights similarity 0.6, impact 0.35, acceptance 0.05", () => {
    const score = buildFitScore(input, "impact");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.6 * 0.35 + 0.2 * 0.05, 4);
  });

  it("odds mode weights similarity 0.6, impact 0.1, acceptance 0.3", () => {
    const score = buildFitScore(input, "odds");
    expect(score).toBeCloseTo(0.85 * 0.6 + 0.6 * 0.1 + 0.2 * 0.3, 4);
  });
});

describe("buildFitReasons", () => {
  it("includes subject match reason", () => {
    const reasons = buildFitReasons({
      similarity: 0.85,
      subjectAreas: ["Cardiology"],
      wordCountInRange: true,
      openAccess: false,
      mode: "auto",
    });
    expect(reasons).toContain("Strong subject match");
  });

  it("includes word count reason when in range", () => {
    const reasons = buildFitReasons({
      similarity: 0.7,
      subjectAreas: [],
      wordCountInRange: true,
      openAccess: false,
      mode: "auto",
    });
    expect(reasons).toContain("Word count within journal limits");
  });

  it("includes open access label", () => {
    const reasons = buildFitReasons({
      similarity: 0.7,
      subjectAreas: [],
      wordCountInRange: false,
      openAccess: true,
      mode: "auto",
    });
    expect(reasons).toContain("Open access");
  });
});

describe("normalizeScoreComponents", () => {
  it("normalises values to [0, 1] range", () => {
    const values = [10, 20, 30, 40, 50];
    const normalized = normalizeScoreComponents(values);
    expect(normalized[0]).toBe(0);
    expect(normalized[4]).toBe(1);
    expect(normalized[2]).toBeCloseTo(0.5, 4);
  });

  it("returns all 0.5 when all values are equal", () => {
    const normalized = normalizeScoreComponents([5, 5, 5]);
    expect(normalized).toEqual([0.5, 0.5, 0.5]);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/services/__tests__/journal-recommend.test.ts
```

Expected: FAIL — `journal-recommend.service` does not exist.

- [ ] **Step 3: Implement the recommendation service**

```typescript
// server/services/journal-recommend.service.ts
import { supabaseAdmin } from "../lib/supabase";
import type { JournalDTO } from "../../shared/backend";
import { mapJournalRow } from "./journals/types";
import type { JournalRow } from "./journals/types";

export type RecommendMode = "auto" | "impact" | "odds";

export interface JournalRecommendation {
  journal: JournalDTO;
  fitScore: number;
  fitReasons: string[];
}

export interface RecommendFilters {
  mode: RecommendMode;
  openAccess?: boolean;
}

// ── Scoring helpers (exported for tests) ──────────────────────────────────

interface ScoringInput {
  similarity: number;
  impactFactorNorm: number;
  acceptanceRate: number;
  avgDecisionDaysNorm: number;
}

export function buildFitScore(input: ScoringInput, mode: RecommendMode): number {
  const { similarity, impactFactorNorm, acceptanceRate, avgDecisionDaysNorm } = input;
  switch (mode) {
    case "impact":
      return similarity * 0.6 + impactFactorNorm * 0.35 + acceptanceRate * 0.05;
    case "odds":
      return similarity * 0.6 + impactFactorNorm * 0.1 + acceptanceRate * 0.3;
    case "auto":
    default:
      return similarity * 0.6 + avgDecisionDaysNorm * 0.2 + acceptanceRate * 0.2;
  }
}

export function normalizeScoreComponents(values: number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max === min) return values.map(() => 0.5);
  return values.map((v) => (v - min) / (max - min));
}

export function buildFitReasons(input: {
  similarity: number;
  subjectAreas: string[];
  wordCountInRange: boolean;
  openAccess: boolean;
  mode: RecommendMode;
}): string[] {
  const reasons: string[] = [];

  if (input.similarity >= 0.8) reasons.push("Strong subject match");
  else if (input.similarity >= 0.6) reasons.push("Good subject match");
  else reasons.push("Moderate subject match");

  if (input.subjectAreas.length > 0) {
    reasons.push(`Subject areas: ${input.subjectAreas.slice(0, 2).join(", ")}`);
  }

  if (input.wordCountInRange) reasons.push("Word count within journal limits");
  if (input.openAccess) reasons.push("Open access");

  if (input.mode === "impact") reasons.push("High impact factor");
  if (input.mode === "odds") reasons.push("Above-average acceptance rate");

  return reasons;
}

// ── Main recommendation query ──────────────────────────────────────────────

export async function recommendJournals(params: {
  manuscriptId: string;
  manuscriptWordCount: number;
  filters: RecommendFilters;
}): Promise<JournalRecommendation[]> {
  // 1. Fetch manuscript embedding
  const { data: msData, error: msError } = await supabaseAdmin
    .from("manuscripts")
    .select("abstract_embedding")
    .eq("id", params.manuscriptId)
    .single();

  if (msError || !msData?.abstract_embedding) return [];

  const embedding = msData.abstract_embedding as number[];

  // 2. pgvector cosine similarity — top 50 candidates
  // Supabase supports this via rpc with a custom function, or via raw query
  const { data: candidates, error: vecError } = await supabaseAdmin.rpc(
    "match_journals_by_embedding",
    {
      query_embedding: embedding,
      match_count: 50,
    },
  );

  if (vecError || !candidates) return [];

  // 3. Filter by open access preference
  let filtered = (candidates as Array<JournalRow & { similarity: number }>).filter((j) => {
    if (params.filters.openAccess === true) return j.open_access === true;
    if (params.filters.openAccess === false) return j.open_access !== true;
    return true;
  });

  // 4. Filter by word count in range
  filtered = filtered.filter((j) => {
    const limits = (j.submission_requirements_json as any)?.word_limits;
    if (!limits?.main_text) return true; // no constraint, include
    const wc = params.manuscriptWordCount;
    return wc <= limits.main_text;
  });

  // 5. Normalise score components across the candidate set
  const impactValues = filtered.map((j) => j.impact_factor ?? 0);
  const decisionValues = filtered.map((j) =>
    j.avg_decision_days ? 1 / j.avg_decision_days : 0,
  );
  const acceptanceValues = filtered.map((j) => j.acceptance_rate ?? 0);

  const impactNorm = normalizeScoreComponents(impactValues);
  const decisionNorm = normalizeScoreComponents(decisionValues);
  const acceptanceNorm = normalizeScoreComponents(acceptanceValues);

  // 6. Score and build reasons
  const scored: JournalRecommendation[] = filtered.map((j, i) => {
    const similarity = j.similarity;
    const scoringInput = {
      similarity,
      impactFactorNorm: impactNorm[i],
      acceptanceRate: acceptanceNorm[i],
      avgDecisionDaysNorm: decisionNorm[i],
    };
    const fitScore = buildFitScore(scoringInput, params.filters.mode);
    const fitReasons = buildFitReasons({
      similarity,
      subjectAreas: j.subject_areas ?? [],
      wordCountInRange: (() => {
        const limits = (j.submission_requirements_json as any)?.word_limits;
        return limits?.main_text ? params.manuscriptWordCount <= limits.main_text : false;
      })(),
      openAccess: j.open_access === true,
      mode: params.filters.mode,
    });

    return { journal: mapJournalRow(j), fitScore, fitReasons };
  });

  // 7. Sort descending by fitScore, return top 10
  return scored.sort((a, b) => b.fitScore - a.fitScore).slice(0, 10);
}
```

- [ ] **Step 4: Add the pgvector RPC function to Supabase**

Run in the Supabase dashboard SQL editor:
```sql
create or replace function match_journals_by_embedding(
  query_embedding vector(384),
  match_count int default 50
)
returns table (
  id uuid,
  external_id text,
  name text,
  abbreviation text,
  logo_url text,
  impact_factor float8,
  impact_factor_year int4,
  open_access bool,
  website_url text,
  submission_portal_url text,
  submission_requirements_json jsonb,
  publisher text,
  subject_areas text[],
  geographic_location text,
  issn_print text,
  issn_online text,
  acceptance_rate float8,
  avg_decision_days int4,
  apc_cost_usd float8,
  provenance jsonb,
  last_verified_at timestamptz,
  created_at timestamptz,
  updated_at timestamptz,
  mean_time_to_publication_days int4,
  similarity float8
)
language sql stable
as $$
  select
    j.*,
    1 - (j.scope_embedding <=> query_embedding) as similarity
  from journals j
  where j.scope_embedding is not null
  order by j.scope_embedding <=> query_embedding
  limit match_count;
$$;
```

- [ ] **Step 5: Add route to `manuscripts.ts`**

In `server/routes/manuscripts.ts`, add:
```typescript
manuscriptsRouter.get("/:manuscriptId/recommend-journals", requireProAccess, async (req, res, next) => {
  try {
    const { manuscriptId } = req.params;
    const mode = (req.query.mode as string) === "impact" ? "impact"
      : (req.query.mode as string) === "odds" ? "odds"
      : "auto";
    const openAccess = req.query.openAccess === "true" ? true
      : req.query.openAccess === "false" ? false
      : undefined;

    // Get manuscript word count for constraint filtering
    const { supabaseAdmin } = await import("../lib/supabase");
    const { data: ms } = await supabaseAdmin
      .from("manuscripts")
      .select("word_count")
      .eq("id", manuscriptId)
      .single();

    const { recommendJournals } = await import("../services/journal-recommend.service");
    const recommendations = await recommendJournals({
      manuscriptId,
      manuscriptWordCount: ms?.word_count ?? 0,
      filters: { mode, openAccess },
    });

    res.json({ journals: recommendations });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 6: Run tests to verify they pass**

```bash
npx vitest run server/services/__tests__/journal-recommend.test.ts
```

Expected: all tests PASS.

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Commit**

```bash
git add server/services/journal-recommend.service.ts server/services/__tests__/journal-recommend.test.ts server/routes/manuscripts.ts
git commit -m "feat: add journal recommender with pgvector cosine similarity and mode-based scoring"
```

---

## Group E — Manuscript Reformatter

### Task 11: Reformat service — deterministic layer

**Files:**
- Create: `server/services/reformat.service.ts`
- Create: `server/services/__tests__/reformat.test.ts`

- [ ] **Step 1: Write failing tests for deterministic reformat**

```typescript
// server/services/__tests__/reformat.test.ts
import { describe, expect, it } from "vitest";
import { buildDeterministicChanges } from "../reformat.service";
import type { JournalGuidelinesDTO } from "../../../shared/backend";

function makeSection(id: string, title: string, contentHtml: string) {
  return { id, title, contentHtml };
}

const JOURNAL: JournalGuidelinesDTO = {
  journalId: "j1",
  journalName: "Test Journal",
  submissionPortalUrl: null,
  wordLimits: { abstract: 250, main_text: 3500, total: null, title: null },
  sectionOrder: ["Abstract", "Introduction", "Methods", "Results", "Discussion", "References"],
  sectionsRequired: ["Abstract", "Introduction", "Methods", "Results", "Discussion", "References"],
  citationStyle: "vancouver",
  figuresMax: null,
  tablesMax: null,
  structuredAbstract: true,
  keywordsRequired: null,
  maxKeywords: null,
  requiredDeclarations: ["Data Availability"],
  requiresCoverLetter: null,
  notes: null,
  acceptanceRate: null,
  avgDecisionDays: null,
  raw: null,
};

describe("buildDeterministicChanges", () => {
  it("produces a reorder suggestion when sections are out of order", () => {
    const sections = [
      makeSection("s1", "Introduction", "<p>Intro text.</p>"),
      makeSection("s2", "Abstract", "<p>Abstract text.</p>"),
      makeSection("s3", "Methods", "<p>Methods text.</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.some((c) => c.type === "reorder")).toBe(true);
  });

  it("produces a stub for missing required section", () => {
    const sections = [
      makeSection("s1", "Abstract", "<p>Abstract.</p>"),
      makeSection("s2", "Introduction", "<p>Introduction.</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    const stubs = changes.filter((c) => c.type === "stub");
    expect(stubs.some((c) => c.reason.includes("Methods"))).toBe(true);
  });

  it("produces citation-style suggestion", () => {
    const sections = [
      makeSection("s1", "References", "<ol><li>Smith J et al. (2020). Title. Journal.</li></ol>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.some((c) => c.type === "citation-style")).toBe(true);
  });

  it("marks all deterministic changes as autoAccepted", () => {
    const sections = [
      makeSection("s1", "Introduction", "<p>x</p>"),
      makeSection("s2", "Abstract", "<p>y</p>"),
    ];
    const changes = buildDeterministicChanges(sections, JOURNAL, "ms1");
    expect(changes.every((c) => c.autoAccepted === true)).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
npx vitest run server/services/__tests__/reformat.test.ts
```

Expected: FAIL — `reformat.service` does not exist.

- [ ] **Step 3: Implement `buildDeterministicChanges`**

```typescript
// server/services/reformat.service.ts
import crypto from "node:crypto";
import type { JournalGuidelinesDTO } from "../../shared/backend";
import type { ReformatSuggestion } from "../../shared/reformat";

interface SectionInput {
  id: string;
  title: string;
  contentHtml: string;
}

function normalizeTitle(t: string): string {
  return t.trim().toLowerCase();
}

function titlesMatch(a: string, b: string): boolean {
  const na = normalizeTitle(a);
  const nb = normalizeTitle(b);
  if (na === nb) return true;
  const aliases: Record<string, string[]> = {
    methods: ["methods", "materials and methods", "methodology"],
    "materials and methods": ["methods", "materials and methods", "methodology"],
    results: ["results", "results & synthesis"],
    discussion: ["discussion", "discussion and conclusion"],
    conclusion: ["conclusion", "conclusions"],
    abstract: ["abstract"],
    introduction: ["introduction", "background"],
    references: ["references", "bibliography"],
  };
  return (aliases[na] ?? [na]).includes(nb) || (aliases[nb] ?? [nb]).includes(na);
}

function makeId(): string {
  return crypto.randomUUID();
}

export function buildDeterministicChanges(
  sections: SectionInput[],
  guidelines: JournalGuidelinesDTO,
  manuscriptId: string,
): ReformatSuggestion[] {
  const suggestions: ReformatSuggestion[] = [];
  const sectionOrder = guidelines.sectionOrder ?? [];
  const sectionsRequired = guidelines.sectionsRequired ?? [];

  // ── Reorder ───────────────────────────────────────────────────────────────
  const currentTitles = sections.map((s) => s.title);
  const expectedOrder = sectionOrder.filter((required) =>
    currentTitles.some((t) => titlesMatch(t, required)),
  );

  let isOutOfOrder = false;
  let lastPos = -1;
  for (const expected of expectedOrder) {
    const pos = currentTitles.findIndex((t) => titlesMatch(t, expected));
    if (pos < lastPos) { isOutOfOrder = true; break; }
    lastPos = pos;
  }

  if (isOutOfOrder) {
    suggestions.push({
      id: makeId(),
      type: "reorder",
      sectionId: "document",
      original: currentTitles.join(" → "),
      suggested: expectedOrder.join(" → "),
      reason: `Section order does not match ${guidelines.journalName} requirements (${expectedOrder.join(", ")}).`,
      source: "deterministic",
      autoAccepted: true,
    });
  }

  // ── Missing required sections (stubs) ─────────────────────────────────────
  for (const required of sectionsRequired) {
    const present = sections.some((s) => titlesMatch(s.title, required));
    if (!present) {
      suggestions.push({
        id: makeId(),
        type: "stub",
        sectionId: "document",
        original: "",
        suggested: `<p><em>[Add ${required} section]</em></p>`,
        reason: `${guidelines.journalName} requires a "${required}" section that is missing from this manuscript.`,
        source: "deterministic",
        autoAccepted: true,
      });
    }
  }

  // ── Citation style flag ───────────────────────────────────────────────────
  if (guidelines.citationStyle) {
    const refSection = sections.find((s) => titlesMatch(s.title, "References"));
    if (refSection) {
      suggestions.push({
        id: makeId(),
        type: "citation-style",
        sectionId: refSection.id,
        original: refSection.contentHtml,
        suggested: refSection.contentHtml,
        reason: `${guidelines.journalName} requires ${guidelines.citationStyle.toUpperCase()} citation style. Review and reformat references accordingly.`,
        source: "deterministic",
        autoAccepted: true,
      });
    }
  }

  return suggestions;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run server/services/__tests__/reformat.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/reformat.service.ts server/services/__tests__/reformat.test.ts
git commit -m "feat: implement deterministic reformat layer"
```

---

### Task 12: Reformat service — LLM suggestions layer + route

**Files:**
- Modify: `server/services/reformat.service.ts`
- Modify: `modal-llm/app.py`
- Modify: `server/routes/manuscripts.ts`

- [ ] **Step 1: Add `reformat_section` method to Modal `app.py`**

In `modal-llm/app.py`, add a new method to the `JourniLLM` class after `infer`:

```python
    @modal.fastapi_endpoint(method="POST", path="/reformat")
    def reformat_section(self, body: dict) -> dict:
        import json, os
        from vllm import SamplingParams

        if body.get("_auth") != os.environ.get("MODAL_TOKEN_SECRET"):
            return {"error": "unauthorized"}

        section_title = body.get("section_title", "")
        section_content = body.get("section_content", "")
        guidelines_summary = body.get("guidelines_summary", "")

        if not section_content:
            return {"error": "section_content is required"}

        prompt = f"""You are helping reformat a section of an academic manuscript to meet journal submission requirements.

Journal requirements:
{guidelines_summary}

Section: {section_title}
Content:
---
{section_content[:2000]}
---

Return a JSON array of suggestions. Each suggestion:
{{
  "type": "trim" | "restructure",
  "original": "<exact quote from the content that needs changing>",
  "suggested": "<replacement text>",
  "reason": "<one sentence explanation>"
}}

Rules:
- Only suggest changes that are required by the journal guidelines above.
- For trim: identify specific overlong paragraphs. Quote the exact text in "original".
- For restructure: only if the section structure clearly violates guidelines.
- If no changes are needed, return an empty array [].
- Return ONLY a valid JSON array. No markdown fences, no commentary."""

        params = SamplingParams(
            temperature=0.0,
            max_tokens=2048,
            extra_body={"chat_template_kwargs": {"enable_thinking": False}},
        )

        outputs = self.llm.generate([prompt], params)
        raw = outputs[0].outputs[0].text.strip()
        raw = raw.replace("```json", "").replace("```", "").strip()

        try:
            parsed = json.loads(raw)
            if not isinstance(parsed, list):
                parsed = []
            return {"suggestions": parsed}
        except json.JSONDecodeError:
            return {"suggestions": [], "parse_error": raw[:200]}
```

- [ ] **Step 2: Re-deploy Modal app**

```bash
cd modal-llm
modal deploy app.py
```

- [ ] **Step 3: Add LLM suggestions to `reformat.service.ts`**

Add this function to `server/services/reformat.service.ts`:

```typescript
function buildGuidelinesSummary(guidelines: JournalGuidelinesDTO): string {
  const parts: string[] = [];
  if (guidelines.wordLimits?.abstract) parts.push(`Abstract: max ${guidelines.wordLimits.abstract} words`);
  if (guidelines.wordLimits?.main_text) parts.push(`Main text: max ${guidelines.wordLimits.main_text} words`);
  if (guidelines.citationStyle) parts.push(`Citation style: ${guidelines.citationStyle}`);
  if (guidelines.structuredAbstract) parts.push("Abstract must be structured (Background/Objective/Methods/Results/Conclusion)");
  if (guidelines.sectionOrder?.length) parts.push(`Section order: ${guidelines.sectionOrder.join(", ")}`);
  if (guidelines.requiredDeclarations?.length) parts.push(`Required declarations: ${guidelines.requiredDeclarations.join(", ")}`);
  return parts.join("\n");
}

async function callModalReformat(
  sectionTitle: string,
  sectionContent: string,
  guidelinesSummary: string,
): Promise<Array<{ type: string; original: string; suggested: string; reason: string }>> {
  const url = process.env.MODAL_LLM_REFORMAT_URL ?? process.env.MODAL_LLM_URL;
  if (!url) return [];

  // MODAL_LLM_REFORMAT_URL is the /reformat endpoint URL printed after `modal deploy app.py`.
  // Falls back to MODAL_LLM_URL for local dev where the same container handles both routes.
  const reformatUrl = url;
  try {
    const res = await fetch(reformatUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        section_title: sectionTitle,
        section_content: sectionContent.replace(/<[^>]+>/g, " ").trim(),
        guidelines_summary: guidelinesSummary,
        _auth: process.env.MODAL_TOKEN_SECRET,
      }),
      signal: AbortSignal.timeout(60_000),
    });
    if (!res.ok) return [];
    const data = await res.json() as { suggestions?: unknown[] };
    return Array.isArray(data.suggestions) ? (data.suggestions as any[]) : [];
  } catch {
    return [];
  }
}

export async function buildLlmSuggestions(
  sections: SectionInput[],
  guidelines: JournalGuidelinesDTO,
): Promise<ReformatSuggestion[]> {
  const guidelinesSummary = buildGuidelinesSummary(guidelines);

  // Parallel calls — one per section (skipping references, title)
  const skipSections = new Set(["references", "title"]);
  const eligible = sections.filter((s) => !skipSections.has(normalizeTitle(s.title)));

  const results = await Promise.all(
    eligible.map(async (section) => {
      const raw = await callModalReformat(section.title, section.contentHtml, guidelinesSummary);
      return raw.map((r): ReformatSuggestion => ({
        id: makeId(),
        type: (r.type === "trim" || r.type === "restructure") ? r.type : "trim",
        sectionId: section.id,
        original: r.original ?? "",
        suggested: r.suggested ?? "",
        reason: r.reason ?? "",
        source: "llm",
        autoAccepted: false,
      }));
    }),
  );

  return results.flat();
}
```

- [ ] **Step 4: Add route to `manuscripts.ts`**

In `server/routes/manuscripts.ts`, add after the recommend-journals route:

```typescript
manuscriptsRouter.post("/:manuscriptId/reformat", requireProAccess, async (req, res, next) => {
  try {
    const { manuscriptId } = req.params;
    const { journalId } = req.body as { journalId?: string };
    if (!journalId) return res.status(400).json({ error: "journalId is required" });

    const { supabaseAdmin } = await import("../lib/supabase");

    // Fetch manuscript sections
    const { data: sectionsData } = await supabaseAdmin
      .from("manuscript_sections")
      .select("id, title, content_html")
      .eq("manuscript_id", manuscriptId)
      .order("order");

    if (!sectionsData?.length) {
      return res.status(400).json({ error: "Manuscript has no sections" });
    }

    // Fetch journal guidelines
    const { data: journalData } = await supabaseAdmin
      .from("journals")
      .select("*")
      .eq("id", journalId)
      .single();

    if (!journalData) return res.status(404).json({ error: "Journal not found" });

    const { toJournalGuidelinesDto } = await import("../services/journal-guidelines.service");
    const { mapJournalRow } = await import("../services/journals/types");
    const guidelines = toJournalGuidelinesDto(mapJournalRow(journalData));

    const sections = sectionsData.map((s: any) => ({
      id: s.id,
      title: s.title,
      contentHtml: s.content_html ?? "",
    }));

    const { buildDeterministicChanges, buildLlmSuggestions } = await import("../services/reformat.service");

    const [deterministicChanges, llmSuggestions] = await Promise.all([
      Promise.resolve(buildDeterministicChanges(sections, guidelines, manuscriptId)),
      buildLlmSuggestions(sections, guidelines),
    ]);

    res.json({ deterministicChanges, llmSuggestions });
  } catch (err) {
    next(err);
  }
});
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

```bash
git add server/services/reformat.service.ts server/routes/manuscripts.ts modal-llm/app.py
git commit -m "feat: add LLM suggestion layer and POST /manuscripts/:id/reformat route"
```

---

## Final: End-to-end smoke tests

- [ ] **Parse error detection smoke test**

Upload a DOCX with only 2 sections (no Methods, no Results). Verify:
- Response includes `diagnostics` with a `SECTION_TOO_SHORT` or `LLM_FALLBACK_USED` entry
- LLM is called (check server logs for `LLM_FALLBACK_USED`)

- [ ] **Journal scraper smoke test**

```bash
curl -s -X POST "$RAILWAY_URL/api/journals/sync-scrape" \
  -H "x-scraper-secret: $JOURNI_SCRAPER_SECRET"
```

Expected: `{"scanned": N, "updated": M}` with M > 0 after first run.

- [ ] **Recommendation smoke test**

After uploading a manuscript with an abstract:
```bash
curl -s "$RAILWAY_URL/api/manuscripts/$MANUSCRIPT_ID/recommend-journals?mode=auto" \
  -H "Authorization: Bearer $TOKEN"
```

Expected: JSON with `journals` array of ≥1 entry each with `fitScore` and `fitReasons`.

- [ ] **Reformat smoke test**

```bash
curl -s -X POST "$RAILWAY_URL/api/manuscripts/$MANUSCRIPT_ID/reformat" \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"journalId": "$JOURNAL_ID"}'
```

Expected: JSON with `deterministicChanges` and `llmSuggestions` arrays.

- [ ] **Final commit**

```bash
git add docs/superpowers/plans/2026-04-15-llm-capabilities.md
git commit -m "docs: add implementation plan for LLM capabilities expansion"
```
