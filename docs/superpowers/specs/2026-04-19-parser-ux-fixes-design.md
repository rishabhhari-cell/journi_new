# Parser UX Fixes & Metadata Design

## Goal

Fix four issues in the document import pipeline: (1) onboarding wizard does not load parsed content into the editor, (2) collaboration page wizard opens a blank editor and rereopens the wizard, (3) parsed authors and institutions are not captured as project metadata, (4) parsed figures are not rendered in the editor.

## Architecture

All four fixes operate on the existing `importDocx` / `importPdf` → `ImportDocumentResult` → `applyImportedResult` pipeline. No new services are introduced. The changes are:

- `ProjectOnboardingWizard`: call `replaceManuscriptContent` + `addCitations` before navigating away
- `Collaboration.tsx handleWizardComplete`: await `createManuscript` before calling `applyImportedResult`
- `docx-xml-parse.service.ts` + `manuscript-parse.service.ts`: extract `authors` and `institutions` from document preamble
- `RawParsedDocument` / `ParsedManuscript` / `ImportDocumentResult`: add `authors` and `institutions` fields
- `ProjectContext`: add `updateProjectMetadata` method and `metadata: { authors, institutions }` field
- `applyImportedResult` (Collaboration.tsx): build labeled `<figure>` blocks from `result.review.figures` and insert into "Figures and Tables" section
- `ApiProject` / `patchProject` backend: add `metadata` JSONB column to `projects` table and expose it through the patch API

## Tech Stack

TypeScript ESM, React, ManuscriptContext (Yjs + Supabase), ProjectContext (Supabase), Express + Supabase Admin, Vitest

---

## Issue 1 — Onboarding Wizard Navigation

**Root cause:** `ProjectOnboardingWizard.handleFinish` calls `createManuscript` (not awaited) and navigates to `/collaboration`, but never calls `replaceManuscriptContent` or `addCitations` with the `importResult`. The editor loads with empty sections.

**Fix:** Change navigation target to `/dashboard`. After `createManuscript` resolves, call `replaceManuscriptContent({ title, sections, citations })` and `addCitations(citations)` from `ManuscriptContext` using the `importResult`. This mirrors what `handleWizardComplete` does in `Collaboration.tsx`.

**Props needed:** `ProjectOnboardingWizard` must accept `replaceManuscriptContent` and `addCitations` from `useManuscript()` (already available via the hook inside the component — it already imports `useManuscript`).

**Flow after fix:**
1. User uploads file in wizard → parser runs → `importResult` stored in wizard state
2. User clicks "Create Project" → `createManuscript` called and awaited → `replaceManuscriptContent` called with sections/citations → `navigate("/dashboard")`
3. User opens editor → sees populated manuscript, no second parse

---

## Issue 2 — Collaboration Wizard Blank Editor + Wizard Reopen

**Root cause:** In `Collaboration.tsx handleWizardComplete`, `createManuscript` is called but not awaited. `applyImportedResult` runs immediately after on a stale optimistic manuscript ID. When hydration settles, the correct manuscript has empty sections (the content was applied to the wrong ID), so the onboarding condition (`all sections empty`) becomes true again and the wizard reopens.

**Fix:** Make `createManuscript` in `ManuscriptContext` return a `Promise<void>` (it already fires async backend calls internally). In `handleWizardComplete`, `await createManuscript(...)` before calling `applyImportedResult`. This ensures content is applied to the correct hydrated manuscript ID.

---

## Issue 3 — Authors & Institutions as Project Metadata

### Parser extraction

**DOCX:** `extractDocxXmlStructure` in `docx-xml-parse.service.ts` returns a `DocxXmlStructure` result. Add `authors: string[]` and `institutions: string[]` to this interface. After the title section is identified (first heading), scan the next 1–10 paragraphs before the Abstract heading for author/institution lines using these heuristics:

- Author line: short (≤120 chars), no sentence-ending punctuation, contains comma-separated tokens that look like personal names (2–4 words each, mixed case). Superscript-number suffixes (e.g. "Smith J¹") are stripped.
- Institution line: contains keywords `university`, `institute`, `department`, `hospital`, `college`, `school`, `center`, `centre`, `faculty`, `laboratory` (case-insensitive), OR starts with a superscript digit pattern (`¹`, `²`, `1.`, `2.`).

If no lines match, return empty arrays — no false positives.

**PDF:** In `manuscript-parse.service.ts`, apply the same heuristics to the first page's text blocks (already extracted as `ParsedBlock[]`), scanning blocks between the title block and the first canonical section heading.

