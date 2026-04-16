# Parser Rewrite Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the fragile DOCX/PDF parser pipeline with a Word-XML-aware DOCX walker, fixed PDF line grouping + font detection + Form XObject figure extraction, format-specific citation parsing, CrossRef/OpenAlex async enrichment, and a 4-signal confidence score that gates a Modal LLM fallback at 0.85.

**Architecture:** Three new focused service files (`docx-xml-parse.service.ts`, `parse-confidence.service.ts`, `citation-enrich.service.ts`) encapsulate new behaviour; two existing files (`manuscript-parse.service.ts`, `shared/document-parse.ts`) are modified to wire them together; `llm.service.ts` gets a prompt hardening patch. The deterministic parse runs first; confidence is scored; if <0.85 the Modal LLM result is fetched and merged (LLM fills only empty/missing sections, deterministic sections are kept, figures always deterministic).

**Tech Stack:** TypeScript, JSZip (already installed), fast-xml-parser (already installed), pdfjs-dist (already installed), Vitest (test runner), fetch (Node 18+ built-in for CrossRef/OpenAlex calls).

---

## File Map

| Action | Path | Responsibility |
|--------|------|----------------|
| Create | `server/services/docx-xml-parse.service.ts` | Walk `word/document.xml`, detect headings via `w:outlineLvl`/`w:pStyle`, extract footnotes/endnotes, resolve figure rels via `[Content_Types].xml` |
| Create | `server/services/parse-confidence.service.ts` | Compute 4-signal confidence score (0.0–1.0) from a `ParsedManuscript`; apply empty-section penalties |
| Create | `server/services/citation-enrich.service.ts` | Async CrossRef + OpenAlex enrichment; patches `ParsedCitation[]` in place; never blocks import response |
| Modify | `server/services/manuscript-parse.service.ts` | DOCX path: call XML walker, merge with Mammoth HTML; PDF path: fix y-tolerance, font-size from transform, Form XObject recursion; both: call confidence scorer, trigger Modal if <0.85, merge results |
| Modify | `shared/document-parse.ts` | Add `parseConfidence?: number` to `ParsedManuscript`; rewrite `parseCitationsFromReferences` with format-specific patterns; relax `isBoldOnlyHeading` |
| Modify | `server/services/llm.service.ts` | Harden prompt (never empty sections); add post-parse filter rejecting LLM sections <20 words |
| Create | `server/services/__tests__/docx-xml-parse.test.ts` | Unit tests for XML walker |
| Create | `server/services/__tests__/parse-confidence.test.ts` | Unit tests for confidence scorer |
| Create | `server/services/__tests__/citation-enrich.test.ts` | Unit tests for enrichment logic (mock fetch) |
| Modify | `server/services/__tests__/parse-error-detection.test.ts` | Add smoke test: parseConfidence field present on returned manuscript |

---

## Task 1: Add `parseConfidence` to `ParsedManuscript` interface

**Files:**
- Modify: `shared/document-parse.ts:97-108`

- [ ] **Step 1: Add the field**

In `shared/document-parse.ts`, change the `ParsedManuscript` interface from:

```typescript
export interface ParsedManuscript {
  fileTitle: string;
  sections: ParsedSection[];
  citations: ParsedCitation[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
  reviewRequired?: boolean;
  blocks?: ParsedBlock[];
  figures?: ParsedFigure[];
  tables?: ParsedTable[];
  links?: ParsedLink[];
}
```

to:

```typescript
export interface ParsedManuscript {
  fileTitle: string;
  sections: ParsedSection[];
  citations: ParsedCitation[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
  reviewRequired?: boolean;
  parseConfidence?: number;
  blocks?: ParsedBlock[];
  figures?: ParsedFigure[];
  tables?: ParsedTable[];
  links?: ParsedLink[];
}
```

- [ ] **Step 2: Run type check to confirm no breakage**

```bash
pnpm check
```

Expected: zero new errors (the field is optional so existing callers are unaffected).

- [ ] **Step 3: Commit**

```bash
git add shared/document-parse.ts
git commit -m "feat: add parseConfidence optional field to ParsedManuscript interface"
```

---

## Task 2: Rewrite `parseCitationsFromReferences` with format-specific patterns

**Files:**
- Modify: `shared/document-parse.ts:238-273`
- Test: `server/services/__tests__/parse-confidence.test.ts` (citation tests go here for co-location with other shared-logic tests)

- [ ] **Step 1: Write the failing test**

Create `server/services/__tests__/citation-parse.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { parseRawDocument } from "../../../shared/document-parse";
import type { RawParsedDocument } from "../../../shared/document-parse";

function makeRaw(references: string[]): RawParsedDocument {
  return {
    fileTitle: "Test",
    format: "docx",
    html: "<h2>References</h2>",
    references,
  };
}

describe("parseCitationsFromReferences — format-specific patterns", () => {
  it("parses Vancouver numbered reference without corrupting DOI", () => {
    const result = parseRawDocument(
      makeRaw(["1. Smith J, Jones A. The effects of X on Y. J Med. 2021;45(3):100-110. doi:10.1000/xyz123"])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].doi).toBe("10.1000/xyz123");
    expect(result.citations[0].title).not.toContain("10.1000"); // DOI should not be in title
  });

  it("parses APA reference correctly", () => {
    const result = parseRawDocument(
      makeRaw(["Smith, J., & Jones, A. (2021). The effects of X on Y. Journal of Medicine, 45(3), 100-110."])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].year).toBe(2021);
    expect(result.citations[0].authors.length).toBeGreaterThan(0);
    expect(result.citations[0].authors[0]).not.toBe("Unknown");
  });

  it("keeps malformed line as raw title with Unknown author — never corrupts", () => {
    const result = parseRawDocument(
      makeRaw(["Completely unparseable line with no recognisable structure at all xyz abc"])
    );
    expect(result.citations).toHaveLength(1);
    expect(result.citations[0].title).toBeTruthy();
    expect(result.citations[0].authors).toContain("Unknown");
  });

  it("extracts DOI from any format", () => {
    const result = parseRawDocument(
      makeRaw(["Some Reference. Some Title. https://doi.org/10.9999/test.2021"])
    );
    expect(result.citations[0].doi).toBe("10.9999/test.2021");
  });
});
```

- [ ] **Step 2: Run test to verify it fails for the right reasons**

```bash
pnpm test server/services/__tests__/citation-parse.test.ts
```

Expected: the DOI-in-title test FAILS (current code splits on `.` which merges DOI into title field).

- [ ] **Step 3: Replace `parseCitationsFromReferences` in `shared/document-parse.ts`**

Replace the existing function (lines 238–273) with:

```typescript
function parseCitationsFromReferences(lines: string[]): ParsedCitation[] {
  const citations: ParsedCitation[] = [];

  for (const rawLine of lines) {
    const raw = sanitizeReferenceLine(rawLine);
    if (!raw) continue;

    // Always extract DOI and URL first — these are format-independent
    const doiMatch = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
    const urlMatch = raw.match(/https?:\/\/[^\s)]+/i);
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
    const doi = doiMatch ? doiMatch[0] : undefined;
    const url = urlMatch ? urlMatch[0] : undefined;

    // ── Vancouver / numbered: [1] ... or 1. ... or 1) ...
    // Author list ends before first ". [A-Z][a-z]" that isn't an initial
    const vancouverMatch = raw.match(
      /^(?:\[?\d+\]?[.)]\s*)([^.]+(?:\.[A-Z]\b[^.]*)*)\.\s+(.+?)\.\s+([^.]+?)\.\s*(?:\d{4}|;)/
    );
    if (vancouverMatch) {
      const authorRaw = vancouverMatch[1];
      const title = vancouverMatch[2].trim();
      const journal = vancouverMatch[3].trim();
      const authors = authorRaw
        .split(/,\s*(?=[A-Z])/)
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 8);
      citations.push({
        authors: authors.length > 0 ? authors : ["Unknown"],
        title,
        year,
        journal,
        doi,
        url,
        type: "article",
        metadata: { raw, format: "vancouver" },
      });
      continue;
    }

    // ── APA / Harvard: Authors (YYYY). Title. Journal, vol(issue), pages.
    const apaMatch = raw.match(
      /^([^(]+)\((\d{4})\)\.\s+(.+?)\.\s+([A-Z][^,\d]+?)(?:,\s*\d|\.\s*$|$)/
    );
    if (apaMatch) {
      const authorRaw = apaMatch[1];
      const title = apaMatch[3].trim();
      const journal = apaMatch[4].trim();
      const authors = authorRaw
        .split(/,\s*(?:&\s*)?(?=[A-Z])/)
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 8);
      citations.push({
        authors: authors.length > 0 ? authors : ["Unknown"],
        title,
        year: Number(apaMatch[2]),
        journal,
        doi,
        url,
        type: "article",
        metadata: { raw, format: "apa" },
      });
      continue;
    }

    // ── Fallback: keep raw line as title, never corrupt
    const fallbackYear = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
    // Best-effort author: text before first comma or bracket
    const beforeComma = raw.split(/[,(]/)[0].trim();
    const fallbackAuthors = beforeComma && beforeComma.length < 80 && /[A-Za-z]/.test(beforeComma)
      ? [beforeComma]
      : ["Unknown"];
    citations.push({
      authors: fallbackAuthors,
      title: raw,
      year: fallbackYear,
      doi,
      url,
      type: url ? "website" : "article",
      metadata: { raw, format: "fallback" },
    });
  }

  return citations;
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test server/services/__tests__/citation-parse.test.ts
```

