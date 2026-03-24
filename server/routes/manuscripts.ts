import { Router } from "express";
import { z } from "zod";
import { assertAnyOrganizationRole, assertManuscriptAccess, assertProjectEditable, getProjectAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
import { parseUploadedDocument } from "../services/manuscript-parse.service";

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


