import { countWordsFromHtml } from "./word-count";

export const CANONICAL_SECTION_NAMES = new Set([
  "title", "abstract", "introduction", "background",
  "methods", "materials and methods", "search strategy",
  "results", "results & synthesis", "discussion",
  "conclusion", "conclusions", "references",
  "data availability", "ethics statement", "acknowledgements",
  "funding", "conflicts of interest",
]);

export type ParseDiagnosticLevel = "info" | "warning" | "error";

export interface ParseDiagnostic {
  level: ParseDiagnosticLevel;
  code: string;
  message: string;
}

export interface ParsedCitation {
  authors: string[];
  title: string;
  year: number;
  journal?: string;
  doi?: string;
  url?: string;
  type: "article" | "book" | "website" | "conference";
  volume?: string;
  issue?: string;
  pages?: string;
  publisher?: string;
  metadata?: Record<string, unknown>;
}

export interface ParsedSection {
  title: string;
  content: string;
  order: number;
  wordCount: number;
  sourceTitle?: string;
}

export type ParsedBlockType = "text" | "figure" | "diagram" | "table" | "caption" | "reference";
export type ParsedBlockSource = "text-layer" | "ocr" | "object-extract";

export interface ParsedBoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ParsedBlock {
  id: string;
  type: ParsedBlockType;
  text: string;
  page: number;
  bbox?: ParsedBoundingBox;
  source: ParsedBlockSource;
  confidence: number;
  diagnostics: ParseDiagnostic[];
  suggestedSection?: string;
  /** True when this block's font height is significantly larger than the median body text height on the page — strong heading signal for PDFs. */
  isLargeFont?: boolean;
}

export interface ParsedFigure {
  id: string;
  imageData: string;
  caption?: string;
  page: number;
  bbox?: ParsedBoundingBox;
  confidence: number;
  diagnostics: ParseDiagnostic[];
}

export interface ParsedTable {
  id: string;
  html: string;
  matrix: string[][];
  caption?: string;
  page: number;
  bbox?: ParsedBoundingBox;
  confidence: number;
  diagnostics: ParseDiagnostic[];
}

export interface ParsedLink {
  id: string;
  sourceId: string;
  targetId: string;
  relation: "caption_to_figure" | "caption_to_table";
  confidence: number;
  diagnostics: ParseDiagnostic[];
}

export interface ParsedManuscript {
  fileTitle: string;
  sections: ParsedSection[];
  citations: ParsedCitation[];
  diagnostics: ParseDiagnostic[];
  totalWordCount: number;
  reviewRequired?: boolean;
  parseConfidence?: number;
  blocks?: ParsedBlock[];
  figures?: ParsedFigure[];
  tables?: ParsedTable[];
  links?: ParsedLink[];
}

export interface RawParsedDocument {
  fileTitle: string;
  format: "docx" | "pdf" | "image";
  html?: string;
  text?: string;
  imageDataUrl?: string;
  references?: string[];
  diagnostics?: ParseDiagnostic[];
  blocks?: ParsedBlock[];
  figures?: ParsedFigure[];
  tables?: ParsedTable[];
  links?: ParsedLink[];
  llmParsed?: {
    sections: Array<{ title: string; content: string }>;
    citations: Array<{
      authors: string[];
      title: string;
      year: number;
      journal?: string;
      doi?: string;
      url?: string;
    }>;
  };
}

interface IntermediateSection {
  title: string;
  content: string;
}

const CANONICAL_ORDER = [
  "Title",
  "Abstract",
  "Introduction",
  "Search Strategy",
  "Results & Synthesis",
  "Discussion",
  "Limitations",
  "Conclusions",
  "References",
  "Acknowledgements",
  "Figures and Tables",
  "Appendix",
];

const CANONICAL_ALIASES: Array<[string, RegExp]> = [
  ["Title",               /^(title|title page|cover page|front matter)$/i],
  ["Abstract",            /^(abstract|summary|synopsis|overview|executive summary|precis)$/i],
  ["Introduction",        /^(introduction|background|rationale|background and context|motivation|problem statement|literature review|related work|prior work|related literature)$/i],
  ["Search Strategy",     /^(search strategy|sources of data|method|methods|methodology|materials and methods|materials and methods|study design|research design|experimental design|data collection|data sources|objectives|protocol|search methods|inclusion criteria|eligibility criteria|participants|subjects)$/i],
  ["Results & Synthesis", /^(results|results and synthesis|results and synthesis|findings|key findings|outcomes|empirical results|statistical analysis|quantitative results|qualitative results|case results)$/i],
  ["Discussion",          /^(discussion|drawbacks|analysis|interpretation|implications|key takeaways|strengths and weaknesses|critique|evaluation|commentary|reflection)$/i],
  ["Limitations",         /^(limitations|constraints|study limitations|weaknesses|strengths and limitations|limitations and future work)$/i],
  ["Conclusions",         /^(conclusion|conclusions|final remarks|summary and conclusions|closing remarks|recommendations|future work|future directions|conclusion and future work)$/i],
  ["References",          /^(references|bibliography|cited works|sources|literature cited|further reading|citations|works cited)$/i],
  ["Acknowledgements",    /^(acknowledgements|acknowledgments|acknowledgement|acknowledgment|funding|funding sources|financial disclosure|conflicts of interest|author contributions)$/i],
  ["Figures and Tables",  /^(figures?( and | & )tables?|tables?( and | & )figures?|figures|tables)$/i],
  ["Appendix",            /^(appendix|appendices|supplementary|supplemental|supplementary material|supplementary materials|supplementary data|additional information)$/i],
];

