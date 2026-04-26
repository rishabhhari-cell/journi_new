import { config as loadEnv } from "dotenv";
loadEnv();

import { MANIFEST_PATH } from "../services/parser-benchmark.constants";
import {
  countManifestBatchRows,
} from "../services/parser-benchmark-batch.service";
import {
  ensureWorkerStateDirs,
  fetchRenderReadyExists,
  markFetchRenderReady,
  runBenchmarkScript,
  withBatchClaim,
} from "../services/parser-benchmark-worker.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { readJsonl } from "../services/parser-benchmark.utils";

const BATCH_SIZE = Number(process.env.BENCHMARK_BATCH_SIZE ?? 100);
const START_INDEX = Number(process.env.BENCHMARK_BATCH_START_INDEX ?? 0);
const WORKER_NAME = process.env.BENCHMARK_WORKER_NAME ?? "fetch-render-worker";

async function main() {
  await ensureWorkerStateDirs();
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const totalRows = countManifestBatchRows(manifest, (row) => row.selected && !!row.pmcid);
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

  console.log(`[worker:fetch-render] Starting. total rows=${totalRows}, batch size=${BATCH_SIZE}, total batches=${totalBatches}`);

  for (let batchIndex = START_INDEX; batchIndex < totalBatches; batchIndex += 1) {
    if (await fetchRenderReadyExists(batchIndex)) continue;

    const claim = await withBatchClaim("fetch-render", batchIndex, WORKER_NAME, async () => {
      console.log(`[worker:fetch-render] Claiming batch ${batchIndex}`);
      const batchEnv = {
        BENCHMARK_BATCH_INDEX: String(batchIndex),
        BENCHMARK_BATCH_SIZE: String(BATCH_SIZE),
        BENCHMARK_BATCH_OFFSET: undefined,
        BENCHMARK_BATCH_LIMIT: undefined,
      };

      await runBenchmarkScript("server/scripts/fetch-parser-corpus.ts", batchEnv);
      await runBenchmarkScript("server/scripts/render-parser-docx.ts", batchEnv);
      await markFetchRenderReady(batchIndex, {
        batchIndex,
        batchSize: BATCH_SIZE,
        completedAt: new Date().toISOString(),
        worker: WORKER_NAME,
      });
      console.log(`[worker:fetch-render] Batch ${batchIndex} ready for parser runs.`);
    });

    if (!claim.claimed) {
      console.log(`[worker:fetch-render] Batch ${batchIndex} already claimed by another worker. Skipping.`);
    }
  }

  console.log("[worker:fetch-render] No more batches to prepare.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
