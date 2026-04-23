import { config as loadEnv } from "dotenv";
loadEnv();

import path from "path";
import {
  MANIFEST_PATH,
  REPORTS_DIR,
  REVIEW_PACK_DIR,
} from "../services/parser-benchmark.constants";
import type { CorpusManifestRow, ParserBenchmarkResultRecord, ParserBenchmarkRunMode } from "../services/parser-benchmark.types";
import { ensureDir, readJsonl, writeCsv, writeJson } from "../services/parser-benchmark.utils";

const REVIEW_MODE = (process.env.BENCHMARK_REVIEW_MODE ?? "parser_plus_llm") as ParserBenchmarkRunMode;

async function main() {
  await ensureDir(REVIEW_PACK_DIR);
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);

  const resultRows = manifest
    .filter((row) => row.selected)
    .flatMap((row) => {
      const candidates: Array<{ row: CorpusManifestRow; format: "pdf" | "docx"; result: ParserBenchmarkResultRecord | undefined }> = [
        { row, format: "pdf", result: REVIEW_MODE === "parser_only" ? row.parserOnlyPdf : row.parserPlusLlmPdf },
        { row, format: "docx", result: REVIEW_MODE === "parser_only" ? row.parserOnlyDocx : row.parserPlusLlmDocx },
      ];
      return candidates.filter((candidate): candidate is { row: CorpusManifestRow; format: "pdf" | "docx"; result: ParserBenchmarkResultRecord } => Boolean(candidate.result));
    });

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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
