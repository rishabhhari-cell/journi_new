import type {
  ImportSessionItemDTO,
  ManuscriptImportSessionDTO,
} from "../../shared/backend";
import { normalizeSectionMatchKey } from "../../shared/document-parse";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";

interface ImportSessionRow {
  id: string;
  manuscript_id: string | null;
  file_name: string;
  file_title: string;
  source_format: "docx" | "pdf" | "image";
  review_required: boolean;
  status: "pending_review" | "ready_to_commit" | "manual_only" | "unsupported" | "committed";
  unsupported_reason: string | null;
  diagnostics_json: Array<{ level: "info" | "warning" | "error"; code: string; message: string }>;
  items_json: ImportSessionItemDTO[];
  committed_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface CreateImportSessionInput {
  manuscriptId?: string | null;
  fileName: string;
  fileTitle: string;
  sourceFormat: "docx" | "pdf" | "image";
  reviewRequired: boolean;
  status: "pending_review" | "ready_to_commit" | "manual_only" | "unsupported";
  unsupportedReason?: string | null;
  diagnostics: Array<{ level: "info" | "warning" | "error"; code: string; message: string }>;
  items: ImportSessionItemDTO[];
  actorUserId: string;
}

export interface UpdateImportSessionInput {
  status?: "pending_review" | "ready_to_commit" | "manual_only" | "unsupported";
  unsupportedReason?: string | null;
  items?: ImportSessionItemDTO[];
}

function mapImportSessionRow(row: ImportSessionRow): ManuscriptImportSessionDTO {
  return {
    id: row.id,
    manuscriptId: row.manuscript_id,
    fileName: row.file_name,
    fileTitle: row.file_title,
    sourceFormat: row.source_format,
    reviewRequired: row.review_required,
    status: row.status,
    unsupportedReason: row.unsupported_reason,
    diagnostics: row.diagnostics_json ?? [],
    items: row.items_json ?? [],
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    committedAt: row.committed_at,
  };
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildProvenanceComment(sessionId: string, item: ImportSessionItemDTO): string {
  return `<!--journi-import:${escapeHtml(
    JSON.stringify({
      sessionId,
      itemId: item.id,
      page: item.page ?? null,
      sourceFormat: item.sourceFormat,
      type: item.type,
    }),
  )}-->`;
}

function wrapImportedHtml(sessionId: string, item: ImportSessionItemDTO, html: string): string {
  const marker = buildProvenanceComment(sessionId, item);
  return `${marker}${html}`;
}

function itemToHtml(sessionId: string, item: ImportSessionItemDTO): string {
  if (item.html?.trim()) return wrapImportedHtml(sessionId, item, item.html);

  const text = item.text?.trim() ?? "";
  if (!text) return "";

  if (item.type === "figure_caption") {
    return wrapImportedHtml(sessionId, item, `<p><em>${escapeHtml(text)}</em></p>`);
  }

  return wrapImportedHtml(sessionId, item, `<p>${escapeHtml(text)}</p>`);
}

function parseReferenceToCitation(item: ImportSessionItemDTO) {
  const raw = item.text?.trim() ?? "";
  const doiMatch = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
  const urlMatch = raw.match(/https?:\/\/[^\s)]+/i);
  const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
  const sentenceParts = raw.split(".").map((part) => part.trim()).filter(Boolean);
  const title = sentenceParts.length > 1 ? sentenceParts[1] : sentenceParts[0] || raw;
  const authorPart = sentenceParts[0] || "";
  const authors = authorPart
    .split(/,| and /i)
    .map((name) => name.trim())
    .filter(Boolean)
    .slice(0, 6);

  return {
    citation_type: "article",
    authors: authors.length > 0 ? authors : ["Unknown"],
    title: title || "Imported reference",
    publication_year: yearMatch ? Number(yearMatch[0]) : null,
    doi: doiMatch ? doiMatch[0] : null,
    url: urlMatch ? urlMatch[0] : null,
    metadata: {
      raw,
      import_session_item_id: item.id,
      import_section_title: item.assignedSectionTitle ?? item.proposedSectionTitle ?? null,
      import_page: item.page ?? null,
    },
  };
}

export async function createImportSession(input: CreateImportSessionInput): Promise<ManuscriptImportSessionDTO> {
  const { data, error } = await supabaseAdmin
    .from("manuscript_import_sessions")
    .insert({
      manuscript_id: input.manuscriptId ?? null,
      file_name: input.fileName,
      file_title: input.fileTitle,
      source_format: input.sourceFormat,
      review_required: input.reviewRequired,
      status: input.status,
      unsupported_reason: input.unsupportedReason ?? null,
      diagnostics_json: input.diagnostics,
      items_json: input.items,
      created_by: input.actorUserId,
    })
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Failed to create import session", "IMPORT_SESSION_CREATE_FAILED");
  }

