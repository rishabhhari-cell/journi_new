import { promises as fs } from "fs";
import path from "path";
import type {
  BenchmarkSummaryRow,
  CorpusManifestRow,
  ParserBenchmarkResultRecord,
  ParserBenchmarkRunMode,
  PublisherBucket,
  StudyDesignBucket,
} from "./parser-benchmark.types";
import type { ResultEnvelope } from "./parser-benchmark-artifacts.service";
import { REPORTS_DIR, RESULTS_DIR } from "./parser-benchmark.constants";
import { ensureDir, readJson, writeCsv, writeJson, writeJsonl } from "./parser-benchmark.utils";

function avg(arr: number[]): number {
  return arr.length > 0 ? arr.reduce((a, b) => a + b, 0) / arr.length : 0;
}

export interface FailureLogEntry {
  pmid: string;
  pmcid?: string;
  publisherBucket?: PublisherBucket;
  studyDesignBucket?: StudyDesignBucket;
  format: "pdf" | "docx";
  mode: ParserBenchmarkRunMode;
  overallScore: number;
  hardFailureReasons: string[];
  diagnosticCodes: string[];
  llmFallbackTriggered: boolean;
  parseConfidence?: number;
  sectionFailures: Array<{
    canonicalTitle: string;
    truthWordCount: number;
    parsedWordCount: number;
    tokenRecall: number;
    tokenPrecision: number;
    lcsRatio: number;
    matched: boolean;
  }>;
  missingRequiredSections: string[];
  titleTokenF1: number;
  authorRecall: number;
  referenceDoiRecall: number;
  figureCountDelta: number;
  tableCountDelta: number;
  resultPath?: string;
}

export async function writeFailureLog(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);
  const logPath = path.join(REPORTS_DIR, "failures.jsonl");
  const entries: FailureLogEntry[] = [];

  for (const { row, result } of envelopes) {
    if (result.scores.overall >= 0.95) continue;

    const missingRequired = result.hardFailureReasons
      .filter((r) => r.startsWith("missing_required_section:"))
      .map((r) => r.replace("missing_required_section:", ""));

    const entry: FailureLogEntry = {
      pmid: row.pmid,
      pmcid: row.pmcid,
      publisherBucket: row.publisherBucket,
      studyDesignBucket: row.studyDesignBucket,
      format: result.format,
      mode: result.mode,
      overallScore: result.scores.overall,
      hardFailureReasons: result.hardFailureReasons,
      diagnosticCodes: result.diagnosticCodes,
      llmFallbackTriggered: result.llmFallbackTriggered,
      parseConfidence: result.parseConfidence,
      sectionFailures: result.metrics.sectionComparisons
        .filter((c) => c.tokenRecall < 0.8 || !c.matched)
        .map((c) => ({
          canonicalTitle: c.canonicalTitle,
          truthWordCount: c.truthWordCount,
          parsedWordCount: c.parsedWordCount,
          tokenRecall: c.tokenRecall,
          tokenPrecision: c.tokenPrecision,
          lcsRatio: c.lcsRatio,
          matched: c.matched,
        })),
      missingRequiredSections: missingRequired,
      titleTokenF1: result.metrics.titleTokenF1,
      authorRecall: result.metrics.authorRecall,
      referenceDoiRecall: result.metrics.referenceDoiRecall,
      figureCountDelta: result.metrics.figureCountDelta,
      tableCountDelta: result.metrics.tableCountDelta,
      resultPath: result.rawResultPath,
    };

    entries.push(entry);
  }

  await writeJsonl(logPath, entries);
}

export async function writeSectionAccuracyReport(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);

  const buckets = new Map<string, { recall: number[]; precision: number[]; lcs: number[]; matchRate: number[] }>();

  for (const { result } of envelopes) {
    for (const sc of result.metrics.sectionComparisons) {
      const key = `${sc.canonicalTitle}|${result.format}|${result.mode}`;
      const existing = buckets.get(key) ?? { recall: [], precision: [], lcs: [], matchRate: [] };
      existing.recall.push(sc.tokenRecall);
      existing.precision.push(sc.tokenPrecision);
      existing.lcs.push(sc.lcsRatio);
      existing.matchRate.push(sc.matched ? 1 : 0);
      buckets.set(key, existing);
    }
  }

  const rows: Array<Record<string, unknown>> = [];
  for (const [key, data] of buckets.entries()) {
    const [canonicalTitle, format, mode] = key.split("|");
    rows.push({
      canonicalTitle,
      format,
      mode,
      sampleCount: data.recall.length,
      avgTokenRecall: avg(data.recall).toFixed(4),
      avgTokenPrecision: avg(data.precision).toFixed(4),
      avgLcsRatio: avg(data.lcs).toFixed(4),
      avgMatchRate: avg(data.matchRate).toFixed(4),
    });
  }

  rows.sort((a, b) => Number(a.avgTokenRecall) - Number(b.avgTokenRecall));

  await writeCsv(
    path.join(REPORTS_DIR, "section-accuracy.csv"),
    ["canonicalTitle", "format", "mode", "sampleCount", "avgTokenRecall", "avgTokenPrecision", "avgLcsRatio", "avgMatchRate"],
    rows,
  );
}