### Data model changes

```typescript
// shared/document-parse.ts
export interface RawParsedDocument {
  // ... existing fields ...
  authors?: string[];
  institutions?: string[];
}

export interface ParsedManuscript {
  // ... existing fields ...
  authors?: string[];
  institutions?: string[];
}
```

`parseRawDocument` passes `raw.authors` and `raw.institutions` through to the returned `ParsedManuscript`.

```typescript
// client/src/lib/document-io.ts
export interface ImportDocumentResult {
  // ... existing fields ...
  authors: string[];
  institutions: string[];
}
```

`importDocx` / `importPdf` map `parsed.authors ?? []` and `parsed.institutions ?? []` into `ImportDocumentResult`.

### ProjectContext metadata

Add to `client/src/types/index.ts`:
```typescript
export interface ProjectMetadata {
  authors: string[];
  institutions: string[];
}
```

Add to `Project` interface:
```typescript
metadata?: ProjectMetadata;
```

Add to `ProjectContextType`:
```typescript
updateProjectMetadata: (patch: Partial<ProjectMetadata>) => Promise<void>;
```

`updateProjectMetadata` merges the patch into `activeProject.metadata` optimistically and calls `patchProject(projectId, { metadata: merged })` to persist.

### Backend

Add a migration file `server/sql/006_project_metadata.sql`:
```sql
alter table public.projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

Extend `patchProjectSchema` in `server/routes/projects.ts` to accept `metadata: z.record(z.unknown()).optional()`. Include `metadata` in the Supabase `.update()` call. Return `metadata` in `ApiProject`.

Extend `ApiProject` in `client/src/lib/api/backend.ts`:
```typescript
metadata?: Record<string, unknown>;
```

Extend `patchProject` to accept `metadata?: Record<string, unknown>`.

### applyImportedResult hook-in

In `Collaboration.tsx`, after `applyImportedResult` is called, if `importResult.authors.length > 0` or `importResult.institutions.length > 0`, call `updateProjectMetadata({ authors: importResult.authors, institutions: importResult.institutions })`.

In `ProjectOnboardingWizard.handleFinish`, do the same after `replaceManuscriptContent`.

### Submission surface

`SubmitToJournalDialog` reads `activeProject.metadata?.authors ?? []` and `activeProject.metadata?.institutions ?? []` and includes them in the submission payload. No editor sections involved.

---

## Issue 4 — Figure Rendering in "Figures and Tables" Section

**Root cause:** `applyImportedResult` in `Collaboration.tsx` builds section HTML from `result.sections` only. `result.review.figures` (which contains base64 `imageData` + `caption`) is never rendered into the editor.

**Fix:** At the end of `applyImportedResult`, after sections are applied, check `result.review.figures`. If non-empty and the document does not require review (`!result.review.required`), build an HTML string and insert it into the "Figures and Tables" section:

```typescript
const figuresHtml = result.review.figures
  .map((fig, i) => {
    const label = `Figure ${i + 1}`;
    const caption = fig.caption ? ` — ${fig.caption}` : '';
    return `<figure><img src="${fig.imageData}" alt="${label}" /><figcaption><strong>${label}</strong>${caption}</figcaption></figure>`;
  })
  .join('\n');
```

Find the "Figures and Tables" section via `getSectionByTitle('Figures and Tables')`. If it exists, append `figuresHtml` to its content via `updateSectionContent`. If it doesn't exist (some manuscript types omit it), skip silently.

**Scope:** Only the non-review path. Figures that require review (i.e. `result.review.required === true`) already have their own assignment UI — that path is unchanged.

---

## Error Handling

- If author/institution extraction returns empty arrays, `ImportDocumentResult.authors` and `.institutions` are `[]` — `updateProjectMetadata` is not called (no-op for empty arrays).
- If `updateProjectMetadata` Supabase call fails, log the error and continue — metadata is not critical for the editor to function.
- If figure `imageData` is empty string or missing, skip that figure silently.

---

## Testing

- Unit tests for author/institution extraction heuristics in `server/services/__tests__/docx-xml-parse.test.ts` — add cases for: typical author line, institution line with university keyword, superscript-stripped author, line that should NOT match (abstract body text).
- Unit test for `parseRawDocument` passing through `authors` and `institutions`.
- Manual verification of all four flows: onboarding import → dashboard → editor shows content; collaboration wizard import → editor populated, wizard does not reopen; imported DOCX with known authors → project metadata populated; DOCX/PDF with figures → "Figures and Tables" section contains labeled `<figure>` blocks.
