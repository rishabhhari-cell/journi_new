import { Router } from "express";
import { z } from "zod";
import { assertManuscriptAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";

export const citationsRouter = Router();

const listSchema = z.object({
  manuscriptId: z.string().uuid(),
});

const createSchema = z.object({
  manuscriptId: z.string().uuid(),
  citationType: z.enum(["article", "book", "website", "conference"]),
  authors: z.array(z.string().min(1)).default([]),
  title: z.string().min(1),
  publicationYear: z.number().int().optional(),
  doi: z.string().optional(),
  url: z.string().optional(),
  metadata: z.record(z.string(), z.any()).default({}),
});

citationsRouter.use(requireAuth);

citationsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const query = listSchema.parse(req.query);
    await assertManuscriptAccess(authReq.auth.userId, query.manuscriptId, false);

    const { data, error } = await supabaseAdmin
      .from("citations")
      .select("*")
      .eq("manuscript_id", query.manuscriptId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new HttpError(500, error.message, "CITATIONS_LIST_FAILED");
    }

    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

citationsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createSchema.parse(req.body);
    const context = await assertManuscriptAccess(authReq.auth.userId, input.manuscriptId, true);

    const { data, error } = await supabaseAdmin
      .from("citations")
      .insert({
        manuscript_id: input.manuscriptId,
        citation_type: input.citationType,
        authors: input.authors,
        title: input.title,
        publication_year: input.publicationYear ?? null,
        doi: input.doi ?? null,
        url: input.url ?? null,
        metadata: input.metadata,
        created_by: authReq.auth.userId,
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Citation create failed", "CITATION_CREATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "citation.created",
      entityType: "citation",
      entityId: data.id,
      payload: { manuscriptId: input.manuscriptId, title: input.title },
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

citationsRouter.delete("/:citationId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const citationId = req.params.citationId;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("citations")
      .select("id, manuscript_id, title")
      .eq("id", citationId)
      .maybeSingle();

    if (existingError) {
      throw new HttpError(500, existingError.message, "CITATION_FETCH_FAILED");
    }
    if (!existing) {
      throw new HttpError(404, "Citation not found", "CITATION_NOT_FOUND");
    }

    const context = await assertManuscriptAccess(authReq.auth.userId, existing.manuscript_id, true);

    const { error } = await supabaseAdmin.from("citations").delete().eq("id", citationId);
    if (error) {
      throw new HttpError(400, error.message, "CITATION_DELETE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "citation.deleted",
      entityType: "citation",
      entityId: citationId,
      payload: { manuscriptId: existing.manuscript_id, title: existing.title },
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});