export async function writeAggregateReport(envelopes: ResultEnvelope[]): Promise<void> {
  await ensureDir(REPORTS_DIR);

  const grouped = new Map<string, ParserBenchmarkResultRecord[]>();

  for (const { row, result } of envelopes) {
    const key = [row.publisherBucket ?? "unknown", row.studyDesignBucket ?? "unknown", result.format, result.mode].join("|");
    const bucket = grouped.get(key) ?? [];
    bucket.push(result);
    grouped.set(key, bucket);
  }

  const summaryRows: BenchmarkSummaryRow[] = [];
  for (const [key, results] of grouped.entries()) {
    const [publisherBucket, studyDesignBucket, format, mode] = key.split("|");
    summaryRows.push({
      publisherBucket: publisherBucket as PublisherBucket,
      studyDesignBucket: studyDesignBucket as StudyDesignBucket,
      format: format as "pdf" | "docx",
      mode: mode as "parser_only" | "parser_plus_llm",
      documentCount: results.length,
      llmFallbackCount: results.filter((r) => r.llmFallbackTriggered).length,
      avgOverallScore: avg(results.map((r) => r.scores.overall)),
      avgMetadataScore: avg(results.map((r) => r.scores.metadata)),
      avgStructureScore: avg(results.map((r) => r.scores.structure)),
      avgContentScore: avg(results.map((r) => r.scores.content)),
      avgReferenceScore: avg(results.map((r) => r.scores.references)),
      avgFiguresTablesScore: avg(results.map((r) => r.scores.figuresTables)),
    });
  }

  summaryRows.sort((a, b) => a.avgOverallScore - b.avgOverallScore);

  await writeJson(path.join(REPORTS_DIR, "benchmark-summary.json"), summaryRows);
  await writeCsv(
    path.join(REPORTS_DIR, "benchmark-summary.csv"),
    [
      "publisherBucket", "studyDesignBucket", "format", "mode",
      "documentCount", "llmFallbackCount",
      "avgOverallScore", "avgMetadataScore", "avgStructureScore",
      "avgContentScore", "avgReferenceScore", "avgFiguresTablesScore",
    ],
    summaryRows as unknown as Array<Record<string, unknown>>,
  );
}

export async function writeCorpusCompletionReport(
  selectedRows: CorpusManifestRow[],
  envelopes: ResultEnvelope[],
): Promise<void> {
  await ensureDir(REPORTS_DIR);

  const resultKeys = new Set(envelopes.map((e) => `${e.row.pmid}|${e.result.format}|${e.result.mode}`));

  let complete = 0;
  let partialResult = 0;
  let noResult = 0;

  for (const row of selectedRows) {
    const count = [
      resultKeys.has(`${row.pmid}|pdf|parser_only`),
      resultKeys.has(`${row.pmid}|pdf|parser_plus_llm`),
      resultKeys.has(`${row.pmid}|docx|parser_only`),
      resultKeys.has(`${row.pmid}|docx|parser_plus_llm`),
    ].filter(Boolean).length;

    if (count === 4) complete++;
    else if (count > 0) partialResult++;
    else noResult++;
  }

  const report = {
    generatedAt: new Date().toISOString(),
    totalSelected: selectedRows.length,
    completeRows: complete,
    partialRows: partialResult,
    noResultRows: noResult,
    completionPct: selectedRows.length > 0
      ? ((complete / selectedRows.length) * 100).toFixed(1)
      : "0.0",
  };

  await writeJson(path.join(REPORTS_DIR, "corpus-completion.json"), report);
  console.log(`[report] Corpus completion: ${complete}/${selectedRows.length} (${report.completionPct}%) fully processed.`);
}

export async function readResultEnvelopes(): Promise<ResultEnvelope[]> {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let entries: any[];
  try {
    entries = await fs.readdir(RESULTS_DIR, { withFileTypes: true });
  } catch {
    return [];
  }
  const output: ResultEnvelope[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    try {
      const envelope = await readJson<ResultEnvelope>(path.join(RESULTS_DIR, entry.name));
      if (envelope?.row && envelope?.result) output.push(envelope);
    } catch {
      // skip corrupted result files
    }
  }

  return output;
}