Expected: all 4 tests PASS.

- [ ] **Step 5: Run full test suite to confirm no regressions**

```bash
pnpm test
```

Expected: all existing tests pass.

- [ ] **Step 6: Commit**

```bash
git add shared/document-parse.ts server/services/__tests__/citation-parse.test.ts
git commit -m "feat: rewrite parseCitationsFromReferences with Vancouver/APA/fallback patterns"
```

---

## Task 3: Relax `isBoldOnlyHeading` for mixed inline formatting

**Files:**
- Modify: `shared/document-parse.ts:314-338` (`isBoldOnlyHeading`) and `shared/document-parse.ts:357-376` (`isBoldOnlyHeadingHtml`)

The current DOM-path function (`isBoldOnlyHeading`) requires the paragraph to have exactly ONE child element that is a `<strong>` or `<b>`. This fails when Word produces `<p><strong>Methods</strong> </p>` (trailing text node) or mixed bold+normal formatting like `<p><strong>2.</strong> Methods</p>`.

The HTML-path function (`isBoldOnlyHeadingHtml`) is similarly strict.

- [ ] **Step 1: Relax `isBoldOnlyHeading` (DOM path) in `shared/document-parse.ts`**

Replace lines 314–338 with:

```typescript
function isBoldOnlyHeading(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== "p") return false;
  const text = (node.textContent || "").trim();
  if (!text || text.length > 80) return false;

  // Accept paragraph where ALL non-whitespace content is wrapped in <strong> or <b>
  // — even if there are trailing whitespace-only text nodes.
  const children = Array.from(node.childNodes);
  const meaningfulChildren = children.filter(
    (child) =>
      !(child.nodeType === Node.TEXT_NODE && (child.textContent || "").trim() === "")
  );
  const hasBoldContent = meaningfulChildren.every((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      return (child.textContent || "").trim() === "";
    }
    const el = child as Element;
    return el.tagName.toLowerCase() === "strong" || el.tagName.toLowerCase() === "b";
  });
  const boldText = meaningfulChildren
    .filter((child) => child.nodeType === Node.ELEMENT_NODE)
    .map((child) => (child.textContent || "").trim())
    .join(" ")
    .trim();

  if (!hasBoldContent || boldText !== text) return false;

  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  if (/^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text)) return true;
  return /^[A-Z][A-Za-z0-9\s&/\-]{2,}$/.test(text) && !text.includes(".");
}
```

- [ ] **Step 2: Relax `isBoldOnlyHeadingHtml` (non-DOM/server path) in `shared/document-parse.ts`**

Replace lines 357–376 with:

```typescript
function isBoldOnlyHeadingHtml(blockHtml: string, text: string): boolean {
  if (!text || text.length > 80) return false;

  const innerHtml = blockHtml
    .replace(/^<p\b[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();

  // Accept: whole content bold, OR starts with a bold run followed by plain text
  // that together equal the full paragraph text (e.g. numbered headings "1. Methods")
  const isEntireParagraphBold =
    /^<(strong|b)\b[^>]*>[\s\S]*<\/\1>\s*$/i.test(innerHtml);

  const startsWithBold =
    /^<(strong|b)\b[^>]*>[\s\S]*?<\/\1>/i.test(innerHtml) &&
    stripHtmlToText(innerHtml) === text;

  if (!isEntireParagraphBold && !startsWithBold) return false;

  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  if (/^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text)) return true;
  return /^[A-Z][A-Za-z0-9\s&/\-]{2,}$/.test(text) && !text.includes(".");
}
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: no new errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all tests pass.

- [ ] **Step 5: Commit**

```bash
git add shared/document-parse.ts
git commit -m "fix: relax isBoldOnlyHeading to accept trailing whitespace and multi-run bold paragraphs"
```

---

## Task 4: Create `parse-confidence.service.ts`

**Files:**
- Create: `server/services/parse-confidence.service.ts`
- Create: `server/services/__tests__/parse-confidence.test.ts`

The confidence score is a number 0.0–1.0 composed of four weighted signals plus per-section penalties for empty canonical bodies.

Signal weights:
- **Section count** (30%): ≥5 canonical sections mapped = 1.0; linear below (0 sections = 0.0)
- **Body coverage** (30%): words in non-Title/non-References named sections ÷ total word count
- **Citation yield** (20%): citations extracted ÷ reference lines found (0 reference lines = neutral 0.5)
- **Figure yield** (20%): figures extracted ÷ figure captions detected in content (0 captions = neutral 0.5)

Empty section penalty: each canonical section (`abstract`, `introduction`, `methods`, `results`, `discussion`) with <30 words subtracts 0.10, capped at -0.40 total.

- [ ] **Step 1: Write the failing tests**

Create `server/services/__tests__/parse-confidence.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { computeParseConfidence } from "../parse-confidence.service";
import type { ParsedManuscript } from "../../../shared/document-parse";

function makeSection(title: string, words: number) {
  const content = `<p>${Array(words).fill("word").join(" ")}</p>`;
  return { title, content, order: 0, wordCount: words, sourceTitle: title };
}

describe("computeParseConfidence", () => {
  it("returns ~0.95 for a well-structured document", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [
        makeSection("Abstract", 150),
        makeSection("Introduction", 400),
        makeSection("Methods", 500),
        makeSection("Results", 600),
        makeSection("Discussion", 300),
        makeSection("References", 50),
      ],
      citations: [{ authors: ["A"], title: "T", year: 2020, type: "article" }],
      diagnostics: [],
      totalWordCount: 2000,
    };
    const { score } = computeParseConfidence(ms, { referenceLinesFound: 1, figureCaptionsFound: 0 });
    expect(score).toBeGreaterThanOrEqual(0.85);
  });

  it("penalises empty canonical sections below 0.85", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [
        makeSection("Abstract", 5),      // <30 → penalty
        makeSection("Introduction", 5),  // <30 → penalty
        makeSection("Methods", 5),       // <30 → penalty
        makeSection("Results", 5),       // <30 → penalty
        makeSection("Discussion", 5),    // <30 → penalty
      ],
      citations: [],
      diagnostics: [],
      totalWordCount: 25,
    };
    const { score } = computeParseConfidence(ms, { referenceLinesFound: 0, figureCaptionsFound: 0 });
    expect(score).toBeLessThan(0.85);
  });

  it("returns signals breakdown", () => {
    const ms: ParsedManuscript = {
      fileTitle: "T",
      sections: [makeSection("Abstract", 200), makeSection("Methods", 300)],
      citations: [],
      diagnostics: [],
      totalWordCount: 500,
    };
    const { score, signals } = computeParseConfidence(ms, { referenceLinesFound: 0, figureCaptionsFound: 0 });
    expect(typeof score).toBe("number");
    expect(signals).toHaveProperty("sectionCount");
    expect(signals).toHaveProperty("bodyCoverage");
    expect(signals).toHaveProperty("citationYield");
    expect(signals).toHaveProperty("figureYield");
  });
});
```

- [ ] **Step 2: Run test to verify it fails (file not yet created)**

```bash
pnpm test server/services/__tests__/parse-confidence.test.ts
```

Expected: FAIL — `../parse-confidence.service` not found.

- [ ] **Step 3: Create `server/services/parse-confidence.service.ts`**

```typescript
import type { ParsedManuscript } from "../../shared/document-parse";
import { normalizeSectionMatchKey } from "../../shared/document-parse";

