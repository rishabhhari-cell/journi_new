import { countWordsFromHtml } from "./word-count";

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
];

const CANONICAL_ALIASES: Array<[string, RegExp]> = [
  ["Title", /^(title|title page)$/i],
  ["Abstract", /^(abstract|summary)$/i],
  ["Introduction", /^(introduction|background)$/i],
  ["Search Strategy", /^(search strategy|sources of data|method|methods|methodology)$/i],
  ["Results & Synthesis", /^(results|results and synthesis|results & synthesis|benefits|findings)$/i],
  ["Discussion", /^(discussion|drawbacks|analysis)$/i],
  ["Limitations", /^(limitations|constraints)$/i],
  ["Conclusions", /^(conclusion|conclusions|final remarks)$/i],
  ["References", /^(references|bibliography)$/i],
];

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

    const doiMatch = raw.match(/\b10\.\d{4,9}\/[-._;()/:A-Za-z0-9]+\b/);
    const urlMatch = raw.match(/https?:\/\/[^\s)]+/i);
    const yearMatch = raw.match(/\b(19|20)\d{2}\b/);
    const sentenceParts = raw.split(".").map((part) => part.trim()).filter(Boolean);

    let title = sentenceParts.length > 1 ? sentenceParts[1] : sentenceParts[0];
    if (!title) title = raw;
    const authorPart = sentenceParts[0] || "";
    const authors = authorPart
      .split(/,| and /i)
      .map((name) => name.trim())
      .filter(Boolean)
      .slice(0, 5);
    const journal = sentenceParts.length > 2 ? sentenceParts[2] : undefined;

    citations.push({
      authors: authors.length > 0 ? authors : ["Unknown"],
      title,
      year: yearMatch ? Number(yearMatch[0]) : new Date().getFullYear(),
      journal,
      doi: doiMatch ? doiMatch[0] : undefined,
      url: urlMatch ? urlMatch[0] : undefined,
      type: journal ? "article" : urlMatch ? "website" : "conference",
      metadata: { raw },
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

  // Only treat as heading if text matches a known canonical section name or looks like ALL-CAPS heading
  for (const [, matcher] of CANONICAL_ALIASES) {
    if (matcher.test(text)) return true;
  }
  return /^[A-Z][A-Z\s&/\-0-9]{2,}$/.test(text);
}

function parseSectionsFromHtml(html: string): IntermediateSection[] {
  if (typeof DOMParser === "undefined") return [];
  const parser = new DOMParser();
  const doc = parser.parseFromString(`<div id="root">${html}</div>`, "text/html");
  const root = doc.getElementById("root");
  if (!root) return [];

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
    const looksLikeHeading =
      normalized.length <= 80 &&
      (isKnownHeading || (/^[A-Z0-9\s&/-]+$/.test(trimmed) && trimmed.length > 2));

    if (looksLikeHeading) {
      flush();
      currentTitle = toTitleCase(normalized);
      continue;
    }

    buffer.push(trimmed);
  }

  flush();
  return sections;
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
  const normalized = normalizeHeading(text).toLowerCase();
  if (!normalized) return false;
  if (CANONICAL_ORDER.map((s) => s.toLowerCase()).includes(normalized)) return true;
  return /^[A-Z][A-Z0-9\s&/-]{2,}$/.test(text.trim());
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

    if (!inReferences && isLikelySectionHeading(text) && block.type !== "reference") {
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

  // OVERRIDE heuristics with LLM parsed data if present
  if (raw.llmParsed && raw.llmParsed.sections.length > 0) {
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

  const referencesSection = canonicalSections.find((section) => section.title === "References");
  const referencesLines = referencesSection
    ? extractReferenceLines(referencesSection.content)
    : normalizedBlocks
      .filter((block) => block.type === "reference")
      .map((block) => block.text);

  const citations = raw.llmParsed && raw.llmParsed.citations.length > 0
    ? dedupeCitations(raw.llmParsed.citations.map(c => ({
        ...c,
        type: c.journal ? "article" : c.url ? "website" : "conference",
        metadata: { source: "llm" }
      })))
    : dedupeCitations(parseCitationsFromReferences(referencesLines));

  const sections: ParsedSection[] = canonicalSections.map((section, index) => ({
    title: section.title,
    content: ensureParagraph(section.content),
    order: index,
    wordCount: countWordsFromHtml(section.content),
    sourceTitle: section.title,
  }));

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

  const parsedFigures = incomingFigures.length > 0 ? incomingFigures : inferredFiguresFromCaptions;
  const parsedTables = incomingTables.length > 0 ? incomingTables : inferredTablesFromBlocks;

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

  const hasWarnings = diagnostics.some((item) => item.level === "warning" || item.level === "error");
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