  return mapImportSessionRow(data as ImportSessionRow);
}

export async function getImportSession(sessionId: string): Promise<ManuscriptImportSessionDTO | null> {
  const { data, error } = await supabaseAdmin
    .from("manuscript_import_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message, "IMPORT_SESSION_READ_FAILED");
  }
  if (!data) return null;
  return mapImportSessionRow(data as ImportSessionRow);
}

export async function updateImportSession(
  sessionId: string,
  input: UpdateImportSessionInput,
): Promise<ManuscriptImportSessionDTO> {
  const updates: Record<string, unknown> = {};
  if (input.status !== undefined) updates.status = input.status;
  if (input.unsupportedReason !== undefined) updates.unsupported_reason = input.unsupportedReason;
  if (input.items !== undefined) updates.items_json = input.items;

  const { data, error } = await supabaseAdmin
    .from("manuscript_import_sessions")
    .update(updates)
    .eq("id", sessionId)
    .select("*")
    .single();

  if (error || !data) {
    throw new HttpError(500, error?.message ?? "Failed to update import session", "IMPORT_SESSION_UPDATE_FAILED");
  }

  return mapImportSessionRow(data as ImportSessionRow);
}

export async function commitImportSession(sessionId: string) {
  const { data, error } = await supabaseAdmin
    .from("manuscript_import_sessions")
    .select("*")
    .eq("id", sessionId)
    .maybeSingle();

  if (error) {
    throw new HttpError(500, error.message, "IMPORT_SESSION_READ_FAILED");
  }
  if (!data) {
    throw new HttpError(404, "Import session not found", "IMPORT_SESSION_NOT_FOUND");
  }

  const session = data as ImportSessionRow;
  if (!session.manuscript_id) {
    throw new HttpError(400, "Import session does not target a manuscript", "IMPORT_SESSION_MANUSCRIPT_REQUIRED");
  }
  if (session.status === "committed") {
    throw new HttpError(400, "Import session has already been committed", "IMPORT_SESSION_ALREADY_COMMITTED");
  }
  if (session.status === "unsupported" || session.status === "manual_only") {
    throw new HttpError(400, "This import session cannot be committed automatically", "IMPORT_SESSION_UNSUPPORTED");
  }

  const acceptedItems = (session.items_json ?? []).filter((item) => item.decision === "accepted");
  if (acceptedItems.length === 0) {
    throw new HttpError(400, "No accepted import items to commit", "IMPORT_SESSION_EMPTY_COMMIT");
  }

  const { data: existingSections, error: sectionsError } = await supabaseAdmin
    .from("manuscript_sections")
    .select("*")
    .eq("manuscript_id", session.manuscript_id)
    .order("sort_order", { ascending: true });

  if (sectionsError) {
    throw new HttpError(500, sectionsError.message, "MANUSCRIPT_SECTIONS_FETCH_FAILED");
  }

  const sectionRows = [...(existingSections ?? [])];
  const sectionByTitle = new Map(sectionRows.map((row) => [row.title.trim().toLowerCase(), row]));
  const sectionByKey = new Map(sectionRows.map((row) => [normalizeSectionMatchKey(row.title), row]));
  let maxSortOrder = sectionRows.reduce((max, row) => Math.max(max, row.sort_order ?? 0), -1);

  const sectionItems = acceptedItems.filter((item) =>
    item.type === "section" ||
    item.type === "text_block" ||
    item.type === "table_candidate" ||
    item.type === "figure_caption",
  );
  const referenceItems = acceptedItems.filter((item) => item.type === "reference");

  for (const item of sectionItems) {
    const sectionTitle =
      item.assignedSectionTitle?.trim() ||
      item.proposedSectionTitle?.trim() ||
      item.title?.trim() ||
      "Imported Content";
    const contentHtml = itemToHtml(sessionId, item);
    if (!contentHtml) continue;

    const key = sectionTitle.toLowerCase();
    const existing = sectionByTitle.get(key) ?? sectionByKey.get(normalizeSectionMatchKey(sectionTitle));
    if (existing) {
      const existingHtml = existing.content_html || "<p></p>";
      existing.content_html =
        existingHtml.trim() === "<p></p>" || existingHtml.trim() === ""
          ? contentHtml
          : `${existingHtml}\n${contentHtml}`;
      existing.status = existing.status === "pending" ? "draft" : existing.status;
      continue;
    }

    sectionRows.push({
      id: crypto.randomUUID(),
      manuscript_id: session.manuscript_id,
      title: sectionTitle,
      content_html: contentHtml,
      status: "draft",
      sort_order: ++maxSortOrder,
      last_edited_by: session.created_by,
      last_edited_at: new Date().toISOString(),
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    });
    sectionByTitle.set(key, sectionRows[sectionRows.length - 1]);
    sectionByKey.set(normalizeSectionMatchKey(sectionTitle), sectionRows[sectionRows.length - 1]);
  }

  const upsertPayload = sectionRows.map((row, index) => ({
    id: row.id,
    manuscript_id: row.manuscript_id,
    title: row.title,
    content_html: row.content_html,
    status: row.status,
    sort_order: index,
    last_edited_by: session.created_by,
    last_edited_at: new Date().toISOString(),
  }));

  const { error: upsertSectionsError } = await supabaseAdmin
    .from("manuscript_sections")
    .upsert(upsertPayload, { onConflict: "id" });

  if (upsertSectionsError) {
    throw new HttpError(500, upsertSectionsError.message, "MANUSCRIPT_SECTIONS_COMMIT_FAILED");
  }

  if (referenceItems.length > 0) {
    const citationRows = referenceItems.map((item) => ({
      manuscript_id: session.manuscript_id,
      created_by: session.created_by,
      ...parseReferenceToCitation(item),
    }));

    const { error: citationError } = await supabaseAdmin.from("citations").insert(citationRows);
    if (citationError) {
      throw new HttpError(500, citationError.message, "IMPORT_SESSION_CITATIONS_FAILED");
    }
  }

  const { data: updatedSession, error: sessionUpdateError } = await supabaseAdmin
    .from("manuscript_import_sessions")
    .update({
      status: "committed",
      committed_at: new Date().toISOString(),
      items_json: session.items_json,
    })
    .eq("id", sessionId)
    .select("*")
    .single();

  if (sessionUpdateError || !updatedSession) {
    throw new HttpError(
      500,
      sessionUpdateError?.message ?? "Failed to finalize import session",
      "IMPORT_SESSION_FINALIZE_FAILED",
    );
  }

  const { data: refreshedSections, error: refreshedSectionsError } = await supabaseAdmin
    .from("manuscript_sections")
    .select("*")
    .eq("manuscript_id", session.manuscript_id)
    .order("sort_order", { ascending: true });

  if (refreshedSectionsError) {
    throw new HttpError(500, refreshedSectionsError.message, "MANUSCRIPT_SECTIONS_FETCH_FAILED");
  }

  const { data: refreshedCitations, error: refreshedCitationsError } = await supabaseAdmin
    .from("citations")
    .select("*")
    .eq("manuscript_id", session.manuscript_id)
    .order("created_at", { ascending: true });

  if (refreshedCitationsError) {
    throw new HttpError(500, refreshedCitationsError.message, "CITATIONS_LIST_FAILED");
  }

  return {
    session: mapImportSessionRow(updatedSession as ImportSessionRow),
    sections: refreshedSections ?? [],
    citations: refreshedCitations ?? [],
  };
}
