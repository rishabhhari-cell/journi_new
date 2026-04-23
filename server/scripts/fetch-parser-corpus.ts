import { config as loadEnv } from "dotenv";
loadEnv();

import { promises as fs } from "fs";
import path from "path";
import {
  MANIFEST_PATH,
  PDF_DIR,
  XML_DIR,
} from "../services/parser-benchmark.constants";
import {
  fetchPmcXmlByPmcid,
  resolvePmcPdfUrl,
} from "../services/parser-benchmark-source.service";
import type { CorpusManifestRow } from "../services/parser-benchmark.types";
import { ensureDir, mapWithConcurrency, readJsonl, sha256Buffer, slugify, writeJsonl } from "../services/parser-benchmark.utils";

const CONCURRENCY = Number(process.env.BENCHMARK_FETCH_CONCURRENCY ?? 8);

async function main() {
  await ensureDir(XML_DIR);
  await ensureDir(PDF_DIR);

  const manifest = await readJsonl<CorpusManifestRow>(MANIFEST_PATH);
  const selectedRows = manifest.filter((row) => row.selected);

  await mapWithConcurrency(selectedRows, CONCURRENCY, async (row) => {
    if (row.pmcid && row.xml.status !== "ready") {
      try {
        const xml = await fetchPmcXmlByPmcid(row.pmcid);
        const xmlPath = row.xml.path || path.join(XML_DIR, `${slugify(row.pmcid)}.xml`);
        const buffer = Buffer.from(xml, "utf8");
        await fs.writeFile(xmlPath, xml, "utf8");
        row.xml = {
          status: "ready",
          path: xmlPath,
          sha256: sha256Buffer(buffer),
          sourceUrl: row.xml.sourceUrl || `pmc-efetch:${row.pmcid}`,
          bytes: buffer.byteLength,
        };
      } catch (error) {
        row.xml = {
          ...row.xml,
          status: "failed",
          error: (error as Error).message,
        };
      }
    }

    if (row.pmcid && row.pdf.status !== "ready") {
      try {
        const pdfUrl = row.pdf.sourceUrl || await resolvePmcPdfUrl(row.pmcid);
        if (!pdfUrl) {
          row.pdf = { ...row.pdf, status: "missing", error: "No legal PDF URL available from PMC OA service." };
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
          const pdfPath = row.pdf.path || path.join(PDF_DIR, `${slugify(row.pmcid)}.pdf`);
          await fs.writeFile(pdfPath, buffer);
          row.pdf = {
            status: "ready",
            path: pdfPath,
            sha256: sha256Buffer(buffer),
            sourceUrl: pdfUrl,
            bytes: buffer.byteLength,
          };
        }
      } catch (error) {
        row.pdf = {
          ...row.pdf,
          status: "failed",
          error: (error as Error).message,
        };
      }
    }
  });

  await writeJsonl(MANIFEST_PATH, manifest);
  console.log(`Fetch complete for ${selectedRows.length} selected records.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
