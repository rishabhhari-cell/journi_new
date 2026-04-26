import { config as loadEnv } from "dotenv";
loadEnv();

import { MANIFEST_PATH } from "../services/parser-benchmark.constants";
import { countManifestBatchRows } from "../services/parser-benchmark-batch.service";
import {
  ensureWorkerStateDirs,
  fetchRenderReadyExists,
  markRunDone,
  runBenchmarkScript,
  runDoneExists,
  withBatchClaim,
} from "../services/parser-benchmark-worker.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { readJsonl } from "../services/parser-benchmark.utils";

const BATCH_SIZE = Number(process.env.BENCHMARK_BATCH_SIZE ?? 100);
const START_INDEX = Number(process.env.BENCHMARK_BATCH_START_INDEX ?? 0);
const POLL_MS = Number(process.env.BENCHMARK_WORKER_POLL_MS ?? 15000);
const WORKER_NAME = process.env.BENCHMARK_WORKER_NAME ?? "run-worker";

async function main() {
  await ensureWorkerStateDirs();
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const totalRows = countManifestBatchRows(manifest, (row) => row.selected && !!row.pmcid);
  const totalBatches = Math.ceil(totalRows / BATCH_SIZE);

  console.log(`[worker:run] Starting. total rows=${totalRows}, batch size=${BATCH_SIZE}, total batches=${totalBatches}`);

  while (true) {
    let didWork = false;
    let doneCount = 0;

    for (let batchIndex = START_INDEX; batchIndex < totalBatches; batchIndex += 1) {
      if (await runDoneExists(batchIndex)) {
        doneCount += 1;
        continue;
      }
      if (!(await fetchRenderReadyExists(batchIndex))) continue;

      const claim = await withBatchClaim("run", batchIndex, WORKER_NAME, async () => {
        didWork = true;
        console.log(`[worker:run] Claiming batch ${batchIndex}`);
        const batchOffset = batchIndex * BATCH_SIZE;
        const batchEnv = {
          BENCHMARK_BATCH_INDEX: undefined,
          BENCHMARK_BATCH_SIZE: undefined,
          BENCHMARK_BATCH_OFFSET: String(batchOffset),
          BENCHMARK_BATCH_LIMIT: String(BATCH_SIZE),
          BENCHMARK_RUN_CONCURRENCY: process.env.BENCHMARK_RUN_CONCURRENCY ?? "1",
          BENCHMARK_WRITE_REPORTS: "false",
        };

        await runBenchmarkScript("server/scripts/run-parser-benchmark.ts", {
          ...batchEnv,
          BENCHMARK_MODE: "parser_only",
        });
        await runBenchmarkScript("server/scripts/run-parser-benchmark.ts", {
          ...batchEnv,
          BENCHMARK_MODE: "parser_plus_llm",
        });
        await markRunDone(batchIndex, {
          batchIndex,
          batchSize: BATCH_SIZE,
          completedAt: new Date().toISOString(),
          worker: WORKER_NAME,
        });
        console.log(`[worker:run] Batch ${batchIndex} complete.`);
      });

      if (claim.claimed) {
        doneCount += 1;
      }
    }

    if (doneCount >= totalBatches) {
      console.log("[worker:run] All batches completed.");
      return;
    }

    if (!didWork) {
      console.log(`[worker:run] Waiting for fetched/rendered batches... (${doneCount}/${totalBatches} complete)`);
      await sleep(POLL_MS);
    }
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
