# Journi LLM Plan — Deterministic-First, Privacy by Default

## The Privacy Problem

The current code sends **verbatim manuscript text** to external APIs. Looking at `llm.service.ts` line 30–55, the prompt literally says "Copy content VERBATIM from the source" and passes raw 1000-word chunks of the full document text.

For Journi's users — academic researchers — this is the most sensitive data at the worst possible moment:
- Pre-publication findings that have not yet been peer-reviewed
- Novel methodologies that could be scooped
- Clinical trial data, patient-adjacent information
- Government or industry-funded research with IP obligations
- Institutional policies that explicitly prohibit sending unpublished work to third-party AI

**"No training on API data" policies do not resolve this.** The data still transits Google's and Anthropic's infrastructure, is subject to their data retention windows (days to weeks), is accessible to their staff under certain conditions, and is subject to subpoenas in their jurisdictions. For many researchers and institutions, this is a non-starter regardless of policy language.

The right architectural principle for Journi: **manuscript text never leaves your infrastructure by default.** External APIs are used only for tasks where the data sent is non-sensitive.

---

## What Data Each Task Actually Sends

| Task | Data sent to external API | Sensitivity |
|---|---|---|
| Section extraction | Full verbatim manuscript text (1000-word chunks) | **Critical** — entire unpublished paper |
| Citation rescue | Raw reference lines from the paper | **Medium** — bibliographic metadata only, not novel content |
| Guideline normalization | Journal author-instructions page text (public web content) | **None** — public data |
| Journal recommendation | Abstract + keywords only | **Medium** — summarises findings, not full text |
| Cover letter drafting | Title + abstract + journal name | **Medium** — summarises findings |
| Section semantic validation | Full section content | **High** — unpublished prose |

This analysis changes the architecture significantly:
- **Section extraction** must stay on-device/on-server — no exceptions
- **Guideline normalization** is fine with any API — it's public data
- **Journal recommendation and cover letters** — abstract/title only, acceptable with user consent
- **Citation rescue** — reference lines only, acceptable

---

## Revised Architecture

```
Browser
  │
  ▼
Express API (Railway)
  │
  ├── Deterministic parser (always runs first)     ← manuscript text never leaves
  │     shared/document-parse.ts
  │     Mammoth (DOCX) + pdfjs (PDF)
  │
  ├── Local fallback LLM (section extraction only) ← manuscript text stays on-server
  │     Ollama on the same Railway service
  │     or: llama.cpp sidecar (smaller, cheaper)
  │
  ├── Gemini 2.0 Flash (non-sensitive tasks only)  ← no manuscript text
  │     - Guideline normalization (public journal pages)
  │     - Journal recommendation (abstract only, user opt-in)
  │     - Cover letter drafting (abstract + title only, user opt-in)
  │
  └── pgvector (Supabase)                          ← journal similarity search
        journals table already exists
```

**Key constraint**: `parseDocumentWithLLM()` — the function that sends manuscript text — must only ever call a local model. Never Gemini, never Anthropic.

---

## Core Parsing Strategy

The codebase already has a substantial deterministic parsing engine in `shared/document-parse.ts`:
- `parseSectionsFromHtml()` — parses `<h1>`/`<h2>`/`<h3>` + bold-only headings from Mammoth DOCX output
- `parseSectionsFromText()` / `buildSectionsFromBlocks()` — heading detection from plain text / PDF blocks
- `parseCitationsFromReferences()` — regex-based citation extraction (DOI, URL, year, author, title)
- `mergeIntoCanonicalOrder()` — maps headings to canonical sections via `CANONICAL_ALIASES`

**The current logic is backwards.** `parseRawDocument()` line 611: if `raw.llmParsed` has sections, it overrides the deterministic result entirely — the LLM is called unconditionally on every document even when deterministic parsing would have worked perfectly.

**Fix**: run deterministic first, call the local LLM only when confidence is genuinely low.

