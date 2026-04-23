import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import path from "path";
import { parseRawDocument } from "@shared/document-parse";
import {
  MANIFEST_PATH,
  REPORTS_DIR,
  RESULTS_DIR,
} from "../services/parser-benchmark.constants";
import { parseUploadedDocument } from "../services/manuscript-parse.service";
import { scoreParsedDocumentAgainstTruth } from "../services/parser-benchmark-score.service";
import type {
  BenchmarkSummaryRow,
  CorpusManifestRow,
  JatsGroundTruth,
  ParserBenchmarkResultRecord,
  ParserBenchmarkRunMode,
} from "../services/parser-benchmark.types";
import { ensureDir, readJson, readJsonl, writeCsv, writeJson, writeJsonl } from "../services/parser-benchmark.utils";

const BENCHMARK_MODE = (process.env.BENCHMARK_MODE ?? "both") as "both" | ParserBenchmarkRunMode;
const RUNS: ParserBenchmarkRunMode[] =
  BENCHMARK_MODE === "both" ? ["parser_only", "parser_plus_llm"] : [BENCHMARK_MODE];

async function main() {
  await ensureDir(RESULTS_DIR);
  await ensureDir(REPORTS_DIR);

  if (RUNS.includes("parser_plus_llm") && !process.env.MODAL_LLM_URL) {
    throw new Error("MODAL_LLM_URL must be set to run parser_plus_llm benchmark mode.");
  }

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selectedRows = manifest.filter((row) => row.selected && row.truth.path);

  for (const mode of RUNS) {
    for (const row of selectedRows) {
      const truth = await readJson<JatsGroundTruth>(row.truth.path!);
      for (const format of ["pdf", "docx"] as const) {
        const artifact = row[format];
        if (artifact.status !== "ready" || !artifact.path) continue;

        const rawBuffer = await fs.readFile(artifact.path);
        const raw = await parseUploadedDocument({
          fileName: artifact.path,
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
        const rawResultPath = path.join(RESULTS_DIR, `${row.pmid}-${format}-${mode}.json`);

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

        if (mode === "parser_only" && format === "pdf") row.parserOnlyPdf = result;
        if (mode === "parser_only" && format === "docx") row.parserOnlyDocx = result;
        if (mode === "parser_plus_llm" && format === "pdf") row.parserPlusLlmPdf = result;
        if (mode === "parser_plus_llm" && format === "docx") row.parserPlusLlmDocx = result;
      }
    }
  }

  await writeJsonl(MANIFEST_PATH, manifest);
  await writeReports(manifest);
  console.log("Parser benchmark complete.");
}

async function writeReports(manifest: CorpusManifestRow[]): Promise<void> {
  const summaryRows = buildSummaryRows(manifest);
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

function buildSummaryRows(manifest: CorpusManifestRow[]): BenchmarkSummaryRow[] {
  const rows: BenchmarkSummaryRow[] = [];
  const grouped = new Map<string, ParserBenchmarkResultRecord[]>();

  for (const row of manifest.filter((item) => item.selected)) {
    const resultEntries: Array<ParserBenchmarkResultRecord | undefined> = [
      row.parserOnlyPdf,
      row.parserOnlyDocx,
      row.parserPlusLlmPdf,
      row.parserPlusLlmDocx,
    ];
    for (const result of resultEntries) {
      if (!result) continue;
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