const ABSTRACT_SUBSECTION_KEYS = new Set([
  "introduction",
  "background",
  "objectives",
  "methods",
  "results",
  "discussion",
  "conclusions",
]);

export function normalizeSectionMatchKey(title: string): string {
  const cleaned = normalizeHeading(title).toLowerCase();
  if (!cleaned) return "content";
  if (/^(title|title page|cover page|front matter)$/.test(cleaned)) return "title";
  if (/^(abstract|summary|synopsis|overview|executive summary|precis)$/.test(cleaned)) return "abstract";
  if (/^(introduction|background|rationale|motivation|problem statement|literature review|related work|prior work|related literature)$/.test(cleaned)) return "introduction";
  if (/^(methods?|methodology|materials (and|&) methods|search strategy|sources of data|study design|research design|experimental design|data collection|data sources|objectives|protocol|search methods|inclusion criteria|eligibility criteria|participants|subjects)$/.test(cleaned)) return "methods";
  if (/^(results|results (and|&) synthesis|findings|key findings|outcomes|empirical results|statistical analysis|quantitative results|qualitative results|case results)$/.test(cleaned)) return "results";
  if (/^(discussion|drawbacks|analysis|interpretation|implications|key takeaways|strengths and weaknesses|critique|evaluation|commentary|reflection)$/.test(cleaned)) return "discussion";
  if (/^(limitations|constraints|study limitations|weaknesses|strengths and limitations|limitations and future work)$/.test(cleaned)) return "limitations";
  if (/^(conclusion|conclusions|final remarks|summary and conclusions|closing remarks|recommendations|future work|future directions|conclusion and future work)$/.test(cleaned)) return "conclusions";
  if (/^(references|bibliography|cited works|sources|literature cited|further reading|citations|works cited)$/.test(cleaned)) return "references";
  if (/^(acknowledgements|acknowledgments|acknowledgement|acknowledgment|funding|funding sources|financial disclosure|conflicts of interest|author contributions)$/.test(cleaned)) return "acknowledgements";
  if (/^(figures?( and | & )tables?|tables?( and | & )figures?|figures|tables)$/.test(cleaned)) return "figures_and_tables";
  if (/^(appendix|appendices|supplementary|supplemental|supplementary material|supplementary materials|supplementary data|additional information)$/.test(cleaned)) return "appendix";
  return cleaned;
}

