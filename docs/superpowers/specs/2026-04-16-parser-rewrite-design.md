# Parser Rewrite Design
**Date:** 2026-04-16
**Status:** Approved

## Problem

The current deterministic parser is unreliable for the primary user workflow — importing a Word or PDF manuscript. Observed failure modes across all three document types (author DOCX, author-exported PDF, journal PDF):

- Text appears as a single giant "Content" block with no section structure
- Sections are detected (headings present) but body content is empty
- Duplicate or misnamed sections created
- References section not extracted
- No figures present after import
- Citations not parsed into individual structured entries

The root causes are:
1. DOCX: Mammoth's HTML output strips Word's authoritative heading metadata (style names, outline levels). We then try to re-infer headings from HTML bold tags — a lossy, fragile approach.
2. PDF: Line grouping tolerance is too tight (±2px), font-height detection unreliable (pdfjs returns height=0 frequently), Form XObjects (the standard figure container in journal PDFs) are never processed.
3. Citations: The reference line parser splits on `.` which immediately corrupts DOIs, author initials, and abbreviated journal names.
4. Confidence gate: Only checks heading count, not whether sections have content — allows empty-body parses to pass as "high confidence".

---

## Architecture

### DOCX Pipeline

**Current flow:**
```
DOCX → Mammoth HTML → regex heading detection → sections
```

**New flow:**
```
DOCX zip
  ├── [Content_Types].xml  → find main document part path
  ├── word/document.xml    → XML walk → heading/body blocks (authoritative)
  ├── word/footnotes.xml   → reference lines
  ├── word/endnotes.xml    → reference lines
  └── word/_rels/[main].rels → figure rel map (fixed path resolution)

Mammoth (parallel) → rich HTML for body paragraph content

Merge: XML walk provides structure, Mammoth provides HTML content
```

**Heading detection from XML (in priority order):**
1. `w:outlineLvl` value 0–3 on any paragraph → heading at that level
2. `w:pStyle` value starts with `Heading` or `heading` (case-insensitive) → heading
3. `w:pStyle` value matches canonical section alias (case-insensitive) → heading
4. ALL-CAPS paragraph ≤60 chars matching a canonical alias → heading (last resort)

This eliminates the style-map dependency entirely. Any Word document, any template, any language — if Word considers it a heading, `w:outlineLvl` will be set.

**Figure extraction fix:**
Read `[Content_Types].xml` to find the actual main document part (may not be `word/document.xml`). Resolve relationship file relative to that part. This handles the OOXML variant where the main part is named differently.

---

### PDF Pipeline

**Three targeted fixes:**

**1. Line grouping tolerance**
Change y-tolerance from ±2px to ±5px. Add x-gap detection: if two items on the same y-band have an x-gap > 3× the average character width of that line, split into separate columns. This handles two-column layouts without merging columns into gibberish.

**2. Font size from transform matrix**
Replace `item.height` (frequently 0) with:
```typescript
const fontSize = Math.sqrt(
  item.transform[0] * item.transform[0] +
  item.transform[1] * item.transform[1]
);
```
This is always available regardless of whether pdfjs populates `height`. Use this value for `medianBodySize` computation and `isLargeFont` heading detection.

**3. Form XObject recursion**
Add handling for `paintXObject` operator list ops. When encountered:
- Call `page.commonObjs.get()` or `page.objs.get()` on the XObject reference
- If the XObject contains `paintImageXObject` or `paintInlineImageXObject` ops, extract those images
- Cap recursion depth at 2 (figures never nest deeper in practice)

This covers the vast majority of figures in Word-exported and LaTeX-exported PDFs, which wrap images in Form XObjects.

---

### Citation Extraction

**Replace sentence-split with format-specific patterns:**

| Format | Pattern |
|---|---|
| Vancouver | Leading `[N]` or `N.`/`N)` marker; authors end before first `. [A-Z][a-z]` that isn't an initial; year as `YYYY;` or `(YYYY)` |
| APA/Harvard | Authors end at `(YYYY).`; title ends at next `. `; journal before volume number |
| Chicago numbered | `N.` prefix; same structure as Vancouver |
| Fallback | Keep raw line as `title`, `authors: ["Unknown"]` — never corrupt |

**Try patterns in order:** Vancouver → APA → Chicago → fallback. DOI regex extraction is unchanged (works correctly today).

**Footnotes/endnotes:** The DOCX XML walk reads `word/footnotes.xml` and `word/endnotes.xml`. Reference-format lines from these files are appended to `references[]` before citation parsing runs.

---

### CrossRef + OpenAlex Enrichment

Runs **async after import completes** — does not block the import response. Patches Supabase citations table directly.

**Strategy by citation state:**

| Citation state | Action |
|---|---|
| DOI present | CrossRef DOI lookup first (authoritative). Fall back to OpenAlex `filter=doi:` if CrossRef returns nothing |
| No DOI, title + author present | Query CrossRef fuzzy search AND OpenAlex fuzzy search in parallel. Accept whichever returns confidence ≥0.80. If both ≥0.80, prefer CrossRef |
| Neither title nor author | Skip enrichment, keep raw line |

OpenAlex requests include `mailto:rishabh.hari@gmail.com` in User-Agent as per their polite pool policy.

Both APIs are free, no key required.

---

### Confidence Scoring & Modal Fallback

**Confidence score (0.0–1.0) computed from four signals after deterministic parse:**

