import { Router } from "express";
import { z } from "zod";
import { assertAnyOrganizationRole, assertManuscriptAccess, assertProjectEditable, getProjectAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireProAccess } from "../middleware/billing";
import { writeAuditEvent } from "../services/audit.service";
import { buildManuscriptFormatCheck } from "../services/format-check.service";
import {
  commitImportSession,
  createImportSession,
  getImportSession,
  updateImportSession,
} from "../services/import-session.service";
import { toJournalGuidelinesDto } from "../services/journal-guidelines.service";
import { parseUploadedDocument } from "../services/manuscript-parse.service";
import { getJournalById } from "../services/journals/search.service";

export const manuscriptsRouter = Router();

const querySchema = z.object({
  projectId: z.string().uuid(),
});

const createSchema = z.object({
  projectId: z.string().uuid(),
  title: z.string().min(2),
  type: z.string().default("full_paper"),
  status: z.enum(["draft", "ready", "submitted", "revision", "archived"]).default("draft"),
  sections: z
    .array(
      z.object({
        title: z.string().min(1),
        contentHtml: z.string().default("<p></p>"),
        status: z.enum(["complete", "active", "draft", "pending"]).default("pending"),
      }),
    )
    .default([]),
});

const patchSchema = z.object({
  title: z.string().min(2).optional(),
  type: z.string().optional(),
  status: z.enum(["draft", "ready", "submitted", "revision", "archived"]).optional(),
});

const sectionPatchSchema = z.object({
  title: z.string().optional(),
  contentHtml: z.string().optional(),
  status: z.enum(["complete", "active", "draft", "pending"]).optional(),
  sortOrder: z.number().int().optional(),
});

const createVersionSchema = z.object({
  manuscriptId: z.string().uuid(),
  label: z.string().min(1),
  snapshotBase64: z.string().min(1),
});

const parseUploadSchema = z.object({
  fileName: z.string().min(1),
  mimeType: z.string().optional(),
  base64: z.string().min(1),
});

const importSessionItemSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["section", "text_block", "reference", "table_candidate", "figure_caption", "manual_only"]),
  sourceFormat: z.enum(["docx", "pdf", "image"]),
  title: z.string().nullable().optional(),
  text: z.string().nullable().optional(),
  html: z.string().nullable().optional(),
  page: z.number().int().nullable().optional(),
  bbox: z
    .object({
      x: z.number(),
      y: z.number(),
      width: z.number(),
      height: z.number(),
    })
    .nullable()
    .optional(),
  confidence: z.number(),
  diagnostics: z.array(
    z.object({
      level: z.enum(["info", "warning", "error"]),
      code: z.string(),
      message: z.string(),
    }),
  ),
  proposedSectionTitle: z.string().nullable().optional(),
  assignedSectionTitle: z.string().nullable().optional(),
  decision: z.enum(["pending", "accepted", "rejected"]),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createImportSessionSchema = z.object({
  manuscriptId: z.string().uuid().nullable().optional(),
  fileName: z.string().min(1),
  fileTitle: z.string().min(1),
  sourceFormat: z.enum(["docx", "pdf", "image"]),
  reviewRequired: z.boolean(),
  status: z.enum(["pending_review", "ready_to_commit", "manual_only", "unsupported"]),
  unsupportedReason: z.string().nullable().optional(),
  diagnostics: z.array(
    z.object({
      level: z.enum(["info", "warning", "error"]),
      code: z.string(),
      message: z.string(),
    }),
  ),
  items: z.array(importSessionItemSchema),
});

const updateImportSessionSchema = z.object({
  status: z.enum(["pending_review", "ready_to_commit", "manual_only", "unsupported"]).optional(),
  unsupportedReason: z.string().nullable().optional(),
  items: z.array(importSessionItemSchema).optional(),
});

manuscriptsRouter.use(requireAuth);

