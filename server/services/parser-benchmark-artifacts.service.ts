import path from "path";
import {
  DOCX_DIR,
  PDF_DIR,
  RESULTS_DIR,
  TRUTH_DIR,
  XML_DIR,
} from "./parser-benchmark.constants";
import type {
  CorpusManifestRow,
  ParserBenchmarkResultRecord,
  ParserBenchmarkRunMode,
} from "./parser-benchmark.types";
import type { ParsedManuscript, RawParsedDocument } from "@shared/document-parse";
import type { JatsGroundTruth } from "./parser-benchmark.types";
import { slugify } from "./parser-benchmark.utils";

export function getRowArtifactKey(row: Pick<CorpusManifestRow, "pmcid" | "pmid">): string {
  return slugify(row.pmcid || row.pmid);
}

export function getXmlPath(row: Pick<CorpusManifestRow, "pmcid" | "pmid" | "xml">): string {
  return row.xml.path || path.join(XML_DIR, `${getRowArtifactKey(row)}.xml`);
}

export function getPdfPath(row: Pick<CorpusManifestRow, "pmcid" | "pmid" | "pdf">): string {
  return row.pdf.path || path.join(PDF_DIR, `${getRowArtifactKey(row)}.pdf`);
}

export function getTruthPath(row: Pick<CorpusManifestRow, "pmcid" | "pmid" | "truth">): string {
  return row.truth.path || path.join(TRUTH_DIR, `${getRowArtifactKey(row)}.json`);
}

export function getDocxPath(row: Pick<CorpusManifestRow, "pmcid" | "pmid" | "docx">): string {
  return row.docx.path || path.join(DOCX_DIR, `${getRowArtifactKey(row)}.docx`);
}

export function getResultPath(
  row: Pick<CorpusManifestRow, "pmid">,
  format: "pdf" | "docx",
  mode: ParserBenchmarkRunMode,
): string {
  return path.join(RESULTS_DIR, `${row.pmid}-${format}-${mode}.json`);
}

export interface ResultEnvelope {
  row: CorpusManifestRow;
  raw?: RawParsedDocument;
  parsed?: ParsedManuscript;
  truth?: JatsGroundTruth;
  result: ParserBenchmarkResultRecord;
}
