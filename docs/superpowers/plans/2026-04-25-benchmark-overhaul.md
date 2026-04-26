# Parser Benchmark Overhaul Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken sentinel-based benchmark pipeline with a single resumable script that correctly runs 5000 papers (1000 per publisher, across all study design buckets) through both DOCX and PDF paths, fixes all bugs found in the code review (lost LLM diagnostics, false "done" markers, silent skips), and produces per-document failure logs and per-cell aggregate reports that expose exactly where the parser is wrong.

**Architecture:** One top-level orchestrator script (`run-benchmark-pipeline.ts`) replaces the worker/sentinel system entirely. Idempotency is enforced purely by on-disk artifact existence — no sentinel files. The script runs fetch → render → benchmark → report in a single resumable pass. All per-document failures are written to a structured failure log alongside result files. A separate reporting script reads results and emits drill-down CSVs by publisher × study design × format × failure category.

**Tech Stack:** TypeScript + tsx, pdfjs-dist (existing), mammoth (existing), html-to-docx (existing), fast-xml-parser (existing), Node.js fs/promises, existing `mapWithConcurrency` utility. No new dependencies.

---

## Confirmed Bugs Being Fixed

| # | Bug | Location |
|---|-----|----------|
| B1 | Sentinel files written unconditionally even when artifacts absent | `worker-fetch-render.ts`, `worker-run-benchmark.ts` |
| B2 | `LLM_FALLBACK_USED` diagnostic lost in DOCX path | `manuscript-parse.service.ts:1211` — `...rawDocx` overwrites local diagnostics |
| B3 | `LLM_FALLBACK_USED` diagnostic lost in PDF path | `manuscript-parse.service.ts:1330` — same spread bug |
| B4 | LLM never fires in `parser_plus_llm` mode because Modal endpoint errors are silently swallowed and scores are identical to parser_only | `manuscript-parse.service.ts:1309-1325` |
| B5 | `completed` counter increments for skipped rows, giving false progress | `run-parser-benchmark.ts:79-85` |
| B6 | `collectParagraphText` doesn't recurse into JATS sub-sections → phantom zero-score truth sections | `jats-ground-truth.service.ts:94-111` |
| B7 | render-docx is single-threaded (serial loop) → 4× slower than necessary | `render-parser-docx.ts:46` |
| B8 | fetch concurrency=2 with no NCBI API key header → extremely slow | `fetch-parser-corpus.ts:25` |
| B9 | In `parser_plus_llm` mode, LLM should always run (not gated by 0.85 confidence threshold) | `manuscript-parse.service.ts:1189, 1310` |

---

## File Map

### Files Modified
| File | What changes |
|------|-------------|
| `server/services/manuscript-parse.service.ts` | Fix B2, B3: merge local `diagnostics` into final raw doc; Fix B4/B9: add `forceLlm` param; expose `llmAttempted` flag |
| `server/services/jats-ground-truth.service.ts` | Fix B6: recurse into sub-sections in `collectParagraphText` |
| `server/services/parser-benchmark.constants.ts` | Update `STUDY_BUCKET_TARGETS` to sum to 1000 per publisher (5000 total); raise `DEFAULT_DOWNLOAD_CONCURRENCY` to 8 |
| `server/scripts/check-parser-corpus-feasibility.ts` | Update target per-publisher to 1000 |

### Files Created
| File | Purpose |
|------|---------|
| `server/scripts/run-benchmark-pipeline.ts` | Single resumable orchestrator: fetch → render → benchmark → report |
| `server/services/parser-benchmark-report.service.ts` | Aggregate report builder + failure log writer, extracted from `run-parser-benchmark.ts` |

### Files Retired (no longer needed — replaced by orchestrator)
- `server/scripts/worker-fetch-render.ts` — sentinel model gone
- `server/scripts/worker-run-benchmark.ts` — sentinel model gone
- `server/scripts/run-parser-benchmark.ts` — logic absorbed into orchestrator
- `server/scripts/fetch-parser-corpus.ts` — logic absorbed into orchestrator
- `server/scripts/render-parser-docx.ts` — logic absorbed into orchestrator

> Keep the retired files in place; just stop using them. The orchestrator is the new entry point.

---

## Task 1: Fix `manuscript-parse.service.ts` — lost diagnostics (B2, B3) and LLM always-on (B4, B9)

**Files:**
- Modify: `server/services/manuscript-parse.service.ts`

The DOCX path builds `rawDocx` at line 1153 with `diagnostics: [...diagnostics, ...]`. Then the `try` block that calls the LLM pushes `LLM_FALLBACK_USED` into the *local* `diagnostics` array (line 1194). But `finalRawDocx` is assembled as `{ ...rawDocx, llmParsed }` — which overwrites the `diagnostics` field with `rawDocx.diagnostics`, discarding any pushes made after `rawDocx` was frozen. The PDF path has the same bug at lines 1312-1334. Fix: rebuild the diagnostics array just before assembling the final struct. Also add a `forceLlm?: boolean` parameter to `ParseUploadInput` so the benchmark can bypass the 0.85 threshold in `parser_plus_llm` mode.

- [ ] **Step 1: Add `forceLlm` to `ParseUploadInput`**

In `server/services/manuscript-parse.service.ts`, change the interface at line 10:

```typescript
export interface ParseUploadInput {
  fileName: string;
  mimeType?: string;
  buffer: Buffer;
  disableLlmFallback?: boolean;
  forceLlm?: boolean;
}
```

- [ ] **Step 2: Fix DOCX diagnostic merge (B2)**

Find the block at lines ~1188–1230 (DOCX LLM section). Replace the final assembly:

```typescript
// BEFORE (lines ~1211-1229):
const finalRawDocx: RawParsedDocument = {
  ...rawDocx,
  llmParsed: mergedSections
    ? { sections: mergedSections, citations: llmParsed?.citations ?? [] }
    : undefined,
};

const parsedDocx = parseRawDocument(finalRawDocx);
const finalParsed: typeof parsedDocx = {
  ...parsedDocx,
  parseConfidence: confidenceScore,
};

const errorDiagsDocx = runDeterministicErrorChecks(finalParsed);
return {
  ...finalRawDocx,
  diagnostics: [...(finalRawDocx.diagnostics ?? []), ...errorDiagsDocx],
  parseConfidence: confidenceScore,
};
```

```typescript
// AFTER: merge local diagnostics (which now include LLM_FALLBACK_USED) into final struct
const finalRawDocx: RawParsedDocument = {
  ...rawDocx,
  diagnostics: [...(rawDocx.diagnostics ?? []), ...diagnostics],
  llmParsed: mergedSections
    ? { sections: mergedSections, citations: llmParsed?.citations ?? [] }
    : undefined,
};

const parsedDocx = parseRawDocument(finalRawDocx);
const finalParsed: typeof parsedDocx = {
  ...parsedDocx,
  parseConfidence: confidenceScore,
};

const errorDiagsDocx = runDeterministicErrorChecks(finalParsed);
return {
  ...finalRawDocx,
  diagnostics: [...(finalRawDocx.diagnostics ?? []), ...errorDiagsDocx],
  parseConfidence: confidenceScore,
};
```