manuscriptsRouter.post("/parse", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = parseUploadSchema.parse(req.body);
    await assertAnyOrganizationRole(authReq.auth.userId, "viewer");

    const buffer = Buffer.from(input.base64, "base64");
    const parsed = await parseUploadedDocument({
      fileName: input.fileName,
      mimeType: input.mimeType,
      buffer,
    });

    res.json({ data: parsed });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.post("/import-sessions", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createImportSessionSchema.parse(req.body);

    let organizationId: string | null = null;
    if (input.manuscriptId) {
      const context = await assertManuscriptAccess(authReq.auth.userId, input.manuscriptId, true);
      organizationId = context.access.organizationId;
    } else {
      await assertAnyOrganizationRole(authReq.auth.userId, "viewer");
    }

    const session = await createImportSession({
      manuscriptId: input.manuscriptId ?? null,
      fileName: input.fileName,
      fileTitle: input.fileTitle,
      sourceFormat: input.sourceFormat,
      reviewRequired: input.reviewRequired,
      status: input.status,
      unsupportedReason: input.unsupportedReason ?? null,
      diagnostics: input.diagnostics,
      items: input.items,
      actorUserId: authReq.auth.userId,
    });

    await writeAuditEvent({
      organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.import_session.created",
      entityType: "manuscript_import_session",
      entityId: session.id,
      payload: {
        manuscriptId: input.manuscriptId ?? null,
        sourceFormat: input.sourceFormat,
        status: input.status,
      },
    });

    res.status(201).json({ data: session });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.get("/import-sessions/:sessionId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const session = await getImportSession(req.params.sessionId);
    if (!session) {
      throw new HttpError(404, "Import session not found", "IMPORT_SESSION_NOT_FOUND");
    }

    if (session.manuscriptId) {
      await assertManuscriptAccess(authReq.auth.userId, session.manuscriptId, false);
    } else {
      await assertAnyOrganizationRole(authReq.auth.userId, "viewer");
    }

    res.json({ data: session });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.patch("/import-sessions/:sessionId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const existing = await getImportSession(req.params.sessionId);
    if (!existing) {
      throw new HttpError(404, "Import session not found", "IMPORT_SESSION_NOT_FOUND");
    }

    if (existing.manuscriptId) {
      await assertManuscriptAccess(authReq.auth.userId, existing.manuscriptId, true);
    } else {
      await assertAnyOrganizationRole(authReq.auth.userId, "viewer");
    }

    const input = updateImportSessionSchema.parse(req.body);
    const updated = await updateImportSession(req.params.sessionId, input);
    res.json({ data: updated });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.post("/import-sessions/:sessionId/commit", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const existing = await getImportSession(req.params.sessionId);
    if (!existing) {
      throw new HttpError(404, "Import session not found", "IMPORT_SESSION_NOT_FOUND");
    }
    if (!existing.manuscriptId) {
      throw new HttpError(400, "Import session does not target a manuscript", "IMPORT_SESSION_MANUSCRIPT_REQUIRED");
    }

    const context = await assertManuscriptAccess(authReq.auth.userId, existing.manuscriptId, true);
    const committed = await commitImportSession(req.params.sessionId);

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.import_session.committed",
      entityType: "manuscript_import_session",
      entityId: req.params.sessionId,
      payload: {
        manuscriptId: existing.manuscriptId,
        acceptedItems: existing.items.filter((item) => item.decision === "accepted").length,
      },
    });

    res.json({ data: committed });

    // Fire-and-forget: embed the abstract for journal recommendation.
    // Runs after response is sent — never blocks the commit.
    const manuscriptId = existing.manuscriptId;
    if (manuscriptId) {
      Promise.resolve(
        supabaseAdmin
          .from("manuscript_sections")
          .select("content_html")
          .eq("manuscript_id", manuscriptId)
          .ilike("title", "abstract")
          .limit(1),
      )
        .then(async ({ data: sections }) => {
          const html = (sections as Array<{ content_html?: string }> | null)?.[0]?.content_html;
          if (!html) return;
          const { embedSingle } = await import("../services/embed.service");
          const embedding = await embedSingle(html.replace(/<[^>]+>/g, " ").trim());
          if (!embedding) return;
          await supabaseAdmin
            .from("manuscripts")
            .update({ abstract_embedding: embedding })
            .eq("id", manuscriptId);
        })
        .catch(() => {/* non-critical */});
    }
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const query = querySchema.parse(req.query);
    await getProjectAccess(authReq.auth.userId, query.projectId);

    const { data, error } = await supabaseAdmin
      .from("manuscripts")
      .select("*, manuscript_sections(*)")
      .eq("project_id", query.projectId)
      .order("updated_at", { ascending: false });

    if (error) {
      throw new HttpError(500, error.message, "MANUSCRIPT_LIST_FAILED");
    }

    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createSchema.parse(req.body);
    const access = await assertProjectEditable(authReq.auth.userId, input.projectId);

    const { data: manuscript, error: manuscriptError } = await supabaseAdmin
      .from("manuscripts")
      .insert({
        project_id: input.projectId,
        title: input.title,
        type: input.type,
        status: input.status,
        created_by: authReq.auth.userId,
      })
      .select("*")
      .single();

    if (manuscriptError || !manuscript) {
      throw new HttpError(400, manuscriptError?.message ?? "Failed to create manuscript", "MANUSCRIPT_CREATE_FAILED");
    }

    if (input.sections.length > 0) {
      const sectionRows = input.sections.map((section, idx) => ({
        manuscript_id: manuscript.id,
        title: section.title,
        content_html: section.contentHtml,
        status: section.status,
        sort_order: idx,
        last_edited_by: authReq.auth.userId,
      }));
      const { error: sectionError } = await supabaseAdmin.from("manuscript_sections").insert(sectionRows);
      if (sectionError) {
        throw new HttpError(500, sectionError.message, "MANUSCRIPT_SECTIONS_CREATE_FAILED");
      }
    }

    await writeAuditEvent({
      organizationId: access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.created",
      entityType: "manuscript",
      entityId: manuscript.id,
      payload: { title: input.title, type: input.type },
    });

    res.status(201).json({ data: manuscript });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.patch("/:manuscriptId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = patchSchema.parse(req.body);
    const manuscriptId = req.params.manuscriptId;
    const context = await assertManuscriptAccess(authReq.auth.userId, manuscriptId, true);

    const { data, error } = await supabaseAdmin
      .from("manuscripts")
      .update({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.type !== undefined ? { type: input.type } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", manuscriptId)
      .select("*")
      .single();
    if (error) {
      throw new HttpError(400, error.message, "MANUSCRIPT_UPDATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.updated",
      entityType: "manuscript",
      entityId: manuscriptId,
      payload: input,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.patch("/:manuscriptId/sections/:sectionId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = sectionPatchSchema.parse(req.body);
    const manuscriptId = req.params.manuscriptId;
    const sectionId = req.params.sectionId;
    const context = await assertManuscriptAccess(authReq.auth.userId, manuscriptId, true);

    const { data, error } = await supabaseAdmin
      .from("manuscript_sections")
      .update({
        ...(input.title !== undefined ? { title: input.title } : {}),
        ...(input.contentHtml !== undefined ? { content_html: input.contentHtml } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.sortOrder !== undefined ? { sort_order: input.sortOrder } : {}),
        last_edited_by: authReq.auth.userId,
        last_edited_at: new Date().toISOString(),
      })
      .eq("id", sectionId)
      .eq("manuscript_id", manuscriptId)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Section update failed", "MANUSCRIPT_SECTION_UPDATE_FAILED");
    }

    await supabaseAdmin
      .from("manuscripts")
      .update({ updated_at: new Date().toISOString() })
      .eq("id", manuscriptId);

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.section.updated",
      entityType: "manuscript_section",
      entityId: sectionId,
      payload: {
        manuscriptId,
        fields: Object.keys(input),
      },
    });

    res.json({ data });

    // Re-embed abstract if that section was just edited — fire-and-forget.
    if (
      data.title?.toLowerCase() === "abstract" &&
      input.contentHtml
    ) {
      const plainText = input.contentHtml.replace(/<[^>]+>/g, " ").trim();
      if (plainText) {
        import("../services/embed.service")
          .then(({ embedSingle }) => embedSingle(plainText))
          .then(async (embedding) => {
            if (!embedding) return;
            await supabaseAdmin
              .from("manuscripts")
              .update({ abstract_embedding: embedding })
              .eq("id", manuscriptId);
          })
          .catch(() => {/* non-critical */});
      }
    }
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.post("/versions", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createVersionSchema.parse(req.body);
    const context = await assertManuscriptAccess(authReq.auth.userId, input.manuscriptId, true);

    const { data, error } = await supabaseAdmin
      .from("manuscript_versions")
      .insert({
        manuscript_id: input.manuscriptId,
        version_label: input.label,
        snapshot_base64: input.snapshotBase64,
        created_by: authReq.auth.userId,
      })
      .select("*")
      .single();

    if (error) {
      throw new HttpError(400, error.message, "MANUSCRIPT_VERSION_CREATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.version.created",
      entityType: "manuscript_version",
      entityId: data.id,
      payload: { manuscriptId: input.manuscriptId, label: input.label },
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.get("/:manuscriptId/versions", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const manuscriptId = req.params.manuscriptId;
    await assertManuscriptAccess(authReq.auth.userId, manuscriptId, false);

    const { data, error } = await supabaseAdmin
      .from("manuscript_versions")
      .select("id, version_label, created_at, created_by")
      .eq("manuscript_id", manuscriptId)
      .order("created_at", { ascending: false });

    if (error) {
      throw new HttpError(500, error.message, "MANUSCRIPT_VERSIONS_LIST_FAILED");
    }

    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

const formatCheckSchema = z.object({
  journalId: z.string().uuid(),
});

manuscriptsRouter.post("/:manuscriptId/format-check", requireProAccess, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const manuscriptId = req.params.manuscriptId;
    const input = formatCheckSchema.parse(req.body);

    await assertManuscriptAccess(authReq.auth.userId, manuscriptId, false);

    const { data: sections, error: sectionsError } = await supabaseAdmin
      .from("manuscript_sections")
      .select("id, title, content_html, sort_order")
      .eq("manuscript_id", manuscriptId)
      .order("sort_order", { ascending: true });

    if (sectionsError) {
      throw new HttpError(500, sectionsError.message, "MANUSCRIPT_SECTIONS_FETCH_FAILED");
    }
    if (!sections || sections.length === 0) {
      throw new HttpError(400, "Manuscript has no sections to reformat", "MANUSCRIPT_EMPTY");
    }

    const { data: citations, error: citationsError } = await supabaseAdmin
      .from("citations")
      .select("id")
      .eq("manuscript_id", manuscriptId);

    if (citationsError) {
      throw new HttpError(500, citationsError.message, "CITATIONS_LIST_FAILED");
    }

    const journal = await getJournalById(input.journalId);
    if (!journal) {
      throw new HttpError(404, "Journal not found", "JOURNAL_NOT_FOUND");
    }

    const formatCheck = buildManuscriptFormatCheck({
      manuscriptId,
      journalId: journal.id,
      journalName: journal.name,
      manuscriptSections: sections.map((s: any) => ({
        id: s.id,
        title: s.title,
        contentHtml: s.content_html ?? "<p></p>",
      })),
      manuscriptCitations: citations ?? [],
      journalGuidelines: toJournalGuidelinesDto(journal),
    });

    res.json({ data: formatCheck });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.delete("/:manuscriptId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const manuscriptId = req.params.manuscriptId;
    const context = await assertManuscriptAccess(authReq.auth.userId, manuscriptId, true);

    const { error } = await supabaseAdmin.from("manuscripts").delete().eq("id", manuscriptId);
    if (error) {
      throw new HttpError(400, error.message, "MANUSCRIPT_DELETE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "manuscript.deleted",
      entityType: "manuscript",
      entityId: manuscriptId,
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});

manuscriptsRouter.get("/:manuscriptId/recommend-journals", requireProAccess, async (req, res, next) => {
  try {
    const { manuscriptId } = req.params;
    const mode =
      req.query.mode === "impact" ? "impact" : req.query.mode === "odds" ? "odds" : "auto";
    const openAccess =
      req.query.openAccess === "true" ? true : req.query.openAccess === "false" ? false : undefined;

    const { data: ms } = await supabaseAdmin
      .from("manuscripts")
      .select("word_count")
      .eq("id", manuscriptId)
      .single();

    const { recommendJournals } = await import("../services/journal-recommend.service");
    const recommendations = await recommendJournals({
      manuscriptId,
      manuscriptWordCount: (ms as { word_count?: number } | null)?.word_count ?? 0,
      filters: { mode, openAccess },
    });

    res.json({ journals: recommendations });
  } catch (err) {
    next(err);
  }
});