function normalizeHeading(raw: string): string {
  return raw
    .replace(/<[^>]*>/g, " ")
    .replace(/[^A-Za-z0-9\s&/-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(input: string): string {
  return input
    .split(/\s+/)
    .filter(Boolean)
    .map((segment) => segment[0].toUpperCase() + segment.slice(1).toLowerCase())
    .join(" ");
}

function mapToCanonical(title: string): string {
  const cleaned = normalizeHeading(title);
  for (const [canonical, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(cleaned)) return canonical;
  }
  return cleaned ? toTitleCase(cleaned) : "Content";
}

function ensureParagraph(content: string): string {
  const trimmed = (content || "").trim();
  if (!trimmed) return "<p></p>";
  if (/<[a-z][\s\S]*>/i.test(trimmed)) return trimmed;
  return `<p>${trimmed}</p>`;
}

function sanitizeReferenceLine(line: string): string {
  return line
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/\s+/g, " ")
    .replace(/\s+([,.;:!?])/g, "$1")
    .trim();
}

function parseCitationsFromReferences(lines: string[]): ParsedCitation[] {
  const citations: ParsedCitation[] = [];

  for (const rawLine of lines) {
    const raw = sanitizeReferenceLine(rawLine);
    if (!raw) continue;

    // Always extract DOI and URL first — these are format-independent
    const doiMatch = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
    const urlMatch = raw.match(/https?:\/\/[^\s)]+/i);
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const year = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
    const doi = doiMatch ? doiMatch[0] : undefined;
    const url = urlMatch ? urlMatch[0] : undefined;

    // ── Vancouver / numbered: [1] ... or 1. ... or 1) ...
    // Author list ends before first ". [A-Z][a-z]" that isn't an initial
    const vancouverMatch = raw.match(
      /^(?:\[?\d+\]?[.)]\s*)([^.]+(?:\.[A-Z]\b[^.]*)*)\.\s+(.+?)\.\s+([^.]+?)\.\s*(?:\d{4}|;)/
    );
    if (vancouverMatch) {
      const authorRaw = vancouverMatch[1];
      const title = vancouverMatch[2].trim();
      const journal = vancouverMatch[3].trim();
      const authors = authorRaw
        .split(/,\s*(?=[A-Z])/)
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 8);
      citations.push({
        authors: authors.length > 0 ? authors : ["Unknown"],
        title,
        year,
        journal,
        doi,
        url,
        type: "article",
        metadata: { raw, format: "vancouver" },
      });
      continue;
    }

    // ── APA / Harvard: Authors (YYYY). Title. Journal, vol(issue), pages.
    const apaMatch = raw.match(
      /^([^(]+)\((\d{4})\)\.\s+(.+?)\.\s+([A-Z][^,\d]+?)(?:,\s*\d|\.\s*$|$)/
    );
    if (apaMatch) {
      const authorRaw = apaMatch[1];
      const title = apaMatch[3].trim();
      const journal = apaMatch[4].trim();
      const authors = authorRaw
        .split(/,\s*(?:&\s*)?(?=[A-Z])/)
        .map((a) => a.trim())
        .filter(Boolean)
        .slice(0, 8);
      citations.push({
        authors: authors.length > 0 ? authors : ["Unknown"],
        title,
        year: Number(apaMatch[2]),
        journal,
        doi,
        url,
        type: "article",
        metadata: { raw, format: "apa" },
      });
      continue;
    }

    // ── Fallback: keep raw line as title, never corrupt
    const fallbackYear = yearMatch ? Number(yearMatch[0]) : new Date().getFullYear();
    // Best-effort author: text before first comma or bracket
    // Must be short (≤40 chars) and look like a name (≤4 words) to avoid using full sentences
    const beforeComma = raw.split(/[,(]/)[0].trim();
    const looksLikeName =
      beforeComma.length > 0 &&
      beforeComma.length <= 40 &&
      beforeComma.split(/\s+/).length <= 4 &&
      /[A-Za-z]/.test(beforeComma);
    const fallbackAuthors = looksLikeName ? [beforeComma] : ["Unknown"];
    citations.push({
      authors: fallbackAuthors,
      title: raw,
      year: fallbackYear,
      doi,
      url,
      type: url ? "website" : "article",
      metadata: { raw, format: "fallback" },
    });
  }

  return citations;
}

function mergeIntoCanonicalOrder(
  sections: IntermediateSection[],
  fileTitle: string,
): IntermediateSection[] {
  const map = new Map<string, IntermediateSection>();

  for (const section of sections) {
    const canonicalTitle = mapToCanonical(section.title);
    const existing = map.get(canonicalTitle);
    if (existing) {
      existing.content = `${existing.content}\n${section.content}`.trim();
      continue;
    }
    map.set(canonicalTitle, {
      title: canonicalTitle,
      content: ensureParagraph(section.content),
    });
  }

  if (!map.has("Title")) {
    map.set("Title", { title: "Title", content: `<p>${fileTitle}</p>` });
  }

  const ordered: IntermediateSection[] = [];
  for (const canonical of CANONICAL_ORDER) {
    const entry = map.get(canonical);
    if (entry) {
      ordered.push(entry);
      map.delete(canonical);
    }
  }

  Array.from(map.values()).forEach((entry) => {
    ordered.push(entry);
  });

  return ordered;
}

function isBoldOnlyHeading(node: Element): boolean {
  const tag = node.tagName.toLowerCase();
  if (tag !== "p") return false;
  const text = (node.textContent || "").trim();
  if (!text || text.length > 80) return false;

  // Paragraph whose entire content is a single <strong> or <b> element
  const children = Array.from(node.children);
  const soleChild = children.length === 1 ? children[0] : null;
  const isBold =
    soleChild !== null &&
    (soleChild.tagName.toLowerCase() === "strong" || soleChild.tagName.toLowerCase() === "b") &&
    (soleChild.textContent || "").trim() === text;

  if (!isBold) return false;

  // Only treat as heading if text matches a known canonical section name,
  // looks like ALL-CAPS heading, or is title-case without sentence punctuation
  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  if (/^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text)) return true;
  // Accept title-case mixed headings ("Study Design", "Key Findings") — guard against
  // bolded body sentences by rejecting text containing a period mid-string
  return /^[A-Z][A-Za-z0-9\s&/\-]{2,}$/.test(text) && !text.includes(".");
}

