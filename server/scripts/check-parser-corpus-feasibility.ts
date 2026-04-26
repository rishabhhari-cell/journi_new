import { config as loadEnv } from "dotenv";
loadEnv();

import path from "path";
import {
  MANIFEST_PATH,
  MAX_ARTICLES_PER_JOURNAL,
  PUBLISHER_BUCKETS,
  REPORTS_DIR,
  REQUIRED_JOURNALS_PER_PUBLISHER,
  STUDY_BUCKET_TARGETS,
  STUDY_DESIGN_BUCKETS,
} from "../services/parser-benchmark.constants";
import type { CorpusManifestRow, PublisherBucket, StudyDesignBucket } from "../services/parser-benchmark.types";
import { ensureDir, readJsonl, writeCsv, writeJson } from "../services/parser-benchmark.utils";

interface CellReport {
  publisherBucket: PublisherBucket;
  studyDesignBucket: StudyDesignBucket;
  available: number;
  selected: number;
  target: number;
  deficit: number;
}

async function main() {
  await ensureDir(REPORTS_DIR);
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selected = lockSelection(manifest);

  const reports: CellReport[] = [];
  for (const publisherBucket of PUBLISHER_BUCKETS) {
    for (const studyDesignBucket of STUDY_DESIGN_BUCKETS) {
      const available = manifest.filter((row) =>
        row.publisherBucket === publisherBucket &&
        row.studyDesignBucket === studyDesignBucket &&
        Boolean(row.pmcid),
      ).length;
      const selectedCount = selected.filter((row) =>
        row.publisherBucket === publisherBucket &&
        row.studyDesignBucket === studyDesignBucket &&
        row.selected,
      ).length;
      const target = STUDY_BUCKET_TARGETS[studyDesignBucket];
      reports.push({
        publisherBucket,
        studyDesignBucket,
        available,
        selected: selectedCount,
        target,
        deficit: Math.max(0, target - selectedCount),
      });
    }
  }

  await writeJsonlSafe(MANIFEST_PATH, selected);
  await writeJson(path.join(REPORTS_DIR, "feasibility-report.json"), {
    generatedAt: new Date().toISOString(),
    reports,
    publisherCoverage: summarizePublisherCoverage(selected),
  });
  await writeCsv(
    path.join(REPORTS_DIR, "feasibility-report.csv"),
    ["publisherBucket", "studyDesignBucket", "available", "selected", "target", "deficit"],
    reports as unknown as Array<Record<string, unknown>>,
  );

  console.log("Feasibility check complete.");
}

function lockSelection(rows: CorpusManifestRow[]): CorpusManifestRow[] {
  const nextRows = rows.map((row) => ({ ...row, selected: false }));
  const selectedPmids = new Set<string>();

  for (const publisherBucket of PUBLISHER_BUCKETS) {
    const journalCounts = new Map<string, number>();
    for (const studyDesignBucket of STUDY_DESIGN_BUCKETS) {
      const target = STUDY_BUCKET_TARGETS[studyDesignBucket];
      const candidates = nextRows
        .filter((row) =>
          row.publisherBucket === publisherBucket &&
          row.studyDesignBucket === studyDesignBucket &&
          Boolean(row.pmcid) &&
          !selectedPmids.has(row.pmid),
        )
        .sort(compareRowsForSelection);

      let taken = 0;
      for (const candidate of candidates) {
        if (taken >= target) break;
        const journalKey = candidate.journal?.toLowerCase().trim() || "unknown";
        if ((journalCounts.get(journalKey) ?? 0) >= MAX_ARTICLES_PER_JOURNAL) continue;
        candidate.selected = true;
        selectedPmids.add(candidate.pmid);
        journalCounts.set(journalKey, (journalCounts.get(journalKey) ?? 0) + 1);
        taken += 1;
      }
    }

    const totalSelectedForPublisher = nextRows.filter((row) => row.publisherBucket === publisherBucket && row.selected).length;
    const remainder = 1000 - totalSelectedForPublisher;
    if (remainder > 0) {
      const fillCandidates = nextRows
        .filter((row) =>
          row.publisherBucket === publisherBucket &&
          Boolean(row.pmcid) &&
          !selectedPmids.has(row.pmid),
        )
        .sort(compareRowsForSelection);

      let filled = 0;
      for (const candidate of fillCandidates) {
        if (filled >= remainder) break;
        const journalKey = candidate.journal?.toLowerCase().trim() || "unknown";
        const currentJournalCount = nextRows.filter((row) => row.selected && row.publisherBucket === publisherBucket && (row.journal?.toLowerCase().trim() || "unknown") === journalKey).length;
        if (currentJournalCount >= MAX_ARTICLES_PER_JOURNAL) continue;
        candidate.selected = true;
        selectedPmids.add(candidate.pmid);
        filled += 1;
      }
    }
  }

  return nextRows;
}

function compareRowsForSelection(a: CorpusManifestRow, b: CorpusManifestRow): number {
  const confidenceRank = { high: 0, medium: 1, low: 2 };
  const publisherRank = { high: 0, medium: 1, low: 2 };

  return (
    (confidenceRank[a.studyDesignConfidence] ?? 9) - (confidenceRank[b.studyDesignConfidence] ?? 9) ||
    (publisherRank[a.publisherConfidence ?? "low"] ?? 9) - (publisherRank[b.publisherConfidence ?? "low"] ?? 9) ||
    (b.publicationYear ?? 0) - (a.publicationYear ?? 0) ||
    (a.journal ?? "").localeCompare(b.journal ?? "")
  );
}

function summarizePublisherCoverage(rows: CorpusManifestRow[]): Array<Record<string, unknown>> {
  return PUBLISHER_BUCKETS.map((publisherBucket) => {
    const publisherRows = rows.filter((row) => row.publisherBucket === publisherBucket && row.selected);
    const journalCount = new Set(publisherRows.map((row) => row.journal).filter(Boolean)).size;
    return {
      publisherBucket,
      selected: publisherRows.length,
      distinctJournals: journalCount,
      meetsDistinctJournalMinimum: journalCount >= REQUIRED_JOURNALS_PER_PUBLISHER,
    };
  });
}

async function writeJsonlSafe(filePath: string, rows: CorpusManifestRow[]): Promise<void> {
  const { writeJsonl } = await import("../services/parser-benchmark.utils");
  await writeJsonl(filePath, rows);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
