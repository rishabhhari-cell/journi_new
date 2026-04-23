import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import path from "path";
import {
  DOCX_DIR,
  MANIFEST_PATH,
  TRUTH_DIR,
} from "../services/parser-benchmark.constants";
import { extractJatsGroundTruth, renderGroundTruthHtml } from "../services/jats-ground-truth.service";
import type { CorpusManifestRow, JatsGroundTruth } from "../services/parser-benchmark.types";
import { ensureDir, readJsonl, sha256Buffer, slugify, writeJson, writeJsonl } from "../services/parser-benchmark.utils";

const DOCX_VARIANT = process.env.BENCHMARK_DOCX_VARIANT === "clean" ? "clean" : "perturbed";

async function main() {
  await ensureDir(DOCX_DIR);
  await ensureDir(TRUTH_DIR);

  const { default: HTMLtoDOCX } = await import("html-to-docx");
  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);

  for (const row of manifest.filter((entry) => entry.selected && entry.xml.path)) {
    try {
      const xml = await fs.readFile(row.xml.path!, "utf8");
      const truth = extractJatsGroundTruth(xml);
      const truthPath = path.join(TRUTH_DIR, `${slugify(row.pmcid || row.pmid)}.json`);
      await writeJson(truthPath, truth);
      const truthBuffer = Buffer.from(JSON.stringify(truth), "utf8");
      row.truth = {
        status: "ready",
        path: truthPath,
        sha256: sha256Buffer(truthBuffer),
        bytes: truthBuffer.byteLength,
      };

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
      const docxPath = path.join(DOCX_DIR, `${slugify(row.pmcid || row.pmid)}.docx`);
      await fs.writeFile(docxPath, docxBuffer);
      row.docx = {
        status: "ready",
        path: docxPath,
        sha256: sha256Buffer(docxBuffer),
        bytes: docxBuffer.byteLength,
      };
    } catch (error) {
      row.truth = {
        ...row.truth,
        status: "failed",
        error: (error as Error).message,
      };
      row.docx = {
        ...row.docx,
        status: "failed",
        error: (error as Error).message,
      };
    }
  }

  await writeJsonl(MANIFEST_PATH, manifest);
  console.log("Rendered truth JSON and DOCX artifacts.");
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
