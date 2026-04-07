import { Router } from "express";
import { z } from "zod";
import { assertAnyOrganizationRole } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
import { toJournalGuidelinesDto } from "../services/journal-guidelines.service";
import { ingestJournals } from "../services/journals/ingest.service";
import { getJournalById, searchJournals } from "../services/journals/search.service";
import { syncJournals } from "../services/journals/sync.service";
import type { JournalImportInput } from "../services/journals/types";

export const journalsRouter = Router();

const searchSchema = z.object({
  q: z.string().optional(),
  page: z.coerce.number().int().min(1).default(1),
  perPage: z.coerce.number().int().min(1).max(100).default(25),
  sortBy: z.enum(["relevance", "impact_factor", "name", "last_verified_at"]).default("relevance"),
  sortDirection: z.enum(["asc", "desc"]).default("desc"),
  openAccess: z
    .string()
    .optional()
    .transform((value) => (value === undefined ? undefined : value === "true")),
  impactFactorMin: z.coerce.number().optional(),
  impactFactorMax: z.coerce.number().optional(),
  subjectAreas: z
    .string()
    .optional()
    .transform((value) => (value ? value.split(",").map((v) => v.trim()).filter(Boolean) : undefined)),
});

const importSchema = z.object({
  source: z.string().min(1).default("manual"),
  journals: z
    .array(
      z.object({
        externalId: z.string().optional(),
        name: z.string().min(2),
        abbreviation: z.string().optional(),
        logoUrl: z.string().url().optional(),
        impactFactor: z.number().nullable().optional(),
        impactFactorYear: z.number().int().nullable().optional(),
        openAccess: z.boolean().nullable().optional(),
        websiteUrl: z.string().url().optional(),
        submissionPortalUrl: z.string().url().optional(),
        submissionRequirements: z.record(z.string(), z.unknown()).nullable().optional(),
        publisher: z.string().optional(),
        subjectAreas: z.array(z.string()).optional(),
        geographicLocation: z.string().optional(),
        issnPrint: z.string().optional(),
        issnOnline: z.string().optional(),
        acceptanceRate: z.number().nullable().optional(),
        avgDecisionDays: z.number().int().nullable().optional(),
        apcCostUsd: z.number().nullable().optional(),
        provenance: z.record(z.string(), z.string()).optional(),
      }),
    )
    .min(1),
});

const syncSchema = z.object({
  journalIds: z.array(z.string().uuid()).optional(),
  staleHours: z.number().int().min(1).optional(),
});

journalsRouter.get("/", async (req, res, next) => {
  try {
    const query = searchSchema.parse(req.query);
    const result = await searchJournals({
      q: query.q,
      page: query.page,
      perPage: query.perPage,
      sortBy: query.sortBy,
      sortDirection: query.sortDirection,
      openAccess: query.openAccess,
      impactFactorMin: query.impactFactorMin,
      impactFactorMax: query.impactFactorMax,
      subjectAreas: query.subjectAreas,
    });
    res.json(result);
  } catch (error) {
    next(error);
  }
});

journalsRouter.get("/:journalId", async (req, res, next) => {
  try {
    const journal = await getJournalById(req.params.journalId);
    if (!journal) {
      throw new HttpError(404, "Journal not found", "JOURNAL_NOT_FOUND");
    }
    res.json({ data: journal });
  } catch (error) {
    next(error);
  }
});

journalsRouter.post("/import", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    const input = importSchema.parse(req.body);

    const result = await ingestJournals({
      source: input.source,
      journals: input.journals as JournalImportInput[],
      actorUserId: authReq.auth.userId,
    });

    await writeAuditEvent({
      actorUserId: authReq.auth.userId,
      eventType: "journals.import",
      entityType: "journal_batch",
      payload: {
        source: input.source,
        processed: result.processed,
      },
    });

    res.status(201).json({ data: result });
  } catch (error) {
    next(error);
  }
});