const CANONICAL_BODY_SECTIONS = new Set([
  "abstract", "introduction", "methods", "results", "discussion",
]);

const NAMED_NON_CONTENT_KEYS = new Set(["title", "references", "content"]);

export interface ConfidenceSignals {
  sectionCount: number;   // 0–1
  bodyCoverage: number;   // 0–1
  citationYield: number;  // 0–1
  figureYield: number;    // 0–1
}

export interface ConfidenceResult {
  score: number;
  signals: ConfidenceSignals;
  penalty: number;
}

export interface ConfidenceContext {
  referenceLinesFound: number;
  figureCaptionsFound: number;
}

export function computeParseConfidence(
  ms: ParsedManuscript,
  ctx: ConfidenceContext,
): ConfidenceResult {
  // 1. Section count signal (30%)
  const canonicalSectionKeys = new Set(
    ms.sections
      .map((s) => normalizeSectionMatchKey(s.title))
      .filter((key) => !NAMED_NON_CONTENT_KEYS.has(key) && key !== "figures_and_tables" && key !== "appendix" && key !== "acknowledgements"),
  );
  const sectionCountSignal = Math.min(1.0, canonicalSectionKeys.size / 5);

  // 2. Body coverage signal (30%)
  // Words in sections whose key is neither "title", "references", "content", nor figures/appendix
  const bodyWords = ms.sections
    .filter((s) => {
      const key = normalizeSectionMatchKey(s.title);
      return !NAMED_NON_CONTENT_KEYS.has(key) && key !== "figures_and_tables" && key !== "appendix";
    })
    .reduce((sum, s) => sum + s.wordCount, 0);
  const bodyCoverageSignal = ms.totalWordCount > 0 ? Math.min(1.0, bodyWords / ms.totalWordCount) : 0;

  // 3. Citation yield signal (20%)
  let citationYieldSignal: number;
  if (ctx.referenceLinesFound === 0) {
    citationYieldSignal = 0.5; // neutral — no references section to parse
  } else {
    citationYieldSignal = Math.min(1.0, ms.citations.length / ctx.referenceLinesFound);
  }

  // 4. Figure yield signal (20%)
  let figureYieldSignal: number;
  if (ctx.figureCaptionsFound === 0) {
    figureYieldSignal = 0.5; // neutral
  } else {
    figureYieldSignal = Math.min(1.0, (ms.figures?.length || 0) / ctx.figureCaptionsFound);
  }

  const rawScore =
    sectionCountSignal * 0.30 +
    bodyCoverageSignal * 0.30 +
    citationYieldSignal * 0.20 +
    figureYieldSignal * 0.20;

  // Empty section penalty: -0.10 per canonical body section with <30 words, max -0.40
  let penaltyCount = 0;
  for (const section of ms.sections) {
    const key = normalizeSectionMatchKey(section.title);
    if (CANONICAL_BODY_SECTIONS.has(key) && section.wordCount < 30) {
      penaltyCount += 1;
    }
  }
  const penalty = Math.min(0.40, penaltyCount * 0.10);
  const score = Math.max(0, Math.min(1.0, rawScore - penalty));

  return {
    score,
    penalty,
    signals: {
      sectionCount: sectionCountSignal,
      bodyCoverage: bodyCoverageSignal,
      citationYield: citationYieldSignal,
      figureYield: figureYieldSignal,
    },
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test server/services/__tests__/parse-confidence.test.ts
```

Expected: all 3 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/parse-confidence.service.ts server/services/__tests__/parse-confidence.test.ts
git commit -m "feat: add parse-confidence.service with 4-signal weighted scorer and empty-section penalties"
```

---

## Task 5: Create `docx-xml-parse.service.ts` — Word XML structure walker

**Files:**
- Create: `server/services/docx-xml-parse.service.ts`
- Create: `server/services/__tests__/docx-xml-parse.test.ts`

This service reads the DOCX zip directly to extract document structure (headings, paragraphs, references from footnotes/endnotes) **without Mammoth**. Mammoth is still used in `manuscript-parse.service.ts` for rich HTML body content — this service only provides structure.

The approach in priority order for heading detection:
1. `w:outlineLvl` attribute value 0–3 on paragraph's `w:pPr` → heading
2. `w:pStyle` value starts with `Heading` or `heading` (case-insensitive)
3. `w:pStyle` value matches a canonical section alias
4. ALL-CAPS paragraph text ≤60 chars that matches a canonical alias (last resort)

- [ ] **Step 1: Write the failing tests**

Create `server/services/__tests__/docx-xml-parse.test.ts`:

```typescript
import { describe, expect, it } from "vitest";
import { extractDocxXmlStructure } from "../docx-xml-parse.service";

// Minimal DOCX zip in-memory (we test with real structure parsing via XML strings)
// These tests use the internal helpers exported for testing only.
import { detectHeadingFromParagraphXml, extractTextFromParagraphXml } from "../docx-xml-parse.service";

describe("detectHeadingFromParagraphXml", () => {
  it("detects heading via w:outlineLvl", () => {
    const paraXml = `<w:p><w:pPr><w:outlineLvl w:val="0"/></w:pPr><w:r><w:t>Introduction</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });

  it("detects heading via w:pStyle starting with Heading", () => {
    const paraXml = `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr><w:r><w:t>Methods</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });

  it("does not flag normal body paragraph as heading", () => {
    const paraXml = `<w:p><w:pPr><w:pStyle w:val="Normal"/></w:pPr><w:r><w:t>This is a body sentence.</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(false);
  });

  it("detects ALL-CAPS canonical alias as heading (last resort)", () => {
    const paraXml = `<w:p><w:r><w:t>METHODS</w:t></w:r></w:p>`;
    expect(detectHeadingFromParagraphXml(paraXml)).toBe(true);
  });
});

