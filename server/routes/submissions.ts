import { Router } from "express";
import { z } from "zod";
import { assertManuscriptAccess, getProjectAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { requireProAccess } from "../middleware/billing";
import { writeAuditEvent } from "../services/audit.service";

export const submissionsRouter = Router();

const submissionStatus = z.enum([
  "draft",
  "submitted",
  "under_review",
  "minor_revision",
  "major_revision",
  "accepted",
  "rejected",
  "withdrawn",
]);

const createSubmissionSchema = z.object({
  manuscriptId: z.string().uuid(),
  journalId: z.string().uuid(),
  externalPortalUrl: z.string().url().optional(),
  status: submissionStatus.default("submitted"),
  submittedAt: z.string().datetime().optional(),
  notes: z.string().max(10000).optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const listSchema = z.object({
  projectId: z.string().uuid(),
});

const updateSubmissionSchema = z.object({
  externalPortalUrl: z.string().url().nullable().optional(),
  status: submissionStatus.optional(),
  submittedAt: z.string().datetime().nullable().optional(),
  decisionAt: z.string().datetime().nullable().optional(),
  notes: z.string().max(10000).nullable().optional(),
  metadata: z.record(z.string(), z.unknown()).optional(),
});

const createSubmissionEventSchema = z.object({
  eventType: z.string().min(2).max(100),
  note: z.string().max(10000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
});

submissionsRouter.use(requireAuth, requireProAccess);

async function getSubmissionWithAccessOrThrow(userId: string, submissionId: string, requireEdit: boolean) {
  const { data: submission, error } = await supabaseAdmin
    .from("journal_submissions")
    .select("id, manuscript_id, journal_id, status")
    .eq("id", submissionId)
    .maybeSingle();

  if (error) throw new HttpError(500, error.message, "SUBMISSION_FETCH_FAILED");
  if (!submission) throw new HttpError(404, "Submission not found", "SUBMISSION_NOT_FOUND");

  const context = await assertManuscriptAccess(userId, submission.manuscript_id, requireEdit);
  return { submission, context };
}

submissionsRouter.post("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createSubmissionSchema.parse(req.body);
    const context = await assertManuscriptAccess(authReq.auth.userId, input.manuscriptId, true);

    const { data: journal, error: journalError } = await supabaseAdmin
      .from("journals")
      .select("id, submission_portal_url")
      .eq("id", input.journalId)
      .maybeSingle();
    if (journalError) throw new HttpError(500, journalError.message, "JOURNAL_FETCH_FAILED");
    if (!journal) throw new HttpError(404, "Journal not found", "JOURNAL_NOT_FOUND");

    const { data, error } = await supabaseAdmin
      .from("journal_submissions")
      .insert({
        manuscript_id: input.manuscriptId,
        journal_id: input.journalId,
        submitted_by: authReq.auth.userId,
        external_portal_url: input.externalPortalUrl ?? journal.submission_portal_url ?? null,
        status: input.status,
        submitted_at: input.submittedAt ?? new Date().toISOString(),
        notes: input.notes ?? null,
        metadata: input.metadata ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Submission create failed", "SUBMISSION_CREATE_FAILED");
    }

    await supabaseAdmin.from("submission_events").insert({
      submission_id: data.id,
      actor_user_id: authReq.auth.userId,
      event_type: "submission.created",
      note: "Submission tracker created",
      payload: {
        status: data.status,
      },
    });

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "submission.created",
      entityType: "journal_submission",
      entityId: data.id,
      payload: {
        manuscriptId: input.manuscriptId,
        journalId: input.journalId,
      },
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.get("/", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const query = listSchema.parse(req.query);
    await getProjectAccess(authReq.auth.userId, query.projectId);

    const { data, error } = await supabaseAdmin
      .from("journal_submissions")
      .select("*, journals(id, name, submission_portal_url), manuscripts!inner(id, title, project_id)")
      .eq("manuscripts.project_id", query.projectId)
      .order("created_at", { ascending: false });

    if (error) throw new HttpError(500, error.message, "SUBMISSION_LIST_FAILED");
    res.json({ data: data ?? [] });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.get("/:submissionId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const { submission, context } = await getSubmissionWithAccessOrThrow(authReq.auth.userId, req.params.submissionId, false);

    const [{ data, error }, { data: events, error: eventsError }] = await Promise.all([
      supabaseAdmin
        .from("journal_submissions")
        .select("*, journals(id, name, submission_portal_url), manuscripts(id, title, project_id)")
        .eq("id", submission.id)
        .single(),
      supabaseAdmin
        .from("submission_events")
        .select("*")
        .eq("submission_id", submission.id)
        .order("created_at", { ascending: true }),
    ]);

    if (error) throw new HttpError(500, error.message, "SUBMISSION_FETCH_FAILED");
    if (eventsError) throw new HttpError(500, eventsError.message, "SUBMISSION_EVENTS_FETCH_FAILED");

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "submission.viewed",
      entityType: "journal_submission",
      entityId: submission.id,
    });

    res.json({ data: { ...data, events: events ?? [] } });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.patch("/:submissionId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = updateSubmissionSchema.parse(req.body);
    const { submission, context } = await getSubmissionWithAccessOrThrow(authReq.auth.userId, req.params.submissionId, true);

    const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (input.externalPortalUrl !== undefined) updates.external_portal_url = input.externalPortalUrl;
    if (input.status !== undefined) updates.status = input.status;
    if (input.submittedAt !== undefined) updates.submitted_at = input.submittedAt;
    if (input.decisionAt !== undefined) updates.decision_at = input.decisionAt;
    if (input.notes !== undefined) updates.notes = input.notes;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const { data, error } = await supabaseAdmin
      .from("journal_submissions")
      .update(updates)
      .eq("id", submission.id)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Submission update failed", "SUBMISSION_UPDATE_FAILED");
    }

    await supabaseAdmin.from("submission_events").insert({
      submission_id: submission.id,
      actor_user_id: authReq.auth.userId,
      event_type: input.status && input.status !== submission.status ? "submission.status_changed" : "submission.updated",
      note: input.status && input.status !== submission.status ? `Status updated to ${input.status}` : "Submission updated",
      payload: {
        updatedFields: Object.keys(input),
      },
    });

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "submission.updated",
      entityType: "journal_submission",
      entityId: submission.id,
      payload: input as Record<string, unknown>,
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

submissionsRouter.post("/:submissionId/events", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const input = createSubmissionEventSchema.parse(req.body);
    const { submission, context } = await getSubmissionWithAccessOrThrow(authReq.auth.userId, req.params.submissionId, true);

    const { data, error } = await supabaseAdmin
      .from("submission_events")
      .insert({
        submission_id: submission.id,
        actor_user_id: authReq.auth.userId,
        event_type: input.eventType,
        note: input.note ?? null,
        payload: input.payload ?? {},
      })
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Submission event create failed", "SUBMISSION_EVENT_CREATE_FAILED");
    }

    await writeAuditEvent({
      organizationId: context.access.organizationId,
      actorUserId: authReq.auth.userId,
      eventType: "submission.event.created",
      entityType: "submission_event",
      entityId: data.id,
      payload: {
        submissionId: submission.id,
        eventType: input.eventType,
      },
    });

    res.status(201).json({ data });
  } catch (error) {
    next(error);
  }
});