// PATCH /journals/:journalId — admin-only manual corrections (acceptance rate, metrics, guidelines)
const journalPatchSchema = z.object({
  name: z.string().min(2).optional(),
  abbreviation: z.string().optional(),
  impactFactor: z.number().nullable().optional(),
  impactFactorYear: z.number().int().nullable().optional(),
  openAccess: z.boolean().nullable().optional(),
  websiteUrl: z.string().url().nullable().optional(),
  submissionPortalUrl: z.string().url().nullable().optional(),
  submissionRequirements: z.record(z.string(), z.unknown()).nullable().optional(),
  publisher: z.string().optional(),
  subjectAreas: z.array(z.string()).optional(),
  geographicLocation: z.string().optional(),
  issnPrint: z.string().optional(),
  issnOnline: z.string().optional(),
  acceptanceRate: z.number().min(0).max(100).nullable().optional(),
  avgDecisionDays: z.number().int().min(1).nullable().optional(),
  apcCostUsd: z.number().nullable().optional(),
});

journalsRouter.patch("/:journalId", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");

    const journalId = req.params.journalId;
    const input = journalPatchSchema.parse(req.body);

    const updates: Record<string, unknown> = {};
    if (input.name !== undefined) updates.name = input.name;
    if (input.abbreviation !== undefined) updates.abbreviation = input.abbreviation;
    if (input.impactFactor !== undefined) updates.impact_factor = input.impactFactor;
    if (input.impactFactorYear !== undefined) updates.impact_factor_year = input.impactFactorYear;
    if (input.openAccess !== undefined) updates.open_access = input.openAccess;
    if (input.websiteUrl !== undefined) updates.website_url = input.websiteUrl;
    if (input.submissionPortalUrl !== undefined) updates.submission_portal_url = input.submissionPortalUrl;
    if (input.submissionRequirements !== undefined) updates.submission_requirements_json = input.submissionRequirements;
    if (input.publisher !== undefined) updates.publisher = input.publisher;
    if (input.subjectAreas !== undefined) updates.subject_areas = input.subjectAreas;
    if (input.geographicLocation !== undefined) updates.geographic_location = input.geographicLocation;
    if (input.issnPrint !== undefined) updates.issn_print = input.issnPrint;
    if (input.issnOnline !== undefined) updates.issn_online = input.issnOnline;
    if (input.acceptanceRate !== undefined) updates.acceptance_rate = input.acceptanceRate;
    if (input.avgDecisionDays !== undefined) updates.avg_decision_days = input.avgDecisionDays;
    if (input.apcCostUsd !== undefined) updates.apc_cost_usd = input.apcCostUsd;

    // Mark manually edited fields as "manual" provenance (priority 100)
    const { data: existing } = await supabaseAdmin
      .from("journals")
      .select("provenance")
      .eq("id", journalId)
      .maybeSingle();

    const provenance = { ...(existing?.provenance ?? {}) };
    for (const key of Object.keys(updates)) {
      provenance[key] = "manual";
    }
    updates.provenance = provenance;
    updates.last_verified_at = new Date().toISOString();

    const { data, error } = await supabaseAdmin
      .from("journals")
      .update(updates)
      .eq("id", journalId)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Journal update failed", "JOURNAL_UPDATE_FAILED");
    }

    await writeAuditEvent({
      actorUserId: authReq.auth.userId,
      eventType: "journals.import",
      entityType: "journal",
      entityId: journalId,
      payload: { source: "manual_patch", fields: Object.keys(updates) },
    });

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// GET /journals/:journalId/guidelines
journalsRouter.get("/:journalId/guidelines", async (req, res, next) => {
  try {
    const journal = await getJournalById(req.params.journalId);
    if (!journal) {
      throw new HttpError(404, "Journal not found", "JOURNAL_NOT_FOUND");
    }

    res.json({ data: toJournalGuidelinesDto(journal) });
  } catch (error) {
    next(error);
  }
});

journalsRouter.post("/sync", requireAuth, async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    await assertAnyOrganizationRole(authReq.auth.userId, "admin");
    const input = syncSchema.parse(req.body ?? {});
    const result = await syncJournals({
      journalIds: input.journalIds,
      staleHours: input.staleHours,
    });

    await writeAuditEvent({
      actorUserId: authReq.auth.userId,
      eventType: "journals.sync",
      entityType: "journal_batch",
      payload: result as unknown as Record<string, unknown>,
    });

    res.json({ data: result });
  } catch (error) {
    next(error);
  }
});