- [ ] **Step 3: Fix DOCX LLM threshold to respect `forceLlm` (B9)**

Change the LLM trigger condition in the DOCX block (~line 1189):

```typescript
// BEFORE:
if (!input.disableLlmFallback && confidenceScore < 0.85) {

// AFTER:
if (!input.disableLlmFallback && (input.forceLlm || confidenceScore < 0.85)) {
```

- [ ] **Step 4: Fix PDF diagnostic merge (B3)**

Find the PDF assembly block (~lines 1330-1343). Apply the same fix:

```typescript
// BEFORE:
const rawPdf: RawParsedDocument = {
  ...rawPdfPrelim,
  diagnostics: [...diagnostics, ...payload.diagnostics],
  llmParsed: pdfMergedSections
    ? { sections: pdfMergedSections, citations: llmParsed?.citations ?? [] }
    : undefined,
};
// ...
return { ...rawPdf, diagnostics: [...(rawPdf.diagnostics ?? []), ...errorDiagsPdf], parseConfidence: pdfConfidenceScore };
```

```typescript
// AFTER: diagnostics array now includes LLM_FALLBACK_USED pushed during the try block
const rawPdf: RawParsedDocument = {
  ...rawPdfPrelim,
  diagnostics: [...diagnostics, ...payload.diagnostics],
  llmParsed: pdfMergedSections
    ? { sections: pdfMergedSections, citations: llmParsed?.citations ?? [] }
    : undefined,
};
const parsedPdf = parseRawDocument(rawPdf);
const finalParsedPdf: typeof parsedPdf = {
  ...parsedPdf,
  parseConfidence: pdfConfidenceScore,
};
const errorDiagsPdf = runDeterministicErrorChecks(finalParsedPdf);
return { ...rawPdf, diagnostics: [...(rawPdf.diagnostics ?? []), ...errorDiagsPdf], parseConfidence: pdfConfidenceScore };
```

Note: the key fix here is that `diagnostics` (the local array declared at line 1079) now has `LLM_FALLBACK_USED` in it from the try block, and `rawPdf` spreads `...diagnostics` directly. This is already correct *if* the PDF try-block pushes before the catch — verify the push is inside `try`, not after it.

- [ ] **Step 5: Fix PDF LLM threshold to respect `forceLlm` (B9)**

```typescript
// BEFORE (~line 1310):
if (!input.disableLlmFallback && pdfConfidenceScore < 0.85 && payload.text.trim().length > 0) {

// AFTER:
if (!input.disableLlmFallback && (input.forceLlm || pdfConfidenceScore < 0.85) && payload.text.trim().length > 0) {
```

- [ ] **Step 6: Verify the LLM_FALLBACK_USED push is inside the try block for both paths**

In the DOCX path (~line 1192-1197), the structure must be:
```typescript
try {
  if (textResult.value.trim().length > 0) {
    llmParsed = await parseDocumentWithLLM(textResult.value);
    diagnostics.push({
      level: "info",
      code: "LLM_FALLBACK_USED",
      message: `Parse confidence ${confidenceScore.toFixed(2)} below threshold; AI-assisted parsing used.`,
    });
  }
} catch (error) {
  diagnostics.push({
    level: "warning",
    code: "LLM_PARSE_FAILED",
    message: error instanceof Error ? error.message : "AI-assisted parsing failed; manual review required.",
  });
}
```

Same structure must hold in the PDF path. If `LLM_FALLBACK_USED` is pushed after the catch closes, move it inside the `try`.

- [ ] **Step 7: Smoke-test the fix manually**

```bash
cd c:/Users/risha/Journi_MVP_new
node -e "
const { parseUploadedDocument } = require('./server/services/manuscript-parse.service.ts');
// We can't easily run tsx inline — instead verify the TS compiles:
" 2>&1 | head -5
npx tsx -e "
import { parseUploadedDocument } from './server/services/manuscript-parse.service';
console.log('import ok');
"
```

Expected: `import ok` with no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add server/services/manuscript-parse.service.ts
git commit -m "fix: merge LLM diagnostics into final raw doc; add forceLlm param"
```

---

## Task 2: Fix `jats-ground-truth.service.ts` — sub-section text recursion (B6)

**Files:**
- Modify: `server/services/jats-ground-truth.service.ts`

`collectParagraphText` at line 94 only reads `<p>` and `<list>` direct children of a `<sec>` node. Papers with nested sections (`<sec><sec><p>...</p></sec></sec>`) return empty text for the outer section, creating phantom zero-score truth entries that drag content scores down unfairly.

- [ ] **Step 1: Update `collectParagraphText` to recurse into sub-sections**

Replace the function at lines 94-112:

```typescript
// BEFORE:
function collectParagraphText(secNode: unknown): string {
  if (secNode == null || typeof secNode !== "object") return "";
  const node = secNode as Record<string, unknown>;
  const pieces: string[] = [];

  for (const paragraph of ensureArray(node.p)) {
    const text = normalizeWhitespace(textFromNode(paragraph));
    if (text) pieces.push(text);
  }

  for (const list of ensureArray(node.list)) {
    for (const item of ensureArray((list as Record<string, unknown>).listItem)) {
      const text = normalizeWhitespace(textFromNode(item));
      if (text) pieces.push(text);
    }
  }

  return pieces.join("\n\n").trim();
}
```

```typescript
// AFTER: recurse into nested <sec> nodes so sub-section text bubbles up to parent
function collectParagraphText(secNode: unknown): string {
  if (secNode == null || typeof secNode !== "object") return "";
  const node = secNode as Record<string, unknown>;
  const pieces: string[] = [];

  for (const paragraph of ensureArray(node.p)) {
    const text = normalizeWhitespace(textFromNode(paragraph));
    if (text) pieces.push(text);
  }

  for (const list of ensureArray(node.list)) {
    for (const item of ensureArray((list as Record<string, unknown>).listItem)) {
      const text = normalizeWhitespace(textFromNode(item));
      if (text) pieces.push(text);
    }
  }

  // Recurse into nested <sec> nodes — JATS allows sections nested arbitrarily deep
  for (const subSec of ensureArray(node.sec)) {
    const subText = collectParagraphText(subSec);
    if (subText) pieces.push(subText);
  }

  return pieces.join("\n\n").trim();
}
```

- [ ] **Step 2: Verify against a known nested JATS file**

```bash
cd c:/Users/risha/Journi_MVP_new
npx tsx -e "
import { extractJatsGroundTruth } from './server/services/jats-ground-truth.service';
import { readFileSync } from 'fs';
// Pick any XML file that has nested sections
const xml = readFileSync('data/parser-benchmark/xml/pmc13102035.xml', 'utf8');
const truth = extractJatsGroundTruth(xml);
const emptySections = truth.sections.filter(s => s.wordCount === 0);
console.log('total sections:', truth.sections.length);
console.log('empty sections:', emptySections.length);
console.log('section titles:', truth.sections.map(s => s.canonicalTitle + '(' + s.wordCount + 'w)').join(', '));
"
```

Expected: empty section count is 0 or very low (title section with 0 body words is acceptable). Previously this would show multiple body sections with 0 words.

- [ ] **Step 3: Commit**

```bash
git add server/services/jats-ground-truth.service.ts
git commit -m "fix: recurse into JATS sub-sections when collecting paragraph text"
```

---

## Task 3: Update corpus targets to 1000-per-publisher / 5000 total (constants + feasibility)

**Files:**
- Modify: `server/services/parser-benchmark.constants.ts`
- Modify: `server/scripts/check-parser-corpus-feasibility.ts`

Current `STUDY_BUCKET_TARGETS` sum to 1000 total. With 5 publishers × 1000 per publisher = 5000 total. We want balanced coverage: each publisher contributes ~167 per study bucket (1000/6). The feasibility script already fills remainder up to 1000 per publisher, so the study targets only need to be proportional. We set them to 200 each (6 buckets × ~167 rounds to 200 for headroom) = 1200 per publisher, but the feasibility script caps at 1000. Effectively: targets drive priority ordering within the 1000 cap, not the cap itself.

- [ ] **Step 1: Update `STUDY_BUCKET_TARGETS` and concurrency constants**

In `server/services/parser-benchmark.constants.ts`, replace lines 72-87:

```typescript
export const STUDY_BUCKET_TARGETS: Record<StudyDesignBucket, number> = {
  systematic_review_meta_analysis: 200,
  review_non_systematic: 200,
  rct_or_interventional_trial: 200,
  observational_cohort_case_control_cross_sectional: 200,
  case_report_or_case_series: 100,
  other_primary_research: 100,
};