| Signal | Weight | Measurement |
|---|---|---|
| Section count | 30% | ≥5 canonical sections = 1.0; linear below (0 = 0.0) |
| Body coverage | 30% | words in non-Title/non-References named sections ÷ total word count |
| Citation yield | 20% | citations extracted ÷ reference lines found (0 reference lines = neutral 0.5) |
| Figure yield | 20% | figures extracted ÷ figure captions detected (0 captions = neutral 0.5) |

**Empty section penalty:** each canonical section (Abstract, Introduction, Methods, Results, Discussion) with <30 words subtracts 0.10 from the final score, capped at -0.40 total.

**Threshold: 0.85**
- ≥0.85: return deterministic result
- <0.85: call `parseDocumentWithLLM()` (existing Modal endpoint, Qwen3-8B on A10G)

**Merge strategy when Modal fallback runs:**
- Sections: use LLM section for any slot where deterministic section is missing OR body word count <30. Keep deterministic sections where they exist and are populated.
- Citations: union of both sets, deduped by DOI then normalised title.
- Figures: deterministic always wins — LLM cannot extract images.

**LLM result validation:** reject any LLM section with <20 words of content (guards against the LLM producing the same empty-heading problem).

**`parseConfidence: number`** added to `ParsedManuscript` interface. Surfaced to frontend for a subtle "review imported content" indicator. No threshold-based warnings in UI for MVP — just a visible score.

---

## Files Changed

### New files

| File | Purpose |
|---|---|
| `server/services/docx-xml-parse.service.ts` | Word XML walker — reads structure from `document.xml`, footnotes, endnotes. No Mammoth dependency. |
| `server/services/citation-enrich.service.ts` | CrossRef + OpenAlex async enrichment. Patches Supabase citations table. |
| `server/services/parse-confidence.service.ts` | Confidence scoring function. Accepts `ParsedManuscript`, returns `{ score, signals }`. |

### Modified files

| File | Change |
|---|---|
| `server/services/manuscript-parse.service.ts` | DOCX: call XML walker for structure, merge with Mammoth HTML. Fix Content_Types figure path resolution. PDF: fix y-tolerance, font-size from transform matrix, Form XObject recursion. Both: call confidence scorer, trigger Modal fallback if <0.85, merge results. |
| `shared/document-parse.ts` | Add `parseConfidence?: number` to `ParsedManuscript`. Rewrite `parseCitationsFromReferences` with format-specific patterns. Relax `isBoldOnlyHeading` for mixed inline formatting. |
| `server/services/llm.service.ts` | Improve prompt to never produce empty section content. Add post-parse validation rejecting sections with <20 words. |

### Not changed
`parse-error-detection.service.ts`, `citation-format.service.ts`, all routes, all frontend components, all Supabase schema.

---

## Confidence Scoring — Example Scenarios

| Document type | Section count signal | Coverage signal | Score (approx) | Modal triggered? |
|---|---|---|---|---|
| Well-structured DOCX, heading styles | 1.0 | 0.95 | ~0.95 | No |
| DOCX, bold-only headings, good body | 0.8 | 0.85 | ~0.85 | Borderline |
| DOCX, no heading markers, one giant block | 0.2 | 0.1 | ~0.15 | Yes |
| PDF with text layer, detectable headings | 0.8 | 0.80 | ~0.80 | Yes → Modal fixes structure |
| PDF with heading detection, empty bodies | 0.8 | 0.05 | ~0.35 (+ penalties) | Yes |

---

## Verification Checklist

### DOCX
- [ ] Well-structured DOCX with Heading 1/2/3 styles → sections detected, body populated, `parseConfidence` ≥0.90, field present on returned `ParsedManuscript`
- [ ] DOCX with custom journal template styles → `w:outlineLvl` walk detects headings regardless of style name
- [ ] DOCX with bold-only headings → detected via relaxed `isBoldOnlyHeading`
- [ ] DOCX with footnote references → references extracted from `footnotes.xml`
- [ ] DOCX with embedded PNG/JPEG → figures extracted via corrected Content_Types path
- [ ] DOCX with embedded chart → SVG chart rendered (existing behaviour preserved)

### PDF
- [ ] Two-column PDF → columns not merged into gibberish lines
- [ ] PDF with `height=0` text items → `isLargeFont` computed from transform matrix correctly
- [ ] PDF with Form XObject figures → figures extracted (not empty)
- [ ] PDF with clear heading fonts → `isLargeFont` heading detection fires on headings, not body text

### Citations
- [ ] Vancouver-format references → authors/title/journal/year parsed correctly
- [ ] APA-format references → authors/title/journal/year parsed correctly
- [ ] References with DOIs → DOI extracted, CrossRef enrichment fills full record async
- [ ] References without DOIs → OpenAlex fuzzy search enriches where confidence ≥0.80
- [ ] Malformed/unparseable reference line → kept as raw title, `authors: ["Unknown"]`, not corrupted

### Confidence & Modal fallback
- [ ] Well-structured document → `parseConfidence` ≥0.85, Modal not called
- [ ] Document with empty section bodies → `parseConfidence` <0.85 due to penalties, Modal triggered
- [ ] Modal fallback result merged correctly — deterministic sections preserved, LLM fills gaps only
- [ ] LLM sections with <20 words rejected from merge

### Privacy
- [ ] No manuscript text sent to CrossRef or OpenAlex (only DOIs, titles, author names)
- [ ] Modal endpoint only called when confidence <0.85 (not on every import)
