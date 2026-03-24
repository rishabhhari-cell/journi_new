import { Router } from "express";
import { z } from "zod";
import { assertAnyOrganizationRole } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
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


