import { config as loadEnv } from "dotenv";
loadEnv();

import { readJsonl } from "../services/parser-benchmark.utils";
import { MANIFEST_PATH } from "../services/parser-benchmark.constants";
import {
  writeAggregateReport,
  writeCorpusCompletionReport,
  writeFailureLog,
  writeSectionAccuracyReport,
  readResultEnvelopes,
} from "../services/parser-benchmark-report.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";

async function main(): Promise<void> {
  console.log("[reports] Loading envelopes...");
  const envelopes = await readResultEnvelopes();
  console.log("[reports] Loaded", envelopes.length, "envelopes");

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selectedRows = manifest.filter((r) => r.selected && r.pmcid);

  console.log("[reports] Writing reports...");
  await Promise.all([
    writeAggregateReport(envelopes),
    writeSectionAccuracyReport(envelopes),
    writeFailureLog(envelopes),
    writeCorpusCompletionReport(selectedRows, envelopes),
  ]);
  console.log("[reports] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
