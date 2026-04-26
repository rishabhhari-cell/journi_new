import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import {
  MANIFEST_PATH,
  PDF_DIR,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import {
  formatBatchLabel,
  selectManifestBatch,
} from "../services/parser-benchmark-batch.service";
import {
  getPdfPath,
  getXmlPath,
} from "../services/parser-benchmark-artifacts.service";
import {
  fetchPmcXmlByPmcid,
  resolvePmcPdfUrl,
} from "../services/parser-benchmark-source.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { ensureDir, fileExists, mapWithConcurrency, readJsonl, sha256Buffer } from "../services/parser-benchmark.utils";

const CONCURRENCY = Number(process.env.BENCHMARK_FETCH_CONCURRENCY ?? 2);
const PROGRESS_EVERY = Number(process.env.BENCHMARK_FETCH_PROGRESS_EVERY ?? 25);
const CHECKPOINT_EVERY = Number(process.env.BENCHMARK_FETCH_CHECKPOINT_EVERY ?? 50);

type FetchStats = {
  startedAtMs: number;
  completed: number;
  skippedAlreadyReady: number;
  xmlReady: number;
  xmlFailed: number;
  pdfReady: number;
  pdfMissing: number;
  pdfFailed: number;
  xmlFetchMs: number;
  xmlFetchCount: number;
  pdfFetchMs: number;
  pdfFetchCount: number;
};

function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) return `${hours}h ${minutes}m ${seconds}s`;
  if (minutes > 0) return `${minutes}m ${seconds}s`;
  return `${seconds}s`;
}

function logProgress(stats: FetchStats, total: number, label: string): void {
  const elapsedMs = Date.now() - stats.startedAtMs;
  const rate = stats.completed > 0 ? stats.completed / (elapsedMs / 1000) : 0;
  const remaining = Math.max(0, total - stats.completed);
  const etaMs = rate > 0 ? (remaining / rate) * 1000 : 0;
  const avgXmlMs = stats.xmlFetchCount > 0 ? Math.round(stats.xmlFetchMs / stats.xmlFetchCount) : 0;
  const avgPdfMs = stats.pdfFetchCount > 0 ? Math.round(stats.pdfFetchMs / stats.pdfFetchCount) : 0;

  console.log(
    [
      `[fetch] ${label}`,
      `${stats.completed}/${total} rows`,
      `xml ready=${stats.xmlReady}`,
      `xml failed=${stats.xmlFailed}`,
      `pdf ready=${stats.pdfReady}`,
      `pdf missing=${stats.pdfMissing}`,
      `pdf failed=${stats.pdfFailed}`,
      `skipped=${stats.skippedAlreadyReady}`,
      `avg xml=${avgXmlMs}ms`,
      `avg pdf=${avgPdfMs}ms`,
      `elapsed=${formatDuration(elapsedMs)}`,
      `eta=${formatDuration(etaMs)}`,
    ].join(" | "),
  );
}

async function main() {
  await ensureDir(XML_DIR);
  await ensureDir(PDF_DIR);

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const batch = selectManifestBatch(
    manifest,
    (row) => row.selected && !!row.pmcid,
  );
  const selectedRows = batch.rows;
  console.log(`[fetch] Starting batch: ${formatBatchLabel(batch.totalEligible, selectedRows.length, batch.offset, batch.limit)}`);
  const stats: FetchStats = {
    startedAtMs: Date.now(),
    completed: 0,
    skippedAlreadyReady: 0,
    xmlReady: 0,
    xmlFailed: 0,
    pdfReady: 0,
    pdfMissing: 0,
    pdfFailed: 0,
    xmlFetchMs: 0,
    xmlFetchCount: 0,
    pdfFetchMs: 0,
    pdfFetchCount: 0,
  };
  let nextProgressAt = PROGRESS_EVERY;
  let nextCheckpointAt = CHECKPOINT_EVERY;
  let shuttingDown = false;

  process.on("SIGINT", () => {
    if (shuttingDown) return;
    shuttingDown = true;
    console.log("\n[fetch] Interrupt received. Exiting cleanly. Completed files stay on disk and the batch is resumable.");
    process.exit(130);
  });

  if (selectedRows.length === 0) {
    console.log("[fetch] No selected rows need fetching for this batch.");
    return;
  }

  await mapWithConcurrency(selectedRows, CONCURRENCY, async (row) => {
    const xmlPath = getXmlPath(row);
    const pdfPath = getPdfPath(row);
    const xmlReady = await fileExists(xmlPath);
    const pdfReady = await fileExists(pdfPath);
    const alreadyReady = xmlReady && pdfReady;
    if (alreadyReady) {
      stats.skippedAlreadyReady += 1;
    } else if (row.pmcid) {
      if (!xmlReady) {
        const startedAt = Date.now();
        try {
          const xml = await fetchPmcXmlByPmcid(row.pmcid);
          const buffer = Buffer.from(xml, "utf8");
          await fs.writeFile(xmlPath, xml, "utf8");
          void sha256Buffer(buffer);
          stats.xmlReady += 1;
          stats.xmlFetchMs += Date.now() - startedAt;
          stats.xmlFetchCount += 1;
        } catch (error) {
          stats.xmlFailed += 1;
          console.warn(`[fetch] XML failed for ${row.pmcid}: ${(error as Error).message}`);
        }
      }

      if (!pdfReady) {
        const startedAt = Date.now();
        try {
          const pdfUrl = row.pdf.sourceUrl || await resolvePmcPdfUrl(row.pmcid);
          if (!pdfUrl) {
            stats.pdfMissing += 1;
          } else {
            const response = await fetch(pdfUrl, {
              headers: { "User-Agent": "Journi Parser Benchmark/1.0" },
              signal: AbortSignal.timeout(60_000),
            });
            if (!response.ok) {
              throw new Error(`PDF download failed (${response.status})`);
            }
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);
            await fs.writeFile(pdfPath, buffer);
            void sha256Buffer(buffer);
            stats.pdfReady += 1;
            stats.pdfFetchMs += Date.now() - startedAt;
            stats.pdfFetchCount += 1;
          }
        } catch (error) {
          stats.pdfFailed += 1;
          console.warn(`[fetch] PDF failed for ${row.pmcid}: ${(error as Error).message}`);
        }
      }
    }

    stats.completed += 1;

    while (stats.completed >= nextProgressAt) {
      logProgress(stats, selectedRows.length, `progress ${nextProgressAt}`);
      nextProgressAt += PROGRESS_EVERY;
    }

    while (stats.completed >= nextCheckpointAt) {
      logProgress(stats, selectedRows.length, `checkpoint ${nextCheckpointAt}/${selectedRows.length}`);
      nextCheckpointAt += CHECKPOINT_EVERY;
    }
  });

  logProgress(stats, selectedRows.length, "final");
  console.log(`Fetch complete for ${selectedRows.length} selected records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
