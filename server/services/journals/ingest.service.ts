import crypto from "node:crypto";
import { supabaseAdmin } from "../../lib/supabase";
import { invalidateJournalCache } from "./search.service";
import type { JournalImportInput } from "./types";

export interface JournalIngestResult {
  processed: number;
  source: string;
}

function normalizeIssn(value?: string | null): string | null {
  if (!value) return null;
  const trimmed = value.replace(/\s/g, "").toUpperCase();
  if (trimmed.length === 8 && !trimmed.includes("-")) {
    return `${trimmed.slice(0, 4)}-${trimmed.slice(4)}`;
  }
  return trimmed;
}

function fallbackExternalId(input: JournalImportInput): string {
  if (input.externalId?.trim()) return input.externalId.trim();
  const issn = normalizeIssn(input.issnPrint) ?? normalizeIssn(input.issnOnline);
  if (issn) return `issn:${issn}`;
  const slug = input.name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
  const hash = crypto.createHash("sha1").update(input.name).digest("hex").slice(0, 8);
  return `name:${slug}:${hash}`;
}

export async function ingestJournals(params: {
  journals: JournalImportInput[];
  source: string;
  actorUserId: string;
}): Promise<JournalIngestResult> {
  if (params.journals.length === 0) {
    return { processed: 0, source: params.source };
  }

  const rows = params.journals.map((journal) => {
    const externalId = fallbackExternalId(journal);
    return {
      external_id: externalId,
      name: journal.name,
      abbreviation: journal.abbreviation ?? null,
      logo_url: journal.logoUrl ?? null,
      impact_factor: journal.impactFactor ?? null,
      impact_factor_year: journal.impactFactorYear ?? null,
      open_access: journal.openAccess ?? null,
      website_url: journal.websiteUrl ?? null,
      submission_portal_url: journal.submissionPortalUrl ?? null,
      submission_requirements_json: journal.submissionRequirements ?? null,
      publisher: journal.publisher ?? null,
      subject_areas: journal.subjectAreas ?? [],
      geographic_location: journal.geographicLocation ?? null,
      issn_print: normalizeIssn(journal.issnPrint),
      issn_online: normalizeIssn(journal.issnOnline),
      acceptance_rate: journal.acceptanceRate ?? null,
      avg_decision_days: journal.avgDecisionDays ?? null,
      apc_cost_usd: journal.apcCostUsd ?? null,
      provenance: {
        ...(journal.provenance ?? {}),
        imported_from: params.source,
        imported_by: params.actorUserId,
      },
      last_verified_at: new Date().toISOString(),
    };
  });

  const { error } = await supabaseAdmin
    .from("journals")
    .upsert(rows, { onConflict: "external_id" });

  if (error) {
    throw new Error(`Journal import failed: ${error.message}`);
  }

  invalidateJournalCache();
  return { processed: rows.length, source: params.source };
}