export const DISCOVERY_OVERSAMPLE_MULTIPLIER = 1.5;
export const REQUIRED_JOURNALS_PER_PUBLISHER = 10;
export const MAX_ARTICLES_PER_JOURNAL = 100;
export const DEFAULT_DISCOVERY_BATCH_SIZE = 200;
export const DEFAULT_DOWNLOAD_CONCURRENCY = 8;
export const DEFAULT_PARSE_CONCURRENCY = 4;
export const DEFAULT_LLM_CONCURRENCY = 2;
```

- [ ] **Step 2: Update the per-publisher cap in `check-parser-corpus-feasibility.ts`**

The `lockSelection` function hardcodes `1000 - totalSelectedForPublisher` and `remainder > 0` fill at lines 101-121. This is already correct for 1000-per-publisher. Verify the constant is not also hardcoded in the report summary:

In `summarizePublisherCoverage` the function just reports what was selected — no hardcoded 1000 there. No change needed.

- [ ] **Step 3: Add NCBI API key header to fetch source service**

In `server/services/parser-benchmark-source.service.ts`, find `fetchText` (~line 86). Add the API key to EUtils requests:

```typescript
async function fetchText(url: string): Promise<string> {
  const normalizedUrl = normalizeNcbiDownloadUrl(url);
  return runWithRetry(`text request ${url}`, async () => {
    await throttleEutils(normalizedUrl);
    const ncbiApiKey = process.env.NCBI_API_KEY;
    const urlWithKey =
      ncbiApiKey && normalizedUrl.startsWith(EUTILS_BASE)
        ? `${normalizedUrl}${normalizedUrl.includes("?") ? "&" : "?"}api_key=${ncbiApiKey}`
        : normalizedUrl;
    const response = await fetch(urlWithKey, {
      headers: {
        Accept: "application/xml, text/xml, application/json, text/plain",
        "User-Agent": "Journi Parser Benchmark/1.0",
      },
      signal: AbortSignal.timeout(60_000),
    });
    // ... rest unchanged
```

Also update `EUTILS_MIN_INTERVAL_MS` to be dynamic:

```typescript
// BEFORE (line ~14):
const EUTILS_MIN_INTERVAL_MS = 450;

// AFTER: 100ms with API key (10 req/s), 450ms without (3 req/s)
const EUTILS_MIN_INTERVAL_MS = process.env.NCBI_API_KEY ? 100 : 450;
```

- [ ] **Step 4: Commit**

```bash
git add server/services/parser-benchmark.constants.ts
git add server/services/parser-benchmark-source.service.ts
git commit -m "fix: update corpus targets to 5000 total, add NCBI API key support for faster fetching"
```

---

## Task 4: Create `parser-benchmark-report.service.ts` — failure log + aggregate reports

**Files:**
- Create: `server/services/parser-benchmark-report.service.ts`

This service is extracted and expanded from the inline `writeReports()` and `buildSummaryRows()` in the old `run-parser-benchmark.ts`. It adds:
1. Per-document failure log (written as `data/parser-benchmark/reports/failures.jsonl`)
2. Drill-down aggregate CSV by (publisher × study design × format × mode)
3. Per-section accuracy CSV showing which section types lose the most points
4. A corpus completion report showing how many rows have all 4 result files

- [ ] **Step 1: Create the file**

```typescript
// server/services/parser-benchmark-report.service.ts
import { promises as fs } from "fs";
import path from "path";
import type {
  BenchmarkSummaryRow,
  CorpusManifestRow,
  ParserBenchmarkResultRecord,
  PublisherBucket,
  StudyDesignBucket,
} from "./parser-benchmark.types";
import type { ResultEnvelope } from "./parser-benchmark-artifacts.service";
import { REPORTS_DIR, RESULTS_DIR } from "./parser-benchmark.constants";
import { ensureDir, readJson, writeCsv, writeJson, appendJsonl } from "./parser-benchmark.utils";

export interface FailureLogEntry {
  pmid: string;
  pmcid?: string;
  publisherBucket?: PublisherBucket;
  studyDesignBucket?: StudyDesignBucket;
  format: "pdf" | "docx";
  mode: string;
  overallScore: number;
  hardFailureReasons: string[];
  diagnosticCodes: string[];
  llmFallbackTriggered: boolean;
  parseConfidence?: number;
  sectionFailures: Array<{
    canonicalTitle: string;
    truthWordCount: number;
    parsedWordCount: number;
    tokenRecall: number;
    tokenPrecision: number;
    lcsRatio: number;
    matched: boolean;
  }>;
  missingRequiredSections: string[];
  titleTokenF1: number;
  authorRecall: number;
  referenceDoiRecall: number;
  figureCountDelta: number;
  tableCountDelta: number;
  resultPath?: string;
}

export async function writeFailureLog(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);
  const logPath = path.join(REPORTS_DIR, "failures.jsonl");
  // Overwrite each run
  await fs.writeFile(logPath, "", "utf8");

  for (const { row, result } of envelopes) {
    if (result.scores.overall >= 0.95) continue; // only log failures

    const missingRequired = result.hardFailureReasons
      .filter((r) => r.startsWith("missing_required_section:"))
      .map((r) => r.replace("missing_required_section:", ""));

    const entry: FailureLogEntry = {
      pmid: row.pmid,
      pmcid: row.pmcid,
      publisherBucket: row.publisherBucket,
      studyDesignBucket: row.studyDesignBucket,
      format: result.format,
      mode: result.mode,
      overallScore: result.scores.overall,
      hardFailureReasons: result.hardFailureReasons,
      diagnosticCodes: result.diagnosticCodes,
      llmFallbackTriggered: result.llmFallbackTriggered,
      parseConfidence: result.parseConfidence,
      sectionFailures: result.metrics.sectionComparisons
        .filter((c) => c.tokenRecall < 0.8 || !c.matched)
        .map((c) => ({
          canonicalTitle: c.canonicalTitle,
          truthWordCount: c.truthWordCount,
          parsedWordCount: c.parsedWordCount,
          tokenRecall: c.tokenRecall,
          tokenPrecision: c.tokenPrecision,
          lcsRatio: c.lcsRatio,
          matched: c.matched,
        })),
      missingRequiredSections: missingRequired,
      titleTokenF1: result.metrics.titleTokenF1,
      authorRecall: result.metrics.authorRecall,
      referenceDoiRecall: result.metrics.referenceDoiRecall,
      figureCountDelta: result.metrics.figureCountDelta,
      tableCountDelta: result.metrics.tableCountDelta,
      resultPath: result.rawResultPath,
    };

    await appendJsonl(logPath, entry);
  }
}

export async function writeSectionAccuracyReport(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);

  // Aggregate by canonicalTitle × format × mode
  const buckets = new Map<string, { recall: number[]; precision: number[]; lcs: number[]; matchRate: number[] }>();

  for (const { result } of envelopes) {
    for (const sc of result.metrics.sectionComparisons) {
      const key = `${sc.canonicalTitle}|${result.format}|${result.mode}`;
      const existing = buckets.get(key) ?? { recall: [], precision: [], lcs: [], matchRate: [] };
      existing.recall.push(sc.tokenRecall);
      existing.precision.push(sc.tokenPrecision);
      existing.lcs.push(sc.lcsRatio);
      existing.matchRate.push(sc.matched ? 1 : 0);
      buckets.set(key, existing);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const [key, data] of buckets.entries()) {
    const [canonicalTitle, format, mode] = key.split("|");
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    rows.push({
      canonicalTitle,
      format,
      mode,
      sampleCount: data.recall.length,
      avgTokenRecall: avg(data.recall).toFixed(4),
      avgTokenPrecision: avg(data.precision).toFixed(4),
      avgLcsRatio: avg(data.lcs).toFixed(4),
      avgMatchRate: avg(data.matchRate).toFixed(4),
    });
  }

  rows.sort((a, b) => Number(a.avgTokenRecall) - Number(b.avgTokenRecall));

  await writeCsv(
    path.join(REPORTS_DIR, "section-accuracy.csv"),
    ["canonicalTitle", "format", "mode", "sampleCount", "avgTokenRecall", "avgTokenPrecision", "avgLcsRatio", "avgMatchRate"],
    rows,
  );
}

export async function writeAggregateReport(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);

  const grouped = new Map<string, ParserBenchmarkResultRecord[]>();
  const rowByKey = new Map<string, CorpusManifestRow>();

  for (const { row, result } of envelopes) {
    const key = [row.publisherBucket ?? "unknown", row.studyDesignBucket ?? "unknown", result.format, result.mode].join("|");
    const bucket = grouped.get(key) ?? [];
    bucket.push(result);
    grouped.set(key, bucket);
    rowByKey.set(key, row);
  }

  const summaryRows: BenchmarkSummaryRow[] = [];
  for (const [key, results] of grouped.entries()) {
    const [publisherBucket, studyDesignBucket, format, mode] = key.split("|");
    const avg = (arr: number[]) => arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
    summaryRows.push({
      publisherBucket: publisherBucket as PublisherBucket,
      studyDesignBucket: studyDesignBucket as StudyDesignBucket,
      format: format as "pdf" | "docx",
      mode: mode as "parser_only" | "parser_plus_llm",
      documentCount: results.length,
      llmFallbackCount: results.filter((r) => r.llmFallbackTriggered).length,
      avgOverallScore: avg(results.map((r) => r.scores.overall)),
      avgMetadataScore: avg(results.map((r) => r.scores.metadata)),
      avgStructureScore: avg(results.map((r) => r.scores.structure)),
      avgContentScore: avg(results.map((r) => r.scores.content)),
      avgReferenceScore: avg(results.map((r) => r.scores.references)),
      avgFiguresTablesScore: avg(results.map((r) => r.scores.figuresTables)),
    });
  }

  summaryRows.sort((a, b) => a.avgOverallScore - b.avgOverallScore);

  await writeJson(path.join(REPORTS_DIR, "benchmark-summary.json"), summaryRows);
  await writeCsv(
    path.join(REPORTS_DIR, "benchmark-summary.csv"),
    [
      "publisherBucket", "studyDesignBucket", "format", "mode",
      "documentCount", "llmFallbackCount",
      "avgOverallScore", "avgMetadataScore", "avgStructureScore",
      "avgContentScore", "avgReferenceScore", "avgFiguresTablesScore",
    ],
    summaryRows as unknown as Array<Record<string, unknown>>,
  );
}

export async function writeCorpusCompletionReport(
  selectedRows: CorpusManifestRow[],
  envelopes: ResultEnvelope[],
): Promise<void> {
  await ensureDir(REPORTS_DIR);

  const resultPmids = new Set(envelopes.map((e) => e.row.pmid + "|" + e.result.format + "|" + e.result.mode));

  let complete = 0;
  let partialResult = 0;
  let noResult = 0;

  for (const row of selectedRows) {
    const hasPdfOnly = resultPmids.has(`${row.pmid}|pdf|parser_only`);
    const hasPdfLlm = resultPmids.has(`${row.pmid}|pdf|parser_plus_llm`);
    const hasDocxOnly = resultPmids.has(`${row.pmid}|docx|parser_only`);
    const hasDocxLlm = resultPmids.has(`${row.pmid}|docx|parser_plus_llm`);
    const count = [hasPdfOnly, hasPdfLlm, hasDocxOnly, hasDocxLlm].filter(Boolean).length;

    if (count === 4) complete++;
    else if (count > 0) partialResult++;
    else noResult++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalSelected: selectedRows.length,
    completeRows: complete,
    partialRows: partialResult,
    noResultRows: noResult,
    completionPct: ((complete / selectedRows.length) * 100).toFixed(1),
  };

  await writeJson(path.join(REPORTS_DIR, "corpus-completion.json"), report);
  console.log(`[report] Corpus completion: ${complete}/${selectedRows.length} (${report.completionPct}%) fully processed.`);
}

export async function readResultEnvelopes(): Promise<ResultEnvelope[]> {
  const entries = await fs.readdir(RESULTS_DIR, { withFileTypes: true });
  const output: ResultEnvelope[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const envelope = await readJson<ResultEnvelope>(path.join(RESULTS_DIR, entry.name));
      if (envelope?.row && envelope?.result) output.push(envelope);
    } catch {
      // corrupted result file — skip
    }
  }

  return output;
}
```

- [ ] **Step 2: Verify it compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
npx tsx -e "import './server/services/parser-benchmark-report.service'; console.log('ok');"
```

