import { XMLParser } from "fast-xml-parser";
import type { ParseDiagnostic } from "../../shared/document-parse";
import { normalizeSectionMatchKey } from "../../shared/document-parse";

const xmlParser = new XMLParser({
  ignoreAttributes: false,
  attributeNamePrefix: "",
  removeNSPrefix: true,
  parseTagValue: false,
  parseAttributeValue: false,
});

function ensureArray<T>(value: T | T[] | undefined | null): T[] {
  if (Array.isArray(value)) return value;
  return value == null ? [] : [value];
}

// ─── Public helpers (exported for unit tests) ────────────────────────────────

export function extractTextFromParagraphXml(paraXml: string): string {
  // Fast regex extract of all <w:t> content — avoids full XML parse per paragraph
  const runs = Array.from(paraXml.matchAll(/<(?:w:)?t(?:\s[^>]*)?>([^<]*)<\/(?:w:)?t>/g));
  return runs.map((m) => m[1]).join("").trim();
}

export function detectHeadingFromParagraphXml(paraXml: string): boolean {
  // Priority 1: w:outlineLvl 0–3
  const outlineLvlMatch = paraXml.match(/<(?:w:)?outlineLvl[^>]+(?:w:)?val="(\d+)"/);
  if (outlineLvlMatch) {
    const level = Number(outlineLvlMatch[1]);
    if (level >= 0 && level <= 3) return true;
  }

  // Priority 2: w:pStyle starts with "Heading" or "heading"
  const pStyleMatch = paraXml.match(/<(?:w:)?pStyle[^>]+(?:w:)?val="([^"]+)"/);
  if (pStyleMatch) {
    const styleName = pStyleMatch[1];
    if (/^heading/i.test(styleName)) return true;

    // Priority 3: w:pStyle matches a canonical section alias
    const key = normalizeSectionMatchKey(styleName);
    if (key && key !== "content" && key !== styleName.toLowerCase()) return true;
  }

  // Priority 4: ALL-CAPS ≤60 chars matching canonical alias
  const text = extractTextFromParagraphXml(paraXml);
  if (text && text.length <= 60 && /^[A-Z][A-Z\s&/-]+$/.test(text)) {
    const key = normalizeSectionMatchKey(text);
    if (key && key !== "content") return true;
  }

  return false;
}

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DocxXmlSection {
  title: string;
  paragraphTexts: string[];
}

export type PreambleLineType = "author" | "institution" | "other";

const INSTITUTION_KEYWORDS = /university|institute|department|hospital|college|school|center|centre|faculty|laboratory/i;
const SUPERSCRIPT_DIGITS = /^[¹²³⁴⁵⁶⁷⁸⁹]+|^\d+(?=[A-Z])/;

export function classifyPreambleLine(line: string): PreambleLineType {
  const trimmed = line.trim();
  if (!trimmed || trimmed.length > 200) return "other";

  // Reject lines that are clearly not preamble author/institution content
  if (/https?:\/\/|doi\.org|10\.\d{4,}/i.test(trimmed)) return "other";
  if (/correspondence:|email:|@|©|\bDOI\b|\bISSN\b|\bpages?\b/i.test(trimmed)) return "other";
  // Reject if it ends with sentence punctuation suggesting body text
  if (/[.!?]$/.test(trimmed) && trimmed.split(/\s+/).length > 6) return "other";

  // Institution: keyword match OR starts with superscript/digit affiliation marker
  if (INSTITUTION_KEYWORDS.test(trimmed)) return "institution";
  if (SUPERSCRIPT_DIGITS.test(trimmed)) return "institution";

  // Strip superscript suffixes (e.g. "Smith J¹" → "Smith J") before name check
  const stripped = trimmed.replace(/[¹²³⁴⁵⁶⁷⁸⁹⁰]+/g, "").trim();

  // Author: short line, comma-separated tokens that look like names (1–4 words, starts uppercase)
  if (stripped.length <= 120 && !/[.!?]$/.test(stripped)) {
    const tokens = stripped.split(/,\s*/);
    const looksLikeNames = tokens.every((token) => {
      const words = token.trim().split(/\s+/);
      if (words.length < 1 || words.length > 5) return false;
      // Must start with a capital letter and not be an all-caps abbreviation >4 chars (likely an acronym/journal)
      if (!/^[A-Z]/.test(words[0])) return false;
      if (words[0].length > 4 && /^[A-Z]+$/.test(words[0])) return false;
      return true;
    });
    // Multiple comma-separated tokens: classic author list
    if (looksLikeNames && tokens.length >= 2) return "author";
    // Single token: only treat as author if it has 2+ words (e.g. "Alice Smith", "Jones AB")
    if (looksLikeNames && tokens.length === 1 && stripped.split(/\s+/).length >= 2 && stripped.split(/\s+/).length <= 4) return "author";
  }

  return "other";
}