function stripHtmlToText(html: string): string {
  return html
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n")
    .replace(/<\/h[1-6]>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/\s+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function isBoldOnlyHeadingHtml(blockHtml: string, text: string): boolean {
  if (!text || text.length > 80) return false;

  const innerHtml = blockHtml
    .replace(/^<p\b[^>]*>/i, "")
    .replace(/<\/p>$/i, "")
    .trim();

  const isEntireParagraphBold =
    /^<(strong|b)\b[^>]*>[\s\S]*<\/\1>$/i.test(innerHtml) &&
    stripHtmlToText(innerHtml) === text;

  if (!isEntireParagraphBold) return false;

  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  if (/^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text)) return true;
  return /^[A-Z][A-Za-z0-9\s&/\-]{2,}$/.test(text) && !text.includes(".");
}

function extractHtmlBlocks(html: string): Array<{ tag: string; html: string; text: string }> {
  const blocks = Array.from(
    html.matchAll(/<(p|h1|h2|h3)\b[^>]*>[\s\S]*?<\/\1>/gi),
  ).map((match) => {
    const blockHtml = match[0];
    return {
      tag: match[1].toLowerCase(),
      html: blockHtml,
      text: stripHtmlToText(blockHtml),
    };
  });

  return blocks;
}

function parseSectionsFromHtmlWithoutDom(html: string): IntermediateSection[] {
  const blocks = extractHtmlBlocks(html);
  if (blocks.length === 0) {
    return html.trim() ? [{ title: "Content", content: ensureParagraph(html) }] : [];
  }

  const sections: IntermediateSection[] = [];
  let currentTitle = "";
  let currentContent = "";

  for (const block of blocks) {
    const isHeading =
      block.tag === "h1" ||
      block.tag === "h2" ||
      block.tag === "h3" ||
      (block.tag === "p" && isBoldOnlyHeadingHtml(block.html, block.text));

    if (isHeading) {
      if (currentTitle || currentContent.trim()) {
        sections.push({
          title: currentTitle || "Content",
          content: ensureParagraph(currentContent.trim()),
        });
      }
      currentTitle = normalizeHeading(block.text) || "Content";
      currentContent = "";
      continue;
    }

    currentContent += block.html;
  }

  if (currentTitle || currentContent.trim()) {
    sections.push({
      title: currentTitle || "Content",
      content: ensureParagraph(currentContent.trim()),
    });
  }

  if (sections.length === 0 && html.trim()) {
    sections.push({ title: "Content", content: ensureParagraph(html) });
  }

  return sections;
}

function parseSectionsFromHtml(html: string): IntermediateSection[] {
  if (typeof DOMParser === "undefined") {
    return parseSectionsFromHtmlWithoutDom(html);
  }
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) {
    return parseSectionsFromHtmlWithoutDom(html);
  }

  const sections: IntermediateSection[] = [];
  let currentTitle = "";
  let currentContent = "";

  for (const node of Array.from(root.children)) {
    const tag = node.tagName.toLowerCase();
    if (tag === "h1" || tag === "h2" || tag === "h3" || isBoldOnlyHeading(node)) {
      if (currentTitle || currentContent.trim()) {
        sections.push({
          title: currentTitle || "Content",
          content: ensureParagraph(currentContent.trim()),
        });
      }
      currentTitle = normalizeHeading(node.textContent || "") || "Content";
      currentContent = "";
    } else {
      currentContent += node.outerHTML;
    }
  }

  if (currentTitle || currentContent.trim()) {
    sections.push({
      title: currentTitle || "Content",
      content: ensureParagraph(currentContent.trim()),
    });
  }

  if (sections.length === 0 && html.trim()) {
    sections.push({ title: "Content", content: ensureParagraph(html) });
  }

  return sections;
}

function parseSectionsFromText(text: string): IntermediateSection[] {
  const lines = text.split(/\r?\n/);
  const sections: IntermediateSection[] = [];
  let currentTitle = "";
  let buffer: string[] = [];

  const headingCandidates = new Set(
    [
      ...CANONICAL_ORDER,
      "methods",
      "methodology",
      "sources of data",
      "benefits",
      "drawbacks",
      "summary",
      "content",
    ].map((value) => value.toLowerCase()),
  );

  const flush = () => {
    if (!currentTitle && buffer.length === 0) return;
    const content = buffer
      .map((line) => line.trim())
      .filter(Boolean)
      .map((line) => `<p>${line}</p>`)
      .join("");
    sections.push({
      title: currentTitle || "Content",
      content: content || "<p></p>",
    });
    buffer = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) {
      buffer.push("");
      continue;
    }

    const normalized = normalizeHeading(trimmed).toLowerCase();
    const isKnownHeading = headingCandidates.has(normalized);

    // Strip leading number/outline prefix (e.g. "1. ", "4.2 ", "I. ", "II. ") and test the remainder
    const strippedNumbered = trimmed.replace(/^[\dIVXivx]+(?:\.\d+)*[.)]\s+/, "");
    const normalizedStripped = normalizeHeading(strippedNumbered).toLowerCase();
    const isNumberedHeading =
      strippedNumbered !== trimmed &&
      strippedNumbered.length > 2 &&
      strippedNumbered.length <= 80 &&
      (headingCandidates.has(normalizedStripped) || /^[A-Z][A-Z\s&/-]{2,}$/.test(strippedNumbered));

    const looksLikeHeading =
      normalized.length <= 80 &&
      (isKnownHeading ||
        isNumberedHeading ||
        (/^[A-Z0-9\s&/-]+$/.test(trimmed) && trimmed.length > 2));

    if (looksLikeHeading) {
      flush();
      currentTitle = toTitleCase(isNumberedHeading ? normalizedStripped : normalized);
      continue;
    }

    buffer.push(trimmed);
  }

  flush();
  return sections;
}

