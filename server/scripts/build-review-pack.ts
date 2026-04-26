import { config as loadEnv } from "dotenv";
loadEnv();

import path from "path";
import {
  REPORTS_DIR,
  RESULTS_DIR,
  REVIEW_PACK_DIR,
} from "../services/parser-benchmark.constants";
import type { CorpusManifestRow, ParserBenchmarkResultRecord, ParserBenchmarkRunMode } from "../services/parser-benchmark.types";
import { ensureDir, readJson, writeCsv, writeJson } from "../services/parser-benchmark.utils";
import type { ResultEnvelope } from "../services/parser-benchmark-artifacts.service";

const REVIEW_MODE = (process.env.BENCHMARK_REVIEW_MODE ?? "parser_plus_llm") as ParserBenchmarkRunMode;

async function main() {
  await ensureDir(REVIEW_PACK_DIR);
  const resultRows = (await readResultEnvelopes())
    .filter((entry) => entry.result.mode === REVIEW_MODE)
    .map((entry) => ({ row: entry.row, format: entry.result.format, result: entry.result }));

  const worstOverall = [...resultRows]
    .sort((a, b) => a.result.scores.overall - b.result.scores.overall)
    .slice(0, 40);

  const byCell = new Map<string, Array<typeof resultRows[number]>>();
  for (const entry of resultRows) {
    const key = `${entry.row.publisherBucket}|${entry.row.studyDesignBucket}|${entry.format}`;
    const bucket = byCell.get(key) ?? [];
    bucket.push(entry);
    byCell.set(key, bucket);
  }

  const randomCellSample = Array.from(byCell.values()).flatMap((entries) =>
    shuffle(entries).slice(0, 2),
  ).slice(0, 100);

  const reviewPack = dedupeByKey([...worstOverall, ...randomCellSample], (entry) => `${entry.row.pmid}|${entry.format}`);
  const jsonPath = path.join(REVIEW_PACK_DIR, `review-pack-${REVIEW_MODE}.json`);
  const csvPath = path.join(REVIEW_PACK_DIR, `review-pack-${REVIEW_MODE}.csv`);

  await writeJson(jsonPath, reviewPack.map(serializeReviewEntry));
  await writeCsv(
    csvPath,
    ["pmid", "pmcid", "publisherBucket", "studyDesignBucket", "format", "mode", "overallScore", "hardFailureReasons", "artifactPath", "resultPath"],
    reviewPack.map((entry) => serializeReviewEntry(entry)) as Array<Record<string, unknown>>,
  );
  await writeJson(path.join(REPORTS_DIR, `review-pack-${REVIEW_MODE}-summary.json`), {
    generatedAt: new Date().toISOString(),
    count: reviewPack.length,
  });

  console.log(`Review pack written: ${reviewPack.length} entries.`);
}

function serializeReviewEntry(entry: { row: CorpusManifestRow; format: "pdf" | "docx"; result: ParserBenchmarkResultRecord }): Record<string, unknown> {
  return {
    pmid: entry.row.pmid,
    pmcid: entry.row.pmcid,
    publisherBucket: entry.row.publisherBucket,
    studyDesignBucket: entry.row.studyDesignBucket,
    format: entry.format,
    mode: entry.result.mode,
    overallScore: entry.result.scores.overall,
    hardFailureReasons: entry.result.hardFailureReasons.join(";"),
    artifactPath: entry.row[entry.format].path,
    resultPath: entry.result.rawResultPath,
  };
}

function shuffle<T>(items: T[]): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function dedupeByKey<T>(items: T[], keyFn: (item: T) => string): T[] {
  const seen = new Set<string>();
  const output: T[] = [];
  for (const item of items) {
    const key = keyFn(item);
    if (seen.has(key)) continue;
    seen.add(key);
    output.push(item);
  }
  return output;
}

async function readResultEnvelopes(): Promise<ResultEnvelope[]> {
  const fs = await import("fs/promises");
  const entries = await fs.readdir(RESULTS_DIR, { withFileTypes: true });
  const output: ResultEnvelope[] = [];

  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith(".json")) continue;
    const envelope = await readJson<ResultEnvelope>(path.join(RESULTS_DIR, entry.name));
    if (!envelope?.row || !envelope?.result) continue;
    output.push(envelope);
  }

  return output;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