export interface DocxXmlResult {
  sections: DocxXmlSection[];
  referenceLines: string[];
  mainDocumentPath: string;
  figureRelsPath: string;
  diagnostics: ParseDiagnostic[];
  authors: string[];
  institutions: string[];
}

// ─── Main export ─────────────────────────────────────────────────────────────

export async function extractDocxXmlStructure(buffer: Buffer): Promise<DocxXmlResult> {
  const { default: JSZip } = await import("jszip");
  const zip = await JSZip.loadAsync(buffer);
  const diagnostics: ParseDiagnostic[] = [];

  // Step 1: Find main document part via [Content_Types].xml
  let mainDocumentPath = "word/document.xml";
  const contentTypesXml = await zip.file("[Content_Types].xml")?.async("string");
  if (contentTypesXml) {
    const ctParsed = xmlParser.parse(contentTypesXml);
    const overrides = ensureArray(ctParsed?.Types?.Override);
    const docPart = overrides.find(
      (o: any) =>
        String(o?.ContentType ?? "").includes("wordprocessingml.document.main"),
    );
    if (docPart?.PartName) {
      mainDocumentPath = String(docPart.PartName).replace(/^\//, "");
    }
  } else {
    diagnostics.push({
      level: "warning",
      code: "DOCX_CONTENT_TYPES_MISSING",
      message: "[Content_Types].xml not found; assuming word/document.xml as main part.",
    });
  }

  // Step 2: Derive figure rels path from main document path
  const mainDocDir = mainDocumentPath.split("/").slice(0, -1).join("/");
  const mainDocFile = mainDocumentPath.split("/").pop() ?? "document.xml";
  const figureRelsPath = `${mainDocDir}/_rels/${mainDocFile}.rels`;

  // Step 3: Walk document.xml paragraph by paragraph
  const documentXml = await zip.file(mainDocumentPath)?.async("string");
  if (!documentXml) {
    diagnostics.push({
      level: "error",
      code: "DOCX_DOCUMENT_XML_MISSING",
      message: `Main document part ${mainDocumentPath} not found in DOCX zip.`,
    });
    return { sections: [], referenceLines: [], mainDocumentPath, figureRelsPath, diagnostics, authors: [], institutions: [] };
  }

  const paragraphMatches = Array.from(documentXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g));

  const sections: DocxXmlSection[] = [];
  let currentTitle: string | null = null;
  let currentParagraphs: string[] = [];

  const flush = () => {
    if (currentTitle !== null || currentParagraphs.length > 0) {
      sections.push({
        title: currentTitle ?? "Content",
        paragraphTexts: currentParagraphs,
      });
    }
    currentParagraphs = [];
  };

  for (const match of paragraphMatches) {
    const paraXml = match[0];
    const text = extractTextFromParagraphXml(paraXml);
    if (!text) continue;

    if (detectHeadingFromParagraphXml(paraXml)) {
      flush();
      currentTitle = text;
    } else {
      currentParagraphs.push(text);
    }
  }
  flush();

  // Step 3b: Extract authors and institutions from preamble of the first section
  const authors: string[] = [];
  const institutions: string[] = [];
  const firstSection = sections[0];
  if (firstSection) {
    const preambleLines = firstSection.paragraphTexts.slice(0, 10);
    for (const line of preambleLines) {
      const kind = classifyPreambleLine(line);
      if (kind === "author") authors.push(line.replace(/[¹²³⁴⁵⁶⁷⁸⁹]+/g, "").trim());
      else if (kind === "institution") institutions.push(line.trim());
    }
  }

  // Step 4: Extract reference lines from footnotes.xml + endnotes.xml
  const referenceLines: string[] = [];
  for (const notesFile of [`${mainDocDir}/footnotes.xml`, `${mainDocDir}/endnotes.xml`]) {
    const notesXml = await zip.file(notesFile)?.async("string");
    if (!notesXml) continue;
    const noteParaMatches = Array.from(notesXml.matchAll(/<w:p[\s>][\s\S]*?<\/w:p>/g));
    for (const match of noteParaMatches) {
      const text = extractTextFromParagraphXml(match[0]);
      if (text && /\b(19|20)\d{2}\b/.test(text)) {
        referenceLines.push(text);
      }
    }
  }

  return { sections, referenceLines, mainDocumentPath, figureRelsPath, diagnostics, authors, institutions };
}