Expected: `ok`

- [ ] **Step 3: Commit**

```bash
git add server/services/parser-benchmark-report.service.ts
git commit -m "feat: add report service with failure log, section accuracy, and completion tracking"
```

---

## Task 5: Create `run-benchmark-pipeline.ts` — the single resumable orchestrator

**Files:**
- Create: `server/scripts/run-benchmark-pipeline.ts`

This replaces all five of the old scripts + workers. It runs in a single process with three phases:

**Phase 1 — Fetch**: For each selected row in parallel (concurrency 8), if XML missing → fetch, if PDF missing → resolve URL and download.

**Phase 2 — Render**: For each selected row where XML exists but truth/DOCX missing, render truth JSON and DOCX in parallel (concurrency 4).

**Phase 3 — Benchmark**: For each selected row where truth exists, run parser for all (format, mode) combos that don't yet have a result file. Concurrency 4 for `parser_only`, 2 for `parser_plus_llm`.

After all three phases, write reports via the report service.

Idempotency: each artifact is gated by `fileExists`. Resumable: re-run the script and it picks up where it left off. No sentinel files. Progress is printed every N rows with counts of: xml_ready / pdf_ready / truth_ready / results_ready / total.

- [ ] **Step 1: Create the file**

```typescript
// server/scripts/run-benchmark-pipeline.ts
import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import { parseRawDocument } from "@shared/document-parse";
import {
  DEFAULT_LLM_CONCURRENCY,
  DEFAULT_PARSE_CONCURRENCY,
  DOCX_DIR,
  MANIFEST_PATH,
  PDF_DIR,
  RESULTS_DIR,
  TRUTH_DIR,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import {
  getDocxPath,
  getPdfPath,
  getResultPath,
  getTruthPath,
  getXmlPath,
  type ResultEnvelope,
} from "../services/parser-benchmark-artifacts.service";
import {
  fetchPmcXmlByPmcid,
  resolvePmcPdfUrl,
} from "../services/parser-benchmark-source.service";
import { extractJatsGroundTruth, renderGroundTruthHtml } from "../services/jats-ground-truth.service";
import { parseUploadedDocument } from "../services/manuscript-parse.service";
import { scoreParsedDocumentAgainstTruth } from "../services/parser-benchmark-score.service";
import {
  writeAggregateReport,
  writeCorpusCompletionReport,
  writeFailureLog,
  writeSectionAccuracyReport,
  readResultEnvelopes,
} from "../services/parser-benchmark-report.service";
import type {
  CorpusManifestRow,
  JatsGroundTruth,
  ParserBenchmarkResultRecord,
  ParserBenchmarkRunMode,
} from "../services/parser-benchmark.types";
import {
  ensureDir,
  fileExists,
  mapWithConcurrency,
  readJson,
  readJsonl,
  writeJson,
} from "../services/parser-benchmark.utils";

// ── Config ──────────────────────────────────────────────────────────────────
const FETCH_CONCURRENCY = Number(process.env.BENCHMARK_FETCH_CONCURRENCY ?? 8);
const RENDER_CONCURRENCY = Number(process.env.BENCHMARK_RENDER_CONCURRENCY ?? 4);
const PARSE_CONCURRENCY = Number(process.env.BENCHMARK_PARSE_CONCURRENCY ?? DEFAULT_PARSE_CONCURRENCY);
const LLM_CONCURRENCY = Number(process.env.BENCHMARK_LLM_CONCURRENCY ?? DEFAULT_LLM_CONCURRENCY);
const FORCE_RERUN = process.env.BENCHMARK_FORCE_RERUN === "true";
const SKIP_LLM = process.env.BENCHMARK_SKIP_LLM === "true";
const PROGRESS_EVERY = Number(process.env.BENCHMARK_PROGRESS_EVERY ?? 50);
const MODES: ParserBenchmarkRunMode[] = SKIP_LLM ? ["parser_only"] : ["parser_only", "parser_plus_llm"];

// ── Counters ─────────────────────────────────────────────────────────────────
interface PipelineStats {
  total: number;
  xmlReady: number;
  xmlFailed: number;
  pdfReady: number;
  pdfFailed: number;
  pdfMissing: number;
  truthReady: number;
  renderFailed: number;
  resultsReady: number;
  resultsFailed: number;
  skipped: number;
}

function printStats(stats: PipelineStats, phase: string): void {
  console.log(
    `[pipeline:${phase}] ` +
    `xml=${stats.xmlReady}/${stats.total} ` +
    `(fail=${stats.xmlFailed}) | ` +
    `pdf=${stats.pdfReady}/${stats.total} ` +
    `(fail=${stats.pdfFailed} missing=${stats.pdfMissing}) | ` +
    `truth=${stats.truthReady}/${stats.total} ` +
    `(fail=${stats.renderFailed}) | ` +
    `results=${stats.resultsReady} ` +
    `(fail=${stats.resultsFailed} skip=${stats.skipped})`
  );
}

// ── Phase 1: Fetch XML + PDF ─────────────────────────────────────────────────
async function fetchPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:fetch] Starting fetch for ${rows.length} rows at concurrency=${FETCH_CONCURRENCY}`);
  let done = 0;

  await mapWithConcurrency(rows, FETCH_CONCURRENCY, async (row) => {
    const xmlPath = getXmlPath(row);
    const pdfPath = getPdfPath(row);
    const xmlExists = await fileExists(xmlPath);
    const pdfExists = await fileExists(pdfPath);

    if (!xmlExists && row.pmcid) {
      try {
        const xml = await fetchPmcXmlByPmcid(row.pmcid);
        await fs.writeFile(xmlPath, xml, "utf8");
        stats.xmlReady++;
      } catch (err) {
        stats.xmlFailed++;
        console.warn(`[fetch] XML failed ${row.pmcid}: ${(err as Error).message}`);
      }
    } else if (xmlExists) {
      stats.xmlReady++;
    }

    if (!pdfExists && row.pmcid) {
      try {
        const pdfUrl = row.pdf?.sourceUrl || await resolvePmcPdfUrl(row.pmcid);
        if (!pdfUrl) {
          stats.pdfMissing++;
        } else {
          const res = await fetch(pdfUrl, {
            headers: { "User-Agent": "Journi Parser Benchmark/1.0" },
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
          const buf = Buffer.from(await res.arrayBuffer());
          await fs.writeFile(pdfPath, buf);
          stats.pdfReady++;
        }
      } catch (err) {
        stats.pdfFailed++;
        console.warn(`[fetch] PDF failed ${row.pmcid}: ${(err as Error).message}`);
      }
    } else if (pdfExists) {
      stats.pdfReady++;
    }

    done++;
    if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "fetch");
  });
}

