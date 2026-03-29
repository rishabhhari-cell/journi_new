import axios from "axios";
import { Router } from "express";
import { z } from "zod";
import { assertManuscriptAccess } from "../lib/access";
import { HttpError } from "../lib/http-error";
import { supabaseAdmin } from "../lib/supabase";
import { requireAuth, type AuthedRequest } from "../middleware/auth";
import { writeAuditEvent } from "../services/audit.service";
import { type CitationFormat, formatCitation } from "../services/citation-format.service";

export const citationsRouter = Router();

const listSchema = z.object({
  manuscriptId: z.string().uuid(),
  format: z.enum(["vancouver", "apa", "mla"]).optional(),
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

const updateSchema = z.object({
  citationType: z.enum(["article", "book", "website", "conference"]).optional(),
  authors: z.array(z.string().min(1)).optional(),
  title: z.string().min(1).optional(),
  publicationYear: z.number().int().nullable().optional(),
  doi: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

const lookupSchema = z.object({
  doi: z.string().min(3),
});

citationsRouter.use(requireAuth);

// GET /citations?manuscriptId=X[&format=vancouver]
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

    const citations = data ?? [];

    if (query.format) {
      const fmt = query.format as CitationFormat;
      const formatted = citations.map((c: any) => ({
        id: c.id,
        formatted: formatCitation(c, fmt),
      }));
      return res.json({ data: formatted });
    }

    res.json({ data: citations });
  } catch (error) {
    next(error);
  }
});

// POST /citations/lookup — resolve a DOI to structured citation metadata
citationsRouter.post("/lookup", async (req, res, next) => {
  try {
    const input = lookupSchema.parse(req.body);
    const doi = input.doi.replace(/^https?:\/\/doi\.org\//i, "").trim();

    const response = await axios.get(`https://api.crossref.org/works/${encodeURIComponent(doi)}`, {
      headers: { Accept: "application/json" },
      timeout: 8000,
    });

    const work = response.data?.message;
    if (!work) {
      throw new HttpError(404, "DOI not found in Crossref", "DOI_NOT_FOUND");
    }

    const authors = (work.author ?? []).map(
      (a: any) => `${a.given ?? ""} ${a.family ?? ""}`.trim(),
    );
    const title = Array.isArray(work.title) ? work.title[0] : work.title ?? "";
    const journal = Array.isArray(work["container-title"])
      ? work["container-title"][0]
      : work["container-title"] ?? "";
    const year =
      work.published?.["date-parts"]?.[0]?.[0] ??
      work["published-print"]?.["date-parts"]?.[0]?.[0] ??
      null;

    res.json({
      data: {
        citationType: "article",
        authors,
        title,
        publicationYear: year,
        doi,
        url: work.URL ?? null,
        metadata: {
          journal,
          volume: work.volume ?? "",
          issue: work.issue ?? "",
          pages: work.page ?? "",
          publisher: work.publisher ?? "",
        },
      },
    });
  } catch (error) {
    if (axios.isAxiosError(error) && error.response?.status === 404) {
      return next(new HttpError(404, "DOI not found", "DOI_NOT_FOUND"));
    }
    next(error);
  }
});

// POST /citations
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

// PATCH /citations/:citationId
citationsRouter.patch("/:citationId", async (req, res, next) => {
  try {
    const authReq = req as unknown as AuthedRequest;
    const citationId = req.params.citationId;
    const input = updateSchema.parse(req.body);

    const { data: existing, error: existingError } = await supabaseAdmin
      .from("citations")
      .select("id, manuscript_id")
      .eq("id", citationId)
      .maybeSingle();

    if (existingError) throw new HttpError(500, existingError.message, "CITATION_FETCH_FAILED");
    if (!existing) throw new HttpError(404, "Citation not found", "CITATION_NOT_FOUND");

    await assertManuscriptAccess(authReq.auth.userId, existing.manuscript_id, true);

    const updates: Record<string, unknown> = {};
    if (input.citationType !== undefined) updates.citation_type = input.citationType;
    if (input.authors !== undefined) updates.authors = input.authors;
    if (input.title !== undefined) updates.title = input.title;
    if (input.publicationYear !== undefined) updates.publication_year = input.publicationYear;
    if (input.doi !== undefined) updates.doi = input.doi;
    if (input.url !== undefined) updates.url = input.url;
    if (input.metadata !== undefined) updates.metadata = input.metadata;

    const { data, error } = await supabaseAdmin
      .from("citations")
      .update(updates)
      .eq("id", citationId)
      .select("*")
      .single();

    if (error || !data) {
      throw new HttpError(400, error?.message ?? "Citation update failed", "CITATION_UPDATE_FAILED");
    }

    res.json({ data });
  } catch (error) {
    next(error);
  }
});

// DELETE /citations/:citationId
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