Expected fallback rates:
- DOCX with heading styles → deterministic handles ~95% → local LLM needed ~5%
- DOCX with bold-only headings → deterministic handles ~80% → local LLM needed ~20%
- PDF with text layer → deterministic handles ~60% → local LLM needed ~40%
- PDF scanned / no text layer → `manual_only` (LLM cannot help regardless)

Effective local LLM call rate for a typical manuscript mix (60% DOCX / 40% PDF): **~20% of uploads**.

---

## Model Choice for Local Fallback

The local model only needs to do one thing: given unstructured text, return `{ sections: [...], citations: [...] }` JSON. This is a structured extraction task, not a reasoning or generation task.

**Recommendation: [Qwen2.5:3b](https://ollama.com/library/qwen2.5)** (already in use) via Ollama on the same Railway service.

- 3B parameters, ~2GB VRAM / ~3GB RAM in 4-bit quantisation
- Fits on a Railway service with 4–8GB RAM (CPU inference, no GPU required)
- Fast enough for 1000-word chunks: ~5–15s on CPU at this size
- Already wired in `llm.service.ts` — minimal code change

Alternative if Railway RAM is constrained: **Qwen2.5:1.5b** (~1.5GB) — slightly lower quality but usable for structured extraction.

**What changes**: instead of Ollama being a separate Railway service (current setup), embed it as a sidecar in the main API service. This eliminates the internal network hop, the separate Dockerfile, and the startup race condition that the current `waitForOllamaModel()` works around.

---

## Cost Model

| Component | Cost |
|---|---|
| Ollama sidecar (CPU inference, same Railway dyno) | $0 marginal — included in API service cost |
| Gemini 2.0 Flash (guideline normalization, ~700K input tokens/month) | ~$0.05/month |
| Gemini 2.0 Flash (journal recommendation, abstract only, 500/day) | ~$1.50/month |
| Claude Haiku 3.5 (cover letters, ~1.8M input tokens/month) | ~$1.50/month |
| **Total external API cost** | **~$3–5/month** |

The vast majority of work (section extraction, citation rescue, format checking) never touches a paid API. External APIs are used only for tasks where the input is non-sensitive metadata.

---

## Implementation Plan

### Phase 1 — Fix the override logic; make deterministic the winner [1 day]

**File: `shared/document-parse.ts`** line 611

Change from LLM-always-wins to deterministic-wins-when-capable:

```typescript
// Current (bad): LLM always overrides deterministic result
if (raw.llmParsed && raw.llmParsed.sections.length > 0) {
  baseSections = raw.llmParsed.sections.map(...)
}

// Fixed: LLM only fills in when deterministic produced nothing useful
const deterministicProducedSections = baseSections.length >= 2 &&
  !baseSections.every(s => s.title === "Content");

if (!deterministicProducedSections && raw.llmParsed && raw.llmParsed.sections.length > 0) {
  baseSections = raw.llmParsed.sections.map((sec) => ({
    title: sec.title,
    content: ensureParagraph(sec.content),
  }));
}
```

Same fix for citations (line 648): use `parseCitationsFromReferences()` first; fall back to `raw.llmParsed.citations` only if regex found nothing.

**File: `server/services/manuscript-parse.service.ts`**

Gate the `parseDocumentWithLLM()` call behind a confidence check:

For DOCX:
```typescript
const headingCount = (result.value.match(/<h[1-3][^>]*>/gi) || []).length;
const boldHeadingCount = (result.value.match(/<p><strong>[A-Z][^<]{2,60}<\/strong><\/p>/gi) || []).length;
const deterministicLooksGood = (headingCount + boldHeadingCount) >= 3;

let llmParsed;
if (!deterministicLooksGood) {
  try {
    const textResult = await mammoth.extractRawText({ buffer: input.buffer });
    if (textResult.value.trim().length > 0) {
      llmParsed = await parseDocumentWithLLM(textResult.value);
      diagnostics.push({ level: "info", code: "LLM_FALLBACK_USED",
        message: "Heading structure unclear; local AI-assisted parsing used." });
    }
  } catch (err) { /* add LLM_PARSE_FAILED diagnostic, continue */ }
}
```

For PDF: use `structureRatio` (fraction of blocks with `suggestedSection !== "Content"`) as the confidence gate, threshold ~0.15.

---

### Phase 2 — Move Ollama to sidecar; harden local LLM path [1–2 days]

**Remove** `ollama-service/` as a separate Railway service.

**Add** Ollama as a process launched within the main API container:
- In the main `Dockerfile` (or Railway's start command): run `ollama serve &` before starting the Node process
- Pull the model at container startup: `ollama pull qwen2.5:3b`
- Update `OLLAMA_BASE_URL` default to `http://127.0.0.1:11434` (localhost, not internal DNS)
- Remove the `waitForOllamaModel()` race condition — replace with a startup check that blocks the Express server from accepting requests until Ollama is ready

**`server/services/llm.service.ts`** — enforce privacy boundary:
- `parseDocumentWithLLM()` must **only** call `invokeOllama()` — remove Anthropic fallback from this function entirely
- Add a comment explicitly documenting why: `// Manuscript text must not leave this server. No external API fallback.`
- On Ollama failure: return `{ sections: [], citations: [] }` and set `reviewRequired: true` — never route manuscript text to an external API as a fallback

Remove `invokeAnthropic()` from `llm.service.ts` — move it to a separate `server/services/external-llm.service.ts` that is only imported by non-manuscript services (guideline normalization, recommendations, cover letters). This enforces the boundary at the import level.

---

### Phase 3 — Guideline normalization via Gemini [1–2 days]

**New file: `server/services/external-llm.service.ts`**

Houses all external API calls. Only imported by services that handle non-sensitive data.

```typescript
// This service must NEVER receive manuscript text.
// It handles: journal metadata, abstracts, cover letter inputs only.
export async function invokeGemini(prompt: string): Promise<string> { ... }
export async function invokeAnthropic(prompt: string): Promise<string> { ... }
```

**New file: `server/services/guideline-normalize.service.ts`**

Input: raw text of a journal's author-instructions page (fetched from public `website_url`)
Output: `submission_requirements_json` matching the existing schema in the `journals` table

This is entirely public data — no privacy concern. Runs once per journal on sync, result cached in DB.

Route: wire into existing `POST /api/journals/sync` admin endpoint.

---

### Phase 4 — Journal recommendation [2–3 days]

Two-stage approach:
1. **pgvector similarity** (pre-filter): embed the manuscript **abstract only** (not full text) using Gemini's embedding API (`text-embedding-004`). Store journal embeddings in a `vector(768)` column on `journals`. Retrieve top-20 candidates by cosine similarity.
2. **Gemini reranker**: send abstract + top-20 journal summaries → ranked list with rationale.

**UI requirement**: user must explicitly trigger this. Display a clear notice: "Your abstract will be sent to Google's API to find matching journals. No other manuscript content is shared." This is the opt-in moment — users who have privacy concerns can skip it and search manually.

**Schema addition:**
```sql
ALTER TABLE journals ADD COLUMN embedding vector(768);
CREATE INDEX ON journals USING ivfflat (embedding vector_cosine_ops);
```

Route: `POST /api/manuscripts/:manuscriptId/recommend-journals` — Pro only.

---

### Phase 5 — Cover letter drafting [1–2 days]

**New file: `server/services/cover-letter.service.ts`**

Input sent to API: manuscript title + abstract + journal name + scope. **No full manuscript text.**

Same opt-in notice pattern as journal recommendation.

Uses Claude Haiku 3.5 (better prose than Gemini for this task).

Route: `POST /api/manuscripts/:manuscriptId/cover-letter` with body `{ journalId }`.

---

## Privacy Boundaries Summary

| What happens | Where it runs | Data leaves server? |
|---|---|---|
| DOCX → HTML (Mammoth) | On-server | No |
| PDF → text blocks (pdfjs) | On-server | No |
| Section heading detection | On-server | No |
| Citation regex parsing | On-server | No |
| Format checking vs journal rules | On-server | No |
| Section extraction fallback (low-confidence docs) | Ollama sidecar (localhost) | No |
| Citation rescue fallback | Ollama sidecar (localhost) | No |
| Guideline normalization | Gemini API | No (public journal pages) |
| Journal recommendation | Gemini API | Abstract + keywords only, opt-in |
| Cover letter drafting | Anthropic API | Title + abstract only, opt-in |

Manuscript prose **never** leaves the server. The only things that touch external APIs are: public journal metadata, and user-triggered features where the user explicitly sends their abstract.

---

## Files to Create

| File | Purpose |
|---|---|
| `server/services/external-llm.service.ts` | All external API calls (Gemini, Anthropic) — never receives manuscript text |
| `server/services/guideline-normalize.service.ts` | Journal guidelines extraction from public pages |
| `server/services/journal-recommend.service.ts` | pgvector + Gemini journal recommendation |
| `server/services/cover-letter.service.ts` | Cover letter generation (abstract only) |

## Files to Modify

| File | Change |
|---|---|
| `shared/document-parse.ts` | Fix LLM override logic — deterministic wins when it produces ≥2 named sections |
| `server/services/manuscript-parse.service.ts` | Gate LLM call behind confidence check; add `LLM_FALLBACK_USED` diagnostic |
| `server/services/llm.service.ts` | Remove Anthropic fallback; add privacy comment; local Ollama only |
| `server/config/env.ts` | Add `GEMINI_API_KEY` (optional); update `OLLAMA_BASE_URL` default to localhost |
| `server/routes/manuscripts.ts` | Add `recommend-journals`, `cover-letter` endpoints |
| `server/routes/journals.ts` | Wire guideline normalization into sync flow |

## Files to Remove

- `ollama-service/` (entire directory — Ollama moves to sidecar in main service)
- `ollama-service/railway.toml`

---

## When to Revisit the Architecture

**Move to a dedicated GPU pod (Runpod or similar) when:**
- Ollama CPU inference becomes a latency bottleneck (typically when >200 concurrent fallback requests/day)
- PDF-heavy workloads push the fallback rate above 40%
- An enterprise customer requires a dedicated isolated inference environment

**Move to a fine-tuned adapter when:**
- You have ≥500 real production failure cases with labeled corrections
- The fallback rate on a specific document type exceeds 30% consistently
- A specific task (e.g. citation rescue for a particular citation format) has measurable error rates

Neither of these applies at MVP launch. Ship deterministic-first, measure the real fallback rate, then optimize from data.

---

## Verification Checklist

### Privacy enforcement
- [ ] Upload a full manuscript DOCX → no outbound HTTP requests to Gemini or Anthropic (verify in network logs)
- [ ] Kill Ollama sidecar → parse fails gracefully with `manual_only` status, no external API fallback triggered
- [ ] `external-llm.service.ts` is NOT imported anywhere in `manuscript-parse.service.ts` or `llm.service.ts`

### Deterministic-first parsing
- [ ] Well-structured DOCX (heading styles) → no `LLM_FALLBACK_USED` diagnostic, Ollama not called
- [ ] DOCX with bold-only headings → deterministic extracts sections, Ollama not called
- [ ] DOCX with no heading structure → `LLM_FALLBACK_USED` present, Ollama called
- [ ] PDF with detectable section headings → deterministic handles it, Ollama not called
- [ ] `shared/document-parse.ts` preserves deterministic sections when ≥2 named sections found

### External features (non-sensitive only)
- [ ] Journal recommendation sends only abstract (verify request payload in logs)
- [ ] Cover letter sends only title + abstract + journal name (verify request payload)
- [ ] Both features show opt-in notice in UI before making API call
- [ ] Guideline normalization only fetches and sends public journal page content

### Cost monitoring
- [ ] Ollama CPU inference latency logged per-document (p50/p95 target: <15s for 1000-word chunk)
- [ ] External API cost tracked; alert at $20/month