function foldStructuredAbstractSections(sections: IntermediateSection[]): IntermediateSection[] {
  const abstractIndex = sections.findIndex((section) => normalizeSectionMatchKey(section.title) === "abstract");
  if (abstractIndex === -1) return sections;

  const abstractSection = sections[abstractIndex];
  const abstractWordCount = countWordsFromHtml(abstractSection.content);
  const captured: IntermediateSection[] = [];
  const seen = new Set<string>();

  for (let index = abstractIndex + 1; index < sections.length; index += 1) {
    const section = sections[index];
    const key = normalizeSectionMatchKey(section.title);
    if (!ABSTRACT_SUBSECTION_KEYS.has(key)) break;
    if (seen.has(key)) break;
    captured.push(section);
    seen.add(key);
  }

  if ((abstractWordCount > 25 && abstractSection.content.trim() !== "<p></p>") || captured.length < 2) {
    return sections;
  }

  const abstractParts: string[] = [];
  if (abstractSection.content.trim() && abstractSection.content.trim() !== "<p></p>") {
    abstractParts.push(abstractSection.content);
  }
  for (const section of captured) {
    abstractParts.push(`<h3>${section.title}</h3>${ensureParagraph(section.content)}`);
  }

  return [
    ...sections.slice(0, abstractIndex),
    {
      title: abstractSection.title,
      content: abstractParts.join(""),
    },
    ...sections.slice(abstractIndex + 1 + captured.length),
  ];
}

function promoteDocxFrontMatter(sections: IntermediateSection[]): IntermediateSection[] {
  if (sections.length === 0) return sections;

  const first = sections[0];
  const firstKey = normalizeSectionMatchKey(first.title);
  const knownFrontMatterKeys = new Set([
    "content",
    "title",
    "abstract",
    "introduction",
    "methods",
    "results",
    "discussion",
    "conclusions",
    "references",
  ]);

  const nextKey = normalizeSectionMatchKey(sections[1]?.title || "");
  if (nextKey !== "abstract" && nextKey !== "introduction" && nextKey !== "methods") {
    return sections;
  }

  if (firstKey !== "content" && knownFrontMatterKeys.has(firstKey)) {
    return sections;
  }

  const titleParagraph =
    firstKey === "content" ? "" : `<p>${first.title}</p>`;

  return [
    {
      title: "Title",
      content: `${titleParagraph}${ensureParagraph(first.content)}`,
    },
    ...sections.slice(1),
  ];
}

function extractFigureCaptionsFromContent(contentHtml: string): string[] {
  return Array.from(contentHtml.matchAll(/<p\b[^>]*>([\s\S]*?)<\/p>/gi))
    .map((match) => sanitizeReferenceLine(match[1]))
    .filter((line) => /^(figure|fig\.?)\s*\d+\s*[:.]/i.test(line));
}

function dedupeCitations(citations: ParsedCitation[]): ParsedCitation[] {
  const seen = new Set<string>();
  const deduped: ParsedCitation[] = [];
  for (const citation of citations) {
    const key = (citation.doi || citation.title).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    deduped.push(citation);
  }
  return deduped;
}

function extractReferenceLines(contentHtml: string): string[] {
  const fromListItems = Array.from(contentHtml.matchAll(/<li>([\s\S]*?)<\/li>/gi)).map((match) => match[1]);
  if (fromListItems.length > 0) return fromListItems;

  const plain = contentHtml
    .replace(/<\/p>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<[^>]+>/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();

  const numbered = Array.from(
    plain.matchAll(/(?:^|\n)\s*(?:\[?\d+\]?[\.\)]?)\s+([\s\S]*?)(?=(?:\n\s*(?:\[?\d+\]?[\.\)]?)\s+)|$)/g),
  )
    .map((match) => match[1].trim())
    .filter(Boolean);

  if (numbered.length > 0) return numbered;

  return plain.split(/\n+/).map((line) => line.trim()).filter(Boolean);
}

function inferBlockTypeFromText(text: string): ParsedBlockType {
  const trimmed = text.trim();
  if (!trimmed) return "text";
  if (/^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(trimmed)) return "caption";
  if (/^table\s*\d+/i.test(trimmed)) return "caption";
  if (/^(?:\[\d+\]|\d+[.)])\s+.+/.test(trimmed) && /\b(19|20)\d{2}\b/.test(trimmed)) return "reference";
  if (/\|/.test(trimmed) || /\t/.test(trimmed) || /\S+\s{2,}\S+/.test(trimmed)) return "table";
  return "text";
}

function isLikelyReferencesHeading(text: string): boolean {
  return /^(references|bibliography)\b/i.test(normalizeHeading(text));
}

function isLikelySectionHeading(text: string): boolean {
  const trimmed = text.trim();
  const normalized = normalizeHeading(trimmed).toLowerCase();
  if (!normalized) return false;
  if (CANONICAL_ORDER.map((s) => s.toLowerCase()).includes(normalized)) return true;
  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(normalized)) return true;
  }
  // ALL-CAPS heading
  if (/^[A-Z][A-Z0-9\s&/-]{2,}$/.test(trimmed)) return true;
  // Strip numbered prefix and test remainder
  const stripped = trimmed.replace(/^[\dIVXivx]+(?:\.\d+)*[.)]\s+/, "");
  if (stripped !== trimmed && stripped.length > 2 && stripped.length <= 80) {
    const strippedNorm = normalizeHeading(stripped).toLowerCase();
    for (const [, matcher] of CANONICAL_ALIASES) {
      if (matcher.test(strippedNorm)) return true;
    }
    if (/^[A-Z][A-Z0-9\s&/-]{2,}$/.test(stripped)) return true;
  }
  return false;
}

