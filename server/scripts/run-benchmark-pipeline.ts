import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import { parseRawDocument } from "@shared/document-parse";
import {
  DEFAULT_LLM_CONCURRENCY,
  DEFAULT_PARSE_CONCURRENCY,
  DOCX_DIR,
  MANIFEST_PATH,
  PDF_DIR,
  RESULTS_DIR,
  TRUTH_DIR,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import {
  getDocxPath,
  getPdfPath,
  getResultPath,
  getTruthPath,
  getXmlPath,
  type ResultEnvelope,
} from "../services/parser-benchmark-artifacts.service";
import {
  fetchPmcXmlByPmcid,
  resolvePmcPdfUrl,
} from "../services/parser-benchmark-source.service";
import { extractJatsGroundTruth, renderGroundTruthHtml } from "../services/jats-ground-truth.service";
import { parseUploadedDocument } from "../services/manuscript-parse.service";
import { scoreParsedDocumentAgainstTruth } from "../services/parser-benchmark-score.service";
import {
  writeAggregateReport,
  writeCorpusCompletionReport,
  writeFailureLog,
  writeSectionAccuracyReport,
  readResultEnvelopes,
} from "../services/parser-benchmark-report.service";
import type {
  CorpusManifestRow,
  JatsGroundTruth,
  ParserBenchmarkRunMode,
} from "../services/parser-benchmark.types";
import {
  ensureDir,
  fileExists,
  mapWithConcurrency,
  readJson,
  readJsonl,
  writeJson,
} from "../services/parser-benchmark.utils";

// ── Config ──────────────────────────────────────────────────────────────────
const FETCH_CONCURRENCY = Number(process.env.BENCHMARK_FETCH_CONCURRENCY ?? 8);
const RENDER_CONCURRENCY = Number(process.env.BENCHMARK_RENDER_CONCURRENCY ?? 4);
const PARSE_CONCURRENCY = Number(process.env.BENCHMARK_PARSE_CONCURRENCY ?? DEFAULT_PARSE_CONCURRENCY);
const LLM_CONCURRENCY = Number(process.env.BENCHMARK_LLM_CONCURRENCY ?? DEFAULT_LLM_CONCURRENCY);
const FORCE_RERUN = process.env.BENCHMARK_FORCE_RERUN === "true";
const SKIP_LLM = process.env.BENCHMARK_SKIP_LLM === "true";
const PROGRESS_EVERY = Number(process.env.BENCHMARK_PROGRESS_EVERY ?? 50);
const MODES: ParserBenchmarkRunMode[] = SKIP_LLM ? ["parser_only"] : ["parser_only", "parser_plus_llm"];

// ── Counters ─────────────────────────────────────────────────────────────────
interface PipelineStats {
  total: number;
  xmlReady: number;
  xmlFailed: number;
  pdfReady: number;
  pdfFailed: number;
  pdfMissing: number;
  truthReady: number;
  renderFailed: number;
  resultsReady: number;
  resultsFailed: number;
  skipped: number;
}

function printStats(stats: PipelineStats, phase: string): void {
  // resultsReady counts individual result files (2 formats × N modes per row), so no /${stats.total} denominator
  console.log(
    `[pipeline:${phase}] ` +
    `xml=${stats.xmlReady}/${stats.total} ` +
    `(fail=${stats.xmlFailed}) | ` +
    `pdf=${stats.pdfReady}/${stats.total} ` +
    `(fail=${stats.pdfFailed} missing=${stats.pdfMissing}) | ` +
    `truth=${stats.truthReady}/${stats.total} ` +
    `(fail=${stats.renderFailed}) | ` +
    `result_files=${stats.resultsReady} ` +
    `(fail=${stats.resultsFailed} skip=${stats.skipped})`
  );
}

// ── Phase 1: Fetch XML + PDF ─────────────────────────────────────────────────
async function fetchPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:fetch] Starting fetch for ${rows.length} rows at concurrency=${FETCH_CONCURRENCY}`);
  let done = 0;

  await mapWithConcurrency(rows, FETCH_CONCURRENCY, async (row) => {
    const xmlPath = getXmlPath(row);
    const pdfPath = getPdfPath(row);

    const xmlExists = await fileExists(xmlPath);
    const pdfExists = await fileExists(pdfPath);

    if (!xmlExists && row.pmcid) {
      try {
        const xml = await fetchPmcXmlByPmcid(row.pmcid);
        await fs.writeFile(xmlPath, xml, "utf8");
        stats.xmlReady++;
      } catch (err) {
        stats.xmlFailed++;
        console.warn(`[fetch] XML failed ${row.pmcid}: ${(err as Error).message}`);
      }
    } else if (xmlExists) {
      stats.xmlReady++;
    }

    if (!pdfExists && row.pmcid) {
      try {
        const pdfUrl = row.pdf?.sourceUrl || await resolvePmcPdfUrl(row.pmcid);
        if (!pdfUrl) {
          stats.pdfMissing++;
        } else {
          const res = await fetch(pdfUrl, {
            headers: { "User-Agent": "Journi Parser Benchmark/1.0" },
            signal: AbortSignal.timeout(60_000),
          });
          if (!res.ok) throw new Error(`PDF download failed (${res.status})`);
          const buf = Buffer.from(await res.arrayBuffer());
          await fs.writeFile(pdfPath, buf);
          stats.pdfReady++;
        }
      } catch (err) {
        stats.pdfFailed++;
        console.warn(`[fetch] PDF failed ${row.pmcid}: ${(err as Error).message}`);
      }
    } else if (pdfExists) {
      stats.pdfReady++;
    }

    done++;
    if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "fetch");
  });
}

// ── Phase 2: Render truth JSON + DOCX ────────────────────────────────────────
async function renderPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:render] Starting render for ${rows.length} rows at concurrency=${RENDER_CONCURRENCY}`);
  const { default: HTMLtoDOCX } = await import("html-to-docx");
  let done = 0;

  await mapWithConcurrency(rows, RENDER_CONCURRENCY, async (row) => {
    const xmlPath = getXmlPath(row);
    const truthPath = getTruthPath(row);
    const docxPath = getDocxPath(row);

    if (!(await fileExists(xmlPath))) {
      done++;
      if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "render");
      return;
    }

    const truthExists = await fileExists(truthPath);
    const docxExists = await fileExists(docxPath);

    if (truthExists && docxExists && !FORCE_RERUN) {
      stats.truthReady++;
      done++;
      if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "render");
      return;
    }

    try {
      const xml = await fs.readFile(xmlPath, "utf8");
      const truth = extractJatsGroundTruth(xml);
      await writeJson(truthPath, truth);

      const html = renderGroundTruthHtml(truth);
      const docxOutput = await HTMLtoDOCX(html, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      });
      const docxBuf = Buffer.isBuffer(docxOutput) ? docxOutput : Buffer.from(docxOutput as ArrayBuffer);
      await fs.writeFile(docxPath, docxBuf);
      stats.truthReady++;
    } catch (err) {
      stats.renderFailed++;
      console.warn(`[render] Failed ${row.pmcid ?? row.pmid}: ${(err as Error).message}`);
    }

    done++;
    if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, "render");
  });
}

