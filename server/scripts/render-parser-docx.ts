import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import {
  DOCX_DIR,
  MANIFEST_PATH,
  TRUTH_DIR,
} from "../services/parser-benchmark.constants";
import {
  formatBatchLabel,
  selectManifestBatch,
} from "../services/parser-benchmark-batch.service";
import {
  getDocxPath,
  getTruthPath,
  getXmlPath,
} from "../services/parser-benchmark-artifacts.service";
import { extractJatsGroundTruth, renderGroundTruthHtml } from "../services/jats-ground-truth.service";
import type { CorpusManifestRow, JatsGroundTruth } from "../services/parser-benchmark.types";
import { ensureDir, fileExists, readJsonl, writeJson } from "../services/parser-benchmark.utils";

const DOCX_VARIANT = process.env.BENCHMARK_DOCX_VARIANT === "clean" ? "clean" : "perturbed";
const PROGRESS_EVERY = Number(process.env.BENCHMARK_RENDER_PROGRESS_EVERY ?? 25);
const CHECKPOINT_EVERY = Number(process.env.BENCHMARK_RENDER_CHECKPOINT_EVERY ?? 50);

async function main() {
  await ensureDir(DOCX_DIR);
  await ensureDir(TRUTH_DIR);

  const { default: HTMLtoDOCX } = await import("html-to-docx");
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const batch = selectManifestBatch(
    manifest,
    (entry) => entry.selected && !!entry.pmcid,
  );
  const selectedRows = batch.rows;
  console.log(`[render-docx] Starting batch: ${formatBatchLabel(batch.totalEligible, selectedRows.length, batch.offset, batch.limit)}`);

  if (selectedRows.length === 0) {
    console.log("[render-docx] No selected rows need truth/DOCX rendering for this batch.");
    return;
  }

  let completed = 0;
  for (const row of selectedRows) {
    const xmlPath = getXmlPath(row);
    const truthPath = getTruthPath(row);
    const docxPath = getDocxPath(row);
    try {
      if (!(await fileExists(xmlPath))) {
        completed += 1;
        if (completed % PROGRESS_EVERY === 0 || completed === selectedRows.length) {
          console.log(`[render-docx] Progress ${completed}/${selectedRows.length}`);
        }
        continue;
      }

      const truthReady = await fileExists(truthPath);
      const docxReady = await fileExists(docxPath);
      if (truthReady && docxReady) {
        completed += 1;
        if (completed % PROGRESS_EVERY === 0 || completed === selectedRows.length) {
          console.log(`[render-docx] Progress ${completed}/${selectedRows.length}`);
        }
        continue;
      }

      const xml = await fs.readFile(xmlPath, "utf8");
      const truth = extractJatsGroundTruth(xml);
      await writeJson(truthPath, truth);

      const html = DOCX_VARIANT === "clean"
        ? renderGroundTruthHtml(truth)
        : renderPerturbedHtml(truth);
      const docxOutput = await HTMLtoDOCX(html, null, {
        table: { row: { cantSplit: true } },
        footer: false,
        pageNumber: false,
      });
      const docxBuffer = Buffer.isBuffer(docxOutput)
        ? docxOutput
        : Buffer.from(docxOutput as ArrayBuffer);
      await fs.writeFile(docxPath, docxBuffer);
    } catch (error) {
      console.warn(`[render-docx] Failed for ${row.pmcid || row.pmid}: ${(error as Error).message}`);
    }

    completed += 1;
    if (completed % PROGRESS_EVERY === 0 || completed === selectedRows.length) {
      console.log(`[render-docx] Progress ${completed}/${selectedRows.length}`);
    }
    if (completed % CHECKPOINT_EVERY === 0) {
      console.log(`[render-docx] Checkpoint reached at ${completed}/${selectedRows.length}`);
    }
  }

  console.log(`[render-docx] Rendered truth JSON and DOCX artifacts for ${selectedRows.length} rows.`);
}

function renderPerturbedHtml(truth: JatsGroundTruth): string {
  const parts: string[] = [
    `<div style="font-family: Georgia, 'Times New Roman', serif; line-height: 1.45; color: #111827;">`,
  ];

  truth.sections.forEach((section, index) => {
    const marginTop = index === 0 ? "0" : "20px";
    if (section.canonicalTitle === "Title") {
      parts.push(`<h1 style="margin:${marginTop} 0 18px; font-size: 24pt; text-align: center;">${escapeHtml(section.text)}</h1>`);
      return;
    }

    parts.push(
      `<h2 style="margin:${marginTop} 0 10px; font-size: 15pt; letter-spacing: 0.02em; border-bottom: 1px solid #d1d5db; padding-bottom: 4px;">${escapeHtml(section.canonicalTitle)}</h2>`,
    );
    const paragraphs = section.text.split(/\n{2,}/).map((paragraph) => paragraph.trim()).filter(Boolean);
    paragraphs.forEach((paragraph, paragraphIndex) => {
      const indent = paragraphIndex === 0 ? "0" : "14px";
      parts.push(`<p style="margin: 0 0 10px; text-indent: ${indent};">${escapeHtml(paragraph)}</p>`);
    });
  });

  if (truth.figures.length > 0 || truth.tables.length > 0) {
    parts.push(`<h2 style="margin:20px 0 10px; font-size: 15pt;">Figures and Tables</h2>`);
    truth.figures.forEach((figure, index) => {
      const label = figure.label || `Figure ${index + 1}`;
      const caption = figure.caption || "";
      parts.push(`<p style="margin: 0 0 8px; font-size: 10.5pt;"><strong>${escapeHtml(label)}</strong>${caption ? `: ${escapeHtml(caption)}` : ""}</p>`);
    });
    truth.tables.forEach((table, index) => {
      const label = table.label || `Table ${index + 1}`;
      const caption = table.caption || "";
      parts.push(`<p style="margin: 0 0 8px; font-size: 10.5pt;"><strong>${escapeHtml(label)}</strong>${caption ? `: ${escapeHtml(caption)}` : ""}</p>`);
    });
  }

  parts.push("</div>");
  return parts.join("\n");
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
