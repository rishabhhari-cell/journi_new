import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import path from "path";
import { parseRawDocument } from "@shared/document-parse";
import {
  DEFAULT_LLM_CONCURRENCY,
  DEFAULT_PARSE_CONCURRENCY,
  MANIFEST_PATH,
  REPORTS_DIR,
  RESULTS_DIR,
} from "../services/parser-benchmark.constants";
import {
  formatBatchLabel,
  selectManifestBatch,
} from "../services/parser-benchmark-batch.service";
import {
  getDocxPath,
  getPdfPath,
  getResultPath,
  getTruthPath,
  type ResultEnvelope,
} from "../services/parser-benchmark-artifacts.service";
import { parseUploadedDocument } from "../services/manuscript-parse.service";
import { scoreParsedDocumentAgainstTruth } from "../services/parser-benchmark-score.service";
import type {
  BenchmarkSummaryRow,
  CorpusManifestRow,
  JatsGroundTruth,
  ParserBenchmarkResultRecord,
  ParserBenchmarkRunMode,
} from "../services/parser-benchmark.types";
import { ensureDir, fileExists, mapWithConcurrency, readJson, readJsonl, writeCsv, writeJson } from "../services/parser-benchmark.utils";

const BENCHMARK_MODE = (process.env.BENCHMARK_MODE ?? "both") as "both" | ParserBenchmarkRunMode;
const RUNS: ParserBenchmarkRunMode[] =
  BENCHMARK_MODE === "both" ? ["parser_only", "parser_plus_llm"] : [BENCHMARK_MODE];
const FORCE_RERUN = process.env.BENCHMARK_FORCE_RERUN === "true";
const WRITE_REPORTS = process.env.BENCHMARK_WRITE_REPORTS !== "false";
const PROGRESS_EVERY = Number(process.env.BENCHMARK_RUN_PROGRESS_EVERY ?? 10);
const CHECKPOINT_EVERY = Number(process.env.BENCHMARK_RUN_CHECKPOINT_EVERY ?? 25);

function getRunConcurrency(mode: ParserBenchmarkRunMode): number {
  const envValue = process.env.BENCHMARK_RUN_CONCURRENCY;
  if (envValue && Number(envValue) > 0) {
    return Math.floor(Number(envValue));
  }
  return mode === "parser_plus_llm" ? DEFAULT_LLM_CONCURRENCY : DEFAULT_PARSE_CONCURRENCY;
}

async function main() {
  await ensureDir(RESULTS_DIR);
  await ensureDir(REPORTS_DIR);

  if (RUNS.includes("parser_plus_llm") && !process.env.MODAL_LLM_URL) {
    throw new Error("MODAL_LLM_URL must be set to run parser_plus_llm benchmark mode.");
  }

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);

  for (const mode of RUNS) {
    const batch = selectManifestBatch(
      manifest,
      (row) => row.selected && !!row.pmcid,
    );
    const selectedRows = batch.rows;
    console.log(`[run:${mode}] Starting batch: ${formatBatchLabel(batch.totalEligible, selectedRows.length, batch.offset, batch.limit)}`);

    if (selectedRows.length === 0) {
      console.log(`[run:${mode}] No rows need processing for this batch.`);
      continue;
    }

    let completed = 0;

    await mapWithConcurrency(selectedRows, getRunConcurrency(mode), async (row) => {
      const truthPath = getTruthPath(row);
      if (!(await fileExists(truthPath))) {
        completed += 1;
        if (completed % PROGRESS_EVERY === 0 || completed === selectedRows.length) {
          console.log(`[run:${mode}] Progress ${completed}/${selectedRows.length}`);
        }
        return;
      }

      const truth = await readJson<JatsGroundTruth>(truthPath);
      for (const format of ["pdf", "docx"] as const) {
        const rawResultPath = getResultPath(row, format, mode);
        if (!FORCE_RERUN && (await fileExists(rawResultPath))) continue;

        const artifactPath = format === "pdf" ? getPdfPath(row) : getDocxPath(row);
        if (!(await fileExists(artifactPath))) continue;

        const rawBuffer = await fs.readFile(artifactPath);
        const raw = await parseUploadedDocument({
          fileName: artifactPath,
          buffer: rawBuffer,
          disableLlmFallback: mode === "parser_only",
        });
        const parsed = {
          ...parseRawDocument(raw),
          parseConfidence: raw.parseConfidence,
        };
        const llmFallbackTriggered = (raw.diagnostics ?? []).some((diagnostic) => diagnostic.code === "LLM_FALLBACK_USED");
        const scored = scoreParsedDocumentAgainstTruth({
          parsed,
          truth,
          studyDesignBucket: row.studyDesignBucket,
          format,
          mode,
          llmFallbackTriggered,
        });

        const result: ParserBenchmarkResultRecord = {
          ...scored,
          createdAt: new Date().toISOString(),
          rawResultPath,
        };

        await writeJson(rawResultPath, {
          row,
          raw,
          parsed,
          truth,
          result,
        });
      }

      completed += 1;
      if (completed % PROGRESS_EVERY === 0 || completed === selectedRows.length) {
        console.log(`[run:${mode}] Progress ${completed}/${selectedRows.length}`);
      }
      if (completed % CHECKPOINT_EVERY === 0) {
        console.log(`[run:${mode}] Checkpoint reached at ${completed}/${selectedRows.length}`);
      }
    });

    console.log(`[run:${mode}] Completed ${selectedRows.length} rows.`);
  }

  if (WRITE_REPORTS) {
    await writeReports();
  } else {
    console.log("Skipped global report rebuild for this batch.");
  }
  console.log("Parser benchmark complete.");
}