// ── Phase 3: Run parser benchmark ─────────────────────────────────────────────
async function benchmarkRow(
  row: CorpusManifestRow,
  truth: JatsGroundTruth,
  format: "pdf" | "docx",
  mode: ParserBenchmarkRunMode,
  stats: PipelineStats,
): Promise<void> {
  const resultPath = getResultPath(row, format, mode);
  if (!FORCE_RERUN && (await fileExists(resultPath))) {
    stats.resultsReady++;
    return;
  }

  const artifactPath = format === "pdf" ? getPdfPath(row) : getDocxPath(row);
  if (!(await fileExists(artifactPath))) {
    stats.skipped++;
    return;
  }

  try {
    const buffer = await fs.readFile(artifactPath);
    const raw = await parseUploadedDocument({
      fileName: artifactPath,
      buffer,
      disableLlmFallback: mode === "parser_only",
      forceLlm: mode === "parser_plus_llm",
    });

    const parsed = { ...parseRawDocument(raw), parseConfidence: raw.parseConfidence };
    const llmFallbackTriggered = (raw.diagnostics ?? []).some((d) => d.code === "LLM_FALLBACK_USED");

    const scored = scoreParsedDocumentAgainstTruth({
      parsed,
      truth,
      studyDesignBucket: row.studyDesignBucket,
      format,
      mode,
      llmFallbackTriggered,
    });

    const envelope: ResultEnvelope = {
      row,
      raw,
      parsed,
      truth,
      result: {
        ...scored,
        createdAt: new Date().toISOString(),
        rawResultPath: resultPath,
      },
    };
    await writeJson(resultPath, envelope);
    stats.resultsReady++;
  } catch (err) {
    stats.resultsFailed++;
    console.warn(`[benchmark] Failed ${row.pmid} ${format}/${mode}: ${(err as Error).message}`);
  }
}

