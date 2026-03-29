/**
 * seed-journal-metrics.ts
 *
 * One-time CLI script to seed journal acceptance rates, time-to-decision,
 * impact factors, and submission requirements from a JSON file.
 *
 * Usage:
 *   tsx server/scripts/seed-journal-metrics.ts ./data/journal-metrics.json
 *
 * JSON format — see data/journal-metrics.example.json for the schema.
 */

import fs from "node:fs";
import path from "node:path";
import dotenv from "dotenv";
dotenv.config();

import { ingestJournals } from "../services/journals/ingest.service";

interface MetricEntry {
  /** One of: name match OR issn (preferred for deduplication) */
  name?: string;
  issnPrint?: string;
  issnOnline?: string;
  externalId?: string;

  // Metrics
  acceptanceRate?: number | null;       // e.g. 12.5  (percentage)
  avgDecisionDays?: number | null;       // e.g. 45
  impactFactor?: number | null;          // Traditional JIF
  impactFactorYear?: number | null;

  // Submission requirements (stored as submission_requirements_json)
  submissionRequirements?: {
    word_limits?: {
      abstract?: number | null;
      main_text?: number | null;
      total?: number | null;
    };
    sections_required?: string[];
    citation_style?: string;             // e.g. "Vancouver", "APA", "Harvard"
    figures_max?: number | null;
    tables_max?: number | null;
    structured_abstract?: boolean;
    notes?: string;
  } | null;

  // Optional extras
  abbreviation?: string;
  publisher?: string;
  websiteUrl?: string;
  submissionPortalUrl?: string;
  openAccess?: boolean | null;
  apcCostUsd?: number | null;
  subjectAreas?: string[];
}

async function main() {
  const filePath = process.argv[2];
  if (!filePath) {
    console.error("Usage: tsx server/scripts/seed-journal-metrics.ts <path-to-json>");
    process.exit(1);
  }

  const resolved = path.resolve(filePath);
  if (!fs.existsSync(resolved)) {
    console.error(`File not found: ${resolved}`);
    process.exit(1);
  }

  const raw = fs.readFileSync(resolved, "utf-8");
  let entries: MetricEntry[];
  try {
    entries = JSON.parse(raw);
  } catch {
    console.error("Invalid JSON in seed file");
    process.exit(1);
  }

  if (!Array.isArray(entries) || entries.length === 0) {
    console.error("Seed file must be a non-empty JSON array");
    process.exit(1);
  }

  console.log(`Seeding ${entries.length} journal entries with source=manual (priority 100)…`);

  const journals = entries.map((e) => ({
    externalId: e.externalId,
    name: e.name ?? `Journal-${e.issnPrint ?? e.issnOnline ?? "unknown"}`,
    abbreviation: e.abbreviation,
    issnPrint: e.issnPrint,
    issnOnline: e.issnOnline,
    acceptanceRate: e.acceptanceRate ?? null,
    avgDecisionDays: e.avgDecisionDays ?? null,
    impactFactor: e.impactFactor ?? null,
    impactFactorYear: e.impactFactorYear ?? null,
    submissionRequirements: e.submissionRequirements ?? null,
    publisher: e.publisher,
    websiteUrl: e.websiteUrl,
    submissionPortalUrl: e.submissionPortalUrl,
    openAccess: e.openAccess ?? null,
    apcCostUsd: e.apcCostUsd ?? null,
    subjectAreas: e.subjectAreas,
  }));

  const result = await ingestJournals({
    source: "manual",
    journals,
    actorUserId: "system-seed",
  });

  console.log(`Done. Processed: ${result.processed} entries from source="${result.source}".`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
