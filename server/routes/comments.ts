import { Router } from "express";
import { z } from "zod";
import { assertManuscriptAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
import { createMentionNotifications } from "../services/notifications.service";

export const commentsRouter = Router();

const listSchema = z.object({
  manuscriptId: z.string().uuid(),
});

const createSchema = z.object({
  manuscriptId: z.string().uuid(),
  sectionId: z.string().uuid().optional(),
  parentId: z.string().uuid().optional(),
  content: z.string().min(1),
  quotedText: z.string().optional(),
});

const patchSchema = z.object({
  content: z.string().min(1).optional(),
  resolved: z.boolean().optional(),
});

commentsRouter.use(requireAuth);

commentsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const query = listSchema.parse(req.query);
    await assertManuscriptAccess(authReq.auth.userId, query.manuscriptId, false);

    const { data, error } = await supabaseAdmin
      .from("comments")
      .select("*, profiles!comments_author_user_id_fkey(full_name, initials)")
      .eq("manuscript_id", query.manuscriptId)
      .order("created_at", { ascending: true });

    if (error) {
      throw new HttpError(500, error.message, "COMMENTS_LIST_FAILED");
    }

    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

commentsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createSchema.parse(req.body);
    const context = await assertManuscriptAccess(authReq.auth.userId, input.manuscriptId, false);

    const { data, error } = await supabaseAdmin
      .from("comments")
      .insert({
        manuscript_id: input.manuscriptId,
        section_id: input.sectionId ?? null,
        parent_id: input.parentId ?? null,
        author_user_id: authReq.auth.userId,
        content: input.content,
        quoted_text: input.quotedText ?? null,
      })
      .select("*")
      .single();

    if (error) {
      throw new HttpError(400, error.message, "COMMENT_CREATE_FAILED");
    }

    await createMentionNotifications({
      organizationId: context.access.organizationId,
      manuscriptId: input.manuscriptId,
      actorUserId: authReq.auth.userId,
      content: input.content,
    });

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "comment.created",
      entityType: "comment",
      entityId: data.id,
      payload: {
        manuscriptId: input.manuscriptId,
        sectionId: input.sectionId ?? null,
      },
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

commentsRouter.patch("/:commentId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = patchSchema.parse(req.body);
    const commentId = req.params.commentId;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("comments")
      .select("id, manuscript_id")
      .eq("id", commentId)
      .maybeSingle();
    if (existingError) {
      throw new HttpError(500, existingError.message, "COMMENT_FETCH_FAILED");
    }
    if (!existing) {
      throw new HttpError(404, "Comment not found", "COMMENT_NOT_FOUND");
    }

    const context = await assertManuscriptAccess(authReq.auth.userId, existing.manuscript_id, false);

    const { data, error } = await supabaseAdmin
      .from("comments")
      .update({
        ...(input.content !== undefined ? { content: input.content } : {}),
        ...(input.resolved !== undefined ? { resolved: input.resolved } : {}),
        updated_at: new Date().toISOString(),
      })
      .eq("id", commentId)
      .select("*")
      .single();

    if (error) {
      throw new HttpError(400, error.message, "COMMENT_UPDATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "comment.updated",
      entityType: "comment",
      entityId: commentId,
      payload: input,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

commentsRouter.delete("/:commentId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const commentId = req.params.commentId;

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("comments")
      .select("id, manuscript_id")
      .eq("id", commentId)
      .maybeSingle();
    if (existingError) {
      throw new HttpError(500, existingError.message, "COMMENT_FETCH_FAILED");
    }
    if (!existing) {
      throw new HttpError(404, "Comment not found", "COMMENT_NOT_FOUND");
    }

    const context = await assertManuscriptAccess(authReq.auth.userId, existing.manuscript_id, true);

    const { error } = await supabaseAdmin.from("comments").delete().eq("id", commentId);
    if (error) {
      throw new HttpError(400, error.message, "COMMENT_DELETE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "comment.deleted",
      entityType: "comment",
      entityId: commentId,
      payload: {
        manuscriptId: existing.manuscript_id,
      },
    });

    res.json({ ok: true });
  } catch (error) {
    next(error);
  }
});