async function writeReports(): Promise<void> {
  const resultEnvelopes = await readResultEnvelopes();
  const summaryRows = buildSummaryRows(resultEnvelopes);
  await writeJson(path.join(REPORTS_DIR, "benchmark-summary.json"), summaryRows);
  await writeCsv(
    path.join(REPORTS_DIR, "benchmark-summary.csv"),
    [
      "publisherBucket",
      "studyDesignBucket",
      "format",
      "mode",
      "documentCount",
      "llmFallbackCount",
      "avgOverallScore",
      "avgMetadataScore",
      "avgStructureScore",
      "avgContentScore",
      "avgReferenceScore",
      "avgFiguresTablesScore",
    ],
    summaryRows as unknown as Array<Record<string, unknown>>,
  );
}

function buildSummaryRows(resultEnvelopes: ResultEnvelope[]): BenchmarkSummaryRow[] {
  const rows: BenchmarkSummaryRow[] = [];
  const grouped = new Map<string, ParserBenchmarkResultRecord[]>();

  for (const { row, result } of resultEnvelopes) {
    const key = [
      row.publisherBucket,
      row.studyDesignBucket,
      result.format,
      result.mode,
    ].join("|");
    const bucket = grouped.get(key) ?? [];
    bucket.push(result);
    grouped.set(key, bucket);
  }

  for (const [key, results] of grouped.entries()) {
    const [publisherBucket, studyDesignBucket, format, mode] = key.split("|");
    rows.push({
      publisherBucket: publisherBucket as BenchmarkSummaryRow["publisherBucket"],
      studyDesignBucket: studyDesignBucket as BenchmarkSummaryRow["studyDesignBucket"],
      format: format as "pdf" | "docx",
      mode: mode as ParserBenchmarkRunMode,
      documentCount: results.length,
      llmFallbackCount: results.filter((result) => result.llmFallbackTriggered).length,
      avgOverallScore: average(results.map((result) => result.scores.overall)),
      avgMetadataScore: average(results.map((result) => result.scores.metadata)),
      avgStructureScore: average(results.map((result) => result.scores.structure)),
      avgContentScore: average(results.map((result) => result.scores.content)),
      avgReferenceScore: average(results.map((result) => result.scores.references)),
      avgFiguresTablesScore: average(results.map((result) => result.scores.figuresTables)),
    });
  }

  return rows;
}

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

async function readResultEnvelopes(): Promise<ResultEnvelope[]> {
  const entries = await fs.readdir(RESULTS_DIR, { withFileTypes: true });
  const output: ResultEnvelope[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const filePath = path.join(RESULTS_DIR, entry.name);
    const envelope = await readJson<ResultEnvelope>(filePath);
    if (!envelope?.row || !envelope?.result) continue;
    output.push(envelope);
  }

  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