async function benchmarkPhase(rows: CorpusManifestRow[], stats: PipelineStats): Promise<void> {
  console.log(`[pipeline:benchmark] Starting benchmark for ${rows.length} rows`);

  for (const mode of MODES) {
    const concurrency = mode === "parser_plus_llm" ? LLM_CONCURRENCY : PARSE_CONCURRENCY;
    console.log(`[pipeline:benchmark] Mode=${mode} concurrency=${concurrency}`);
    let done = 0;

    await mapWithConcurrency(rows, concurrency, async (row) => {
      const truthPath = getTruthPath(row);
      if (!(await fileExists(truthPath))) {
        done++;
        if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, `benchmark:${mode}`);
        return;
      }

      let truth: JatsGroundTruth;
      try {
        truth = await readJson<JatsGroundTruth>(truthPath);
      } catch {
        done++;
        if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, `benchmark:${mode}`);
        return;
      }

      await benchmarkRow(row, truth, "pdf", mode, stats);
      await benchmarkRow(row, truth, "docx", mode, stats);

      done++;
      if (done % PROGRESS_EVERY === 0 || done === rows.length) printStats(stats, `benchmark:${mode}`);
    });
  }
}

// ── Main ─────────────────────────────────────────────────────────────────────
async function main(): Promise<void> {
  await Promise.all([
    ensureDir(XML_DIR), ensureDir(PDF_DIR),
    ensureDir(DOCX_DIR), ensureDir(TRUTH_DIR),
    ensureDir(RESULTS_DIR),
  ]);

  if (MODES.includes("parser_plus_llm") && !process.env.MODAL_LLM_URL) {
    throw new Error("MODAL_LLM_URL must be set for parser_plus_llm mode. Set BENCHMARK_SKIP_LLM=true to skip.");
  }

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selectedRows = manifest.filter((r) => r.selected && r.pmcid);
  console.log(`[pipeline] ${selectedRows.length} selected rows. Modes: ${MODES.join(", ")}`);

  const limitRows = process.env.BENCHMARK_LIMIT_ROWS ? Number(process.env.BENCHMARK_LIMIT_ROWS) : undefined;
  const rowsToProcess = limitRows ? selectedRows.slice(0, limitRows) : selectedRows;
  if (limitRows) console.log(`[pipeline] Limiting to ${rowsToProcess.length} rows (BENCHMARK_LIMIT_ROWS=${limitRows})`);
  // Note: readResultEnvelopes() reads all results in RESULTS_DIR, not scoped to rowsToProcess — aggregate reports reflect all prior runs

  const stats: PipelineStats = {
    total: rowsToProcess.length,
    xmlReady: 0, xmlFailed: 0,
    pdfReady: 0, pdfFailed: 0, pdfMissing: 0,
    truthReady: 0, renderFailed: 0,
    resultsReady: 0, resultsFailed: 0, skipped: 0,
  };

  await fetchPhase(rowsToProcess, stats);
  await renderPhase(rowsToProcess, stats);
  await benchmarkPhase(rowsToProcess, stats);

  printStats(stats, "final");

  console.log("[pipeline] Writing reports...");
  const envelopes = await readResultEnvelopes();
  await Promise.all([
    writeAggregateReport(envelopes),
    writeSectionAccuracyReport(envelopes),
    writeFailureLog(envelopes),
    writeCorpusCompletionReport(rowsToProcess, envelopes),
  ]);

  console.log("[pipeline] Done.");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
