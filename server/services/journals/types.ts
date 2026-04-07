import type { JournalDTO, JournalSubmissionRequirements } from "../../../shared/backend";
import { normalizeJournalSubmissionRequirements } from "../../../shared/journal-requirements";

export interface JournalImportInput {
  externalId?: string;
  name: string;
  abbreviation?: string;
  logoUrl?: string;
  impactFactor?: number | null;
  impactFactorYear?: number | null;
  openAccess?: boolean | null;
  websiteUrl?: string;
  submissionPortalUrl?: string;
  submissionRequirements?: JournalSubmissionRequirements | null;
  publisher?: string;
  subjectAreas?: string[];
  geographicLocation?: string;
  issnPrint?: string;
  issnOnline?: string;
  acceptanceRate?: number | null;
  avgDecisionDays?: number | null;
  apcCostUsd?: number | null;
  provenance?: Record<string, string>;
}

export interface JournalRow {
  id: string;
  external_id: string | null;
  name: string;
  abbreviation: string | null;
  logo_url: string | null;
  impact_factor: number | null;
  impact_factor_year: number | null;
  open_access: boolean | null;
  website_url: string | null;
  submission_portal_url: string | null;
  submission_requirements_json: JournalSubmissionRequirements | null;
  publisher: string | null;
  subject_areas: string[] | null;
  geographic_location: string | null;
  issn_print: string | null;
  issn_online: string | null;
  acceptance_rate: number | null;
  avg_decision_days: number | null;
  apc_cost_usd: number | null;
  provenance: Record<string, string> | null;
  last_verified_at: string | null;
  created_at: string;
  updated_at: string;
}

export function mapJournalRow(row: JournalRow): JournalDTO {
  return {
    id: row.id,
    externalId: row.external_id,
    name: row.name,
    abbreviation: row.abbreviation,
    logoUrl: row.logo_url,
    impactFactor: row.impact_factor,
    impactFactorYear: row.impact_factor_year,
    openAccess: row.open_access,
    websiteUrl: row.website_url,
    submissionPortalUrl: row.submission_portal_url,
    submissionRequirements: normalizeJournalSubmissionRequirements(row.submission_requirements_json),
    publisher: row.publisher,
    subjectAreas: row.subject_areas ?? [],
    geographicLocation: row.geographic_location,
    issnPrint: row.issn_print,
    issnOnline: row.issn_online,
    acceptanceRate: row.acceptance_rate,
    avgDecisionDays: row.avg_decision_days,
    apcCostUsd: row.apc_cost_usd,
    provenance: row.provenance ?? {},
    lastVerifiedAt: row.last_verified_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