function createPlaceholderImageData(label: string): string {
  const safe = label.replace(/[<>&'"]/g, "");
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="640" height="360"><rect width="100%" height="100%" fill="#f8fafc"/><rect x="10" y="10" width="620" height="340" rx="12" fill="#eef2ff" stroke="#c7d2fe"/><text x="50%" y="50%" text-anchor="middle" dominant-baseline="middle" fill="#475569" font-family="Arial" font-size="18">${safe}</text></svg>`;
  const encodeUtf8 = (value: string): string => {
    if (typeof btoa === "function") {
      return btoa(unescape(encodeURIComponent(value)));
    }
    const maybeBuffer = (globalThis as { Buffer?: { from: (value: string, encoding: string) => { toString: (encoding: string) => string } } }).Buffer;
    if (maybeBuffer) {
      return maybeBuffer.from(value, "utf8").toString("base64");
    }
    return "";
  };
  return `data:image/svg+xml;base64,${encodeUtf8(svg)}`;
}

function isReviewBlockingDiagnostic(
  diagnostic: ParseDiagnostic,
  format: RawParsedDocument["format"],
): boolean {
  if (diagnostic.level === "info") return false;
  if (diagnostic.level === "error") return true;

  if (format === "docx") {
    return diagnostic.code !== "DOCX_PARSE_WARNING";
  }

  return true;
}

function tableLinesToMatrix(lines: string[]): string[][] {
  return lines
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) =>
      line
        .split(/\||\t+|\s{2,}/g)
        .map((cell) => cell.trim())
        .filter(Boolean),
    )
    .filter((row) => row.length > 0);
}

function matrixToHtml(matrix: string[][]): string {
  if (matrix.length === 0) return "<table><tbody></tbody></table>";
  const rows = matrix
    .map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join("")}</tr>`)
    .join("");
  return `<table><tbody>${rows}</tbody></table>`;
}

function normalizePdfBlocks(rawBlocks: ParsedBlock[] | undefined): ParsedBlock[] {
  if (!rawBlocks || rawBlocks.length === 0) return [];
  return rawBlocks.map((block, index) => {
    const text = block.text || "";
    const inferredType = block.type || inferBlockTypeFromText(text);
    const suggestedSection = block.suggestedSection
      ? mapToCanonical(block.suggestedSection)
      : isLikelySectionHeading(text)
        ? mapToCanonical(text)
        : inferredType === "reference"
          ? "References"
          : "Content";

    return {
      id: block.id || `pdf-block-${index + 1}`,
      type: inferredType,
      text,
      page: block.page || 1,
      bbox: block.bbox,
      source: block.source || "text-layer",
      confidence: typeof block.confidence === "number" ? block.confidence : 0.85,
      diagnostics: block.diagnostics || [],
      suggestedSection,
      isLargeFont: block.isLargeFont,
    };
  });
}

function buildSectionsFromBlocks(blocks: ParsedBlock[]): IntermediateSection[] {
  if (blocks.length === 0) return [];

  const sections: IntermediateSection[] = [];
  let currentTitle = "Content";
  let buffer: string[] = [];
  let inReferences = false;

  const flush = () => {
    if (buffer.length === 0) return;
    const content = buffer.map((line) => `<p>${line}</p>`).join("");
    sections.push({ title: currentTitle, content });
    buffer = [];
  };

  for (const block of blocks) {
    const text = (block.text || "").trim();
    if (!text) continue;

    if (isLikelyReferencesHeading(text)) {
      flush();
      currentTitle = "References";
      inReferences = true;
      continue;
    }

    if (!inReferences &&
        (isLikelySectionHeading(text) || (block.isLargeFont && text.length <= 100)) &&
        block.type !== "reference") {
      flush();
      currentTitle = mapToCanonical(text);
      continue;
    }

    if (block.type === "reference") {
      if (!inReferences) {
        flush();
        currentTitle = "References";
        inReferences = true;
      }
      buffer.push(text);
      continue;
    }

    if (block.type === "caption") {
      buffer.push(`<em>${text}</em>`);
      continue;
    }

    if (block.type === "table") {
      const matrix = tableLinesToMatrix([text]);
      buffer.push(matrixToHtml(matrix));
      continue;
    }

    buffer.push(text);
  }

  flush();
  return sections;
}

export function parseRawDocument(raw: RawParsedDocument): ParsedManuscript {
  const diagnostics = [...(raw.diagnostics || [])];
  const fileTitle = raw.fileTitle || "Imported Manuscript";
  const normalizedBlocks = raw.format === "pdf" ? normalizePdfBlocks(raw.blocks) : [];
  const incomingFigures = raw.figures || [];
  const incomingTables = raw.tables || [];
  const incomingLinks = raw.links || [];

  // Image files are embedded directly as a figure section
  if (raw.format === "image" && raw.imageDataUrl) {
    const imgHtml = `<p><img src="${raw.imageDataUrl}" alt="${fileTitle}" style="max-width:100%" /></p>`;
    return {
      fileTitle,
      sections: [
        {
          title: "Figure",
          content: imgHtml,
          order: 0,
          wordCount: 0,
          sourceTitle: "Figure",
        },
      ],
      citations: [],
      diagnostics,
      totalWordCount: 0,
    };
  }

  const sectionsFromHtml = raw.html ? parseSectionsFromHtml(raw.html) : [];
  const sectionsFromText = raw.text ? parseSectionsFromText(raw.text) : [];
  const sectionsFromBlocks = normalizedBlocks.length > 0 ? buildSectionsFromBlocks(normalizedBlocks) : [];
  
  let baseSections = sectionsFromHtml.length > 0
    ? sectionsFromHtml
    : sectionsFromBlocks.length > 0
      ? sectionsFromBlocks
      : sectionsFromText;

  if (raw.format === "docx" && baseSections.length > 0) {
    baseSections = promoteDocxFrontMatter(baseSections);
    baseSections = foldStructuredAbstractSections(baseSections);
  }

  // High-confidence threshold: ≥3 sections with canonical titles, none titled "Content" exclusively.
  // Below this threshold the LLM result is preferred when available.
  const canonicalNames = CANONICAL_SECTION_NAMES;
  const canonicalCount = baseSections.filter(
    (s) => canonicalNames.has(s.title.trim().toLowerCase()),
  ).length;
  const deterministicProducedSections = canonicalCount >= 3;

  if (!deterministicProducedSections && raw.llmParsed && raw.llmParsed.sections.length > 0) {
    baseSections = raw.llmParsed.sections.map((sec) => ({
      title: sec.title,
      content: ensureParagraph(sec.content),
    }));
  }

  if (baseSections.length === 0) {
    diagnostics.push({
      level: "warning",
      code: "NO_SECTIONS_DETECTED",
      message: "No section headings were detected. Imported content was added as a single section.",
    });
  }

  const canonicalSections = mergeIntoCanonicalOrder(
    baseSections.length > 0 ? baseSections : [{ title: "Content", content: "<p></p>" }],
    fileTitle,
  );

  if (raw.references && raw.references.length > 0) {
    const refsHtml = `<ol>${raw.references.map((line) => `<li>${line}</li>`).join("")}</ol>`;
    const existingRef = canonicalSections.find((section) => section.title === "References");
    if (existingRef) {
      existingRef.content = refsHtml;
    } else {
      canonicalSections.push({ title: "References", content: refsHtml });
    }
  }

  const docxFigureCaptions =
    raw.format === "docx"
      ? canonicalSections.flatMap((section) =>
          section.title === "References" ? [] : extractFigureCaptionsFromContent(section.content),
        )
      : [];

  if (docxFigureCaptions.length > 0 && incomingFigures.length === 0) {
    const figuresHtml = docxFigureCaptions
      .map((caption, index) => {
        const imageData = createPlaceholderImageData(caption || `Figure ${index + 1}`);
        return `<figure><img src="${imageData}" alt="${caption}" style="max-width:100%" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
      })
      .join("");

    const existingFigures = canonicalSections.find((section) => section.title === "Figures and Tables");
    if (existingFigures) {
      existingFigures.content = `${existingFigures.content}${figuresHtml}`;
    } else {
      canonicalSections.push({ title: "Figures and Tables", content: figuresHtml });
    }
  }

  const referencesSection = canonicalSections.find((section) => section.title === "References");
  const referencesLines = referencesSection
    ? extractReferenceLines(referencesSection.content)
    : normalizedBlocks
      .filter((block) => block.type === "reference")
      .map((block) => block.text);

  // Prefer deterministic citation extraction; fall back to LLM only when regex found nothing.
  const deterministicCitations = dedupeCitations(parseCitationsFromReferences(referencesLines));
  const citations =
    deterministicCitations.length > 0
      ? deterministicCitations
      : raw.llmParsed && raw.llmParsed.citations.length > 0
        ? dedupeCitations(
            raw.llmParsed.citations.map((c) => ({
              ...c,
              type: (c.journal ? "article" : c.url ? "website" : "conference") as ParsedCitation["type"],
              metadata: { source: "llm" },
            })),
          )
        : [];

  const inferredFiguresFromCaptions: ParsedFigure[] = normalizedBlocks
    .filter((block) => block.type === "caption" && /^(fig(?:ure)?\.?\s*\d+|diagram\s*\d+)/i.test(block.text))
    .map((block, index) => ({
      id: `fig-${index + 1}`,
      imageData: createPlaceholderImageData(block.text || `Figure ${index + 1}`),
      caption: block.text,
      page: block.page,
      bbox: block.bbox,
      confidence: Math.max(0.55, Math.min(0.95, block.confidence)),
      diagnostics: [
        {
          level: "warning",
          code: "FIGURE_PLACEHOLDER_RENDERED",
          message: "Figure detected by caption; source image extraction needs confirmation.",
        },
        ...(block.diagnostics || []),
      ],
    }));

  const inferredTablesFromBlocks: ParsedTable[] = normalizedBlocks
    .filter((block) => block.type === "table")
    .map((block, index) => {
      const matrix = tableLinesToMatrix([block.text]);
      const diagnosticsForTable = matrix.length <= 1
        ? [
            {
              level: "warning" as const,
              code: "TABLE_GRID_UNCERTAIN",
              message: "Table structure may be incomplete and requires review.",
            },
          ]
        : [];
      return {
        id: `tbl-${index + 1}`,
        html: matrixToHtml(matrix),
        matrix,
        page: block.page,
        bbox: block.bbox,
        caption: undefined,
        confidence: Math.max(0.5, Math.min(0.95, block.confidence)),
        diagnostics: [...diagnosticsForTable, ...(block.diagnostics || [])],
      };
    });

  const inferredFiguresFromDocx = raw.format === "docx"
    ? docxFigureCaptions.map((caption, index) => ({
        id: `docx-fig-${index + 1}`,
        imageData: createPlaceholderImageData(caption || `Figure ${index + 1}`),
        caption,
        page: 1,
        confidence: 0.92,
        diagnostics: [],
      }))
    : [];

  const parsedFigures =
    incomingFigures.length > 0
      ? incomingFigures.map((figure, index) => ({
          ...figure,
          caption: figure.caption || docxFigureCaptions[index],
        }))
      : inferredFiguresFromCaptions.length > 0
        ? inferredFiguresFromCaptions
        : inferredFiguresFromDocx;
  const parsedTables = incomingTables.length > 0 ? incomingTables : inferredTablesFromBlocks;

  if (parsedFigures.length > 0) {
    const figuresHtml = parsedFigures
      .map((figure, index) => {
        const caption = figure.caption || docxFigureCaptions[index] || "";
        return `<figure><img src="${figure.imageData}" alt="${caption || `Figure ${index + 1}`}" style="max-width:100%" />${caption ? `<figcaption>${caption}</figcaption>` : ""}</figure>`;
      })
      .join("");

    const existingFigures = canonicalSections.find((section) => section.title === "Figures and Tables");
    if (existingFigures) {
      existingFigures.content = figuresHtml;
    } else {
      canonicalSections.push({ title: "Figures and Tables", content: figuresHtml });
    }
  }

  const sections: ParsedSection[] = canonicalSections.map((section, index) => ({
    title: section.title,
    content: ensureParagraph(section.content),
    order: index,
    wordCount: countWordsFromHtml(section.content),
    sourceTitle: section.title,
  }));

  const captionLinks: ParsedLink[] = [];
  const captionBlocks = normalizedBlocks.filter((block) => block.type === "caption");
  for (const caption of captionBlocks) {
    const captionText = caption.text || "";
    const figureMatch = captionText.match(/^(fig(?:ure)?\.?\s*(\d+)|diagram\s*(\d+))/i);
    if (figureMatch) {
      const figureIndex = Number(figureMatch[2] || figureMatch[3] || 1);
      const target = parsedFigures[figureIndex - 1];
      if (target) {
        target.caption = target.caption || captionText;
        captionLinks.push({
          id: `link-caption-fig-${caption.id}`,
          sourceId: caption.id,
          targetId: target.id,
          relation: "caption_to_figure",
          confidence: 0.75,
          diagnostics: [],
        });
      }
    }
    const tableMatch = captionText.match(/^table\s*(\d+)/i);
    if (tableMatch) {
      const tableIndex = Number(tableMatch[1] || 1);
      const target = parsedTables[tableIndex - 1];
      if (target) {
        target.caption = target.caption || captionText;
        captionLinks.push({
          id: `link-caption-table-${caption.id}`,
          sourceId: caption.id,
          targetId: target.id,
          relation: "caption_to_table",
          confidence: 0.75,
          diagnostics: [],
        });
      }
    }
  }

  const hasWarnings = diagnostics.some((item) => isReviewBlockingDiagnostic(item, raw.format));
  const hasLowConfidenceFigures = parsedFigures.some((figure) => figure.confidence < 0.9);
  const hasLowConfidenceTables = parsedTables.some((table) => table.confidence < 0.9);
  const needsReview =
    raw.format === "image" ||
    hasWarnings ||
    hasLowConfidenceFigures ||
    hasLowConfidenceTables ||
    normalizedBlocks.some((block) => block.confidence < 0.9 || block.diagnostics.length > 0);

  return {
    fileTitle,
    sections,
    citations,
    diagnostics,
    totalWordCount: sections.reduce((sum, section) => sum + section.wordCount, 0),
    reviewRequired: needsReview,
    blocks: normalizedBlocks,
    figures: parsedFigures,
    tables: parsedTables,
    links: [...incomingLinks, ...captionLinks],
  };
}
