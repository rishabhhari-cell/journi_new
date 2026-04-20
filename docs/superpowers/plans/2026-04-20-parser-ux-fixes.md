# Parser UX Fixes & Metadata Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix four import pipeline bugs: onboarding wizard not loading parsed content into editor, collaboration wizard blank editor + reopen, missing authors/institutions project metadata, and figures not rendering in the editor.

**Architecture:** All fixes operate on the existing `importDocx`/`importPdf` → `ImportDocumentResult` → `applyImportedResult` pipeline. The DOCX XML walker gains author/institution extraction; the data model grows `authors`/`institutions` fields that flow through to `ProjectContext`; `ProjectOnboardingWizard` is fixed to apply content before navigating; `createManuscript` is made awaitable; and `applyImportedResult` is extended to render figures.

**Tech Stack:** TypeScript ESM, React, ManuscriptContext (Yjs + Supabase), ProjectContext (Supabase), Express + Supabase Admin, Vitest

---

## File Structure

**Modified:**
- `server/sql/006_project_metadata.sql` — new migration: add `metadata jsonb` column to `projects` table
- `server/routes/projects.ts` — accept + persist `metadata` in patch schema
- `client/src/lib/api/backend.ts` — add `metadata` to `ApiProject`, `patchProject`
- `shared/document-parse.ts` — add `authors?`, `institutions?` to `RawParsedDocument` and `ParsedManuscript`
- `server/services/docx-xml-parse.service.ts` — add author/institution extraction to `DocxXmlResult` + `extractDocxXmlStructure`
- `server/services/manuscript-parse.service.ts` — pass `authors`/`institutions` through to `RawParsedDocument` return for DOCX and PDF
- `client/src/lib/document-io.ts` — add `authors`, `institutions` to `ImportDocumentResult`; map from parsed result
- `client/src/types/index.ts` — add `ProjectMetadata` interface; add `metadata?` to `Project`
- `client/src/contexts/ProjectContext.tsx` — add `updateProjectMetadata`; map `metadata` from API; expose in context
- `client/src/contexts/ManuscriptContext.tsx` — make `createManuscript` return `Promise<string>` instead of `string`
- `client/src/components/dashboard/ProjectOnboardingWizard.tsx` — await `createManuscript`; call `replaceManuscriptContent`; call `updateProjectMetadata`; navigate to `/dashboard`
- `client/src/pages/Collaboration.tsx` — await `createManuscript` in `handleWizardComplete`; call `updateProjectMetadata` after `applyImportedResult`; render figures in `applyImportedResult`
- `client/src/pages/Dashboard.tsx` — add Project Metadata card to Overview tab
- `server/services/__tests__/docx-xml-parse.test.ts` — add author/institution extraction tests
- `server/services/__tests__/parse-error-detection.test.ts` — add `parseRawDocument` author/institution passthrough test

---

## Task 1: SQL migration — add metadata column to projects

**Files:**
- Create: `server/sql/006_project_metadata.sql`

- [ ] **Step 1: Create the migration file**

```sql
-- server/sql/006_project_metadata.sql
alter table public.projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

- [ ] **Step 2: Run the migration against Supabase**

In the Supabase dashboard SQL editor (or via psql), run:
```sql
alter table public.projects
  add column if not exists metadata jsonb not null default '{}'::jsonb;