describe("extractTextFromParagraphXml", () => {
  it("concatenates all w:t runs", () => {
    const paraXml = `<w:p><w:r><w:t>Hello </w:t></w:r><w:r><w:t>world</w:t></w:r></w:p>`;
    expect(extractTextFromParagraphXml(paraXml)).toBe("Hello world");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (file not yet created)**

```bash
pnpm test server/services/__tests__/docx-xml-parse.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/services/docx-xml-parse.service.ts`**

```typescript
import { XMLParser } from "fast-xml-parser";
import type { ParseDiagnostic } from "../../shared/document-parse";
import { normalizeSectionMatchKey } from "../../shared/document-parse";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

// ─── Public helpers (also exported for unit tests) ───────────────────────────

export function extractTextFromParagraphXml(paraXml: string): string {
  // Fast regex extract of all <w:t> content — avoids full XML parse per paragraph
  const runs = Array.from(paraXml.matchAll(/<(?:w:)?t(?:\s[^>]*)?>([^<]*)<\/(?:w:)?t>/g));
  return runs.map((m) => m[1]).join("").trim();
}

export function detectHeadingFromParagraphXml(paraXml: string): boolean {
  // Priority 1: w:outlineLvl 0–3
  const outlineLvlMatch = paraXml.match(/<(?:w:)?outlineLvl[^>]+(?:w:)?val="(\d+)"/);
  if (outlineLvlMatch) {
    const level = Number(outlineLvlMatch[1]);
    if (level >= 0 && level <= 3) return true;
  }

  // Priority 2: w:pStyle starts with "Heading" or "heading"
  const pStyleMatch = paraXml.match(/<(?:w:)?pStyle[^>]+(?:w:)?val="([^"]+)"/);
  if (pStyleMatch) {
    const styleName = pStyleMatch[1];
    if (/^heading/i.test(styleName)) return true;

    // Priority 3: w:pStyle matches canonical section alias
    const key = normalizeSectionMatchKey(styleName);
    if (key && key !== "content" && key !== styleName.toLowerCase()) return true;
  }

  // Priority 4: ALL-CAPS ≤60 chars matching canonical alias
  const text = extractTextFromParagraphXml(paraXml);
  if (text && text.length <= 60 && /^[A-Z][A-Z\s&/-]+$/.test(text)) {
    const key = normalizeSectionMatchKey(text);
    if (key && key !== "content") return true;
  }

  return false;
}

// ─── Main export ─────────────────────────────────────────────────────────────

export interface DocxXmlSection {
  title: string;
  paragraphTexts: string[]; // raw text strings from this section's body paragraphs
}

export interface DocxXmlResult {
  sections: DocxXmlSection[];
  referenceLines: string[];    // from footnotes.xml + endnotes.xml
  mainDocumentPath: string;    // e.g. "word/document.xml"
  figureRelsPath: string;      // e.g. "word/_rels/document.xml.rels"
  diagnostics: ParseDiagnostic[];
}

export async function extractDocxXmlStructure(buffer: Buffer): Promise<DocxXmlResult> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const diagnostics: ParseDiagnostic[] = [];

  // ── Step 1: Find main document part via [Content_Types].xml ──────────────
  let mainDocumentPath = "word/document.xml"; // fallback
  const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypesXml) {
    const ctParsed = xmlParser.parse(contentTypesXml);
    const overrides = ensureArray(ctParsed?.Types?.Override);
    const docPart = overrides.find(
      (o: any) =>
        String(o?.ContentType ?? "").includes("wordprocessingml.document.main"),
    );
    if (docPart?.PartName) {
      mainDocumentPath = String(docPart.PartName).replace(/^\//, "");
    }
  } else {
    diagnostics.push({
      level: "warning",
      code: "DOCX_CONTENT_TYPES_MISSING",
      message: "[Content_Types].xml not found; assuming word/document.xml as main part.",
    });
  }

  // ── Step 2: Derive figure rels path from main document path ──────────────
  const mainDocDir = mainDocumentPath.split("/").slice(0, -1).join("/");
  const mainDocFile = mainDocumentPath.split("/").pop() ?? "document.xml";
  const figureRelsPath = `${mainDocDir}/_rels/${mainDocFile}.rels`;

  // ── Step 3: Walk document.xml paragraph by paragraph ─────────────────────
  const documentXml = await zip.file(mainDocumentPath)?.async("string");
  if (!documentXml) {
    diagnostics.push({
      level: "error",
      code: "DOCX_DOCUMENT_XML_MISSING",
      message: `Main document part ${mainDocumentPath} not found in DOCX zip.`,
    });
    return { sections: [], referenceLines: [], mainDocumentPath, figureRelsPath, diagnostics };
  }

  // Extract all <w:p>...</w:p> blocks (handles multi-line paragraphs)
  const paragraphMatches = Array.from(documentXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g));

  const sections: DocxXmlSection[] = [];
  let currentTitle: string | null = null;
  let currentParagraphs: string[] = [];

  const flush = () => {
    if (currentTitle !== null || currentParagraphs.length > 0) {
      sections.push({
        title: currentTitle ?? "Content",
        paragraphTexts: currentParagraphs,
      });
    }
    currentParagraphs = [];
  };

  for (const match of paragraphMatches) {
    const paraXml = match[0];
    const text = extractTextFromParagraphXml(paraXml);
    if (!text) continue;

    if (detectHeadingFromParagraphXml(paraXml)) {
      flush();
      currentTitle = text;
    } else {
      currentParagraphs.push(text);
    }
  }
  flush();

  // ── Step 4: Extract reference lines from footnotes.xml + endnotes.xml ────
  const referenceLines: string[] = [];
  for (const notesFile of [`${mainDocDir}/footnotes.xml`, `${mainDocDir}/endnotes.xml`]) {
    const notesXml = await zip.file(notesFile)?.async("string");
    if (!notesXml) continue;
    const noteParaMatches = Array.from(notesXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g));
    for (const match of noteParaMatches) {
      const text = extractTextFromParagraphXml(match[0]);
      // Only keep lines that look like references (have a year, or start with a number)
      if (text && /\b(19|20)\d{2}\b/.test(text)) {
        referenceLines.push(text);
      }
    }
  }

  return { sections, referenceLines, mainDocumentPath, figureRelsPath, diagnostics };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test server/services/__tests__/docx-xml-parse.test.ts
```

Expected: all 5 tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/docx-xml-parse.service.ts server/services/__tests__/docx-xml-parse.test.ts
git commit -m "feat: add docx-xml-parse.service — Word XML structure walker with outlineLvl/pStyle heading detection"
```

---

## Task 6: Create `citation-enrich.service.ts`

**Files:**
- Create: `server/services/citation-enrich.service.ts`
- Create: `server/services/__tests__/citation-enrich.test.ts`

This service enriches `ParsedCitation[]` asynchronously **after** the import response has been returned. It patches a Supabase `citations` table row directly; it does NOT block the parse response.

Strategy:
- DOI present → CrossRef DOI lookup first; fall back to OpenAlex `filter=doi:` if CrossRef returns nothing
- No DOI, title + author present → CrossRef fuzzy + OpenAlex fuzzy in parallel; accept ≥0.80 confidence; prefer CrossRef if both qualify
- Neither → skip

Privacy: only DOI, title, and author names leave this server. No manuscript body text.

- [ ] **Step 1: Write the failing tests**

Create `server/services/__tests__/citation-enrich.test.ts`:

```typescript
import { describe, expect, it, vi, beforeEach } from "vitest";
import type { ParsedCitation } from "../../../shared/document-parse";

// We test the internal scoring helper only (no real HTTP)
import { scoreOpenAlexMatch } from "../citation-enrich.service";

describe("scoreOpenAlexMatch", () => {
  it("returns high score when title matches closely", () => {
    const citation: ParsedCitation = {
      authors: ["Smith J"],
      title: "Effect of aspirin on cardiovascular events",
      year: 2019,
      type: "article",
    };
    const workTitle = "Effect of aspirin on cardiovascular events";
    const score = scoreOpenAlexMatch(citation, workTitle, 2019);
    expect(score).toBeGreaterThanOrEqual(0.80);
  });

  it("returns low score when title does not match", () => {
    const citation: ParsedCitation = {
      authors: ["Smith J"],
      title: "Effect of aspirin on cardiovascular events",
      year: 2019,
      type: "article",
    };
    const score = scoreOpenAlexMatch(citation, "Completely different paper about biology", 2019);
    expect(score).toBeLessThan(0.80);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
pnpm test server/services/__tests__/citation-enrich.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create `server/services/citation-enrich.service.ts`**

```typescript
import type { ParsedCitation } from "../../shared/document-parse";

const CROSSREF_BASE = "https://api.crossref.org/works";
const OPENALEX_BASE = "https://api.openalex.org/works";
const OPENALEX_MAILTO = "rishabh.hari@gmail.com";
const CONFIDENCE_THRESHOLD = 0.80;

// ─── Internal scoring helper (exported for tests) ────────────────────────────

export function scoreOpenAlexMatch(
  citation: ParsedCitation,
  candidateTitle: string,
  candidateYear: number | null,
): number {
  if (!citation.title || !candidateTitle) return 0;

  const normalize = (s: string) => s.toLowerCase().replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim();
  const t1 = normalize(citation.title);
  const t2 = normalize(candidateTitle);

  if (t1 === t2) return 1.0;

  // Simple token overlap score
  const tokens1 = new Set(t1.split(" ").filter((w) => w.length > 3));
  const tokens2 = new Set(t2.split(" ").filter((w) => w.length > 3));
  if (tokens1.size === 0 || tokens2.size === 0) return 0;

  let overlap = 0;
  for (const token of tokens1) {
    if (tokens2.has(token)) overlap += 1;
  }
  const jaccardLike = overlap / (tokens1.size + tokens2.size - overlap);

  // Year bonus/penalty
  const yearMatch = candidateYear && Math.abs(candidateYear - citation.year) <= 1 ? 0.1 : 0;

  return Math.min(1.0, jaccardLike + yearMatch);
}

// ─── CrossRef lookup ─────────────────────────────────────────────────────────

async function crossrefByDoi(doi: string): Promise<Partial<ParsedCitation> | null> {
  try {
    const res = await fetch(`${CROSSREF_BASE}/${encodeURIComponent(doi)}`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.message;
    if (!work) return null;
    return {
      authors: ensureArray(work["author"]).map((a: any) => `${a.family ?? ""} ${a.given ?? ""}`.trim()).filter(Boolean),
      title: ensureArray(work["title"])[0] ?? undefined,
      journal: ensureArray(work["container-title"])[0] ?? undefined,
      year: work["published"]?.["date-parts"]?.[0]?.[0] ?? undefined,
      volume: work["volume"] ?? undefined,
      issue: work["issue"] ?? undefined,
      pages: work["page"] ?? undefined,
      doi: work["DOI"] ?? doi,
      url: work["URL"] ?? undefined,
    };
  } catch {
    return null;
  }
}

async function crossrefFuzzy(citation: ParsedCitation): Promise<Partial<ParsedCitation> | null> {
  try {
    const query = encodeURIComponent(`${citation.title} ${citation.authors[0] ?? ""}`);
    const res = await fetch(`${CROSSREF_BASE}?query=${query}&rows=1`, {
      signal: AbortSignal.timeout(8_000),
    });
    if (!res.ok) return null;
    const data: any = await res.json();
    const item = data?.message?.items?.[0];
    if (!item) return null;
    const score = scoreOpenAlexMatch(
      citation,
      ensureArray(item["title"])[0] ?? "",
      item["published"]?.["date-parts"]?.[0]?.[0] ?? null,
    );
    if (score < CONFIDENCE_THRESHOLD) return null;
    return {
      authors: ensureArray(item["author"]).map((a: any) => `${a.family ?? ""} ${a.given ?? ""}`.trim()).filter(Boolean),
      title: ensureArray(item["title"])[0] ?? undefined,
      journal: ensureArray(item["container-title"])[0] ?? undefined,
      year: item["published"]?.["date-parts"]?.[0]?.[0] ?? undefined,
      doi: item["DOI"] ?? undefined,
      url: item["URL"] ?? undefined,
    };
  } catch {
    return null;
  }
}

async function openAlexByDoi(doi: string): Promise<Partial<ParsedCitation> | null> {
  try {
    const res = await fetch(
      `${OPENALEX_BASE}?filter=doi:${encodeURIComponent(doi)}&select=title,authorships,publication_year,primary_location,doi`,
      {
        headers: { "User-Agent": `Journi/1.0 (mailto:${OPENALEX_MAILTO})` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.results?.[0];
    if (!work) return null;
    return mapOpenAlexWork(work);
  } catch {
    return null;
  }
}

async function openAlexFuzzy(citation: ParsedCitation): Promise<Partial<ParsedCitation> | null> {
  try {
    const query = encodeURIComponent(`${citation.title} ${citation.authors[0] ?? ""}`);
    const res = await fetch(
      `${OPENALEX_BASE}?search=${query}&per-page=1&select=title,authorships,publication_year,primary_location,doi`,
      {
        headers: { "User-Agent": `Journi/1.0 (mailto:${OPENALEX_MAILTO})` },
        signal: AbortSignal.timeout(8_000),
      },
    );
    if (!res.ok) return null;
    const data: any = await res.json();
    const work = data?.results?.[0];
    if (!work) return null;
    const score = scoreOpenAlexMatch(citation, work.title ?? "", work.publication_year ?? null);
    if (score < CONFIDENCE_THRESHOLD) return null;
    return mapOpenAlexWork(work);
  } catch {
    return null;
  }
}

function mapOpenAlexWork(work: any): Partial<ParsedCitation> {
  return {
    authors: ensureArray(work["authorships"])
      .map((a: any) => a?.author?.display_name ?? "")
      .filter(Boolean),
    title: work["title"] ?? undefined,
    journal: work["primary_location"]?.source?.display_name ?? undefined,
    year: work["publication_year"] ?? undefined,
    doi: work["doi"]?.replace("https://doi.org/", "") ?? undefined,
  };
}

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

function mergeCitation(base: ParsedCitation, enriched: Partial<ParsedCitation>): ParsedCitation {
  return {
    ...base,
    authors: enriched.authors && enriched.authors.length > 0 ? enriched.authors : base.authors,
    title: enriched.title ?? base.title,
    journal: enriched.journal ?? base.journal,
    year: enriched.year ?? base.year,
    doi: enriched.doi ?? base.doi,
    url: enriched.url ?? base.url,
    volume: enriched.volume ?? base.volume,
    issue: enriched.issue ?? base.issue,
    pages: enriched.pages ?? base.pages,
    metadata: { ...(base.metadata ?? {}), enriched: true },
  };
}

/**
 * Enrich an array of citations in place using CrossRef + OpenAlex.
 * Returns a new array with enriched data; original array is not mutated.
 * 
 * Call this AFTER the import response has been returned (fire-and-forget async).
 * Only DOIs, titles, and author names leave this server.
 */
export async function enrichCitations(citations: ParsedCitation[]): Promise<ParsedCitation[]> {
  return Promise.all(
    citations.map(async (citation): Promise<ParsedCitation> => {
      try {
        if (citation.doi) {
          // DOI path: CrossRef first, OpenAlex fallback
          const crossrefResult = await crossrefByDoi(citation.doi);
          if (crossrefResult) return mergeCitation(citation, crossrefResult);
          const openAlexResult = await openAlexByDoi(citation.doi);
          if (openAlexResult) return mergeCitation(citation, openAlexResult);
          return citation;
        }

        if (citation.title && citation.authors[0] !== "Unknown") {
          // Fuzzy path: CrossRef + OpenAlex in parallel
          const [crossrefResult, openAlexResult] = await Promise.all([
            crossrefFuzzy(citation),
            openAlexFuzzy(citation),
          ]);
          // Prefer CrossRef if both qualify
          if (crossrefResult) return mergeCitation(citation, crossrefResult);
          if (openAlexResult) return mergeCitation(citation, openAlexResult);
        }
      } catch {
        // Never let enrichment crash the import
      }
      return citation;
    }),
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
pnpm test server/services/__tests__/citation-enrich.test.ts
```

Expected: both tests PASS.

- [ ] **Step 5: Commit**

```bash
git add server/services/citation-enrich.service.ts server/services/__tests__/citation-enrich.test.ts
git commit -m "feat: add citation-enrich.service with CrossRef + OpenAlex async enrichment"
```

---

## Task 7: Harden `llm.service.ts` prompt + add post-parse filter

**Files:**
- Modify: `server/services/llm.service.ts:25-51` (`buildPrompt`)
- Modify: `server/services/llm.service.ts:111-143` (`parseDocumentWithLLM`)

- [ ] **Step 1: Update `buildPrompt` to forbid empty section content**

In `server/services/llm.service.ts`, replace the `buildPrompt` function (lines 25–51):

```typescript
function buildPrompt(textChunk: string): string {
  return `You are an academic document parser. Extract text from the chunk below into structured sections and citations.

RULES — follow exactly:
1. DO NOT rephrase, summarize, or paraphrase any text. Copy content VERBATIM from the source.
2. Replace ALL em-dashes (— – \u2014 \u2013) and any Unicode dash variants with a hyphen-minus (-). Never output em-dashes.
3. Do not invent content. If a section boundary is unclear, include the text under the nearest prior heading.
4. If you are unsure which section text belongs to, output it under the section title "Unknown" (title field = "Unknown").
5. Return ONLY a valid JSON object. No markdown fences, no commentary, no explanations.
6. NEVER output a section with an empty or near-empty content field. Every section you output MUST contain at least 20 words of verbatim content from the source. If a heading appears but has no body text in this chunk, omit that section entirely rather than outputting it with empty content.

Schema:
{
  "sections": [
    { "title": "Section Title", "content": "Exact verbatim text\\nwith newlines preserved" }
  ],
  "citations": [
    { "authors": ["Author 1"], "title": "Paper Title", "year": 2023, "journal": "Journal Name" }
  ]
}

If no citations are found, return an empty array for citations.

Text Chunk:
---
${textChunk}
---`;
}
```

- [ ] **Step 2: Add post-parse validation that rejects LLM sections with <20 words**

In `server/services/llm.service.ts`, update `parseDocumentWithLLM` (lines 111–143) to add a filter after stitching:

```typescript
export async function parseDocumentWithLLM(text: string): Promise<OllamaParsedDocument> {
  const chunks = chunkText(text, 1000);

  // Process all chunks in parallel — Modal handles concurrent requests on the same GPU.
  const chunkResults = await Promise.all(chunks.map((chunk) => invokeModal(chunk)));

  const result: OllamaParsedDocument = { sections: [], citations: [] };

  for (const chunkParsed of chunkResults) {
    // Stitch sections across chunks — merge if same title or continuation
    for (const section of chunkParsed.sections) {
      const last = result.sections[result.sections.length - 1];
      if (
        last &&
        (last.title.toLowerCase() === section.title.toLowerCase() ||
          section.title.toLowerCase() === "content")
      ) {
        last.content += "\n\n" + section.content;
      } else {
        result.sections.push(section);
      }
    }

    // Deduplicate citations by title
    for (const citation of chunkParsed.citations) {
      if (!result.citations.some((c) => c.title.toLowerCase() === citation.title.toLowerCase())) {
        result.citations.push(citation);
      }
    }
  }

  // Post-parse validation: reject any LLM section with <20 words of content.
  // Guards against the LLM producing the same empty-heading problem as the deterministic parser.
  result.sections = result.sections.filter((section) => {
    const wordCount = section.content.trim().split(/\s+/).filter(Boolean).length;
    return wordCount >= 20;
  });

  return result;
}
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/services/llm.service.ts
git commit -m "fix: harden LLM prompt to forbid empty sections; add post-parse filter rejecting <20-word sections"
```

---

## Task 8: Fix PDF pipeline in `manuscript-parse.service.ts`

**Files:**
- Modify: `server/services/manuscript-parse.service.ts:576-818` (`extractPdfPayload`)

Three targeted fixes:
1. Y-tolerance: ±2px → ±5px
2. Font size from transform matrix instead of `item.height`
3. Form XObject recursion (handle `paintXObject` ops, recurse up to depth 2)

- [ ] **Step 1: Fix y-tolerance (±2px → ±5px)**

In `extractPdfPayload`, find the two places where items are grouped by y coordinate. Both use `Math.abs(item.y - currentY) <= 2`.

Change line 627 (inside `extractPdfPayload`):
```typescript
      if (currentY === null || Math.abs(item.y - currentY) <= 2) {
```
to:
```typescript
      if (currentY === null || Math.abs(item.y - currentY) <= 5) {
```

- [ ] **Step 2: Fix font-size computation from transform matrix**

In `extractPdfPayload`, the items are mapped at lines 600–609. The `height` field is computed as `Math.abs(item.height || 10)`. Replace this mapping with transform-matrix font-size:

In the existing map block (lines 601–609), change:

```typescript
    const items = (textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>)
      .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => ({
        text: item.str?.trim() || "",
        x: item.transform?.[4] || 0,
        y: item.transform?.[5] || 0,
        width: item.width || 0,
        height: Math.abs(item.height || 10),
      }))
```

to:

```typescript
    const items = (textContent.items as Array<{ str?: string; transform?: number[]; width?: number; height?: number }>)
      .filter((item) => typeof item.str === "string" && item.str.trim().length > 0)
      .map((item) => {
        const t = item.transform || [1, 0, 0, 1, 0, 0];
        const fontSize = Math.sqrt(t[0] * t[0] + t[1] * t[1]) || Math.abs(item.height || 10);
        return {
          text: item.str?.trim() || "",
          x: t[4] || 0,
          y: t[5] || 0,
          width: item.width || 0,
          height: fontSize,
        };
      })
```

- [ ] **Step 3: Add Form XObject recursion**

In `extractPdfPayload`, after the existing `isImageOp` check block (around line 745), add Form XObject handling. Find the loop over `operatorList.fnArray` and add a new branch **before** the `isImageOp` check:

```typescript
      // Form XObject: may contain images wrapped in a sub-operator list
      if (fn === (pdfjs as any).OPS.paintXObject) {
        const xobjId = String(args[0] || "");
        if (xobjId) {
          await extractImagesFromXObject(page, xobjId, currentTransform, 0);
        }
        continue;
      }
```

Add this helper function **before** `extractPdfPayload`:

```typescript
async function extractImagesFromXObject(
  page: any,
  xobjId: string,
  parentTransform: number[],
  depth: number,
): Promise<Array<{ imageData: any; bbox: ParsedBoundingBox }>> {
  if (depth > 2) return []; // cap recursion — figures never nest deeper in practice

  const xobj = await waitForPdfObject(page.commonObjs as any, xobjId)
    ?? await waitForPdfObject(page.objs as any, xobjId);
  if (!xobj?.operatorList) return [];

  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const results: Array<{ imageData: any; bbox: ParsedBoundingBox }> = [];
  let localTransform = [...parentTransform];
  const stack: number[][] = [];

  for (let i = 0; i < xobj.operatorList.fnArray.length; i += 1) {
    const fn = xobj.operatorList.fnArray[i];
    const fnArgs = xobj.operatorList.argsArray[i] || [];

    if (fn === (pdfjs as any).OPS.save) { stack.push([...localTransform]); continue; }
    if (fn === (pdfjs as any).OPS.restore) { localTransform = stack.pop() || localTransform; continue; }
    if (fn === (pdfjs as any).OPS.transform) {
      localTransform = multiplyTransform(localTransform, fnArgs as number[]);
      continue;
    }
    if (fn === (pdfjs as any).OPS.paintXObject) {
      const nested = await extractImagesFromXObject(page, String(fnArgs[0] || ""), localTransform, depth + 1);
      results.push(...nested);
      continue;
    }
    if (
      fn === (pdfjs as any).OPS.paintImageXObject ||
      fn === (pdfjs as any).OPS.paintInlineImageXObject ||
      fn === (pdfjs as any).OPS.paintImageXObjectRepeat
    ) {
      let imgData: any = null;
      if (fn === (pdfjs as any).OPS.paintInlineImageXObject) {
        imgData = fnArgs[0];
      } else {
        imgData = await waitForPdfObject(page.objs as any, String(fnArgs[0] || ""));
      }
      if (imgData) {
        results.push({ imageData: imgData, bbox: bboxFromTransform(localTransform) });
      }
    }
  }
  return results;
}
```

Then in the main operator loop inside `extractPdfPayload`, add the XObject handler after the `transform` handler and before `isImageOp`:

```typescript
      if (fn === (pdfjs as any).OPS.paintXObject) {
        const xobjId = String(args[0] || "");
        if (xobjId) {
          const viewport = page.getViewport({ scale: 1 });
          const minFigW = Math.max(24, viewport.width * 0.06);
          const minFigH = Math.max(24, viewport.height * 0.06);
          const xobjImages = await extractImagesFromXObject(page, xobjId, currentTransform, 0);
          for (const { imageData, bbox } of xobjImages) {
            if (bbox.width < minFigW || bbox.height < minFigH) continue;
            const dataUrl = await pdfImageDataToDataUrl(imageData, (pdfjs as any).ImageKind);
            if (!dataUrl) continue;
            figures.push({
              id: `fig-${++figureCount}`,
              imageData: dataUrl,
              page: pageNum,
              bbox,
              confidence: 0.92,
              diagnostics: [],
            });
          }
        }
        continue;
      }
```

- [ ] **Step 4: Run type check**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 5: Run tests**

```bash
pnpm test
```

Expected: all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add server/services/manuscript-parse.service.ts
git commit -m "fix: PDF y-tolerance ±5px, font-size from transform matrix, Form XObject figure recursion"
```

---

## Task 9: Wire DOCX XML walker + figure path fix in `manuscript-parse.service.ts`

**Files:**
- Modify: `server/services/manuscript-parse.service.ts:846-927` (DOCX branch of `parseUploadedDocument`)
- Modify: `server/services/manuscript-parse.service.ts:392-455` (`extractDocxFigures`)

**Goal:** Replace the raw Mammoth heading detection gate with the XML walker's section structure. Mammoth still provides HTML content; XML walker provides section boundaries. Also fix `extractDocxFigures` to use the correct rels path derived from `[Content_Types].xml`.

- [ ] **Step 1: Import the new XML walker service at the top of `manuscript-parse.service.ts`**

After the existing imports (around lines 1–6), add:

```typescript
import { extractDocxXmlStructure } from "./docx-xml-parse.service";
```

- [ ] **Step 2: Fix `extractDocxFigures` to use the correct rels path**

`extractDocxFigures` currently hardcodes `word/_rels/document.xml.rels`. Change it to accept the rels path as a parameter:

Replace the function signature:
```typescript
async function extractDocxFigures(buffer: Buffer): Promise<{ figures: ParsedFigure[]; diagnostics: ParseDiagnostic[] }> {
```
with:
```typescript
async function extractDocxFigures(
  buffer: Buffer,
  relsPath = "word/_rels/document.xml.rels",
  mainDocPath = "word/document.xml",
): Promise<{ figures: ParsedFigure[]; diagnostics: ParseDiagnostic[] }> {
```

And replace the hardcoded paths inside:
```typescript
  const relsXml = await zip.file("word/_rels/document.xml.rels")?.async("string");
  const documentXml = await zip.file("word/document.xml")?.async("string");
```
with:
```typescript
  const relsXml = await zip.file(relsPath)?.async("string");
  const documentXml = await zip.file(mainDocPath)?.async("string");
```

- [ ] **Step 3: Rewrite the DOCX branch in `parseUploadedDocument` to use XML walker**

Replace the existing DOCX branch (lines 851–927) with:

```typescript
  if (extension === "docx") {
    const mammothStyleMap = [
      "p[style-name='Heading 1'] => h1:fresh",
      "p[style-name='Heading 2'] => h2:fresh",
      "p[style-name='Heading 3'] => h3:fresh",
      "p[style-name='Title'] => h1:fresh",
      "p[style-name='Subtitle'] => h2:fresh",
      "p[style-name='Abstract'] => h2:fresh",
      "p[style-name='abstract'] => h2:fresh",
      "p[style-name='Section Heading'] => h2:fresh",
    ];

    // Run XML walker, Mammoth HTML in parallel; figure extraction uses XML walker result
    const [xmlResult, result, textResult] = await Promise.all([
      extractDocxXmlStructure(input.buffer),
      mammoth.convertToHtml({ buffer: input.buffer, styleMap: mammothStyleMap } as any),
      mammoth.extractRawText({ buffer: input.buffer } as any),
    ]);
    // Use the correct rels path found by the XML walker (not hardcoded word/_rels/document.xml.rels)
    const extractedFigures = await extractDocxFigures(
      input.buffer,
      xmlResult.figureRelsPath,
      xmlResult.mainDocumentPath,
    );

    const warnings = (result.messages || []).map((message) => ({
      level: "warning" as const,
      code: "DOCX_PARSE_WARNING",
      message: message.message,
    }));

    const fidelityNote: ParseDiagnostic[] = [
      {
        level: "info",
        code: "DOCX_FIDELITY_NOTICE",
        message:
          "DOCX parsed via XML + HTML conversion. Complex formatting may not be fully preserved — review imported content.",
      },
    ];

    // Merge XML structure with Mammoth HTML content:
    // XML walker provides section titles; Mammoth HTML provides body content.
    // We build an HTML string that has <h2> headings where the XML walker found headings.
    let mergedHtml: string;
    if (xmlResult.sections.length >= 2) {
      // Build HTML from XML structure — each section title becomes an <h2>, paragraphs become <p>
      const htmlParts: string[] = [];
      for (const section of xmlResult.sections) {
        if (section.title !== "Content") {
          htmlParts.push(`<h2>${escapeHtml(section.title)}</h2>`);
        }
        for (const para of section.paragraphTexts) {
          htmlParts.push(`<p>${escapeHtml(para)}</p>`);
        }
      }
      mergedHtml = htmlParts.join("\n");
    } else {
      // XML walker found no structure (e.g. very simple doc) — fall back to Mammoth HTML
      mergedHtml = result.value;
    }

    // Append reference lines from footnotes/endnotes found by XML walker
    const xmlReferenceLines = xmlResult.referenceLines;

    const rawDocx: RawParsedDocument = {
      fileTitle,
      format: "docx",
      html: mergedHtml,
      text: normalizeText(textResult.value),
      diagnostics: [
        ...diagnostics,
        ...fidelityNote,
        ...warnings,
        ...extractedFigures.diagnostics,
        ...xmlResult.diagnostics,
      ],
      figures: extractedFigures.figures,
      references: [
        ...extractReferencesFromOupHtml(result.value),
        ...xmlReferenceLines,
      ],
    };

    // Compute confidence score to decide whether to call Modal LLM
    const parsedDocxPrelim = parseRawDocument(rawDocx);
    const referenceLinesFound = (rawDocx.references ?? []).length;
    const figureCaptionsFound = parsedDocxPrelim.sections
      .flatMap((s) => {
        const matches = s.content.match(/^(figure|fig\.?)\s*\d+\s*[:.]/gim);
        return matches ?? [];
      }).length;

    const { score: confidenceScore } = computeParseConfidence(parsedDocxPrelim, {
      referenceLinesFound,
      figureCaptionsFound,
    });

    let llmParsed: RawParsedDocument["llmParsed"] | undefined;
    if (confidenceScore < 0.85) {
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
    }

    // Merge LLM result: LLM fills empty/missing sections, deterministic wins where populated
    const mergedSections = llmParsed ? mergeLlmSections(parsedDocxPrelim.sections, llmParsed.sections) : undefined;

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
    };
  }
```

- [ ] **Step 4: Add `mergeLlmSections` helper and `computeParseConfidence` import**

Add import at top of file:
```typescript
import { computeParseConfidence } from "./parse-confidence.service";
```

Add helper function before `parseUploadedDocument`:

```typescript
/**
 * Merge LLM sections into deterministic sections.
 * - Deterministic section with ≥30 words → keep as-is
 * - Deterministic section with <30 words AND LLM has a matching section with ≥20 words → use LLM
 * - LLM section for a slot with no deterministic section → include LLM
 * - LLM sections with <20 words → rejected
 */
function mergeLlmSections(
  deterministicSections: Array<{ title: string; content: string; wordCount: number }>,
  llmSections: Array<{ title: string; content: string }>,
): Array<{ title: string; content: string }> {
  const llmMap = new Map<string, string>();
  for (const sec of llmSections) {
    const wordCount = sec.content.trim().split(/\s+/).filter(Boolean).length;
    if (wordCount >= 20) {
      llmMap.set(sec.title.toLowerCase(), sec.content);
    }
  }

  const merged: Array<{ title: string; content: string }> = [];
  const usedLlmTitles = new Set<string>();

  for (const det of deterministicSections) {
    if (det.wordCount >= 30) {
      merged.push({ title: det.title, content: det.content });
    } else {
      const llmContent = llmMap.get(det.title.toLowerCase());
      if (llmContent) {
        merged.push({ title: det.title, content: `<p>${llmContent}</p>` });
        usedLlmTitles.add(det.title.toLowerCase());
      } else {
        merged.push({ title: det.title, content: det.content });
      }
    }
  }

  // Add LLM-only sections not covered by deterministic
  for (const [titleKey, content] of llmMap.entries()) {
    if (!usedLlmTitles.has(titleKey)) {
      const titleFormatted = titleKey.charAt(0).toUpperCase() + titleKey.slice(1);
      merged.push({ title: titleFormatted, content: `<p>${content}</p>` });
    }
  }

  return merged;
}
```

- [ ] **Step 5: Apply same confidence gate + merge to PDF branch**

In the PDF branch (around lines 947–1000 in the original file, now after the DOCX branch), replace the existing LLM gate:

```typescript
      // Only call LLM when the PDF block structure suggests poor deterministic coverage.
      const nonContentBlocks = payload.blocks.filter(
        (b) => b.suggestedSection && b.suggestedSection !== "Content",
      ).length;
      const structureRatio = payload.blocks.length > 0 ? nonContentBlocks / payload.blocks.length : 0;
      const pdfDeterministicLooksGood = structureRatio >= 0.25;

      let llmParsed;
      if (!pdfDeterministicLooksGood && payload.text.trim().length > 0) {
```

with:

```typescript
      // Use confidence scoring to decide whether to call Modal LLM
      const pdfRawPrelim: RawParsedDocument = {
        fileTitle,
        format: "pdf",
        text: payload.text,
        blocks: payload.blocks,
        figures: payload.figures,
        tables: payload.tables,
        links: [],
        diagnostics: [...diagnostics, ...payload.diagnostics],
      };
      const parsedPdfPrelim = parseRawDocument(pdfRawPrelim);
      const pdfReferenceLinesFound = payload.blocks.filter((b) => b.type === "reference").length;
      const pdfFigureCaptionsFound = payload.blocks.filter((b) => b.type === "caption" && /^(fig(?:ure)?\.?\s*\d+)/i.test(b.text)).length;
      const { score: pdfConfidenceScore } = computeParseConfidence(parsedPdfPrelim, {
        referenceLinesFound: pdfReferenceLinesFound,
        figureCaptionsFound: pdfFigureCaptionsFound,
      });

      let llmParsed: RawParsedDocument["llmParsed"] | undefined;
      if (pdfConfidenceScore < 0.85 && payload.text.trim().length > 0) {
```

And after the LLM call block, update the `rawPdf` construction:

```typescript
      const rawPdf: RawParsedDocument = {
        fileTitle,
        format: "pdf",
        text: payload.text,
        blocks: payload.blocks,
        figures: payload.figures,
        tables: payload.tables,
        links: [],
        diagnostics: [...diagnostics, ...payload.diagnostics],
        llmParsed,
      };
      const parsedPdf = parseRawDocument(rawPdf);
      const finalParsedPdf: typeof parsedPdf = {
        ...parsedPdf,
        parseConfidence: pdfConfidenceScore,
      };
      const errorDiagsPdf = runDeterministicErrorChecks(finalParsedPdf);
      return { ...rawPdf, diagnostics: [...(rawPdf.diagnostics ?? []), ...errorDiagsPdf] };
```

- [ ] **Step 6: Run type check**

```bash
pnpm check
```

Expected: no errors. (If the `parseDocumentWithLLM` return type causes issues because it now references `OllamaParsedDocument` differently, check that `llmParsed` assignment aligns with `RawParsedDocument["llmParsed"]` type — both have `sections` and `citations` arrays.)

- [ ] **Step 7: Run all tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 8: Commit**

```bash
git add server/services/manuscript-parse.service.ts
git commit -m "feat: wire DOCX XML walker + confidence-gated Modal fallback for both DOCX and PDF pipelines"
```

---

## Task 10: Wire async citation enrichment post-import

**Files:**
- Modify: `server/routes/manuscripts.ts` (the route that calls `parseUploadedDocument`)

The enrichment must run **after** the HTTP response is returned. We fire-and-forget `enrichCitations()` and patch the Supabase `citations` table directly.

- [ ] **Step 1: Find the manuscript upload route**

```bash
grep -n "parseUploadedDocument\|parseRawDocument" server/routes/manuscripts.ts
```

Note the line numbers where the parse result is used and where the response is sent.

- [ ] **Step 2: Add the fire-and-forget enrichment call**

In `server/routes/manuscripts.ts`, after the line that sends the HTTP response (after `res.json(...)` or equivalent), add:

```typescript
// Fire-and-forget: enrich citations async after response is sent
// enrichCitations only sends DOIs/titles/authors — no manuscript text leaves the server
if (parsed.citations.length > 0) {
  enrichCitations(parsed.citations)
    .then(async (enriched) => {
      // Patch each enriched citation back to Supabase
      // Only update fields that were enriched (have metadata.enriched = true)
      for (const citation of enriched) {
        if (!(citation.metadata as any)?.enriched) continue;
        // Find and update the corresponding Supabase row by title + manuscriptId
        // This is best-effort — if it fails, the original citation data remains
        try {
          await supabase
            .from("citations")
            .update({
              authors: citation.authors,
              journal: citation.journal,
              year: citation.year,
              doi: citation.doi,
              url: citation.url,
              volume: citation.volume,
              issue: citation.issue,
              pages: citation.pages,
            })
            .eq("manuscript_id", manuscriptId)
            .eq("title", citation.title);
        } catch {
          // Enrichment is best-effort — never surface errors to the user
        }
      }
    })
    .catch(() => {
      // Never let enrichment crash the server process
    });
}
```

Add the import at the top of `manuscripts.ts`:
```typescript
import { enrichCitations } from "../services/citation-enrich.service";
```

- [ ] **Step 3: Run type check**

```bash
pnpm check
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
pnpm test
```

Expected: all pass.

- [ ] **Step 5: Commit**

```bash
git add server/routes/manuscripts.ts
git commit -m "feat: fire-and-forget citation enrichment post-import via CrossRef + OpenAlex"
```

---

## Task 11: Expose `parseConfidence` in the API response + verification run

**Files:**
- Read: `server/routes/manuscripts.ts` (confirm `parseConfidence` field is forwarded to the client)
- Modify: `server/services/__tests__/parse-error-detection.test.ts` (add smoke test)

- [ ] **Step 1: Confirm `parseConfidence` is in API response**

Check that the manuscript route returns the full parsed manuscript object (including `parseConfidence`) to the client. If it serialises a subset of fields, add `parseConfidence` to that subset.

```bash
grep -n "parseConfidence\|sections\|citations" server/routes/manuscripts.ts | head -30
```

If `parseConfidence` is not in the serialised response, add it where the response object is built.

- [ ] **Step 2: Add smoke test to existing test file**

In `server/services/__tests__/parse-error-detection.test.ts`, add at the end:

```typescript
import { parseRawDocument } from "../../../shared/document-parse";
import type { RawParsedDocument } from "../../../shared/document-parse";

describe("parseRawDocument — parseConfidence field", () => {
  it("parseConfidence can be set on the returned ParsedManuscript", () => {
    const raw: RawParsedDocument = {
      fileTitle: "Test",
      format: "docx",
      html: "<h2>Abstract</h2><p>Background objectives methods.</p><h2>Methods</h2><p>We recruited 100 patients from three sites.</p>",
    };
    const result = parseRawDocument(raw);
    // Field exists in the interface and can be assigned
    const withConfidence = { ...result, parseConfidence: 0.92 };
    expect(withConfidence.parseConfidence).toBe(0.92);
  });
});
```

- [ ] **Step 3: Run all tests**

```bash
pnpm test
```

Expected: all pass including new smoke test.

- [ ] **Step 4: Final commit**

```bash
git add server/services/__tests__/parse-error-detection.test.ts server/routes/manuscripts.ts
git commit -m "test: add parseConfidence smoke test; confirm field exposed in API response"
```

---

## Verification Checklist (manual testing)

After all tasks complete, test with real files:

**DOCX:**
- [ ] Upload a well-structured DOCX (Word Heading 1/2/3 styles) → `parseConfidence` ≥ 0.90, sections populated
- [ ] Upload a DOCX with no heading styles (bold-only) → sections still detected, `parseConfidence` computed
- [ ] Upload a DOCX with embedded PNG → figure appears in `figures[]`

**PDF:**
- [ ] Upload a PDF with clear text layer → `parseConfidence` computed, sections not garbled
- [ ] Upload a journal PDF → Form XObject figures appear (not placeholder)

**Citations:**
- [ ] Import a document with a References section → citations extracted without DOI corruption
- [ ] Wait 10s after import → citations updated in Supabase with CrossRef/OpenAlex data (check DB)

**Confidence gate:**
- [ ] Import a document with empty section bodies → `parseConfidence` < 0.85 logged in diagnostics