// ── Phase 2: Render truth JSON + DOCX ────────────────────────────────────────
async function renderPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:render] Starting render for ${rows.length} rows at concurrency=${RENDER_CONCURRENCY}`);
  const { default: HTMLtoDOCX } = await import("html-to-docx");
  let done = 0;

  await mapWithConcurrency(rows, RENDER_CONCURRENCY, async (row) => {
    const xmlPath = getXmlPath(row);
    const truthPath = getTruthPath(row);
    const docxPath = getDocxPath(row);

    if (!(await fileExists(xmlPath))) {
      done++;
      return;
    }

    const truthExists = await fileExists(truthPath);
    const docxExists = await fileExists(docxPath);

    if (truthExists && docxExists && !FORCE_RERUN) {
      stats.truthReady++;
      done++;
      if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "render");
      return;
    }

    try {
      const xml = await fs.readFile(xmlPath, "utf8");
      const truth = extractJatsGroundTruth(xml);
      await writeJson(truthPath, truth);

      const html = renderGroundTruthHtml(truth);
      const docxOutput = await HTMLtoDOCX(html, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      });
      const docxBuf = Buffer.isBuffer(docxOutput) ? docxOutput : Buffer.from(docxOutput as ArrayBuffer);
      await fs.writeFile(docxPath, docxBuf);
      stats.truthReady++;
    } catch (err) {
      stats.renderFailed++;
      console.warn(`[render] Failed ${row.pmcid ?? row.pmid}: ${(err as Error).message}`);
    }

    done++;
    if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "render");
  });
}

// ── Phase 3: Run parser benchmark ─────────────────────────────────────────────
async function benchmarkRow(
  row: CorpusManifestRow,
  truth: JatsGroundTruth,
  format: "pdf" | "docx",
  mode: ParserBenchmarkRunMode,
  stats: PipelineStats,
): Promise<void> {
  const resultPath = getResultPath(row, format, mode);
  if (!FORCE_RERUN && (await fileExists(resultPath))) {
    stats.resultsReady++;
    return;
  }

  const artifactPath = format === "pdf" ? getPdfPath(row) : getDocxPath(row);
  if (!(await fileExists(artifactPath))) {
    stats.skipped++;
    return;
  }

  try {
    const buffer = await fs.readFile(artifactPath);
    const raw = await parseUploadedDocument({
      fileName: artifactPath,
      buffer,
      disableLlmFallback: mode === "parser_only",
      forceLlm: mode === "parser_plus_llm",
    });

    const parsed = { ...parseRawDocument(raw), parseConfidence: raw.parseConfidence };
    const llmFallbackTriggered = (raw.diagnostics ?? []).some((d) => d.code === "LLM_FALLBACK_USED");

    const scored = scoreParsedDocumentAgainstTruth({
      parsed,
      truth,
      studyDesignBucket: row.studyDesignBucket,
      format,
      mode,
      llmFallbackTriggered,
    });

    const result: ParserBenchmarkResultRecord = {
      ...scored,
      createdAt: new Date().toISOString(),
      rawResultPath: resultPath,
    };

    const envelope: ResultEnvelope = { row, raw, parsed, truth, result };
    await writeJson(resultPath, envelope);
    stats.resultsReady++;
  } catch (err) {
    stats.resultsFailed++;
    console.warn(`[benchmark] Failed ${row.pmid} ${format}/${mode}: ${(err as Error).message}`);
  }
}

async function benchmarkPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:benchmark] Starting benchmark for ${rows.length} rows`);

  // Process parser_only first (no LLM dependency), then parser_plus_llm
  for (const mode of MODES) {
    const concurrency = mode === "parser_plus_llm" ? LLM_CONCURRENCY : PARSE_CONCURRENCY;
    console.log(`[pipeline:benchmark] Mode=${mode} concurrency=${concurrency}`);
    let done = 0;

    await mapWithConcurrency(rows, concurrency, async (row) => {
      const truthPath = getTruthPath(row);
      if (!(await fileExists(truthPath))) {
        done++;
        return;
      }

      let truth: JatsGroundTruth;
      try {
        truth = await readJson<JatsGroundTruth>(truthPath);
      } catch {
        done++;
        return;
      }

      await benchmarkRow(row, truth, "pdf", mode, stats);
      await benchmarkRow(row, truth, "docx", mode, stats);

      done++;
      if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, `benchmark:${mode}`);
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await Promise.all([
    ensureDir(XML_DIR), ensureDir(PDF_DIR),
    ensureDir(DOCX_DIR), ensureDir(TRUTH_DIR),
    ensureDir(RESULTS_DIR),
  ]);

  if (MODES.includes("parser_plus_llm") && !process.env.MODAL_LLM_URL) {
    throw new Error("MODAL_LLM_URL must be set for parser_plus_llm mode. Set BENCHMARK_SKIP_LLM=true to skip.");
  }

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selectedRows = manifest.filter((r) => r.selected && r.pmcid);
  console.log(`[pipeline] ${selectedRows.length} selected rows. Modes: ${MODES.join(", ")}`);

  const stats: PipelineStats = {
    total: selectedRows.length,
    xmlReady: 0, xmlFailed: 0,
    pdfReady: 0, pdfFailed: 0, pdfMissing: 0,
    truthReady: 0, renderFailed: 0,
    resultsReady: 0, resultsFailed: 0, skipped: 0,
  };

  await fetchPhase(selectedRows, stats);
  await renderPhase(selectedRows, stats);
  await benchmarkPhase(selectedRows, stats);

  printStats(stats, "final");

  console.log("[pipeline] Writing reports...");
  const envelopes = await readResultEnvelopes();
  await Promise.all([
    writeAggregateReport(envelopes),
    writeSectionAccuracyReport(envelopes),
    writeFailureLog(envelopes),
    writeCorpusCompletionReport(selectedRows, envelopes),
  ]);

  console.log("[pipeline] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
```

- [ ] **Step 2: Fix `ResultEnvelope` — it needs `raw` and `parsed` fields for the full write**

The existing `ResultEnvelope` in `parser-benchmark-artifacts.service.ts` only has `row` and `result`. The result files written by the old script also stored `raw` and `parsed`. Update the type:

```typescript
// server/services/parser-benchmark-artifacts.service.ts
// Add to ResultEnvelope:
import type { ParsedManuscript, RawParsedDocument } from "@shared/document-parse";

export interface ResultEnvelope {
  row: CorpusManifestRow;
  raw?: RawParsedDocument;
  parsed?: ParsedManuscript;
  truth?: unknown;
  result: ParserBenchmarkResultRecord;
}
```

The `raw` and `parsed` fields make individual result files useful for debugging (you can see exactly what the parser returned for any document). They're optional so the report reader still works if old result files are present without them.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
npx tsx --no-run server/scripts/run-benchmark-pipeline.ts 2>&1 | head -20
```

If there are import errors, fix them. Common issues: `@shared/document-parse` path alias — check `tsconfig.json` paths. If alias doesn't resolve in tsx, use the relative path `../../shared/document-parse`.

- [ ] **Step 4: Dry-run on a single row**

```bash
cd c:/Users/risha/Journi_MVP_new
BENCHMARK_PROGRESS_EVERY=1 BENCHMARK_SKIP_LLM=true BENCHMARK_FORCE_RERUN=false \
  npx tsx --max-old-space-size=4096 server/scripts/run-benchmark-pipeline.ts 2>&1 | head -60
```

Expected output: stats lines showing xml, pdf, truth, results counts incrementing. Script should complete without throwing.

- [ ] **Step 5: Commit**

```bash
git add server/scripts/run-benchmark-pipeline.ts
git add server/services/parser-benchmark-artifacts.service.ts
git commit -m "feat: add single-process resumable benchmark pipeline, replacing worker/sentinel architecture"
```

---

## Task 6: Wipe false sentinels and validate end-to-end on first 50 rows

**Files:** No code changes — operational validation.

- [ ] **Step 1: Delete the false sentinel files**

```bash
cd c:/Users/risha/Journi_MVP_new
rm -f data/parser-benchmark/worker-state/fetch-render-ready/*.json
rm -f data/parser-benchmark/worker-state/run-done/*.json
echo "Sentinels cleared."
ls data/parser-benchmark/worker-state/fetch-render-ready/ 2>/dev/null | wc -l
# Expected: 0
```

- [ ] **Step 2: Run pipeline on first 50 rows only, parser_only, to validate**

We don't have a row-limit flag yet in the pipeline. Add a temporary env override by adding this check immediately after the `selectedRows` filter in `main()`:

```typescript
const limitRows = process.env.BENCHMARK_LIMIT_ROWS ? Number(process.env.BENCHMARK_LIMIT_ROWS) : undefined;
const rowsToProcess = limitRows ? selectedRows.slice(0, limitRows) : selectedRows;
```

Then pass `rowsToProcess` to all three phases instead of `selectedRows`.

```bash
cd c:/Users/risha/Journi_MVP_new
BENCHMARK_LIMIT_ROWS=50 BENCHMARK_SKIP_LLM=true BENCHMARK_FORCE_RERUN=true \
  npx tsx --max-old-space-size=4096 server/scripts/run-benchmark-pipeline.ts 2>&1 | tee /tmp/pipeline-test.log
```

Expected output ends with:
```
[pipeline:final] xml=50/50 ... truth=50/50 ... results=100 ...
[pipeline] Writing reports...
[pipeline] Done.
```

- [ ] **Step 3: Verify report files exist and have content**

```bash
ls -la data/parser-benchmark/reports/
# Expect: benchmark-summary.csv, benchmark-summary.json, section-accuracy.csv, failures.jsonl, corpus-completion.json
node -e "
const j = require('./data/parser-benchmark/reports/corpus-completion.json');
console.log(j);
"
# Expected: completeRows >= 50, completionPct > 0
```

- [ ] **Step 4: Inspect a sample failure log entry**

```bash
node -e "
const fs = require('fs');
const lines = fs.readFileSync('data/parser-benchmark/reports/failures.jsonl','utf8').trim().split('\n');
console.log('failure entries:', lines.length);
const first = JSON.parse(lines[0]);
console.log('pmid:', first.pmid, 'overall:', first.overallScore.toFixed(3));
console.log('missing sections:', first.missingRequiredSections);
console.log('bad sections:', first.sectionFailures.map(s => s.canonicalTitle + ' recall=' + s.tokenRecall.toFixed(2)));
"
```

Expected: readable failure detail showing which sections failed and why.

- [ ] **Step 5: Commit**

```bash
git add server/scripts/run-benchmark-pipeline.ts
git commit -m "feat: add BENCHMARK_LIMIT_ROWS env for partial runs during validation"
```

---

## Task 7: Re-select corpus to 5000 rows and run full pipeline

**Files:** No code changes — operational steps.

- [ ] **Step 1: Check current corpus counts vs 5000 target**

```bash
cd c:/Users/risha/Journi_MVP_new
node -e "
const fs = require('fs');
const lines = fs.readFileSync('data/parser-benchmark/manifest.jsonl','utf8').trim().split('\n');
const rows = lines.map(l => JSON.parse(l));
const byPub = {};
for (const r of rows) {
  byPub[r.publisherBucket] = (byPub[r.publisherBucket]||0)+1;
}
console.log('Manifest total:', rows.length);
console.log('By publisher:', JSON.stringify(byPub));
const selected = rows.filter(r => r.selected && r.pmcid);
const selByPub = {};
for (const r of selected) selByPub[r.publisherBucket] = (selByPub[r.publisherBucket]||0)+1;
console.log('Selected:', selected.length, JSON.stringify(selByPub));
"
```

Current state: 4083 selected; sage is only 190. Need to discover more sage papers and potentially more springer_nature (893 currently vs 1000 target).

- [ ] **Step 2: Run discover to fill gaps**

```bash
cd c:/Users/risha/Journi_MVP_new
npx tsx server/scripts/discover-parser-corpus.ts 2>&1 | tail -30
```

This is resumable — it reads discovery progress and only fetches new pages. Run until sage ≥ 1000 and springer_nature ≥ 1000 in manifest.

- [ ] **Step 3: Re-run feasibility to re-select 5000 rows**

```bash
npx tsx server/scripts/check-parser-corpus-feasibility.ts 2>&1
```

This re-runs `lockSelection` with the updated targets (200 per study bucket per publisher, capped at 1000 per publisher). It rewrites the manifest with updated `selected` flags.

- [ ] **Step 4: Verify final corpus composition**

```bash
node -e "
const fs = require('fs');
const lines = fs.readFileSync('data/parser-benchmark/manifest.jsonl','utf8').trim().split('\n');
const rows = lines.map(l => JSON.parse(l)).filter(r => r.selected && r.pmcid);
const byPub = {}; const byStudy = {};
for (const r of rows) {
  byPub[r.publisherBucket] = (byPub[r.publisherBucket]||0)+1;
  byStudy[r.studyDesignBucket] = (byStudy[r.studyDesignBucket]||0)+1;
}
console.log('Total selected:', rows.length);
console.log('By publisher:', JSON.stringify(byPub, null, 2));
console.log('By study design:', JSON.stringify(byStudy, null, 2));
"
```

Expected: total ~5000; each publisher 800–1000; each study design bucket reasonably balanced.

- [ ] **Step 5: Run full pipeline — parser_only only first**

```bash
cd c:/Users/risha/Journi_MVP_new
BENCHMARK_SKIP_LLM=true \
  npx tsx --max-old-space-size=6144 server/scripts/run-benchmark-pipeline.ts 2>&1 | tee data/parser-benchmark/pipeline-run-parser-only.log
```

This will take multiple hours. It is fully resumable — Ctrl-C and restart from where it left off.

- [ ] **Step 6: Once parser_only is complete, run parser_plus_llm**

```bash
BENCHMARK_SKIP_LLM=false MODAL_LLM_URL=<your-url> MODAL_TOKEN_SECRET=<your-secret> \
  npx tsx --max-old-space-size=6144 server/scripts/run-benchmark-pipeline.ts 2>&1 | tee data/parser-benchmark/pipeline-run-llm.log
```

The pipeline will skip all already-complete parser_only results and only process the parser_plus_llm combos.

---

## Task 8: Validate reports — confirm LLM fires, scores differ, failures are logged

**Files:** No code changes — validation.

- [ ] **Step 1: Check LLM actually fired**

```bash
node -e "
const fs = require('fs');
const dir = 'data/parser-benchmark/results';
const files = fs.readdirSync(dir).filter(f => f.includes('parser_plus_llm')).slice(0, 200);
let llmUsed = 0, llmFailed = 0, total = files.length;
for (const f of files) {
  const j = JSON.parse(fs.readFileSync(dir+'/'+f,'utf8'));
  const codes = j.result.diagnosticCodes || [];
  if (codes.includes('LLM_FALLBACK_USED')) llmUsed++;
  if (codes.includes('LLM_PARSE_FAILED')) llmFailed++;
}
console.log('LLM_FALLBACK_USED:', llmUsed, '/', total);
console.log('LLM_PARSE_FAILED:', llmFailed, '/', total);
"
```

Expected: `LLM_FALLBACK_USED` count > 0. If still 0 and `LLM_PARSE_FAILED` > 0, the Modal endpoint is down — check connectivity.

- [ ] **Step 2: Check scores differ between modes**

```bash
node -e "
const fs = require('fs');
const dir = 'data/parser-benchmark/results';
const files = fs.readdirSync(dir);
const pmids = [...new Set(files.map(f => f.split('-')[0]))].slice(0, 20);
let same = 0, diff = 0;
for (const pmid of pmids) {
  try {
    const po = JSON.parse(fs.readFileSync(dir+'/'+pmid+'-pdf-parser_only.json','utf8'));
    const pl = JSON.parse(fs.readFileSync(dir+'/'+pmid+'-pdf-parser_plus_llm.json','utf8'));
    if (Math.abs(po.result.scores.overall - pl.result.scores.overall) < 0.001) same++;
    else diff++;
  } catch {}
}
console.log('same score:', same, 'different score:', diff);
"
```

Expected: `different score` > 0.

- [ ] **Step 3: Review section accuracy report**

```bash
node -e "
const fs = require('fs');
const csv = fs.readFileSync('data/parser-benchmark/reports/section-accuracy.csv','utf8');
const lines = csv.trim().split('\n');
console.log(lines[0]); // header
// Print bottom 10 (worst recall)
lines.slice(1, 11).forEach(l => console.log(l));
"
```

This tells you which section types (Methods, Results, etc.) have worst token recall — exactly where to focus parser fixes.

- [ ] **Step 4: Review failure log for common patterns**

```bash
node -e "
const fs = require('fs');
const lines = fs.readFileSync('data/parser-benchmark/reports/failures.jsonl','utf8').trim().split('\n').filter(Boolean);
const entries = lines.map(l => JSON.parse(l));
const missingCounts = {};
for (const e of entries) {
  for (const s of e.missingRequiredSections) {
    missingCounts[s] = (missingCounts[s]||0)+1;
  }
}
console.log('Most missing required sections:');
Object.entries(missingCounts).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([k,v]) => console.log(' ', k, v));

const diagCounts = {};
for (const e of entries) {
  for (const c of e.diagnosticCodes) {
    diagCounts[c] = (diagCounts[c]||0)+1;
  }
}
console.log('Most common diagnostic codes:');
Object.entries(diagCounts).sort((a,b) => b[1]-a[1]).slice(0,10).forEach(([k,v]) => console.log(' ', k, v));
"
```

This analysis directly informs which parser bugs to fix next.

---

## Self-Review Checklist

### Spec coverage
- [x] 5000 papers (1000 per publisher × 5 publishers) — Task 3 + Task 7
- [x] DOCX and PDF paths — Task 5 (benchmarkRow runs both formats)
- [x] Big 5 publishers (springer_nature, wiley, taylor_francis, sage, elsevier) — existing constants, no change needed
- [x] Fix all bugs from code review — Tasks 1, 2, 3
- [x] Per-document failure logging — Task 4 (`writeFailureLog`)
- [x] Section-level accuracy breakdown — Task 4 (`writeSectionAccuracyReport`)
- [x] Per-cell aggregate reports (publisher × study × format × mode) — Task 4 (`writeAggregateReport`)
- [x] Resumable / no false "done" markers — Task 5 (pure file-existence gating)
- [x] LLM fires in parser_plus_llm mode — Task 1 (`forceLlm` param)
- [x] LLM diagnostic correctly recorded — Task 1 (diagnostics merge fix)
- [x] JATS sub-sections counted — Task 2
- [x] Faster fetch (NCBI API key) — Task 3
- [x] Render concurrency — Task 5 (`RENDER_CONCURRENCY=4`)

### Placeholder scan
- No TBD, TODO, or "fill in details" phrases found. All code is complete.

### Type consistency
- `forceLlm?: boolean` added to `ParseUploadInput` in Task 1, used in Task 5 `parseUploadedDocument` call ✓
- `ResultEnvelope` extended with `raw?`, `parsed?`, `truth?` in Task 5 Step 2, used in Task 5 Step 1 ✓
- `FailureLogEntry` defined in Task 4 Step 1, not referenced from other files (self-contained) ✓
- `PipelineStats` defined and used within Task 5 only ✓
- Report service functions exported in Task 4, imported in Task 5 ✓