```

Expected: query runs with no error; `\d projects` shows `metadata jsonb not null default '{}'`.

- [ ] **Step 3: Commit**

```bash
git add server/sql/006_project_metadata.sql
git commit -m "feat: add metadata jsonb column to projects table"
```

---

## Task 2: Backend — expose metadata in projects API

**Files:**
- Modify: `server/routes/projects.ts`
- Modify: `client/src/lib/api/backend.ts`

- [ ] **Step 1: Extend `patchProjectSchema` and the update handler in `server/routes/projects.ts`**

In `patchProjectSchema` (around line 19), add:
```typescript
const patchProjectSchema = z.object({
  title: z.string().min(2).optional(),
  description: z.string().optional(),
  status: z.enum(["active", "completed", "archived"]).optional(),
  dueDate: z.string().datetime().nullable().optional(),
  metadata: z.record(z.unknown()).optional(),
});
```

In the `PATCH /:projectId` handler's `.update()` call (around line 115), add `metadata`:
```typescript
const { data, error } = await supabaseAdmin
  .from("projects")
  .update({
    ...(input.title !== undefined ? { title: input.title } : {}),
    ...(input.description !== undefined ? { description: input.description } : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
    ...(input.dueDate !== undefined ? { due_date: input.dueDate } : {}),
    ...(input.metadata !== undefined ? { metadata: input.metadata } : {}),
    updated_at: new Date().toISOString(),
  })
  .eq("id", projectId)
  .select("*")
  .single();
```

- [ ] **Step 2: Add `metadata` to `ApiProject` and `patchProject` in `client/src/lib/api/backend.ts`**

In `ApiProject` interface (around line 77), add:
```typescript
export interface ApiProject {
  id: string;
  organization_id: string;
  title: string;
  description: string;
  status: 'active' | 'completed' | 'archived';
  due_date: string | null;
  created_at: string;
  updated_at: string;
  project_members?: ApiProjectMember[];
  tasks_json?: unknown[];
  collaborators_json?: unknown[];
  metadata?: Record<string, unknown>;
}
```

In `patchProject` function (around line 201), add `metadata` to input type and body:
```typescript
export async function patchProject(
  projectId: string,
  input: {
    title?: string;
    description?: string;
    status?: 'active' | 'completed' | 'archived';
    dueDate?: string | null;
    metadata?: Record<string, unknown>;
  },
) {
  return apiFetch<{ data: ApiProject }>(`/projects/${projectId}`, {
    method: 'PATCH',
    body: JSON.stringify(input),
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no type errors related to `metadata`.

- [ ] **Step 4: Commit**

```bash
git add server/routes/projects.ts client/src/lib/api/backend.ts
git commit -m "feat: expose metadata field on projects patch API"
```

---

## Task 3: Data model — authors/institutions in shared types and document-io

**Files:**
- Modify: `shared/document-parse.ts`
- Modify: `client/src/lib/document-io.ts`

- [ ] **Step 1: Add `authors` and `institutions` to `RawParsedDocument` and `ParsedManuscript` in `shared/document-parse.ts`**

In `RawParsedDocument` interface (around line 111), add after `parseConfidence?`:
```typescript
authors?: string[];
institutions?: string[];
```

In `ParsedManuscript` interface (around line 97), add after `parseConfidence?`:
```typescript
authors?: string[];
institutions?: string[];
```

In the `parseRawDocument` function return (find where the `ParsedManuscript` object is assembled and returned), add:
```typescript
authors: raw.authors,
institutions: raw.institutions,
```

- [ ] **Step 2: Add `authors` and `institutions` to `ImportDocumentResult` in `client/src/lib/document-io.ts`**

In `ImportDocumentResult` interface (around line 25), add after `totalWordCount`:
```typescript
authors: string[];
institutions: string[];
```

Find where `importDocx` builds and returns the `ImportDocumentResult` object. Add:
```typescript
authors: parsed.authors ?? [],
institutions: parsed.institutions ?? [],
```

Find where `importPdf` builds and returns the `ImportDocumentResult` object. Add:
```typescript
authors: parsed.authors ?? [],
institutions: parsed.institutions ?? [],
```

Find where `importImage` builds and returns the `ImportDocumentResult` object. Add:
```typescript
authors: [],
institutions: [],
```

- [ ] **Step 3: Run the tests to verify no regressions**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 90 passed (14).

- [ ] **Step 4: Commit**

```bash
git add shared/document-parse.ts client/src/lib/document-io.ts
git commit -m "feat: add authors/institutions fields to RawParsedDocument, ParsedManuscript, ImportDocumentResult"
```

---

## Task 4: Parser — extract authors and institutions from DOCX

**Files:**
- Modify: `server/services/docx-xml-parse.service.ts`
- Modify: `server/services/__tests__/docx-xml-parse.test.ts`

- [ ] **Step 1: Write failing tests in `server/services/__tests__/docx-xml-parse.test.ts`**

Add at the bottom of the file:

```typescript
import { classifyPreambleLine } from "../docx-xml-parse.service";

describe("classifyPreambleLine", () => {
  it("classifies a typical author line", () => {
    expect(classifyPreambleLine("Smith J, Jones A, Patel R")).toBe("author");
  });

  it("strips superscript suffixes before classifying author", () => {
    expect(classifyPreambleLine("Smith J¹, Jones A², Patel R³")).toBe("author");
  });

  it("classifies a university affiliation as institution", () => {
    expect(classifyPreambleLine("¹Department of Medicine, Harvard University, Boston, MA")).toBe("institution");
  });

  it("classifies a hospital affiliation as institution", () => {
    expect(classifyPreambleLine("St. Mary's Hospital, London, UK")).toBe("institution");
  });

  it("does not classify a long body sentence as author or institution", () => {
    expect(classifyPreambleLine("This study investigated the effects of treatment on patient outcomes over 12 months.")).toBe("other");
  });

  it("does not classify abstract heading as author or institution", () => {
    expect(classifyPreambleLine("Abstract")).toBe("other");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test server/services/__tests__/docx-xml-parse.test.ts
```

Expected: FAIL — `classifyPreambleLine` is not exported.

- [ ] **Step 3: Implement `classifyPreambleLine` and update `DocxXmlResult` in `server/services/docx-xml-parse.service.ts`**

Add after the existing `DocxXmlSection` interface (around line 57):

```typescript
export type PreambleLineType = "author" | "institution" | "other";

const INSTITUTION_KEYWORDS = /university|institute|department|hospital|college|school|center|centre|faculty|laboratory/i;
const SUPERSCRIPT_DIGITS = /^[¹²³⁴⁵⁶⁷⁸⁹0-9]+[.\s]/;

export function classifyPreambleLine(line: string): PreambleLineType {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 200) return "other";

  // Institution: keyword match OR starts with superscript/digit affiliation marker
  if (INSTITUTION_KEYWORDS.test(trimmed)) return "institution";
  if (SUPERSCRIPT_DIGITS.test(trimmed)) return "institution";

  // Strip superscript suffixes (e.g. "Smith J¹" → "Smith J") before name check
  const stripped = trimmed.replace(/[¹²³⁴⁵⁶⁷⁸⁹]+/g, "").trim();

  // Author: short line, comma-separated tokens that look like names (2–4 words, mixed case)
  if (stripped.length <= 120 && !/[.!?]$/.test(stripped)) {
    const tokens = stripped.split(/,\s*/);
    const looksLikeNames = tokens.every((token) => {
      const words = token.trim().split(/\s+/);
      return words.length >= 1 && words.length <= 4 && /^[A-Z]/.test(words[0]);
    });
    if (looksLikeNames && tokens.length >= 1) return "author";
  }

  return "other";
}
```

Add `authors` and `institutions` to `DocxXmlResult` interface:

```typescript
export interface DocxXmlResult {
  sections: DocxXmlSection[];
  referenceLines: string[];
  mainDocumentPath: string;
  figureRelsPath: string;
  diagnostics: ParseDiagnostic[];
  authors: string[];
  institutions: string[];
}
```

In `extractDocxXmlStructure`, after `const paragraphMatches = ...` and the section-walking loop, add the preamble scanning logic. After building `sections` (after the loop and final `flush()`), before building `referenceLines`, add:

```typescript
  // Step 3b: Extract authors and institutions from preamble paragraphs
  // Preamble = paragraphs in the first section (before Abstract heading)
  const authors: string[] = [];
  const institutions: string[] = [];
  const firstSection = sections[0];
  if (firstSection) {
    // Scan up to 10 preamble paragraphs (skip the title itself)
    const preambleLines = firstSection.paragraphTexts.slice(0, 10);
    for (const line of preambleLines) {
      const kind = classifyPreambleLine(line);
      if (kind === "author") authors.push(line.replace(/[¹²³⁴⁵⁶⁷⁸⁹]+/g, "").trim());
      else if (kind === "institution") institutions.push(line.trim());
    }
  }
```

Update the return statement at the bottom of `extractDocxXmlStructure`:
```typescript
  return { sections, referenceLines, mainDocumentPath, figureRelsPath, diagnostics, authors, institutions };
```

Also update the early error return (around line 111) to include empty arrays:
```typescript
    return { sections: [], referenceLines: [], mainDocumentPath, figureRelsPath, diagnostics, authors: [], institutions: [] };
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test server/services/__tests__/docx-xml-parse.test.ts
```

Expected: all tests pass including the new `classifyPreambleLine` suite.

- [ ] **Step 5: Commit**

```bash
git add server/services/docx-xml-parse.service.ts server/services/__tests__/docx-xml-parse.test.ts
git commit -m "feat: extract authors and institutions from DOCX preamble paragraphs"
```

---

## Task 5: Parser — pass authors/institutions through manuscript-parse service

**Files:**
- Modify: `server/services/manuscript-parse.service.ts`
- Modify: `server/services/__tests__/parse-error-detection.test.ts`

- [ ] **Step 1: Write a failing test in `server/services/__tests__/parse-error-detection.test.ts`**

Add a new describe block at the bottom of the file:

```typescript
describe("parseRawDocument — authors/institutions passthrough", () => {
  it("passes authors and institutions from RawParsedDocument to ParsedManuscript", () => {
    const raw: RawParsedDocument = {
      fileTitle: "Test",
      format: "docx",
      html: "<h2>Abstract</h2><p>Some content here.</p>",
      authors: ["Smith J", "Jones A"],
      institutions: ["Harvard University"],
    };
    const result = parseRawDocument(raw);
    expect(result.authors).toEqual(["Smith J", "Jones A"]);
    expect(result.institutions).toEqual(["Harvard University"]);
  });

  it("returns undefined authors/institutions when not present in raw", () => {
    const raw: RawParsedDocument = {
      fileTitle: "Test",
      format: "docx",
      html: "<h2>Abstract</h2><p>Some content here.</p>",
    };
    const result = parseRawDocument(raw);
    expect(result.authors).toBeUndefined();
    expect(result.institutions).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test server/services/__tests__/parse-error-detection.test.ts
```

Expected: FAIL — `result.authors` is undefined even when set on raw.

- [ ] **Step 3: Fix `parseRawDocument` in `shared/document-parse.ts` to pass through authors/institutions**

Find the `parseRawDocument` function return statement (around line 922). The function assembles a `ParsedManuscript` object. Add to the returned object:

```typescript
authors: raw.authors,
institutions: raw.institutions,
```

- [ ] **Step 4: Fix `parseUploadedDocument` in `server/services/manuscript-parse.service.ts` to include authors/institutions in the DOCX return**

In the DOCX branch, `xmlResult` already has `authors` and `institutions` (from Task 4). Find `rawDocx` object (around line 1049) and add:

```typescript
const rawDocx: RawParsedDocument = {
  fileTitle,
  format: "docx",
  html: mergedHtml,
  text: normalizeText(textResult.value),
  diagnostics: [...],
  figures: extractedFigures.figures,
  references: [...],
  authors: xmlResult.authors,
  institutions: xmlResult.institutions,
};
```

Also ensure `finalRawDocx` spreads `rawDocx` (which it already does via `{ ...rawDocx, ... }`), so `authors` and `institutions` carry through to the return.

For the PDF branch: apply the same heuristic to text blocks from the first page. Find the PDF branch around line 1144. After `const payload = await extractPdfPayload(input.buffer);`, add:

```typescript
    // Extract authors and institutions from first-page text blocks
    const firstPageBlocks = (payload.blocks ?? []).filter((b) => b.page === 1);
    const pdfAuthors: string[] = [];
    const pdfInstitutions: string[] = [];
    let pastTitle = false;
    let pastFirstHeading = false;
    for (const block of firstPageBlocks) {
      if (!pastTitle && block.isLargeFont) { pastTitle = true; continue; }
      if (!pastTitle) continue;
      if (pastFirstHeading) break;
      // Stop scanning when we hit a canonical section heading
      if (/^(abstract|introduction|background|methods)/i.test(block.text.trim())) {
        pastFirstHeading = true;
        break;
      }
      const kind = classifyPreambleLine(block.text);
      if (kind === "author") pdfAuthors.push(block.text.replace(/[¹²³⁴⁵⁶⁷⁸⁹]+/g, "").trim());
      else if (kind === "institution") pdfInstitutions.push(block.text.trim());
    }
```

Add `authors: pdfAuthors, institutions: pdfInstitutions` to `rawPdfPrelim` and ensure they flow through to the return (via `{ ...rawPdf, ... }`).

- [ ] **Step 5: Run all tests**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 92 passed (14) — the 2 new tests pass, no regressions.

- [ ] **Step 6: Commit**

```bash
git add shared/document-parse.ts server/services/manuscript-parse.service.ts server/services/__tests__/parse-error-detection.test.ts
git commit -m "feat: pass authors/institutions through parseRawDocument and parseUploadedDocument"
```

---

## Task 6: ProjectContext — add metadata field and updateProjectMetadata

**Files:**
- Modify: `client/src/types/index.ts`
- Modify: `client/src/contexts/ProjectContext.tsx`

- [ ] **Step 1: Add `ProjectMetadata` and update `Project` in `client/src/types/index.ts`**

After the `Project` interface (around line 51), add:

```typescript
export interface ProjectMetadata {
  authors: string[];
  institutions: string[];
}
```

Add `metadata?` to the `Project` interface:
```typescript
export interface Project {
  id: string;
  title: string;
  description: string;
  status: ProjectStatus;
  createdAt: Date;
  updatedAt: Date;
  tasks: Task[];
  collaborators: Collaborator[];
  dueDate?: Date;
  metadata?: ProjectMetadata;
}
```

- [ ] **Step 2: Update `mapApiProjectToUi` in `client/src/contexts/ProjectContext.tsx` to map metadata**

In `mapApiProjectToUi` (around line 91), add `metadata` to the returned object:

```typescript
function mapApiProjectToUi(apiProject: ApiProject): Project {
  const tasks: Task[] = apiProject.tasks_json ? rehydrateTasks(apiProject.tasks_json) : [];
  const collaborators: Collaborator[] = apiProject.collaborators_json
    ? (apiProject.collaborators_json as Collaborator[])
    : [];

  const rawMeta = apiProject.metadata ?? {};
  const metadata: ProjectMetadata | undefined =
    Array.isArray(rawMeta.authors) || Array.isArray(rawMeta.institutions)
      ? {
          authors: Array.isArray(rawMeta.authors) ? (rawMeta.authors as string[]) : [],
          institutions: Array.isArray(rawMeta.institutions) ? (rawMeta.institutions as string[]) : [],
        }
      : undefined;

  return {
    id: apiProject.id,
    title: apiProject.title,
    description: apiProject.description ?? '',
    status: apiProject.status,
    createdAt: new Date(apiProject.created_at),
    updatedAt: new Date(apiProject.updated_at),
    dueDate: apiProject.due_date ? new Date(apiProject.due_date) : undefined,
    tasks,
    collaborators,
    metadata,
  };
}
```

- [ ] **Step 3: Add `updateProjectMetadata` to `ProjectContextType` and implement it**

Add to `ProjectContextType` interface (around line 42):
```typescript
updateProjectMetadata: (patch: Partial<ProjectMetadata>) => Promise<void>;
```

Add the implementation inside `ProjectProvider`, after `updateActive` (around line 382):

```typescript
  const updateProjectMetadata = useCallback(async (patch: Partial<ProjectMetadata>): Promise<void> => {
    const current = activeProject.metadata ?? { authors: [], institutions: [] };
    const merged: ProjectMetadata = {
      authors: patch.authors ?? current.authors,
      institutions: patch.institutions ?? current.institutions,
    };
    // Optimistic update
    updateActive((p) => ({ ...p, metadata: merged, updatedAt: new Date() }));
    if (backendMode && activeProject.id) {
      try {
        await patchProject(activeProject.id, { metadata: merged as unknown as Record<string, unknown> });
      } catch {
        // Non-critical — metadata patch failure is logged only
        console.error('[ProjectContext] Failed to persist project metadata');
      }
    }
  }, [activeProject, backendMode, updateActive]);
```

Add `updateProjectMetadata` to the context value in the `ProjectContext.Provider`:
```typescript
<ProjectContext.Provider
  value={{
    projects,
    activeProject,
    activities,
    showOnboarding,
    isLoadingProjects,
    dismissOnboarding,
    setActiveProjectId,
    createProject,
    deleteProject,
    renameProject,
    archiveProject,
    hardDeleteProject,
    addTask,
    updateTask,
    deleteTask,
    addCollaborator,
    removeCollaborator,
    updateCollaborator,
    getTask,
    getCollaborator,
    updateProjectMetadata,
    project: activeProject,
  }}
>
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add client/src/types/index.ts client/src/contexts/ProjectContext.tsx
git commit -m "feat: add ProjectMetadata type and updateProjectMetadata to ProjectContext"
```

---

## Task 7: ManuscriptContext — make createManuscript awaitable

**Files:**
- Modify: `client/src/contexts/ManuscriptContext.tsx`

- [ ] **Step 1: Change `createManuscript` to return `Promise<string>` in `ManuscriptContext.tsx`**

Find `createManuscript` (around line 634). Change the signature and body so it awaits the backend call and resolves with the final (backend-confirmed) ID:

```typescript
  const createManuscript = useCallback(async (title: string, type: ManuscriptType): Promise<string> => {
    const projectId = activeProject?.id ?? 'mvp-project';
    const optimistic = createEmptyManuscript(projectId, title, type);
    setManuscripts((prev) => [...prev, optimistic]);
    setActiveManuscriptId(optimistic.id);

    if (backendMode && activeProject?.id) {
      try {
        const created = await createManuscriptApi({
          projectId: activeProject.id,
          title,
          type,
          sections: optimistic.sections.map((section) => ({
            title: section.title,
            contentHtml: section.content,
            status: section.status,
          })),
        });
        const mapped = mapBackendManuscript(created.data, activeProject.id);
        setManuscripts((prev) =>
          prev.map((doc) =>
            doc.id === optimistic.id
              ? { ...mapped, comments: doc.comments, citations: doc.citations }
              : doc,
          ),
        );
        setActiveManuscriptId(mapped.id);
        return mapped.id;
      } catch {
        // Keep optimistic local manuscript.
      }
    }

    return optimistic.id;
  }, [activeProject?.id, backendMode]);
```

Also update the `ManuscriptContextType` interface — find `createManuscript` in the interface definition and change its return type from `string` to `Promise<string>`:
```typescript
createManuscript: (title: string, type: ManuscriptType) => Promise<string>;
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no errors. (All existing callers that ignored the return value still compile; callers that used the string return directly will need `await` — those are fixed in Tasks 8 and 9.)

- [ ] **Step 3: Run tests**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 92 passed (14).

- [ ] **Step 4: Commit**

```bash
git add client/src/contexts/ManuscriptContext.tsx
git commit -m "feat: make createManuscript async — returns Promise<string> with backend-confirmed ID"
```

---

## Task 8: Fix onboarding wizard navigation

**Files:**
- Modify: `client/src/components/dashboard/ProjectOnboardingWizard.tsx`

- [ ] **Step 1: Update `handleFinish` in `ProjectOnboardingWizard.tsx`**

Add `replaceManuscriptContent` and `updateProjectMetadata` to the hook destructures at the top of the component. Currently (around line 64):
```typescript
  const { createManuscript } = useManuscript();
```
Change to:
```typescript
  const { createManuscript, replaceManuscriptContent } = useManuscript();
  const { updateProjectMetadata } = useProject();
```

Add `useProject` import at the top:
```typescript
import { useProject } from "@/contexts/ProjectContext";
```

Replace the `handleFinish` function (lines 142–177) with:

```typescript
  const handleFinish = async () => {
    if (!canProceedStep1) return;
    setIsCreating(true);

    try {
      await createProject(projectName.trim(), description.trim(), dueDate || undefined);

      // Await manuscript creation so we have the real backend ID before applying content
      const msTitle = importResult?.title || "Untitled Manuscript";
      await createManuscript(msTitle, manuscriptType);

      // Apply parsed content atomically
      if (importResult) {
        const sections = importResult.sections.map((s, i) => ({
          id: s.id ?? `imported-${i}`,
          title: s.title ?? 'Section',
          content: s.content ?? '',
          status: (s.status ?? 'draft') as import('@/types').SectionStatus,
          order: s.order ?? i,
        }));
        const citations = importResult.citations.map((c) => ({
          ...c,
          id: c.id ?? `cit-${Math.random().toString(36).slice(2)}`,
        }));
        replaceManuscriptContent({ title: msTitle, sections, citations });

        // Persist authors/institutions as project metadata
        if (importResult.authors.length > 0 || importResult.institutions.length > 0) {
          void updateProjectMetadata({
            authors: importResult.authors,
            institutions: importResult.institutions,
          });
        }
      }

      // Add collaborators
      const validCollabs = collaborators.filter((c) => c.name.trim() && c.email.trim());
      for (const collab of validCollabs) {
        const data: CollaboratorFormData = {
          name: collab.name.trim(),
          email: collab.email.trim(),
          role: "co_author",
        };
        addCollaborator(data);
      }

      toast.success("Project created!");
      onComplete();
      navigate("/dashboard");
    } catch {
      toast.error("Something went wrong. Please try again.");
    } finally {
      setIsCreating(false);
    }
  };
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add client/src/components/dashboard/ProjectOnboardingWizard.tsx
git commit -m "fix: onboarding wizard — await createManuscript, apply parsed content, navigate to /dashboard"
```

---

## Task 9: Fix collaboration wizard blank editor + figure rendering

**Files:**
- Modify: `client/src/pages/Collaboration.tsx`

- [ ] **Step 1: Fix `handleWizardComplete` — await `createManuscript`**

Find `handleWizardComplete` in `Collaboration.tsx` (around line 991). Change `createManuscript(derivedTitle, result.type)` to `await createManuscript(derivedTitle, result.type)`:

```typescript
  const handleWizardComplete = async (result: WizardResult) => {
    setShowWizard(false);
    setShowDocSwitcher(false);

    if (result.action === 'import' && result.file) {
      setIsImporting(true);
      try {
        const ext = result.file.name.split('.').pop()?.toLowerCase();
        let importResult: ImportDocumentResult;
        if (ext === 'docx') importResult = await importDocx(result.file);
        else if (ext === 'pdf') importResult = await importPdf(result.file);
        else importResult = await importImage(result.file);

        const derivedTitle = importResult.title || result.title;
        await createManuscript(derivedTitle, result.type);
        applyImportedResult(importResult);

        // Persist authors/institutions as project metadata
        if (importResult.authors.length > 0 || importResult.institutions.length > 0) {
          void updateProjectMetadata({
            authors: importResult.authors,
            institutions: importResult.institutions,
          });
        }
      } catch (err) {
        console.error('Import failed:', err);
        toast.error('Failed to import file. Please try a different file.');
      } finally {
        setIsImporting(false);
      }
    } else {
      await createManuscript(result.title, result.type);
      toast.success('New document created \u2014 start writing!');
    }

    if (result.journal) {
      toast.success(`Target journal: ${result.journal.name}`, { duration: 4000 });
    }
  };
```

Add `updateProjectMetadata` to the destructured values from `useProject()` near the top of the `Collaboration` component. Find where `useProject` is used (there's `const project = ...` inline — the component needs `useProject()`). Add the import and hook call:

```typescript
import { useProject } from '@/contexts/ProjectContext';
// inside Collaboration():
const { updateProjectMetadata } = useProject();
```

- [ ] **Step 2: Add figure rendering to `applyImportedResult`**

Find `applyImportedResult` in `Collaboration.tsx` (around line 559). At the end of the function, after the section content is applied, add figure rendering:

```typescript
    // Render parsed figures into "Figures and Tables" section (non-review path only)
    if (!result.review.required && result.review.figures.length > 0) {
      const figSection = getSectionByTitle('Figures and Tables');
      if (figSection) {
        const figuresHtml = result.review.figures
          .filter((fig) => fig.imageData)
          .map((fig, i) => {
            const label = `Figure ${i + 1}`;
            const caption = fig.caption ? ` — ${fig.caption}` : '';
            return `<figure><img src="${fig.imageData}" alt="${label}" /><figcaption><strong>${label}</strong>${caption}</figcaption></figure>`;
          })
          .join('\n');
        if (figuresHtml) {
          const existing = figSection.content && figSection.content !== '<p></p>' ? figSection.content : '';
          updateSectionContent(figSection.id, existing + '\n' + figuresHtml);
        }
      }
    }
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Run tests**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 92 passed (14).

- [ ] **Step 5: Commit**

```bash
git add client/src/pages/Collaboration.tsx
git commit -m "fix: await createManuscript in handleWizardComplete; render figures in applyImportedResult; persist authors/institutions metadata"
```

---

## Task 10: Dashboard — Project Metadata card in Overview tab

**Files:**
- Modify: `client/src/pages/Dashboard.tsx`

- [ ] **Step 1: Add the Project Metadata card to the Overview tab in `Dashboard.tsx`**

Find the Overview tab content (around line 376, inside `{activeTab === 'overview' && ...}`). After the stats row grid (`</div>` closing the 4-stat grid, around line 432), add the metadata card:

```typescript
                {/* Project Metadata card — shown only when authors or institutions are available */}
                {(activeProject.metadata?.authors?.length ?? 0) > 0 || (activeProject.metadata?.institutions?.length ?? 0) > 0 ? (
                  <div className="bg-card rounded-xl border border-border p-5">
                    <h2 className="text-sm font-bold text-foreground mb-4 flex items-center gap-2">
                      <Users size={16} className="text-muted-foreground" />
                      Document Metadata
                    </h2>
                    {(activeProject.metadata?.authors?.length ?? 0) > 0 && (
                      <div className="mb-3">
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Authors</p>
                        <p className="text-sm text-foreground">{activeProject.metadata!.authors.join(', ')}</p>
                      </div>
                    )}
                    {(activeProject.metadata?.institutions?.length ?? 0) > 0 && (
                      <div>
                        <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Institutions</p>
                        <p className="text-sm text-foreground">{activeProject.metadata!.institutions.join(', ')}</p>
                      </div>
                    )}
                  </div>
                ) : null}
```

`activeProject` is already available from `useProject()` which is called at the top of `Dashboard`. `Users` icon is already imported.

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Run tests**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 92 passed (14).

- [ ] **Step 4: Commit**

```bash
git add client/src/pages/Dashboard.tsx
git commit -m "feat: show authors and institutions metadata card in Dashboard Overview tab"
```

---

## Task 11: Final verification

- [ ] **Step 1: Run the full test suite**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm test
```

Expected: 92 passed (14). If any fail, fix before proceeding.

- [ ] **Step 2: TypeScript clean build**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm tsc --noEmit
```

Expected: exit 0, no errors.

- [ ] **Step 3: Start the dev server and manually verify all four flows**

```bash
cd c:/Users/risha/Journi_MVP_new
pnpm dev
```

Verify:
1. **Onboarding wizard**: Create new account → upload a DOCX in Step 2 → complete wizard → lands on `/dashboard` → navigate to editor → document content is pre-loaded (not empty)
2. **Collaboration wizard**: On the editor page, open New Manuscript → import a DOCX → editor shows content, wizard does NOT reopen
3. **Authors/institutions**: Upload a DOCX that has author lines below the title → Dashboard Overview shows a "Document Metadata" card with those names
4. **Figures**: Upload a DOCX or PDF with embedded images → editor's "Figures and Tables" section shows `<figure>` blocks with labeled images and captions
